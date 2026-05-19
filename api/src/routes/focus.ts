import { Router } from "express";
import {
  endDeepWorkSession,
  getActiveDeepWorkSession,
  getDeepWorkSessionHistory,
  resolveFocusIntervention,
  startDeepWorkSession
} from "../services/deepWorkService";

const router = Router();

router.get("/active", async (req, res) => {
  const { userId } = req.query;

  if (!userId || typeof userId !== "string") {
    return res.status(400).json({ error: "Missing userId" });
  }

  const session = await getActiveDeepWorkSession(userId);
  res.json(session);
});

router.get("/history", async (req, res) => {
  const { userId } = req.query;

  if (!userId || typeof userId !== "string") {
    return res.status(400).json({ error: "Missing userId" });
  }

  const sessions = await getDeepWorkSessionHistory(userId);
  res.json(sessions);
});

router.post("/start", async (req, res) => {
  try {
    const {
      userId,
      goal,
      plannedMinutes,
      enforcement,
      allowedApps,
      allowedDomains,
      blockedApps,
      blockedDomains
    } = req.body;

    if (!userId || !plannedMinutes) {
      return res.status(400).json({
        error: "Missing userId or plannedMinutes"
      });
    }

    const session = await startDeepWorkSession({
      userId,
      goal,
      plannedMinutes: Number(plannedMinutes),
      enforcement,
      allowedApps,
      allowedDomains,
      blockedApps,
      blockedDomains
    });

    res.json(session);
  } catch (error) {
    console.error("Start deep work failed:", error);
    res.status(500).json({ error: "Failed to start deep work" });
  }
});

router.post("/:id/end", async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, status } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "Missing userId" });
    }

    const session = await endDeepWorkSession(
      String(userId),
      id,
      status ?? "completed"
    );

    res.json(session);
  } catch (error) {
    console.error("End deep work failed:", error);
    res.status(500).json({ error: "Failed to end deep work" });
  }
});

router.post("/interventions/:id/resolve", async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, action } = req.body;

    const intervention = await resolveFocusIntervention(
      id,
      reason,
      action ?? "allowed_once"
    );

    res.json(intervention);
  } catch (error) {
    console.error("Resolve intervention failed:", error);
    res.status(500).json({ error: "Failed to resolve intervention" });
  }
});

export default router;