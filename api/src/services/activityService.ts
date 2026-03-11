import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { getOrCreateActiveSession } from "./sessionService";

const IDLE_THRESHOLD_MS = 60 * 1000; // 1 minute (for testing)

import { classifyContext } from "./contextClassifier";

export async function handleActivity(
  userId: string,
  appName: string,
  windowTitle: string,
  startTime: Date,
  endTime: Date,
  duration: number,
  type: string
) {
  const session = await getOrCreateActiveSession(userId);

  //const classification = await classifyContext(appName, windowTitle);

  const activity = await prisma.activity.create({
    data: {
      sessionId: session.id,
      appName,
      windowTitle,
      startTime,
      endTime,
      duration,
      type,
  
      category: "unknown",
      intent: "unknown",
      focusImpact: 0.5,
      energyImpact: 0,
      confidence: 0
    }
  });
  await recalculateSessionMetrics(session.id);

  return activity;
}
export async function recalculateSessionMetrics(sessionId: string) {

  const activities = await prisma.activity.findMany({
    where: { sessionId },
    orderBy: { startTime: "asc" }
  });

  if (activities.length === 0) return;

  const session = await prisma.session.findUnique({
    where: { id: sessionId }
  });

  if (!session) return;

  const totalDuration = activities.reduce(
    (sum, a) => sum + a.duration,
    0
  );

  if (totalDuration === 0) return;

  // -----------------------------
  // 1️⃣ Focus Score
  // -----------------------------

  const weightedFocus =
    activities.reduce(
      (sum, a) =>
        sum + (a.focusImpact ?? 0.5) * a.duration,
      0
    ) / totalDuration;

  const focusScore = weightedFocus * 100;

  // -----------------------------
  // 2️⃣ Deep Work Score
  // -----------------------------

  const deepWorkDuration = activities
    .filter(a => a.category === "deep_work")
    .reduce((sum, a) => sum + a.duration, 0);

  const deepWorkScore =
    (deepWorkDuration / totalDuration) * 100;

  // -----------------------------
  // 3️⃣ Context Switch Count
  // -----------------------------

  let switchCount = 0;

  for (let i = 1; i < activities.length; i++) {

    const prev = activities[i - 1];
    const curr = activities[i];

    const switched =
      prev.appName !== curr.appName ||
      prev.windowTitle !== curr.windowTitle;

    if (switched) switchCount++;

  }

  // -----------------------------
  // 4️⃣ Entropy Score
  // -----------------------------

  const appCounts: Record<string, number> = {};

  activities.forEach(a => {
    appCounts[a.appName] =
      (appCounts[a.appName] || 0) + 1;
  });

  const total = activities.length;

  let entropy = 0;

  Object.values(appCounts).forEach(count => {

    const p = count / total;

    entropy -= p * Math.log2(p);

  });

  const maxEntropy =
    Math.log2(Object.keys(appCounts).length || 1);

  const entropyScore =
    maxEntropy > 0
      ? (entropy / maxEntropy) * 100
      : 0;

  // -----------------------------
  // 5️⃣ Burnout Score
  // -----------------------------

  const sessionDurationSeconds =
    totalDuration / 1000;

  const communicationDuration = activities
    .filter(a => a.category === "communication")
    .reduce((sum, a) => sum + a.duration, 0);

  const communicationRatio =
    communicationDuration / totalDuration;

  const durationFactor =
    sessionDurationSeconds / 14400; // 4h

  const switchFactor =
    switchCount / 50;

  const entropyFactor =
    entropyScore / 100;

  let burnoutScore =
    (durationFactor +
      switchFactor +
      entropyFactor +
      communicationRatio) *
    25;

  burnoutScore =
    Math.min(100, Math.max(0, burnoutScore));

  // -----------------------------
  // Update Session
  // -----------------------------

  await prisma.session.update({
    where: { id: sessionId },
    data: {
      focusScore,
      deepWorkScore,
      burnoutScore,
      entropyScore,
      switchCount
    }
  });

}
function compressTimeline(activities: any[]) {

  if (activities.length === 0) return [];

  const timeline = [];

  let current = {
    app: activities[0].appName,
    title: activities[0].windowTitle,
    category: activities[0].category,
    start: activities[0].startTime,
    end: activities[0].endTime,
    duration: activities[0].duration
  };

  for (let i = 1; i < activities.length; i++) {

    const a = activities[i];

    const sameContext =
      a.appName === current.app &&
      a.windowTitle === current.title;

    if (sameContext) {
      current.end = a.endTime;
      current.duration += a.duration;
    } else {

      timeline.push(current);

      current = {
        app: a.appName,
        title: a.windowTitle,
        category: a.category,
        start: a.startTime,
        end: a.endTime,
        duration: a.duration
      };

    }
  }

  timeline.push(current);

  return timeline;
}
export async function getTimeline(userId: string, date: string) {

  const start = new Date(date);
  const end = new Date(date);
  end.setDate(end.getDate() + 1);

  const activities = await prisma.activity.findMany({
    where: {
      session: { userId },
      startTime: {
        gte: start,
        lt: end
      }
    },
    orderBy: { startTime: "asc" }
  });

  return compressTimeline(activities);
}
export async function getFocusBlocks(userId: string, date: string) {

  const start = new Date(date);
  const end = new Date(date);
  end.setDate(end.getDate() + 1);

  const activities = await prisma.activity.findMany({
    where: {
      session: { userId },
      startTime: {
        gte: start,
        lt: end
      }
    },
    orderBy: { startTime: "asc" }
  });

  return detectFocusBlocks(activities);

}
function detectFocusBlocks(activities: any[]) {

  const MIN_BLOCK_DURATION = 10 * 60 * 1000; // 10 minutes

  const blocks: any[] = [];

  let currentBlock: any = null;

  for (const activity of activities) {

    const isDeepWork = activity.category === "deep_work";

    if (!isDeepWork) {

      if (currentBlock) {
        finalizeBlock(currentBlock, blocks, MIN_BLOCK_DURATION);
        currentBlock = null;
      }

      continue;
    }

    if (!currentBlock) {

      currentBlock = {
        start: activity.startTime,
        end: activity.endTime,
        duration: activity.duration
      };

    } else {

      currentBlock.end = activity.endTime;
      currentBlock.duration += activity.duration;

    }

  }

  if (currentBlock) {
    finalizeBlock(currentBlock, blocks, MIN_BLOCK_DURATION);
  }

  return blocks;

}
function finalizeBlock(block: any, blocks: any[], minDuration: number) {

  if (block.duration >= minDuration) {

    blocks.push({
      start: block.start,
      end: block.end,
      duration: block.duration
    });

  }

}