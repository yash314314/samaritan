const { app } = require("electron");

let currentSession = null;

const MIN_SESSION_DURATION = 2000;
const USER_ID = "11111111-1111-1111-1111-111111111111";
const BACKEND_URL = "http://localhost:4000/activity/session";

function now() {
  return Date.now();
}

function startNewSession(event) {
  currentSession = {
    startTime: now(),
    endTime: now(),
    app: event.app,
    title: event.title,
    type: "active"
  };

  console.log(
    "[Samaritan] New observation initiated.",
    "\n  App:", event.app,
    "\n  Title:", event.title,
    "\n  Timestamp:", new Date(currentSession.startTime).toISOString()
  );
}

async function sendSessionToBackend(session) {
  const payload = {
    userId: USER_ID,
    app: session.app,
    title: session.title,
    startTime: new Date(session.startTime).toISOString(),
    endTime: new Date(session.endTime).toISOString(),
    duration: session.duration,
    type: session.type
  };

  console.log("[Samaritan] Preparing transmission to backend.");
  console.log("[Samaritan] Payload:", JSON.stringify(payload, null, 2));

  try {
    const response = await fetch(BACKEND_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const text = await response.text();

    if (!response.ok) {
      console.error(
        "[Samaritan] Backend rejected the observation.",
        "\n  Status:", response.status,
        "\n  Response:", text
      );
      return;
    }

    console.log("[Samaritan] Transmission acknowledged by backend.");
  } catch (err) {
    console.error(
      "[Samaritan] Transmission failed.",
      "\n  Error:", err.message
    );
  }
}

async function closeSession(reason = "active") {
  if (!currentSession) {
    console.log("[Samaritan] No active observation to close.");
    return;
  }

  const endTime = now();
  currentSession.endTime = endTime;
  currentSession.type = reason;

  const duration = endTime - currentSession.startTime;

  if (duration < MIN_SESSION_DURATION) {
    console.log(
      "[Samaritan] Observation discarded.",
      "\n  Reason: Duration too brief.",
      "\n  Duration(ms):", duration
    );
    currentSession = null;
    return;
  }

  currentSession.duration = duration;

  console.log(
    "[Samaritan] Observation concluded.",
    "\n  App:", currentSession.app,
    "\n  Duration(ms):", duration,
    "\n  Reason:", reason,
    "\n  Started:", new Date(currentSession.startTime).toISOString(),
    "\n  Ended:", new Date(currentSession.endTime).toISOString()
  );

  await sendSessionToBackend(currentSession);

  currentSession = null;
}

async function handleEvent(event) {
  if (!currentSession) {
    startNewSession(event);
    return;
  }

  const isSameContext =
    currentSession.app === event.app &&
    currentSession.title === event.title;

  if (!isSameContext) {
    console.log(
      "[Samaritan] Context shift detected.",
      "\n  Previous:", currentSession.app,
      "\n  Current:", event.app
    );

    await closeSession("switch");
    startNewSession(event);
  } else {
    currentSession.endTime = now();
  }
}

app.on("before-quit", async () => {
  console.log("[Samaritan] Shutdown sequence initiated.");
  await closeSession("shutdown");
  console.log("[Samaritan] All observations archived.");
});

// Crash protection
process.on("uncaughtException", (err) => {
  console.error("[Samaritan] Uncaught exception detected.");
  console.error("Details:", err);
});

process.on("unhandledRejection", (err) => {
  console.error("[Samaritan] Unhandled rejection detected.");
  console.error("Details:", err);
});

module.exports = { handleEvent, closeSession };