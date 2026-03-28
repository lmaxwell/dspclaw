import { app, BrowserWindow, ipcMain, safeStorage } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import axios from 'axios';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// DIST and VITE_PUBLIC definitions
process.env.DIST = path.join(__dirname, '../dist');
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : path.join(__dirname, '../public');

let win: BrowserWindow | null;
const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL'];

function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, 'favicon.svg'),
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    backgroundColor: '#0a0a0c',
  });

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString());
  });

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(process.env.DIST, 'index.html'));
  }
}

// Quit when all windows are closed, except on macOS.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
    win = null;
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.whenReady().then(createWindow);

// ----------------------------------------------------------------------------
// IPC Handlers
// ----------------------------------------------------------------------------

// 1. AI Request Proxy (Bypass CORS)
ipcMain.handle('ai-request', async (_event, options) => {
  try {
    const response = await axios({
      ...options,
      timeout: 30000,
    });
    return { data: response.data };
  } catch (error: any) {
    console.error('[ELECTRON] AI Request Error:', error.message);
    return { 
      error: error.response?.data?.error?.message || error.message || 'Unknown error during AI request' 
    };
  }
});

// 2. Safe Storage (Secure API Keys)
ipcMain.handle('safe-storage:encrypt', async (_event, text: string) => {
  if (!safeStorage.isEncryptionAvailable()) return null;
  return safeStorage.encryptString(text).toString('base64');
});

ipcMain.handle('safe-storage:decrypt', async (_event, encryptedBase64: string) => {
  if (!safeStorage.isEncryptionAvailable()) return null;
  try {
    const buffer = Buffer.from(encryptedBase64, 'base64');
    return safeStorage.decryptString(buffer);
  } catch (e) {
    console.error('[ELECTRON] Decryption failed:', e);
    return null;
  }
});

// 3. List Local Audio Files
ipcMain.handle('list-audio-files', async () => {
  try {
    const audioDir = path.join(process.env.VITE_PUBLIC, 'audio');
    if (!fs.existsSync(audioDir)) return [];

    const files = fs.readdirSync(audioDir);
    return files
      .filter(f => f.endsWith('.wav') || f.endsWith('.mp3'))
      .map(f => ({
        name: f.replace(/\.[^/.]+$/, "").replace(/_/g, " ").toUpperCase(),
        url: `./audio/${f}`
      }));
  } catch (e) {
    console.error('[ELECTRON] Failed to list audio files:', e);
    return [];
  }
});
