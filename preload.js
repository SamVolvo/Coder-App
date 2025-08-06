const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Settings & App Info
  getApiKey: () => ipcRenderer.invoke('get-api-key'),
  setApiKey: (key) => ipcRenderer.invoke('set-api-key', key),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getAiProvider: () => ipcRenderer.invoke('get-ai-provider'),
  setAiProvider: (provider) => ipcRenderer.invoke('set-ai-provider', provider),
  getOllamaConfig: () => ipcRenderer.invoke('get-ollama-config'),
  setOllamaConfig: (config) => ipcRenderer.invoke('set-ollama-config', config),
  getOllamaModels: (url) => ipcRenderer.invoke('get-ollama-models', url),
  
  // New Project/File System API
  openProject: () => ipcRenderer.invoke('open-project'),
  readProjectTree: (projectRoot) => ipcRenderer.invoke('read-project-tree', projectRoot),
  readFile: (projectRoot, relativePath) => ipcRenderer.invoke('read-file', projectRoot, relativePath),
  writeFile: (payload) => ipcRenderer.invoke('write-file', payload),
  deleteNode: (projectRoot, relativePath) => ipcRenderer.invoke('delete-node', projectRoot, relativePath),
  renameNode: (projectRoot, oldRelativePath, newRelativePath) => ipcRenderer.invoke('rename-node', projectRoot, oldRelativePath, newRelativePath),
  createFile: (projectRoot, relativePath) => ipcRenderer.invoke('create-file', projectRoot, relativePath),
  createFolder: (projectRoot, relativePath) => ipcRenderer.invoke('create-folder', projectRoot, relativePath),
  uploadFile: (projectRoot) => ipcRenderer.invoke('upload-file', projectRoot),
  onProjectUpdate: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('project-updated', listener);
    return () => ipcRenderer.removeListener('project-updated', listener);
  },
  openInTerminal: (projectRoot) => ipcRenderer.invoke('open-in-terminal', projectRoot),

  // Chat History Management
  readChatHistory: (projectRoot) => ipcRenderer.invoke('read-chat-history', projectRoot),
  writeChatHistory: (projectRoot, history) => ipcRenderer.invoke('write-chat-history', projectRoot, history),

  // AI Service Invocation
  invokeOllama: (payload) => ipcRenderer.invoke('invoke-ollama', payload),

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

  // Feedback API
  sendFeedback: (payload) => ipcRenderer.invoke('send-feedback', payload),
});