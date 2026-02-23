import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma";

export async function getDailyAnalytics(userId: string) {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  const sessions = await prisma.session.findMany({
    where: {
      userId,
      startTime: {
        gte: startOfDay,
        lte: endOfDay
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
    const s = session as typeof session & { burnoutScore: number; isDeepWork: boolean; entropyScore: number };
    totalSwitches += session.switchCount;
    totalIdle += session.idleTime;
    totalFocusScore += session.focusScore;
    totalBurnout += s.burnoutScore;
    if (s.isDeepWork) {
        deepWorkSessions++;
      
        if (session.endTime) {
          const duration =
            (new Date(session.endTime).getTime() -
              new Date(session.startTime).getTime()) /
            1000;
      
          totalDeepWorkSeconds += duration;
        }
      }
      
    session.activities.forEach(activity => {
      const key = activity.appName;
      appUsage[key] = (appUsage[key] || 0) + 1;
      totalEntropy += s.entropyScore;

      if (activity.category === "productive") productiveCount++;
      if (activity.category === "distracting") distractingCount++;
      if (activity.category === "neutral") neutralCount++;
    });

    if (session.endTime) {
      const duration =
        (new Date(session.endTime).getTime() -
          new Date(session.startTime).getTime()) /
        1000;

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
    : 0,

  };
}
export async function getDeepWorkStreak(userId: string) {
    const sessions = await prisma.session.findMany({
      where: {
        userId,
        isDeepWork: true
      } as Prisma.SessionWhereInput,
      orderBy: {
        startTime: "asc"
      }
    });
  
    if (sessions.length === 0) {
      return {
        currentStreak: 0,
        longestStreak: 0
      };
    }
  
    // Group sessions by date
    const deepWorkDays = new Set<string>();
  
    sessions.forEach(session => {
      const date = new Date(session.startTime);
      const key = date.toISOString().split("T")[0];
      deepWorkDays.add(key);
    });
  
    const sortedDays = Array.from(deepWorkDays).sort();
  
    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;
  
    for (let i = 0; i < sortedDays.length; i++) {
      if (i === 0) {
        tempStreak = 1;
      } else {
        const prev = new Date(sortedDays[i - 1]);
        const curr = new Date(sortedDays[i]);
  
        const diff =
          (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
  
        if (diff === 1) {
          tempStreak++;
        } else {
          tempStreak = 1;
        }
      }
  
      longestStreak = Math.max(longestStreak, tempStreak);
    }
  
    // Compute current streak (from today backwards)
    const today = new Date().toISOString().split("T")[0];
    let streakCheckDate = new Date(today);
    let streak = 0;
  
    while (deepWorkDays.has(streakCheckDate.toISOString().split("T")[0])) {
      streak++;
      streakCheckDate.setDate(streakCheckDate.getDate() - 1);
    }
  
    currentStreak = streak;
  
    return {
      currentStreak,
      longestStreak
    };
  }
  export async function getWeeklyAnalytics(userId: string) {
    const today = new Date();
    const startDate = new Date();
    startDate.setDate(today.getDate() - 6);
    startDate.setHours(0, 0, 0, 0);
  
    const sessions = await prisma.session.findMany({
      where: {
        userId,
        startTime: { gte: startDate }
      }
    });
  
    const dailyMap: Record<string, any> = {};
  
    sessions.forEach(session => {
      const s = session as typeof session & { burnoutScore: number; entropyScore: number; isDeepWork: boolean };
      const dateKey = new Date(session.startTime)
        .toISOString()
        .split("T")[0];
  
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
          (new Date(session.endTime).getTime() -
            new Date(session.startTime).getTime()) / 1000;
  
        dailyMap[dateKey].deepWorkSeconds += duration;
      }
    });
  
    const result = Object.entries(dailyMap).map(([date, data]) => ({
      date,
      averageFocus: data.focusTotal / data.sessionCount,
      averageBurnout: data.burnoutTotal / data.sessionCount,
      averageEntropy: data.entropyTotal / data.sessionCount,
      deepWorkSeconds: data.deepWorkSeconds
    }));
  
    return result;
  }
  export async function getHeatmap(userId: string) {
    const sessions = await prisma.session.findMany({
      where: {
        userId,
        endTime: { not: null }
      }
    });
  
    const heatmap: Record<string, Record<number, { totalFocus: number; totalSeconds: number }>> = {};
  
    sessions.forEach(session => {
      const start = new Date(session.startTime);
      const end = new Date(session.endTime!);
  
      let current = new Date(start);
  
      while (current < end) {
        const hour = current.getHours();
        const dateKey = current.toISOString().split("T")[0];
  
        // Calculate end of this hour
        const hourEnd = new Date(current);
        hourEnd.setMinutes(59, 59, 999);
  
        const segmentEnd = hourEnd < end ? hourEnd : end;
  
        const segmentSeconds =
          (segmentEnd.getTime() - current.getTime()) / 1000;
  
        if (!heatmap[dateKey]) {
          heatmap[dateKey] = {};
        }
  
        if (!heatmap[dateKey][hour]) {
          heatmap[dateKey][hour] = {
            totalFocus: 0,
            totalSeconds: 0
          };
        }
  
        heatmap[dateKey][hour].totalFocus +=
          session.focusScore * segmentSeconds;
  
        heatmap[dateKey][hour].totalSeconds += segmentSeconds;
  
        current = new Date(segmentEnd.getTime() + 1);
      }
    });
  
    // Normalize final values
    const finalHeatmap: Record<string, Record<number, number>> = {};
  
    Object.entries(heatmap).forEach(([date, hours]) => {
      finalHeatmap[date] = {};
  
      Object.entries(hours).forEach(([hour, data]) => {
        const avgFocus =
          data.totalSeconds > 0
            ? data.totalFocus / data.totalSeconds
            : 0;
  
        finalHeatmap[date][Number(hour)] = Number(
          avgFocus.toFixed(2)
        );
      });
    });
  
    return finalHeatmap;
  }
  