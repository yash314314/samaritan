const { app, Notification } = require("electron");

let currentSession = null;

const MIN_SESSION_DURATION = 2000;
const USER_ID = "7007b337-6f7b-4d6a-86f9-dc4da4ed48c4";
const BACKEND_URL = "http://localhost:4000/activity/session";

function now() {
  return Date.now();
}

/* ---------------- START SESSION ---------------- */

function startNewSession(event) {
 const startTime = event.startTime
    ? new Date(event.startTime).getTime()
    : now();
    currentSession = {
      startTime,
      endTime: startTime,
      app: event.app,
      title: event.title,
      icon: event.icon || null,
      url: event.url || null,
      domain: event.domain || null,
      type: event.type || "active"
    };
  console.log(
    "[Samaritan] New observation initiated.",
    "\n  App:", event.app,
    "\n  Title:", event.title,
    "\n  Timestamp:", new Date(currentSession.startTime).toISOString()
  );

}

/* ---------------- SEND TO BACKEND ---------------- */

async function sendSessionToBackend(session) {

  const payload = {
    userId: USER_ID,
    app: session.app,
    title: session.title,
    iconUrl: session.icon,
    url: session.url || null,
    domain: session.domain || null,
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

    try {
      const data = JSON.parse(text);
      const focusIntervention = data?.focusIntervention;

      if (focusIntervention) {
        const appName =
          focusIntervention.intervention?.appName || session.app;

        console.log(
          "[Samaritan] Strict focus intervention.",
          "\n  Action:", focusIntervention.intervention?.action,
          "\n  App:", appName,
          "\n  Message:", focusIntervention.message
        );

        if (Notification.isSupported()) {
          new Notification({
            title: "Strict Focus",
            body:
              `${appName} is outside your focus protocol. ` +
              "Return to the active deep work session."
          }).show();
        }
      }
    } catch {
      // Backend returned a valid acknowledgement without JSON intervention data.
    }

  } catch (err) {

    console.error(
      "[Samaritan] Transmission failed.",
      "\n  Error:", err.message
    );

  }

}

/* ---------------- CLOSE SESSION ---------------- */

async function closeSession(reason = "active", endTimeOverride = null) {
  if (!currentSession) {
    console.log("[Samaritan] No active observation to close.");
    return;
  }

  const endTime = endTimeOverride
    ? new Date(endTimeOverride).getTime()
    : now();

  currentSession.endTime = Math.max(endTime, currentSession.startTime);

  const duration =
    currentSession.endTime - currentSession.startTime;

  if (duration < MIN_SESSION_DURATION) {
    currentSession = null;
    return;
  }

  currentSession.duration = duration;

  console.log(
    "[Samaritan] Observation concluded.",
    "\n  App:", currentSession.app,
    "\n  Type:", currentSession.type,
    "\n  Duration(ms):", duration,
    "\n  Reason:", reason
  );

  await sendSessionToBackend(currentSession);

  currentSession = null;
}

/* ---------------- EVENT HANDLER ---------------- */

async function handleEvent(event) {
  const eventStartTime = event.startTime
    ? new Date(event.startTime).getTime()
    : now();

  if (!currentSession) {
    startNewSession(event);
    return;
  }

  const isSameContext =
    currentSession.app === event.app &&
    currentSession.title === event.title &&
    currentSession.type === (event.type || "active");

  if (!isSameContext) {
    await closeSession("switch", eventStartTime);
    startNewSession(event);
  } else {
    currentSession.endTime = now();
  }
}

/* ---------------- SHUTDOWN HANDLER ---------------- */

app.on("before-quit", async () => {

  console.log("[Samaritan] Shutdown sequence initiated.");

  await closeSession("shutdown");

  console.log("[Samaritan] All observations archived.");

});

/* ---------------- CRASH PROTECTION ---------------- */

process.on("uncaughtException", (err) => {

  console.error("[Samaritan] Uncaught exception detected.");
  console.error("Details:", err);

});

process.on("unhandledRejection", (err) => {

  console.error("[Samaritan] Unhandled rejection detected.");
  console.error("Details:", err);

});

module.exports = { handleEvent, closeSession };