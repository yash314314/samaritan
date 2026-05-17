import { prisma } from "../prisma";
import { getISTDayRange } from "../utils/time";

export async function getTimeline(userId: string, date: string) {

  /* ---------- IST SAFE RANGE ---------- */

  const { start, end } =
    getISTDayRange(new Date(date + "T00:00:00"));

  /* ---------- FETCH ACTIVITIES ---------- */

  const activities = await prisma.activity.findMany({
    where: {
      session: { userId },
      startTime: {
        gte: start,
        lt: end
      }
    },
    orderBy: {
      startTime: "asc"
    }
  });

  /* ---------- MERGE ---------- */

  const merged = mergeActivities(activities);

  return merged;

}


/* -------------------------------------------------------------------------- */
/*                          ACTIVITY MERGING ENGINE                           */
/* -------------------------------------------------------------------------- */

function mergeActivities(activities: any[]) {

  if (!activities.length) return [];

  const merged: any[] = [];
  let current: any = null;

  for (const a of activities) {

    if (!current) {

      current = {
        appName: a.appName,
        start: a.startTime,
        end: a.endTime,
        duration: a.duration,
        category: a.category,
        items: [
          {
            title: a.windowTitle,
            start: a.startTime,
            end: a.endTime,
            duration: a.duration
          }
        ]
      };

      continue;
    }

    /* ---------- SAME APP MERGE ---------- */

    if (current.appName === a.appName) {

      current.end = a.endTime;
      current.duration += a.duration;

      current.items.push({
        title: a.windowTitle,
        start: a.startTime,
        end: a.endTime,
        duration: a.duration
      });

    }

    /* ---------- NEW APP ---------- */

    else {

      merged.push(current);

      current = {
        appName: a.appName,
        start: a.startTime,
        end: a.endTime,
        duration: a.duration,
        category: a.category,
        items: [
          {
            title: a.windowTitle,
            start: a.startTime,
            end: a.endTime,
            duration: a.duration
          }
        ]
      };

    }

  }

  if (current) merged.push(current);

  return merged;

}