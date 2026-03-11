import { prisma } from "../prisma";

const rules = [
  {
    match: (app: string, title: string) =>
      app.toLowerCase().includes("code"),
    category: "deep_work",
    intent: "implementation",
    focusImpact: 0.9,
    energyImpact: -0.2
  },
  {
    match: (app: string) =>
      app.toLowerCase().includes("chrome"),
    category: "research",
    intent: "browsing",
    focusImpact: 0.6,
    energyImpact: -0.1
  },
  {
    match: (app: string) =>
      app.toLowerCase().includes("slack") ||
      app.toLowerCase().includes("whatsapp"),
    category: "communication",
    intent: "coordination",
    focusImpact: 0.4,
    energyImpact: -0.3
  },
  {
    match: (_: string, title: string) =>
      title.toLowerCase().includes("youtube"),
    category: "entertainment",
    intent: "content_consumption",
    focusImpact: 0.1,
    energyImpact: 0.1
  }
];

export async function classifyContext(app: string, title: string) {
  // 1. DB patterns first
  const patterns = await prisma.appPattern.findMany({
    where: { appName: app }
  });

  for (const pattern of patterns) {
    const regex = new RegExp(pattern.titleRegex, "i");
    if (regex.test(title)) {
      return {
        category: pattern.category,
        intent: pattern.intent ?? "unknown",
        focusImpact: pattern.focusImpact ?? 0.5,
        energyImpact: pattern.energyImpact ?? 0,
        confidence: pattern.confidence ?? 0.9
      };
    }
  }

  // 2. Rule engine fallback
  for (const rule of rules) {
    if (rule.match(app, title)) {
      return {
        category: rule.category,
        intent: rule.intent,
        focusImpact: rule.focusImpact,
        energyImpact: rule.energyImpact,
        confidence: 0.8
      };
    }
  }

  return {
    category: "unknown",
    intent: "unknown",
    focusImpact: 0.5,
    energyImpact: 0,
    confidence: 0.3
  };
}