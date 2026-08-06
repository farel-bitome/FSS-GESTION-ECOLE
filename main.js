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

function createMainWindow() {
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
  mainWindow.on('closed', () => { mainWindow = null; });
  return mainWindow;
}

function demarrerSelonConfig() {
  const config = appConfig.getConfig();

  if (!config || !config.mode) {
    createSetupWindow();
    return;
  }

  if (config.mode === 'serveur') {
    startLocalServer();
    setTimeout(() => {
      const win = createMainWindow();
      win.loadURL('http://localhost:4790/login.html');
    }, 500);
  } else {
    // Poste client : passe par l'ecran de connexion qui teste la liaison
    // reseau avant de rediriger vers la page de login du serveur distant.
    const win = createMainWindow();
    win.loadFile(path.join(__dirname, 'public', 'connecting.html'), {
      query: {
        ip: config.server_ip || '',
        port: String(config.server_port || '4790')
      }
    });
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
