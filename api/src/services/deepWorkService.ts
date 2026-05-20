import { prisma } from "../prisma";
import {
  getActivityProductivityScore,
  getBaseFocus,
  isIdleActivity
} from "./metricEngine";

type StrictFocusInput = {
  userId: string;
  goal?: string | null;
  plannedMinutes: number;
  enforcement?: string | null;
  allowedApps?: string[];
  allowedDomains?: string[];
  blockedApps?: string[];
  blockedDomains?: string[];
};

type ActivityInput = {
  appName: string;
  windowTitle: string;
  startTime: Date;
  endTime: Date;
  duration: number;
  type?: string | null;
  category?: string | null;
  intent?: string | null;
  focusImpact?: number | null;
  confidence?: number | null;
  domain?: string | null;
  url?: string | null;
};

const WORK_CATEGORIES = new Set([
  "deep_work",
  "research",
  "productivity",
  "development_tools"
]);

const DISTRACTION_CATEGORIES = new Set([
  "entertainment",
  "media"
]);

const DISTRACTION_INTENTS = new Set([
  "gaming",
  "social_media",
  "streaming_video",
  "video_streaming",
  "video"
]);

function normalize(value?: string | null) {
  return (value ?? "").toLowerCase().trim();
}

function normalizeList(values?: string[] | null) {
  return (values ?? [])
    .map(normalize)
    .filter(Boolean);
}

function includesRule(rules: string[], value?: string | null) {
  const normalized = normalize(value);
  if (!normalized) return false;

  return rules.some(rule => normalized.includes(rule));
}

function interventionAction(enforcement: string) {
  if (enforcement === "block") return "blocked";
  if (enforcement === "warn") return "warned";
  if (enforcement === "observe") return "observed";
  return "reason_required";
}

function evaluateProtocol(session: any, activity: ActivityInput) {
  if (isIdleActivity(activity)) {
    return {
      allowed: true,
      severity: "idle",
      reason: "Idle time is tracked but not treated as a protocol violation."
    };
  }

  const allowedApps = normalizeList(session.allowedApps);
  const allowedDomains = normalizeList(session.allowedDomains);
  const blockedApps = normalizeList(session.blockedApps);
  const blockedDomains = normalizeList(session.blockedDomains);

  const appBlocked = includesRule(blockedApps, activity.appName);
  const domainBlocked = includesRule(blockedDomains, activity.domain);

  if (appBlocked || domainBlocked) {
    return {
      allowed: false,
      severity: "critical",
      reason: "Blocked app or domain entered during strict focus."
    };
  }

  const hasAllowList =
    allowedApps.length > 0 || allowedDomains.length > 0;

  if (hasAllowList) {
    const appAllowed = includesRule(allowedApps, activity.appName);
    const domainAllowed = includesRule(
      allowedDomains,
      activity.domain ?? activity.url
    );

    if (!appAllowed && !domainAllowed) {
      return {
        allowed: false,
        severity: "warning",
        reason: "Activity is outside the allowed focus protocol."
      };
    }
  }

  const category = activity.category ?? "unknown";
  const intent = activity.intent ?? "unknown";

  if (
    DISTRACTION_CATEGORIES.has(category) ||
    DISTRACTION_INTENTS.has(intent)
  ) {
    return {
      allowed: false,
      severity: "warning",
      reason: "Distracting category or intent detected."
    };
  }

  if (!hasAllowList && !WORK_CATEGORIES.has(category)) {
    return {
      allowed: false,
      severity: "notice",
      reason: "Activity is not categorized as deep work, research, productivity, or development."
    };
  }

  return {
    allowed: true,
    severity: "ok",
    reason: "Activity matches the active focus protocol."
  };
}

export async function startDeepWorkSession(input: StrictFocusInput) {
  const existing = await prisma.deepWorkSession.findFirst({
    where: {
      userId: input.userId,
      status: "active"
    },
    orderBy: {
      startedAt: "desc"
    }
  });

  if (existing) return existing;

  return prisma.deepWorkSession.create({
    data: {
      userId: input.userId,
      goal: input.goal ?? null,
      status: "active",
      plannedMinutes: Math.max(1, Math.floor(input.plannedMinutes)),
      enforcement: input.enforcement ?? "require_reason",
      allowedApps: input.allowedApps ?? [],
      allowedDomains: input.allowedDomains ?? [],
      blockedApps: input.blockedApps ?? [],
      blockedDomains: input.blockedDomains ?? []
    }
  });
}

export async function getActiveDeepWorkSession(userId: string) {
  return prisma.deepWorkSession.findFirst({
    where: {
      userId,
      status: "active"
    },
    orderBy: {
      startedAt: "desc"
    },
    include: {
      interventions: {
        orderBy: {
          detectedAt: "desc"
        },
        take: 10
      }
    }
  });
}

export async function endDeepWorkSession(
  userId: string,
  id: string,
  status = "completed"
) {
  return prisma.deepWorkSession.update({
    where: { id },
    data: {
      status,
      endedAt: new Date()
    }
  });
}

export async function getDeepWorkSessionHistory(userId: string) {
  return prisma.deepWorkSession.findMany({
    where: { userId },
    orderBy: {
      startedAt: "desc"
    },
    take: 30,
    include: {
      interventions: {
        orderBy: {
          detectedAt: "desc"
        },
        take: 5
      }
    }
  });
}

export async function resolveFocusIntervention(
  id: string,
  reason?: string | null,
  action = "allowed_once"
) {
  return prisma.focusIntervention.update({
    where: { id },
    data: {
      reason: reason ?? null,
      action
    }
  });
}

export async function evaluateDeepWorkActivity(
  userId: string,
  activity: ActivityInput
) {
  const session = await prisma.deepWorkSession.findFirst({
    where: {
      userId,
      status: "active",
      startedAt: {
        lte: activity.endTime
      }
    },
    orderBy: {
      startedAt: "desc"
    }
  });

  if (!session) return null;

  const duration = Math.max(0, activity.duration ?? 0);
  const result = evaluateProtocol(session, activity);
  const idle = isIdleActivity(activity);
  const productive = !idle && result.allowed;
  const distraction = !idle && !result.allowed;

  const currentTotal =
    session.productiveMs + session.distractionMs + session.idleMs;
  const nextProductiveMs =
    session.productiveMs + (productive ? duration : 0);
  const nextDistractionMs =
    session.distractionMs + (distraction ? duration : 0);
  const nextIdleMs =
    session.idleMs + (idle ? duration : 0);
  const nextTotal =
    currentTotal + duration;

  const focusContribution = productive
    ? getBaseFocus(activity) * 100
    : 0;
  const productivityContribution = productive
    ? getActivityProductivityScore(activity)
    : 0;

  const nextFocusScore =
    nextTotal > 0
      ? (
          session.focusScore * currentTotal +
          focusContribution * duration
        ) / nextTotal
      : 0;

  const nextProductivityScore =
    nextTotal > 0
      ? (
          session.productivityScore * currentTotal +
          productivityContribution * duration
        ) / nextTotal
      : 0;

  await prisma.deepWorkSession.update({
    where: { id: session.id },
    data: {
      productiveMs: nextProductiveMs,
      distractionMs: nextDistractionMs,
      idleMs: nextIdleMs,
      focusScore: nextFocusScore,
      productivityScore: nextProductivityScore,
      violationCount: {
        increment: distraction ? 1 : 0
      },
      interruptionMs: {
        increment: distraction ? duration : 0
      }
    }
  });

  if (result.allowed) return null;

  const intervention = await prisma.focusIntervention.create({
    data: {
      deepWorkId: session.id,
      appName: activity.appName,
      domain: activity.domain ?? null,
      windowTitle: activity.windowTitle,
      action: interventionAction(session.enforcement),
      durationMs: duration
    }
  });

  return {
    sessionId: session.id,
    intervention,
    enforcement: session.enforcement,
    message: result.reason
  };
}