import { Router } from 'express';
import { handleActivity } from '../services/activityService';

const router = Router();

router.post('/', async (req, res) => {
  const { userId, appName, windowTitle } = req.body;

  if (!userId || !appName || !windowTitle) {
    return res.status(400).json({ error: "Missing fields" });
  }

  try {
    const activity = await handleActivity(userId, appName, windowTitle);
    res.json(activity);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
