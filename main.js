const { app, BrowserWindow } = require('electron');
const path = require('path');

// Demarre le serveur Express dans le meme processus
require('./server/index.js');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    icon: path.join(__dirname, 'public', 'img', 'logo.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    },
    title: 'Ecole Gestion - FALLSERVICES&SOLUTIONS INFO'
  });

  // Laisse le temps au serveur Express de demarrer avant de charger la page
  setTimeout(() => {
    mainWindow.loadURL('http://localhost:4790/login.html');
  }, 500);

  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) createWindow();
});
