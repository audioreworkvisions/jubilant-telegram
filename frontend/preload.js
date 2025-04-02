const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld(
  'api', {
    getBackendUrl: () => ipcRenderer.invoke('get-backend-url'),
    
    log: (level, message) => {
      const validLevels = ['info', 'warn', 'error', 'debug'];
      if (validLevels.includes(level)) {
        ipcRenderer.send('log', { level, message });
      }
    }
  }
);
