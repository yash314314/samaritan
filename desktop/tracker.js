const activeWin = require("active-win");
const Store = require("electron-store");
const { handleEvent } = require("./sessionEngine");
const { powerMonitor } = require("electron");

let lastActivity = Date.now();
let idleThreshold = 2 * 60 * 1000; // 2 minutes

powerMonitor.on("user-active", () => {
  lastActivity = Date.now();
});

powerMonitor.on("user-idle", () => {
  const now = Date.now();
  if (now - lastActivity > idleThreshold) {
    const { closeSession } = require("./sessionEngine");
    closeSession();
  }
});
async function track() {
  const win = await activeWin();
  if (!win) return;

  const event = {
    timestamp: new Date().toISOString(),
    app: win.owner.name,
    title: win.title
  };

  handleEvent(event);
}

function startTracking() {
  setInterval(track, 1000);
}

module.exports = { startTracking };