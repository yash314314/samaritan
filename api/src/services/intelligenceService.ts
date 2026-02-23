import { prisma } from "../prisma";

export async function detectIntraDayDrift(userId: string) {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const sessions = await prisma.session.findMany({
    where: {
      userId,
      startTime: { gte: startOfDay }
    },
    orderBy: { startTime: "asc" }
  });

  if (sessions.length < 2) {
    return { driftScore: 0 };
  }

  let declineCount = 0;
  let entropyRiseCount = 0;

  for (let i = 1; i < sessions.length; i++) {
    if (sessions[i].focusScore < sessions[i - 1].focusScore) {
      declineCount++;
    }

    const prev = sessions[i - 1] as typeof sessions[0] & { entropyScore: number };
    const curr = sessions[i] as typeof sessions[0] & { entropyScore: number };
    if (curr.entropyScore > prev.entropyScore) {
      entropyRiseCount++;
    }
  }

  const driftScore =
    ((declineCount + entropyRiseCount) /
      ((sessions.length - 1) * 2)) *
    100;

  return {
    driftScore: Number(driftScore.toFixed(2)),
    sessionCount: sessions.length
  };
}
export async function detectInterDayDrift(userId: string) {
    const sessions = await prisma.session.findMany({
      where: { userId },
      orderBy: { startTime: "asc" }
    });
  
    const dailyFocus: Record<string, number[]> = {};
  
    sessions.forEach(session => {
      const date = new Date(session.startTime)
        .toISOString()
        .split("T")[0];
  
      if (!dailyFocus[date]) dailyFocus[date] = [];
      dailyFocus[date].push(session.focusScore);
    });
  
    const dailyAverages = Object.values(dailyFocus).map(
      scores =>
        scores.reduce((a, b) => a + b, 0) / scores.length
    );
  
    let declineDays = 0;
  
    for (let i = 1; i < dailyAverages.length; i++) {
      if (dailyAverages[i] < dailyAverages[i - 1]) {
        declineDays++;
      }
    }
  
    const driftPercentage =
      dailyAverages.length > 1
        ? (declineDays / (dailyAverages.length - 1)) * 100
        : 0;
  
    return {
      interDayDrift: Number(driftPercentage.toFixed(2))
    };
  }
  export async function detectEntropyTrend(userId: string) {
    const sessions = await prisma.session.findMany({
      where: { userId },
      orderBy: { startTime: "asc" }
    });
  
    if (sessions.length < 2) {
      return { entropyTrend: 0 };
    }
  
    let increases = 0;
  
    for (let i = 1; i < sessions.length; i++) {
      const prev = sessions[i - 1] as typeof sessions[0] & { entropyScore: number };
      const curr = sessions[i] as typeof sessions[0] & { entropyScore: number };
      if (curr.entropyScore > prev.entropyScore) {
        increases++;
      }
    }
  
    const entropyTrend =
      (increases / (sessions.length - 1)) * 100;
  
    return {
      entropyTrend: Number(entropyTrend.toFixed(2))
    };
  }
  export async function getPeakFocusWindow(userId: string) {
    const sessions = await prisma.session.findMany({
      where: { userId }
    });
  
    const hourMap: Record<number, { total: number; count: number }> = {};
  
    sessions.forEach(session => {
      const hour = new Date(session.startTime).getHours();
  
      if (!hourMap[hour]) {
        hourMap[hour] = { total: 0, count: 0 };
      }
  
      // weight by session duration
      const duration = session.endTime
        ? (new Date(session.endTime).getTime() -
            new Date(session.startTime).getTime()) /
          1000
        : 0;
  
      hourMap[hour].total += session.focusScore * duration;
      hourMap[hour].count += duration;
    });
  
    let peakHour = 0;
    let bestScore = 0;
  
    Object.entries(hourMap).forEach(([hour, data]) => {
      if (data.count > 0) {
        const avg = data.total / data.count;
        if (avg > bestScore) {
          bestScore = avg;
          peakHour = Number(hour);
        }
      }
    });
  
    return {
      peakHour,
      peakFocusScore: Number(bestScore.toFixed(2))
    };
  }
  export async function getPerformanceProbability(userId: string) {
    const sessions = await prisma.session.findMany({
      where: { userId }
    });
  
    if (sessions.length === 0) {
      return { highPerformanceProbability: 0 };
    }
  
    let highPerformanceSessions = 0;
  
    sessions.forEach(session => {
      const s = session as typeof session & { burnoutScore: number; isDeepWork: boolean };
      if (
        session.focusScore > 75 &&
        s.burnoutScore < 40 &&
        s.isDeepWork
      ) {
        highPerformanceSessions++;
      }
    });
  
    const probability =
      highPerformanceSessions / sessions.length;
  
    return {
      highPerformanceProbability: Number(
        probability.toFixed(2)
      )
    };
  }
  