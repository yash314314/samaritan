const Store = require("electron-store");
const store = new Store();

let currentSession = null;

function startNewSession(event) {
  currentSession = {
    startTime: event.timestamp,
    endTime: event.timestamp,
    app: event.app,
    title: event.title,
    switchCount: 0
  };
}

function closeSession() {
  if (!currentSession) return;

  const sessions = store.get("sessions") || [];
  sessions.push(currentSession);
  store.set("sessions", sessions);

  currentSession = null;
}

function handleEvent(event) {
  if (!currentSession) {
    startNewSession(event);
    return;
  }

  if (
    currentSession.app !== event.app ||
    currentSession.title !== event.title
  ) {
    closeSession();
    startNewSession(event);
  } else {
    currentSession.endTime = event.timestamp;
  }
}

module.exports = { handleEvent, closeSession };