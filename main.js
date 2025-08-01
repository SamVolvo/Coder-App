

const { app, BrowserWindow, ipcMain, Tray, Menu, shell, nativeImage, dialog } = require('electron');
const path = require('path');
const fs = require('fs/promises');
const Store = require('electron-store');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');
const chokidar = require('chokidar');
const { exec } = require('child_process');

// --- Log Configuration ---
log.transports.file.level = 'info';
log.transports.file.resolvePathFn = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const fileName = `${year}-${month}-${day}.log`;
  return path.join(app.getPath('userData'), 'logs', fileName);
};
autoUpdater.logger = log;
log.catchErrors({ showDialog: false });
log.info('App starting...');

const store = new Store();
const allowPrerelease = store.get('allowPrerelease', false);
autoUpdater.allowPrerelease = allowPrerelease;

if (process.platform === 'darwin') {
  autoUpdater.autoDownload = false;
  log.info('macOS detected, setting autoDownload to false.');
} else {
  autoUpdater.autoDownload = true;
  log.info(`Platform is ${process.platform}, setting autoDownload to true.`);
}
log.info(`Auto-updater configured with allowPrerelease: ${allowPrerelease}`);


app.commandLine.appendSwitch('disable-features', 'Autofill');

let tray = null;
let mainWindow;
let watcher = null;
let isInternalChange = false;
const windowIconPath = path.join(__dirname, 'assets', process.platform === 'win32' ? 'icon.ico' : 'icon.png');


function createWindow() {
  log.info('Creating main window...');
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    icon: windowIconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  
  mainWindow.setMenu(null);

  if (!app.isPackaged) {
    log.info('Development mode detected. Loading from Vite server.');
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    log.info('Packaged mode detected. Loading from dist/index.html.');
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }
}

// --- File System Watcher ---
function setupWatcher(projectRoot) {
  if (watcher) {
    log.info('Closing existing file watcher.');
    watcher.close();
  }
  log.info(`Setting up new file watcher for path: ${projectRoot}`);
  watcher = chokidar.watch(projectRoot, {
    ignored: /(^|[\/\\])\..|node_modules|dist|build/, // ignore dotfiles, node_modules, etc.
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 500,
      pollInterval: 100,
    },
  });

  watcher
    .on('all', (event, path) => {
      if (isInternalChange) {
        log.info(`Watcher event ignored (internal change): ${event} on path: ${path}`);
        return;
      }
      log.info(`Watcher event: ${event} on path: ${path}`);
      if (mainWindow) {
        mainWindow.webContents.send('project-updated');
      }
    })
    .on('error', error => log.error(`Watcher error: ${error}`));
}


// --- IPC Handlers ---
ipcMain.handle('get-api-key', () => store.get('apiKey'));
ipcMain.handle('set-api-key', (event, key) => store.set('apiKey', key));
ipcMain.handle('get-typing-effect', () => store.get('useTypingEffect', true));
ipcMain.handle('set-typing-effect', (event, value) => store.set('useTypingEffect', value));
ipcMain.handle('get-syntax-theme', () => store.get('syntaxTheme', 'vsc-dark-plus'));
ipcMain.handle('set-syntax-theme', (event, theme) => store.set('syntaxTheme', theme));
ipcMain.handle('get-app-version', () => app.getVersion());
ipcMain.handle('get-allow-prerelease', () => store.get('allowPrerelease', false));
ipcMain.handle('set-allow-prerelease', (event, value) => {
  store.set('allowPrerelease', value);
  autoUpdater.allowPrerelease = value;
});

ipcMain.handle('open-in-terminal', (event, projectRoot) => {
  if (!projectRoot) return;

  const command = {
    win32: 'start cmd',
    darwin: `open -a Terminal "${projectRoot}"`,
    linux: `gnome-terminal --working-directory="${projectRoot}" || x-terminal-emulator --working-directory="${projectRoot}"`
  }[process.platform];

  if (command) {
    exec(command, { cwd: projectRoot }, (error, stdout, stderr) => {
      if (error) {
        log.error(`Failed to open terminal: ${error.message}`);
        // Fallback for Linux if gnome-terminal and x-terminal-emulator fail
        if (process.platform === 'linux') {
            exec(`xdg-open "${projectRoot}"`, (fallbackError) => {
                if(fallbackError) log.error(`Fallback terminal command failed: ${fallbackError.message}`);
            });
        }
      }
      if (stderr) {
        log.warn(`Terminal command stderr: ${stderr}`);
      }
    });
  } else {
    log.error(`Unsupported platform for opening terminal: ${process.platform}`);
  }
});


// --- New Disk-Based Project Handlers ---

ipcMain.handle('open-project', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] });
    if (canceled || !filePaths.length) return null;
    const projectRoot = filePaths[0];
    setupWatcher(projectRoot);
    return projectRoot;
});

ipcMain.handle('upload-file', async (event, projectRoot) => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile'],
        title: 'Select a file to upload',
    });
    if (canceled || !filePaths.length) return null;

    const sourcePath = filePaths[0];
    const fileName = path.basename(sourcePath);
    const destinationPath = path.join(projectRoot, fileName);
    const relativePath = path.relative(projectRoot, destinationPath).replace(/\\/g, '/');

    try {
        const content = await fs.readFile(sourcePath); // Read as buffer to support all file types
        await fs.writeFile(destinationPath, content);
        log.info(`Uploaded file from ${sourcePath} to ${destinationPath}`);
        return relativePath;
    } catch (e) {
        log.error(`Error uploading file:`, e);
        throw e; // Rethrow to be caught by the renderer
    }
});

const ignoredDirs = new Set(['node_modules', '.git', '.vscode', '__pycache__', 'dist', 'build', '.coder']);
async function readProjectTree(currentPath, rootDir) {
    const results = [];
    try {
        const dirents = await fs.readdir(currentPath, { withFileTypes: true });
        for (const dirent of dirents) {
            if (ignoredDirs.has(dirent.name)) continue;

            const fullPath = path.join(currentPath, dirent.name);
            const relativePath = path.relative(rootDir, fullPath).replace(/\\/g, '/');
            
            if (dirent.isDirectory()) {
                results.push({
                    type: 'folder',
                    name: dirent.name,
                    path: relativePath,
                    children: await readProjectTree(fullPath, rootDir),
                });
            } else {
                results.push({ type: 'file', name: dirent.name, path: relativePath });
            }
        }
    } catch(e) {
        log.error(`Error reading directory ${currentPath}:`, e);
    }
    return results;
}

ipcMain.handle('read-project-tree', (event, projectRoot) => {
    if (!projectRoot) return null;
    return readProjectTree(projectRoot, projectRoot);
});

ipcMain.handle('read-file', (event, projectRoot, relativePath) => fs.readFile(path.join(projectRoot, relativePath), 'utf-8'));

ipcMain.handle('write-file', async (event, projectRoot, relativePath, content) => {
  isInternalChange = true;
  try {
    const fullPath = path.join(projectRoot, relativePath);
    const dir = path.dirname(fullPath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(fullPath, content, 'utf-8');
  } catch (err) {
    log.error(`Error writing file ${relativePath}:`, err);
    throw err;
  } finally {
    // This short delay prevents the watcher from firing on our own changes.
    // It's a more robust way to handle the race condition than the previous timeout implementation.
    setTimeout(() => {
      isInternalChange = false;
    }, 250);
  }
});

ipcMain.handle('delete-node', (event, projectRoot, relativePath) => fs.rm(path.join(projectRoot, relativePath), { recursive: true, force: true }));
ipcMain.handle('rename-node', (event, projectRoot, oldRelativePath, newRelativePath) => fs.rename(path.join(projectRoot, oldRelativePath), path.join(projectRoot, newRelativePath)));
ipcMain.handle('create-file', (event, projectRoot, relativePath) => fs.writeFile(path.join(projectRoot, relativePath), ''));
ipcMain.handle('create-folder', (event, projectRoot, relativePath) => fs.mkdir(path.join(projectRoot, relativePath), { recursive: true }));

const getChatHistoryPath = (projectRoot) => path.join(projectRoot, '.coder', 'chat.json');

ipcMain.handle('read-chat-history', async (event, projectRoot) => {
    try {
        const historyPath = getChatHistoryPath(projectRoot);
        const data = await fs.readFile(historyPath, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        return []; // Return empty array if file doesn't exist or is invalid
    }
});

ipcMain.handle('write-chat-history', async (event, projectRoot, history) => {
    try {
        const coderDir = path.join(projectRoot, '.coder');
        await fs.mkdir(coderDir, { recursive: true });
        const historyPath = getChatHistoryPath(projectRoot);
        await fs.writeFile(historyPath, JSON.stringify(history, null, 2));
    } catch(e) {
        log.error('Failed to write chat history:', e);
    }
});

// --- Updater and Logging ---
ipcMain.on('check-for-updates', () => {
  log.info("IPC: 'check-for-updates' received.");
  if (app.isPackaged) {
    autoUpdater.checkForUpdates().catch(err => {
        // The UI will receive an 'error' status from the 'error' event listener,
        // so we just need to log it here and prevent a crash.
        log.error('Error during manual update check:', err);
    });
  }
});

ipcMain.on('start-update-download', () => {
    log.info("IPC: 'start-update-download' received.");
    autoUpdater.downloadUpdate();
});

ipcMain.on('quit-and-install', async () => {
    log.info("IPC: 'quit-and-install' received.");
    app.isQuitting = true;
    if (process.platform === 'linux') {
        log.info("Platform is Linux. Showing manual restart dialog before quitting.");
        await dialog.showMessageBox(mainWindow, {
            type: 'info',
            title: 'Update Ready to Install',
            message: 'A new version has been downloaded.',
            detail: 'The application will now close. Please restart it to apply the update.'
        });
    }
    autoUpdater.quitAndInstall();
});

ipcMain.on('open-log-file', () => shell.showItemInFolder(log.transports.file.getFile().path));

// --- AutoUpdater Event Listeners for UI Feedback ---
autoUpdater.on('update-available', (info) => {
  log.info('Update available.', info);
  mainWindow?.webContents.send('update-status', { status: 'available', info });
});

autoUpdater.on('update-not-available', (info) => {
  log.info('Update not available.', info);
  mainWindow?.webContents.send('update-status', { status: 'not-available', info });
});

autoUpdater.on('error', (err) => {
  log.error('Error in auto-updater:', err);
  const errorMessage = (err instanceof Error ? err.message : String(err)) || 'An unknown error occurred';
  mainWindow?.webContents.send('update-status', { status: 'error', error: errorMessage });
});

autoUpdater.on('download-progress', (progressObj) => {
  log.info(`Download speed: ${progressObj.bytesPerSecond} - Downloaded ${progressObj.percent}% (${progressObj.transferred}/${progressObj.total})`);
  mainWindow?.webContents.send('update-status', { status: 'downloading', progress: { percent: progressObj.percent } });
});

autoUpdater.on('update-downloaded', (info) => {
  log.info('Update downloaded.', info);
  mainWindow?.webContents.send('update-status', { status: 'downloaded', info });
});


// --- App Lifecycle ---
app.whenReady().then(() => {
  try {
    log.info('App is ready.');
    createWindow();
    
    log.info('Creating system tray icon...');
    let trayIconPath = path.join(__dirname, 'assets', 'icon.png');
    let trayIcon = nativeImage.createFromPath(trayIconPath).resize({ width: 16, height: 16 });
    if (process.platform === 'darwin') trayIcon.setTemplateImage(true);
    
    tray = new Tray(trayIcon);
    const contextMenu = Menu.buildFromTemplate([
      { label: 'Show App', click: () => mainWindow?.show() },
      { label: 'Quit', click: () => { app.isQuitting = true; app.quit(); } }
    ]);
    tray.setToolTip('Coder App');
    tray.setContextMenu(contextMenu);
    log.info('System tray created successfully.');

    if (app.isPackaged) {
      // Check silently on startup, but don't download.
      // The user can trigger download from the settings UI.
      autoUpdater.checkForUpdates().catch(err => {
        // This is a silent check, so we'll just log the error.
        // The user can manually check for updates later.
        log.error('Error during startup update check:', err);
      });
    }
  } catch(error) {
    log.error('Failed to create main window or tray:', error);
    if (app) app.quit();
  }

  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
    log.info('App is quitting.');
    if (watcher) watcher.close();
});