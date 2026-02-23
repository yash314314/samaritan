import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { getOrCreateActiveSession } from "./sessionService";

const IDLE_THRESHOLD_MS = 60 * 1000; // 1 minute (for testing)

export async function handleActivity(userId: string, appName: string, windowTitle: string) {
  const session = await getOrCreateActiveSession(userId);

  // Get last activity
  const lastActivity = await prisma.activity.findFirst({
    where: { sessionId: session.id },
    orderBy: { timestamp: "desc" }
  });

  let isSwitch = false;
  let idleSecondsToAdd = 0;
  
  if (lastActivity) {
    const lastTime = new Date(lastActivity.timestamp).getTime();
    const now = Date.now();
    const diff = now - lastTime;
  
    // Context switch detection
    if (lastActivity.appName !== appName) {
      isSwitch = true;
    }
    if (idleSecondsToAdd > 0) {
      await prisma.session.update({
        where: { id: session.id },
        data: {
          idleTime: { increment: idleSecondsToAdd }
        }
      });
    }
    // Idle detection
    if (diff > IDLE_THRESHOLD_MS) {
      idleSecondsToAdd = Math.floor(diff / 1000);
    }
  }
  const categoryRecord = await prisma.appCategory.findUnique({
    where: { appName }
  });
  
  const category = categoryRecord ? categoryRecord.category : "neutral";
  
  // Create activity
  const activity = await prisma.activity.create({
    data: {
      sessionId: session.id,
      appName,
      windowTitle,
      category
    }
  });  

  // Increment switch count if needed
  if (isSwitch) {
    await prisma.session.update({
      where: { id: session.id },
      data: {
        switchCount: { increment: 1 }
      }
    });
  }

  // Recalculate focus score
  const totalActivities = await prisma.activity.count({
    where: { sessionId: session.id }
  });

  const updatedSession = await prisma.session.findUnique({
    where: { id: session.id }
  });

  if (updatedSession) {
    const idlePenalty = updatedSession.idleTime / 300; 

    const focusScore =
      totalActivities > 0
        ? (1 - updatedSession.switchCount / totalActivities) * 100 - idlePenalty
        : 100;
        
    // Burnout calculation
    const sessionDurationSeconds = updatedSession.endTime
      ? (new Date(updatedSession.endTime).getTime() -
          new Date(updatedSession.startTime).getTime()) /
        1000
      : (Date.now() - new Date(updatedSession.startTime).getTime()) / 1000;

    const distractingCount = await prisma.activity.count({
      where: {
        sessionId: session.id,
        category: "distracting"
      }
    });

    const distractionRatio =
      totalActivities > 0 ? distractingCount / totalActivities : 0;

    const durationFactor = sessionDurationSeconds / 14400; // 4 hrs = high
    const switchFactor = updatedSession.switchCount / 50;
    const idleFactor = updatedSession.idleTime / 1800;
    const focusPenalty = (100 - focusScore) / 100;

    let burnoutScore =
      (durationFactor +
        switchFactor +
        idleFactor +
        distractionRatio +
        focusPenalty) *
      20;

    burnoutScore = Math.min(100, Math.max(0, burnoutScore));

    await prisma.session.update({
      where: { id: session.id },
      data: { focusScore, burnoutScore } as Prisma.SessionUpdateInput
    });
// Deep Work Calculation

const MIN_DEEP_WORK_SECONDS = 25 * 60; // 25 minutes

const durationSeconds = sessionDurationSeconds;

const distractingCountForDeep = await prisma.activity.count({
  where: {
    sessionId: session.id,
    category: "distracting"
  }
});

const distractionRatioDeep =
  totalActivities > 0 ? distractingCountForDeep / totalActivities : 0;

// Normalize factors
const durationFactorDeep = durationSeconds / 3600; // 1 hr ideal
const switchFactorDeep = 1 - updatedSession.switchCount / 30;
const idleFactorDeep = 1 - updatedSession.idleTime / 600;
const focusFactorDeep = updatedSession.focusScore / 100;
const distractionFactorDeep = 1 - distractionRatioDeep;

// Weighted score
let deepWorkScore =
  (durationFactorDeep * 0.3 +
    switchFactorDeep * 0.2 +
    idleFactorDeep * 0.2 +
    focusFactorDeep * 0.2 +
    distractionFactorDeep * 0.1) *
  100;

// Clamp 0–100
deepWorkScore = Math.min(100, Math.max(0, deepWorkScore));

const isDeepWork =
  durationSeconds >= MIN_DEEP_WORK_SECONDS &&
  deepWorkScore >= 60;

await prisma.session.update({
  where: { id: session.id },
  data: {
    deepWorkScore,
    isDeepWork
  } as Prisma.SessionUpdateInput
});

    // Entropy Calculation

const activities = await prisma.activity.findMany({
  where: { sessionId: session.id }
});

// Count frequency per app
const appCounts: Record<string, number> = {};

activities.forEach(a => {
  appCounts[a.appName] = (appCounts[a.appName] || 0) + 1;
});

const total = activities.length;

let entropy = 0;

Object.values(appCounts).forEach(count => {
  const p = count / total;
  entropy -= p * Math.log2(p);
});

// Normalize entropy
// Max entropy occurs when distribution is uniform
const maxEntropy = Math.log2(Object.keys(appCounts).length || 1);

let normalizedEntropy =
  maxEntropy > 0 ? (entropy / maxEntropy) * 100 : 0;

normalizedEntropy = Math.min(100, Math.max(0, normalizedEntropy));

await prisma.session.update({
  where: { id: session.id },
  data: { entropyScore: normalizedEntropy } as Prisma.SessionUpdateInput
});

  }

  return activity;
}
