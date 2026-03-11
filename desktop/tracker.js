const activeWin = require("active-win");
const { handleEvent, closeSession } = require("./sessionEngine");
const { powerMonitor } = require("electron");
const USER_ID = "11111111-1111-1111-1111-111111111111";
const BACKEND_URL = "http://localhost:4000/activity/session";
const idleThreshold = 150; // seconds (testing)

let isIdle = false;
let lastContext = null;
let reportedNoWindow = false;
let idleStart = null; // Timestamp of last idle event

async function track() {
  try {
    const idleTime = powerMonitor.getSystemIdleTime();

    // ---- IDLE DETECTION ----
    if (idleTime >= idleThreshold) {

      if (!isIdle) {
    
        idleStart = Date.now() - (idleTime * 1000);
    
        console.log(
          "[Samaritan] Administrator absence detected.",
          "\n  Idle threshold reached:",
          idleThreshold,
          "seconds"
        );
    
        await closeSession("idle");
    
        isIdle = true;
      }
    
      return;
    }

    // ---- USER RETURNS FROM IDLE ----
    if (isIdle && idleTime < idleThreshold) {

      const idleEnd = Date.now();
    
      const idleDuration = idleEnd - idleStart;
    
      console.log(
        "[Samaritan] Administrator presence restored.",
        "\n  Idle duration (seconds):",
        Math.floor(idleDuration / 1000)
      );
    
      await sendIdleToBackend(idleStart, idleEnd, idleDuration);
    
      isIdle = false;
      idleStart = null;
    }

    const win = await activeWin();

    if (!win) {
      if (!reportedNoWindow) {
        console.log("[Samaritan] No active window detected.");
        reportedNoWindow = true;
      }
      return;
    }

    reportedNoWindow = false;

    const currentContext = {
      app: win.owner?.name || "Unknown",
      title: win.title || "Untitled",
      processId: win.owner?.processId,
      path: win.owner?.path
    };

    // ---- CONTEXT SWITCH DETECTION ----
    const isContextChanged =
      !lastContext ||
      lastContext.app !== currentContext.app ||
      lastContext.title !== currentContext.title;

    if (isContextChanged) {
      if (lastContext) {
        console.log(
          "[Samaritan] Context shift detected.",
          "\n  Previous App:", lastContext.app,
          "\n  Previous Title:", lastContext.title,
          "\n  Current App:", currentContext.app,
          "\n  Current Title:", currentContext.title,
          "\n  PID:", currentContext.processId,
          "\n  Executable:", currentContext.path
        );
      } else {
        console.log(
          "[Samaritan] Initial context acquired.",
          "\n  App:", currentContext.app,
          "\n  Title:", currentContext.title,
          "\n  PID:", currentContext.processId,
          "\n  Executable:", currentContext.path
        );
      }

      await handleEvent(currentContext);
      lastContext = currentContext;
    }

  } catch (err) {
    console.error(
      "[Samaritan] Tracking anomaly detected.",
      "\n  Error:", err.message
    );
  }
}

function startTracking() {

  console.log("[Samaritan] Surveillance initialized.");
  console.log("[Samaritan] Idle threshold:", idleThreshold, "seconds");

  powerMonitor.on("lock-screen", async () => {
    console.log("[Samaritan] System lock detected.");
    await closeSession("lock");
  });

  powerMonitor.on("unlock-screen", () => {
    console.log("[Samaritan] System unlock detected.");
  });

  powerMonitor.on("suspend", async () => {
    console.log("[Samaritan] System suspended.");
    await closeSession("suspend");
  });

  powerMonitor.on("resume", () => {
    console.log("[Samaritan] System resumed.");
  });

  setInterval(track, 1000);
}
async function sendIdleToBackend(start, end, duration) {

  const payload = {

    userId: USER_ID,
    app: "System",
    title: "Idle",
    startTime: new Date(start).toISOString(),
    endTime: new Date(end).toISOString(),
    duration,
    type: "idle"

  };

  await fetch(BACKEND_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

}
module.exports = { startTracking };