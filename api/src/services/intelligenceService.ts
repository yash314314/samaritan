import { prisma } from "../prisma";

export async function getAssistantInsights(userId: string) {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const activities = await prisma.activity.findMany({
    where: {
      session: { userId },
      startTime: { gte: startOfDay }
    }
  });

  if (activities.length === 0) {
    return {
      productivityScore: 0,
      focusScore: 0,
      deepWorkRatio: 0,
      communicationRatio: 0,
      fragmentationScore: 0,
      energyScore: 0,
      dominantIntent: "none",
      suggestion: "No structured work recorded yet."
    };
  }

  const totalDuration = activities.reduce((sum, a) => sum + a.duration, 0);
  if (totalDuration === 0) return null;

  // -------------------------
  // Deep Work
  // -------------------------

  const deepWorkDuration = activities
    .filter(a => a.category === "deep_work")
    .reduce((sum, a) => sum + a.duration, 0);

  const deepWorkRatio = deepWorkDuration / totalDuration;

  // -------------------------
  // Communication
  // -------------------------

  const communicationDuration = activities
    .filter(a => a.category === "communication")
    .reduce((sum, a) => sum + a.duration, 0);

  const communicationRatio = communicationDuration / totalDuration;

  // -------------------------
  // Focus Score
  // -------------------------

  const weightedFocus =
    activities.reduce(
      (sum, a) => sum + (a.focusImpact ?? 0.5) * a.duration,
      0
    ) / totalDuration;

  const focusScore = weightedFocus * 100;

  // -------------------------
  // Fragmentation
  // -------------------------

  const minutes = totalDuration / (60 * 1000);
  const contextSwitchRate =
    minutes > 0 ? activities.length / minutes : 0;

  const fragmentationScore = Math.min(
    100,
    contextSwitchRate * 100
  );

  // -------------------------
  // Energy
  // -------------------------

  const weightedEnergy =
    activities.reduce(
      (sum, a) => sum + (a.energyImpact ?? 0) * a.duration,
      0
    ) / totalDuration;

  const energyScore = weightedEnergy;

  // -------------------------
  // Productivity Score
  // -------------------------

  const productivityScore = Math.max(
    0,
    Math.min(
      100,
      focusScore * 0.5 +
        deepWorkRatio * 100 * 0.3 -
        communicationRatio * 100 * 0.1 -
        fragmentationScore * 0.1
    )
  );

  // -------------------------
  // Dominant Intent
  // -------------------------

  const intentCount: Record<string, number> = {};
  activities.forEach(a => {
    if (!a.intent) return;
    intentCount[a.intent] = (intentCount[a.intent] || 0) + 1;
  });

  let dominantIntent = "unknown";
  let max = 0;

  Object.entries(intentCount).forEach(([intent, count]) => {
    if (count > max) {
      dominantIntent = intent;
      max = count;
    }
  });

  // -------------------------
  // Suggestion Engine
  // -------------------------

  const suggestion = generateAssistantSuggestion({
    productivityScore,
    deepWorkRatio,
    communicationRatio,
    fragmentationScore,
    energyScore
  });

  return {
    productivityScore: Number(productivityScore.toFixed(2)),
    focusScore: Number(focusScore.toFixed(2)),
    deepWorkRatio: Number((deepWorkRatio * 100).toFixed(2)),
    communicationRatio: Number((communicationRatio * 100).toFixed(2)),
    fragmentationScore: Number(fragmentationScore.toFixed(2)),
    energyScore: Number(energyScore.toFixed(2)),
    dominantIntent,
    suggestion
  };
}

function generateAssistantSuggestion(metrics: {
  productivityScore: number;
  deepWorkRatio: number;
  communicationRatio: number;
  fragmentationScore: number;
  energyScore: number;
}) {

  if (metrics.fragmentationScore > 60)
    return "High task fragmentation detected. Reduce switching and batch similar tasks.";

  if (metrics.communicationRatio > 0.45)
    return "Communication is dominating your day. Consider fixed message windows.";

  if (metrics.deepWorkRatio < 0.25)
    return "Deep work time is low. Schedule a 60-minute uninterrupted block.";

  if (metrics.energyScore < -0.4)
    return "Energy drain detected. Take a structured break before continuing.";

  if (metrics.productivityScore > 80)
    return "High-performance pattern detected. Protect this structure.";

  return "Work pattern stable. Maintain structure.";
}
export async function getDailyComparison(userId: string) {

  const todayStart = new Date();
  todayStart.setHours(0,0,0,0);

  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(todayStart.getDate() - 1);

  const yesterdayEnd = new Date(todayStart);

  const todayActivities = await prisma.activity.findMany({
    where:{
      session:{ userId },
      startTime:{ gte: todayStart }
    }
  });

  const yesterdayActivities = await prisma.activity.findMany({
    where:{
      session:{ userId },
      startTime:{
        gte: yesterdayStart,
        lt: yesterdayEnd
      }
    }
  });

  function computeScore(activities:any[]){
    if(activities.length === 0) return 0;

    const totalDuration = activities.reduce((s,a)=>s+a.duration,0);

    const weightedFocus =
      activities.reduce(
        (s,a)=>s+(a.focusImpact ?? 0.5)*a.duration,0
      ) / totalDuration;

    return weightedFocus * 100;
  }

  const todayScore = computeScore(todayActivities);
  const yesterdayScore = computeScore(yesterdayActivities);

  const delta = todayScore - yesterdayScore;

  return {
    todayFocusScore: Number(todayScore.toFixed(2)),
    yesterdayFocusScore: Number(yesterdayScore.toFixed(2)),
    change: Number(delta.toFixed(2))
  };
}

export async function getWeeklyGrowthTrend(userId:string){

  const now = new Date();
  const start = new Date();
  start.setDate(now.getDate() - 7);

  const sessions = await prisma.session.findMany({
    where:{
      userId,
      startTime:{ gte:start }
    },
    orderBy:{ startTime:"asc" }
  });

  if(sessions.length === 0){
    return { growth:0 };
  }

  const scores = sessions.map(s => s.focusScore ?? 0);

  const first = scores[0];
  const last = scores[scores.length-1];

  const growth = last - first;

  return {
    weeklyFocusGrowth: Number(growth.toFixed(2))
  };
}

export async function getIntentHeatmap(userId:string){

  const activities = await prisma.activity.findMany({
    where:{
      session:{ userId }
    }
  });

  const map:Record<string,number> = {};

  activities.forEach(a=>{
    const intent = a.intent ?? "unknown";
    map[intent] = (map[intent] || 0) + a.duration;
  });

  const total = Object.values(map).reduce((s,v)=>s+v,0);

  const heatmap = Object.entries(map).map(([intent,duration])=>({
    intent,
    percentage: Number(((duration/total)*100).toFixed(2))
  }));

  heatmap.sort((a,b)=>b.percentage-a.percentage);

  return heatmap;
}

export async function getBurnoutRisk(userId:string){

  const sessions = await prisma.session.findMany({
    where:{ userId },
    orderBy:{ startTime:"desc" },
    take:10
  });

  if(sessions.length === 0){
    return { burnoutRisk:"low" };
  }

  const avgBurnout =
    sessions.reduce((s,a)=>s+(a.burnoutScore ?? 0),0)
    / sessions.length;

  let risk = "low";

  if(avgBurnout > 60) risk = "high";
  else if(avgBurnout > 35) risk = "moderate";

  return {
    burnoutRisk: risk,
    burnoutScore: Number(avgBurnout.toFixed(2))
  };
}
export async function getWeeklyInsights(userId: string) {

  const now = new Date();
  const weekStart = new Date();
  weekStart.setDate(now.getDate() - 7);

  const activities = await prisma.activity.findMany({
    where: {
      session: { userId },
      startTime: { gte: weekStart }
    }
  });

  if (activities.length === 0) {
    return {
      weeklyFocusScore: 0,
      weeklyDeepWorkRatio: 0,
      weeklyCommunicationRatio: 0,
      peakProductiveHour: null
    };
  }

  const totalDuration = activities.reduce((s, a) => s + a.duration, 0);

  const deepWorkDuration = activities
    .filter(a => a.category === "deep_work")
    .reduce((s, a) => s + a.duration, 0);

  const communicationDuration = activities
    .filter(a => a.category === "communication")
    .reduce((s, a) => s + a.duration, 0);

  const weightedFocus =
    activities.reduce(
      (s, a) => s + (a.focusImpact ?? 0.5) * a.duration,
      0
    ) / totalDuration;

  // Peak hour calculation
  const hourMap: Record<number, { score: number; duration: number }> = {};

  activities.forEach(a => {

    const hour = new Date(a.startTime).getHours();

    if (!hourMap[hour]) {
      hourMap[hour] = { score: 0, duration: 0 };
    }

    hourMap[hour].score += (a.focusImpact ?? 0.5) * a.duration;
    hourMap[hour].duration += a.duration;

  });

  let peakHour = 0;
  let bestScore = 0;

  Object.entries(hourMap).forEach(([hour, data]) => {

    const avg = data.score / data.duration;

    if (avg > bestScore) {
      bestScore = avg;
      peakHour = Number(hour);
    }

  });

  return {
    weeklyFocusScore: Number((weightedFocus * 100).toFixed(2)),
    weeklyDeepWorkRatio: Number(((deepWorkDuration / totalDuration) * 100).toFixed(2)),
    weeklyCommunicationRatio: Number(((communicationDuration / totalDuration) * 100).toFixed(2)),
    peakProductiveHour: peakHour
  };
}

export async function getDashboard(userId: string) {

  const [
    assistant,
    weekly,
    comparison,
    growth,
    intents,
    burnout,
    streak
  ] = await Promise.all([
    getAssistantInsights(userId),
    getWeeklyInsights(userId),
    getDailyComparison(userId),
    getWeeklyGrowthTrend(userId),
    getIntentHeatmap(userId),
    getBurnoutRisk(userId),
    getDeepWorkStreak(userId)
  ]);

  return {
    assistant,
    weekly,
    comparison,
    growth,
    intents,
    burnout,
    streak
  };
}
export async function getDeepWorkStreak(userId: string) {

  const sessions = await prisma.session.findMany({
    where: { userId },
    orderBy: { startTime: "asc" }
  });

  if (sessions.length === 0) {
    return {
      currentDeepWorkStreak: 0,
      longestDeepWorkStreak: 0
    };
  }

  const dailyDeepWork: Record<string, number> = {};

  sessions.forEach(session => {

    const date = session.startTime.toISOString().split("T")[0];

    if (!dailyDeepWork[date]) {
      dailyDeepWork[date] = 0;
    }

    dailyDeepWork[date] += session.deepWorkScore ?? 0;

  });

  const days = Object.keys(dailyDeepWork).sort();

  let current = 0;
  let longest = 0;

  days.forEach(day => {

    if (dailyDeepWork[day] > 30) {
      current++;
      longest = Math.max(longest, current);
    } else {
      current = 0;
    }

  });

  return {
    currentDeepWorkStreak: current,
    longestDeepWorkStreak: longest
  };
}
export async function getDailySummary(userId: string, date: string) {

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
    }
  });

  if (activities.length === 0) {
    return { message: "No activity recorded." };
  }

  const totalDuration = activities.reduce((s,a)=>s+a.duration,0);

  const deepWorkDuration = activities
    .filter(a=>a.category==="deep_work")
    .reduce((s,a)=>s+a.duration,0);

  const focusWeighted =
    activities.reduce(
      (s,a)=>s+(a.focusImpact ?? 0.5)*a.duration,
      0
    ) / totalDuration;

  const focusScore = focusWeighted * 100;

  // intent calculation
  const intentMap: Record<string,number> = {};

  activities.forEach(a=>{
    const intent = a.intent ?? "unknown";
    intentMap[intent] = (intentMap[intent] || 0) + a.duration;
  });

  const topIntent =
    Object.entries(intentMap)
      .sort((a,b)=>b[1]-a[1])[0][0];

  // longest focus block
  const deepActivities =
    activities.filter(a=>a.category==="deep_work");

  let longestFocusBlock = 0;

  deepActivities.forEach(a=>{
    if(a.duration > longestFocusBlock){
      longestFocusBlock = a.duration;
    }
  });

  return {

    date,

    deepWorkHours:
      Number((deepWorkDuration/3600000).toFixed(2)),

    focusScore:
      Number(focusScore.toFixed(2)),

    longestFocusBlockMinutes:
      Math.round(longestFocusBlock/60000),

    totalActivities:
      activities.length,

    dominantIntent: topIntent

  };
}