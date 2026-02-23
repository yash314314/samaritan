const { app, BrowserWindow } = require("electron");
const path = require("path");
const { startTracking } = require("./tracker");
const { startSyncLoop } = require("./syncEngine");

const isDev = !app.isPackaged;

function createWindow() {
  const win = new BrowserWindow({
    width: 1300,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, "preload.js")
    }
  });

  if (isDev) {
    // Development mode
    win.loadURL("http://localhost:3000");
    win.webContents.openDevTools();
  } else {
    // Production mode
    win.loadFile(
      path.join(__dirname, "../dashboard/out/index.html")
    );
  }
}
app.whenReady().then(() => {
    createWindow();
    startTracking();
    startSyncLoop();
});