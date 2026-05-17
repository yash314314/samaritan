export const clamp = (value: number, min = 0, max = 100) =>
    Math.min(max, Math.max(min, value));
  
  export const clamp01 = (value: number) =>
    Math.min(1, Math.max(0, value));
  
  export type ActivityMetricInput = {
    appName: string;
    type?: string | null;
    category?: string | null;
    intent?: string | null;
    focusImpact?: number | null;
    confidence?: number | null;
  };
  
  export function isIdleActivity(a: ActivityMetricInput) {
    return (
      a.type === "idle" ||
      a.appName === "System Idle" ||
      a.category === "idle"
    );
  }
  
  export function getBaseFocus(a: ActivityMetricInput) {
    if (a.focusImpact !== null && a.focusImpact !== undefined) {
      return clamp01(a.focusImpact);
    }
  
    const categoryDefaults: Record<string, number> = {
      deep_work: 0.9,
      development_tools: 0.7,
      productivity: 0.7,
      research: 0.65,
      communication: 0.4,
      media: 0.2,
      entertainment: 0.1,
      system: 0.15
    };
  
    return categoryDefaults[a.category ?? ""] ?? 0.5;
  }
  
  export function getActivityProductivityScore(a: ActivityMetricInput) {
    if (isIdleActivity(a)) return 0;
  
    let score = getBaseFocus(a) * 100;
  
    if (a.category === "deep_work") score += 5;
    if (a.category === "productivity") score += 3;
    if (a.category === "communication") score -= 8;
    if (a.category === "media") score -= 20;
    if (a.category === "entertainment") score -= 30;
    if (a.category === "system") score -= 15;
  
    if (a.intent === "coding") score += 5;
    if (a.intent === "debugging") score += 4;
    if (a.intent === "planning") score += 3;
    if (a.intent === "documentation") score += 3;
    if (a.intent === "chat") score -= 5;
    if (a.intent === "social_media") score -= 20;
    if (a.intent === "gaming") score -= 30;
    if (a.intent?.includes("streaming")) score -= 25;
  
    const confidence = clamp01(a.confidence ?? 0.8);
  
    return clamp(score * confidence + 50 * (1 - confidence));
  }