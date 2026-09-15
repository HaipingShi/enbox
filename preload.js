const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('enbox', {
  getConfig: () => ipcRenderer.invoke('settings:get'),
  saveConfig: (patch) => ipcRenderer.invoke('settings:save', patch),
  send: (text) => ipcRenderer.invoke('chat:send', text),
  abort: () => ipcRenderer.send('chat:abort'),
  copy: (text) => ipcRenderer.invoke('copy:text', text),
  fold: () => ipcRenderer.invoke('win:fold'),
  expand: () => ipcRenderer.invoke('win:expand'),
  moveBy: (dx, dy) => ipcRenderer.send('win:moveBy', dx, dy),
  dock: (side) => ipcRenderer.invoke('win:dock', side),
  setPin: (on) => ipcRenderer.invoke('win:pin', on),
  hide: () => ipcRenderer.invoke('win:hide'),
  quit: () => ipcRenderer.send('app:quit'),
  onView: (cb) => ipcRenderer.on('view', (e, v) => cb(v)),
  onDelta: (cb) => ipcRenderer.on('chat:delta', (e, d) => cb(d)),
});
