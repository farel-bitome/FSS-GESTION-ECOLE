const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const appConfig = require('./server/appConfig');

let mainWindow;
let setupWindow;
let serverStarted = false;

function startLocalServer() {
  if (!serverStarted) {
    require('./server/index.js'); // demarre Express + SQLite sur ce poste
    serverStarted = true;
  }
}

function buildUrl(config) {
  if (config.mode === 'serveur') {
    return 'http://localhost:4790/login.html';
  }
  const port = config.server_port || '4790';
  return `http://${config.server_ip}:${port}/login.html`;
}

function createSetupWindow() {
  setupWindow = new BrowserWindow({
    width: 620,
    height: 640,
    resizable: false,
    icon: path.join(__dirname, 'build', 'icon.ico'),
    title: 'Configuration réseau - Ecole Gestion',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });
  setupWindow.setMenuBarVisibility(false);
  setupWindow.loadFile(path.join(__dirname, 'public', 'setup.html'));
  setupWindow.on('closed', () => { setupWindow = null; });
}

function createMainWindow(url) {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    icon: path.join(__dirname, 'build', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    },
    title: 'Ecole Gestion - FALLSERVICES&SOLUTIONS INFO'
  });
  mainWindow.loadURL(url);
  mainWindow.on('closed', () => { mainWindow = null; });
}

function demarrerSelonConfig() {
  const config = appConfig.getConfig();

  if (!config || !config.mode) {
    createSetupWindow();
    return;
  }

  if (config.mode === 'serveur') {
    startLocalServer();
    setTimeout(() => createMainWindow(buildUrl(config)), 500);
  } else {
    createMainWindow(buildUrl(config));
  }
}

// ---- IPC : pont entre les pages web (renderer) et le systeme (main) ----
ipcMain.handle('config:get', () => appConfig.getConfig());
ipcMain.handle('config:save', (event, config) => appConfig.saveConfig(config));
ipcMain.handle('config:lan-addresses', () => appConfig.getLanAddresses());
ipcMain.handle('app:restart', () => {
  app.relaunch();
  app.exit(0);
});
ipcMain.handle('app:open-config-window', () => {
  if (!setupWindow) createSetupWindow();
});

app.whenReady().then(demarrerSelonConfig);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (mainWindow === null && setupWindow === null) demarrerSelonConfig();
});
