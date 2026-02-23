import { prisma } from "../prisma";

const SESSION_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export async function getOrCreateActiveSession(userId: string) {
  const now = new Date();

  let session = await prisma.session.findFirst({
    where: {
      userId,
      endTime: null
    },
    include: {
      activities: {
        orderBy: { timestamp: "desc" },
        take: 1
      }
    }
  });

  // No active session → create new
  if (!session) {
    return prisma.session.create({
      data: { userId }
    });
  }

  // If session exists, check last activity time
  const lastActivity = session.activities[0];

  if (lastActivity) {
    const diff = now.getTime() - new Date(lastActivity.timestamp).getTime();

    if (diff > SESSION_TIMEOUT_MS) {
      // Close old session
      await prisma.session.update({
        where: { id: session.id },
        data: { endTime: now }
      });

      // Create new session
      return prisma.session.create({
        data: { userId }
      });
    }
  }

  return session;
}
