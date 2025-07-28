
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Settings & App Info
  getApiKey: () => ipcRenderer.invoke('get-api-key'),
  setApiKey: (key) => ipcRenderer.invoke('set-api-key', key),
  getTypingEffect: () => ipcRenderer.invoke('get-typing-effect'),
  setTypingEffect: (value) => ipcRenderer.invoke('set-typing-effect', value),
  getSyntaxTheme: () => ipcRenderer.invoke('get-syntax-theme'),
  setSyntaxTheme: (theme) => ipcRenderer.invoke('set-syntax-theme', theme),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  
  // New Project/File System API
  openProject: () => ipcRenderer.invoke('open-project'),
  readProjectTree: (projectRoot) => ipcRenderer.invoke('read-project-tree', projectRoot),
  readFile: (projectRoot, relativePath) => ipcRenderer.invoke('read-file', projectRoot, relativePath),
  writeFile: (projectRoot, relativePath, content) => ipcRenderer.invoke('write-file', projectRoot, relativePath, content),
  deleteNode: (projectRoot, relativePath) => ipcRenderer.invoke('delete-node', projectRoot, relativePath),
  renameNode: (projectRoot, oldRelativePath, newRelativePath) => ipcRenderer.invoke('rename-node', projectRoot, oldRelativePath, newRelativePath),
  createFile: (projectRoot, relativePath) => ipcRenderer.invoke('create-file', projectRoot, relativePath),
  createFolder: (projectRoot, relativePath) => ipcRenderer.invoke('create-folder', projectRoot, relativePath),
  onProjectUpdate: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('project-updated', listener);
    return () => ipcRenderer.removeListener('project-updated', listener);
  },

  // Chat History Management
  readChatHistory: (projectRoot) => ipcRenderer.invoke('read-chat-history', projectRoot),
  writeChatHistory: (projectRoot, history) => ipcRenderer.invoke('write-chat-history', projectRoot, history),

  // Updater APIs
  getAllowPrerelease: () => ipcRenderer.invoke('get-allow-prerelease'),
  setAllowPrerelease: (value) => ipcRenderer.invoke('set-allow-prerelease', value),
  checkForUpdates: () => ipcRenderer.send('check-for-updates'),
  startUpdateDownload: () => ipcRenderer.send('start-update-download'),
  quitAndInstall: () => ipcRenderer.send('quit-and-install'),
  onUpdateStatus: (callback) => {
    const listener = (event, data) => callback(data);
    ipcRenderer.on('update-status', listener);
    return () => ipcRenderer.removeListener('update-status', listener);
  },
  openLogFile: () => ipcRenderer.send('open-log-file'),
});
