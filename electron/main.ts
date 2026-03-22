import { app, BrowserWindow, ipcMain, safeStorage } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import axios from 'axios';
import updater from 'electron-updater';

const { autoUpdater } = updater;

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ... (DIST and VITE_PUBLIC definitions)
process.env.DIST = path.join(__dirname, '../dist');
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : path.join(__dirname, '../public');

let win: BrowserWindow | null;
const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL'];

// --- Auto Updater Setup ---
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

// --- IPC Handlers ---
// IPC Handlers for Secure Storage
ipcMain.handle('safe-storage:encrypt', (_, text: string) => {
  if (!safeStorage.isEncryptionAvailable()) return text;
  return safeStorage.encryptString(text).toString('base64');
});

ipcMain.handle('safe-storage:decrypt', (_, encryptedBase64: string) => {
  if (!safeStorage.isEncryptionAvailable() || !encryptedBase64) return '';
  try {
    const buffer = Buffer.from(encryptedBase64, 'base64');
    return safeStorage.decryptString(buffer);
  } catch (e) {
    console.error('Failed to decrypt:', e);
    return '';
  }
});

// IPC Handler for AI Proxy (Bypass CORS in packaged app)
ipcMain.handle('ai-request', async (_, { url, method, data, headers }) => {
  try {
    const response = await axios({
      url,
      method,
      data,
      headers: {
        ...headers,
        'User-Agent': 'DSPCLAW-Electron'
      }
    });
    return { data: response.data };
  } catch (error: any) {
    console.error('AI Proxy Error:', error.response?.data || error.message);
    return { 
      error: error.response?.data?.error?.message || error.message,
      status: error.response?.status
    };
  }
});

// IPC Handler to trigger update install
ipcMain.on('install-update', () => {
  autoUpdater.quitAndInstall();
});

// IPC Handler to list audio files
ipcMain.handle('list-audio-files', async () => {
  const audioDir = path.join(process.env.VITE_PUBLIC, 'audio');
  try {
    if (!fs.existsSync(audioDir)) return [];
    const files = fs.readdirSync(audioDir);
    return files
      .filter(f => f.endsWith('.mp3') || f.endsWith('.wav'))
      .map(f => ({
        name: f.replace(/\.[^/.]+$/, "").replace(/_/g, ' ').toUpperCase(),
        url: `./audio/${f}`
      }));
  } catch (e) {
    console.error('Failed to list audio files:', e);
    return [];
  }
});

function createWindow() {
  const iconPath = path.join(process.env.VITE_PUBLIC, 'icon.png');
  
  // Set Dock icon for macOS
  if (process.platform === 'darwin') {
    app.dock.setIcon(iconPath);
  }

  win = new BrowserWindow({
    title: 'DSPCLAW',
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    width: 1200,
    height: 800,
    backgroundColor: '#121214',
  });

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date()).toLocaleString());
  });

  // --- Auto Updater Events ---
  autoUpdater.on('update-available', () => {
    win?.webContents.send('update-available');
  });

  autoUpdater.on('update-downloaded', () => {
    win?.webContents.send('update-downloaded');
  });

  autoUpdater.on('error', (err) => {
    console.error('AutoUpdater Error:', err);
    win?.webContents.send('update-error', err.message);
  });

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    // win.loadFile('dist/index.html')
    win.loadFile(path.join(process.env.DIST, 'index.html'));
    
    // Check for updates when packaged
    autoUpdater.checkForUpdatesAndNotify();
  }
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
    win = null;
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.whenReady().then(createWindow);
