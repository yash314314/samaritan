import express from 'express';
import activityRoutes from './routes/activity';
import analyticsRoutes from './routes/analytics';
import cors from 'cors';


const app = express();

app.use(express.json());
app.use(
  cors({
    origin: "http://localhost:3000"
  })
);
app.use('/activity', activityRoutes);

app.get('/health', (req, res) => {
  res.json({ status: "OK" });
});
app.use('/analytics', analyticsRoutes);
app.listen(4000, () => {
  console.log("API running on http://localhost:4000");
});
