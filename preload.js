const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getConfig: () => ipcRenderer.invoke('config:get'),
  saveConfig: (config) => ipcRenderer.invoke('config:save', config),
  getLanAddresses: () => ipcRenderer.invoke('config:lan-addresses'),
  restartApp: () => ipcRenderer.invoke('app:restart'),
  openConfigWindow: () => ipcRenderer.invoke('app:open-config-window')
});
