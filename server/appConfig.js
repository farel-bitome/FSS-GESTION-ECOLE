const path = require('path');
const fs = require('fs');
const os = require('os');

function getConfigPath() {
  let baseDir;
  try {
    const { app } = require('electron');
    baseDir = app.getPath('userData');
  } catch (e) {
    baseDir = path.join(__dirname, '..');
  }
  return path.join(baseDir, 'config.json');
}

function getConfig() {
  const configPath = getConfigPath();
  if (!fs.existsSync(configPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  } catch (e) {
    return null;
  }
}

function saveConfig(config) {
  const configPath = getConfigPath();
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
  return config;
}

// Adresses IPv4 locales (reseau local uniquement) pour affichage a l'admin
function getLanAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push({ interface: name, address: iface.address, type: 'LAN' });
      }
    }
  }
  return addresses;
}

module.exports = { getConfig, saveConfig, getLanAddresses, getConfigPath };
