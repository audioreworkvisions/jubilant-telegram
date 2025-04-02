const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const log = require('electron-log');

log.transports.file.level = 'info';
log.transports.console.level = 'debug';

let mainWindow;

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000';

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('[REDACTED SECRET]');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, 'build', 'index.html'));
  }

  mainWindow.on('closed', () => {
    log.info('Main window closed');
    mainWindow = null;
  });

  log.info('Main window created');
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.handle('get-backend-url', () => {
  return BACKEND_URL;
});

app.on('ready', () => {
  log.info('Application is ready');
});

app.on('quit', () => {
  log.info('Application is quitting');
});

process.on('uncaughtException', (error) => {
  log.error('Uncaught exception:', error);
});
