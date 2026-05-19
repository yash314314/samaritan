import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import {
  getActivityProductivityScore,
  isIdleActivity
} from "./metricEngine";
export async function getDailyAnalytics(userId: string) {

  const now = new Date();

  const IST_OFFSET = 5.5 * 60 * 60 * 1000;

  const istNow = new Date(now.getTime() + IST_OFFSET);

  istNow.setHours(0,0,0,0);

  const startOfDay = new Date(istNow.getTime() - IST_OFFSET);

  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);

  const sessions = await prisma.session.findMany({
    where: {
      userId,
      startTime: {
        gte: startOfDay,
        lt: endOfDay
      }
    },
    include: {
      activities: true
    }
  });

  const totalSessions = sessions.length;

  let totalSwitches = 0;
  let totalIdle = 0;
  let totalFocusScore = 0;
  let totalBurnout = 0;
  let totalActiveSeconds = 0;
  let totalDeepWorkSeconds = 0;
  let deepWorkSessions = 0;
  let totalEntropy = 0;

  let productiveCount = 0;
  let distractingCount = 0;
  let neutralCount = 0;

  const appUsage: Record<string, number> = {};

  sessions.forEach(session => {

    const s = session as typeof session & {
      burnoutScore: number;
      isDeepWork: boolean;
      entropyScore: number;
    };

    totalSwitches += session.switchCount;
    totalIdle += session.idleTime;
    totalFocusScore += session.focusScore;
    totalBurnout += s.burnoutScore;

    if (s.isDeepWork) {

      deepWorkSessions++;

      if (session.endTime) {

        const duration =
        session.endTime.getTime() - session.startTime.getTime() / 1000;

        totalDeepWorkSeconds += duration;

      }

    }
totalEntropy += s.entropyScore;
    session.activities.forEach(activity => {

      const key = activity.appName;

      appUsage[key] = (appUsage[key] || 0) + 1;

      

      if (activity.category === "productive") productiveCount++;
      if (activity.category === "distracting") distractingCount++;
      if (activity.category === "neutral") neutralCount++;

    });

    if (session.endTime) {

      const duration =
      session.endTime.getTime() - session.startTime.getTime()/ 1000;

      totalActiveSeconds += duration;

    }

  });

  const averageFocus =
    totalSessions > 0 ? totalFocusScore / totalSessions : 0;

  const averageBurnout =
    totalSessions > 0 ? totalBurnout / totalSessions : 0;

  return {

    totalSessions,

    totalSwitches,

    totalIdleSeconds: totalIdle,

    totalActiveSeconds,

    averageFocusScore: Number(averageFocus.toFixed(2)),

    averageBurnoutScore: Number(averageBurnout.toFixed(2)),

    appUsage,

    productivityBreakdown: {
      productiveCount,
      distractingCount,
      neutralCount
    },

    averageEntropyScore:
      totalSessions > 0
        ? Number((totalEntropy / totalSessions).toFixed(2))
        : 0

  };

}
export async function getDeepWorkStreak(userId: string) {

  const sessions = await prisma.session.findMany({
    where: {
      userId,
      isDeepWork: true
    },
    orderBy: { startTime: "asc" }
  });

  if (sessions.length === 0) {
    return { currentStreak: 0, longestStreak: 0 };
  }

  const deepWorkDays = new Set<string>();

  sessions.forEach(session => {

    const d = session.startTime;

    const key =
      d.getFullYear() +
      "-" +
      String(d.getMonth()+1).padStart(2,"0") +
      "-" +
      String(d.getDate()).padStart(2,"0");

    deepWorkDays.add(key);

  });

  const sortedDays = Array.from(deepWorkDays).sort();

  let longestStreak = 0;
  let temp = 0;

  for (let i = 0; i < sortedDays.length; i++) {

    if (i === 0) {
      temp = 1;
    } else {

      const prev = new Date(sortedDays[i-1]);
      const curr = new Date(sortedDays[i]);

      const diff =
        (curr.getTime() - prev.getTime()) / (86400000);

      temp = diff === 1 ? temp + 1 : 1;

    }

    longestStreak = Math.max(longestStreak,temp);

  }

  /* current streak */

  const today = new Date();
  let streak = 0;
  let check = new Date(today);

  while(true){

    const key =
      check.getFullYear() +
      "-" +
      String(check.getMonth()+1).padStart(2,"0") +
      "-" +
      String(check.getDate()).padStart(2,"0");

    if(!deepWorkDays.has(key)) break;

    streak++;
    check.setDate(check.getDate()-1);

  }

  return {
    currentStreak: streak,
    longestStreak
  };

}
export async function getWeeklyAnalytics(userId: string) {

  const today = new Date();
  today.setHours(0,0,0,0);

  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - 6);

  const sessions = await prisma.session.findMany({
    where: {
      userId,
      startTime: { gte: startDate }
    }
  });

  const dailyMap: Record<string, any> = {};

  sessions.forEach(session => {

    const s = session as typeof session & {
      burnoutScore: number;
      entropyScore: number;
      isDeepWork: boolean;
    };

    const d = session.startTime;

    const dateKey =
      d.getFullYear() + "-" +
      String(d.getMonth()+1).padStart(2,"0") + "-" +
      String(d.getDate()).padStart(2,"0");

    if (!dailyMap[dateKey]) {
      dailyMap[dateKey] = {
        focusTotal: 0,
        burnoutTotal: 0,
        entropyTotal: 0,
        deepWorkSeconds: 0,
        sessionCount: 0
      };
    }

    dailyMap[dateKey].focusTotal += session.focusScore;
    dailyMap[dateKey].burnoutTotal += s.burnoutScore;
    dailyMap[dateKey].entropyTotal += s.entropyScore;
    dailyMap[dateKey].sessionCount++;

    if (s.isDeepWork && session.endTime) {

      const duration =
        (session.endTime.getTime() -
         session.startTime.getTime()) / 1000;

      dailyMap[dateKey].deepWorkSeconds += duration;

    }

  });

  const result = Object.entries(dailyMap).map(([date, data]) => ({

    date,

    averageFocus:
      data.focusTotal / data.sessionCount,

    averageBurnout:
      data.burnoutTotal / data.sessionCount,

    averageEntropy:
      data.entropyTotal / data.sessionCount,

    deepWorkSeconds: data.deepWorkSeconds

  }));

  return result;

}
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

function getISTBucket(date: Date) {
  const ist = new Date(date.getTime() + IST_OFFSET_MS);

  return {
    dateKey:
      ist.getUTCFullYear() +
      "-" +
      String(ist.getUTCMonth() + 1).padStart(2, "0") +
      "-" +
      String(ist.getUTCDate()).padStart(2, "0"),
    hour: ist.getUTCHours()
  };
}

function nextISTHourBoundary(date: Date) {
  const istMs = date.getTime() + IST_OFFSET_MS;
  const nextIstHour = Math.floor(istMs / HOUR_MS) * HOUR_MS + HOUR_MS;

  return new Date(nextIstHour - IST_OFFSET_MS);
}

export async function getHeatmap(userId: string) {
  const activities = await prisma.activity.findMany({
    where: {
      session: { userId },
      duration: { gt: 0 }
    },
    orderBy: { startTime: "asc" }
  });

  const heatmap: Record<
    string,
    Record<
      number,
      {
        totalProductivity: number;
        totalMs: number;
        idleMs: number;
        appDurations: Record<string, number>;
        categoryDurations: Record<string, number>;
        intentDurations: Record<string, number>;
      }
    >
  > = {};

  for (const activity of activities) {
    const score = getActivityProductivityScore(activity);

    let current = new Date(activity.startTime);
    const end =
      activity.endTime > activity.startTime
        ? new Date(activity.endTime)
        : new Date(activity.startTime.getTime() + activity.duration);

    while (current < end) {
      const boundary = nextISTHourBoundary(current);
      const segmentEnd = boundary < end ? boundary : end;
      const segmentMs = segmentEnd.getTime() - current.getTime();

      const { dateKey, hour } = getISTBucket(current);

      if (!heatmap[dateKey]) heatmap[dateKey] = {};
      if (!heatmap[dateKey][hour]) {
        heatmap[dateKey][hour] = {
          totalProductivity: 0,
          totalMs: 0,
          idleMs: 0,
          appDurations: {},
          categoryDurations: {},
          intentDurations: {}
        };
      }

      const bucket = heatmap[dateKey][hour];
      const appName = activity.appName ?? "Unknown";
      const category = activity.category ?? "unknown";
      const intent = activity.intent ?? "unknown";

      bucket.totalProductivity += score * segmentMs;
      bucket.totalMs += segmentMs;

      if (isIdleActivity(activity)) {
        bucket.idleMs += segmentMs;
      }

      bucket.appDurations[appName] =
        (bucket.appDurations[appName] || 0) + segmentMs;

      bucket.categoryDurations[category] =
        (bucket.categoryDurations[category] || 0) + segmentMs;

      bucket.intentDurations[intent] =
        (bucket.intentDurations[intent] || 0) + segmentMs;

      current = segmentEnd;
    }
  }

  const getDominantKey = (values: Record<string, number>) => {
    const [key] =
      Object.entries(values).sort((a, b) => b[1] - a[1])[0] ?? [];

    return key ?? null;
  };

  const getTopEntries = (values: Record<string, number>, totalMs: number) =>
    Object.entries(values)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, duration]) => ({
        name,
        duration,
        minutes: Number((duration / 60000).toFixed(1)),
        percentage:
          totalMs > 0
            ? Number(((duration / totalMs) * 100).toFixed(1))
            : 0
      }));

  const finalHeatmap: Record<string, Record<number, any>> = {};

  Object.entries(heatmap).forEach(([date, hours]) => {
    finalHeatmap[date] = {};

    Object.entries(hours).forEach(([hour, data]) => {
      const productivity =
        data.totalMs > 0
          ? Number((data.totalProductivity / data.totalMs).toFixed(2))
          : 0;

      finalHeatmap[date][Number(hour)] = {
        score: productivity,
        productivity,
        duration: data.totalMs,
        trackedMinutes: Number((data.totalMs / 60000).toFixed(1)),
        idleMinutes: Number((data.idleMs / 60000).toFixed(1)),
        dominantApp: getDominantKey(data.appDurations),
        dominantCategory: getDominantKey(data.categoryDurations),
        dominantIntent: getDominantKey(data.intentDurations),
        topApps: getTopEntries(data.appDurations, data.totalMs),
        categoryBreakdown: getTopEntries(
          data.categoryDurations,
          data.totalMs
        ),
        intentBreakdown: getTopEntries(data.intentDurations, data.totalMs)
      };
    });
  });

  return finalHeatmap;
}
