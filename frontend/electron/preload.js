const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
    platform: process.platform,
    organizer: {
        start: (opts) => ipcRenderer.invoke('organizer:start', opts),
        getDefaultScanRoots: () => ipcRenderer.invoke('organizer:get-default-roots'),
    },
    openFile: (path) => ipcRenderer.invoke('file:open', path),
    onOrganizerProgress: (cb) => {
        ipcRenderer.on('organizer:progress', (_, data) => cb(data));
        return () => ipcRenderer.removeAllListeners('organizer:progress');
    },
    getApiConfig: () => ipcRenderer.invoke('get-api-config'),
});
