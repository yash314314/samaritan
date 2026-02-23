import { Router } from "express";
import { getDailyAnalytics, getDeepWorkStreak,getWeeklyAnalytics , getHeatmap} from "../services/analyticsService";
import {
    detectIntraDayDrift,
    detectInterDayDrift,
    detectEntropyTrend,
    getPeakFocusWindow,
    getPerformanceProbability
  } from "../services/intelligenceService";

const router = Router();

router.get("/daily", async (req, res) => {
    const { userId } = req.query;
  
    if (!userId || typeof userId !== "string") {
      return res.status(400).json({ error: "Missing userId" });
    }
  
    try {
      const daily = await getDailyAnalytics(userId);
      const streak = await getDeepWorkStreak(userId);
  
      res.json({
        ...daily,
        ...streak
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Server error" });
    }
  });
  
  router.get("/weekly", async (req, res) => {
    const { userId } = req.query;
  
    if (!userId || typeof userId !== "string") {
      return res.status(400).json({ error: "Missing userId" });
    }
  
    try {
      const weekly = await getWeeklyAnalytics(userId);
      res.json(weekly);
    } catch (error) {
      res.status(500).json({ error: "Server error" });
    }
  });
  router.get("/heatmap", async (req, res) => {
    const { userId } = req.query;
  
    if (!userId || typeof userId !== "string") {
      return res.status(400).json({ error: "Missing userId" });
    }
  
    try {
      const heatmap = await getHeatmap(userId);
      res.json(heatmap);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Server error" });
    }
  });
  router.get("/intelligence", async (req, res) => {
    const { userId } = req.query;
  
    if (!userId || typeof userId !== "string") {
      return res.status(400).json({ error: "Missing userId" });
    }
  
    const intra = await detectIntraDayDrift(userId);
    const inter = await detectInterDayDrift(userId);
    const entropy = await detectEntropyTrend(userId);
    const peak = await getPeakFocusWindow(userId);
    const bayes = await getPerformanceProbability(userId);
  
    res.json({
      ...intra,
      ...inter,
      ...entropy,
      ...peak,
      ...bayes
    });
  });
export default router;
