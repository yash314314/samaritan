import { prisma } from "../prisma";
import { recalculateSessionMetrics } from "./activityService"
const SESSION_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const MAX_SESSION_DURATION = 2 * 60 * 60 * 1000;

export async function getOrCreateActiveSession(userId: string) {

  const now = new Date();

  let session = await prisma.session.findFirst({
    where: {
      userId,
      endTime: null
    },
    orderBy: { startTime: "desc" }
  });

  if (!session) {
    return prisma.session.create({ data: { userId } });
  }

  const lastActivity = await prisma.activity.findFirst({
    where: { sessionId: session.id },
    orderBy: { startTime: "desc" }
  });

  const sessionAge =
    now.getTime() - new Date(session.startTime).getTime();

  const inactivity =
    lastActivity
      ? now.getTime() - new Date(lastActivity.startTime).getTime()
      : 0;

  if (
    sessionAge > MAX_SESSION_DURATION ||
    inactivity > SESSION_TIMEOUT_MS
  ) {

    await prisma.session.update({
      where: { id: session.id },
      data: { endTime: now }
    });

    return prisma.session.create({
      data: { userId }
    });
  }

  return session;
}
import { classifyContext } from "./contextClassifier";
export async function createActivityFromTracker(data: {
  userId: string
  app: string
  title: string
  startTime: Date
  endTime: Date
  duration: number
  type: string
}) {

  const session = await getOrCreateActiveSession(data.userId)

  const activity = await prisma.activity.create({
    data: {
      sessionId: session.id,
      appName: data.app,
      windowTitle: data.title,
      startTime: data.startTime,
      endTime: data.endTime,
      duration: data.duration,
      type: data.type
    }
  })

  // 🔴 THIS WAS MISSING
  await recalculateSessionMetrics(session.id)

  return activity
}