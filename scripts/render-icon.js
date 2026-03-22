import { app, BrowserWindow, ipcMain } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

app.whenReady().then(() => {
  const win = new BrowserWindow({
    show: false, // Hidden window
    webPreferences: {
      offscreen: true
    }
  });

  const svgContent = fs.readFileSync(path.join(root, 'public', 'favicon.svg'), 'utf8');
  
  // We'll inject a script to render SVG to Canvas and send back the data
  const html = `
    <html>
      <body>
        <canvas id="canvas" width="1024" height="1024"></canvas>
        <script>
          const { ipcRenderer } = require('electron');
          const canvas = document.getElementById('canvas');
          const ctx = canvas.getContext('2d');
          const svg = \`${svgContent.replace(/`/g, '\\`').replace(/\${/g, '\\${')}\`;
          
          const img = new Image();
          const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
          const url = URL.createObjectURL(svgBlob);
          
          img.onload = () => {
            ctx.drawImage(img, 0, 0, 1024, 1024);
            const dataUrl = canvas.toDataURL('image/png');
            ipcRenderer.send('render-complete', dataUrl);
          };
          img.src = url;
        </script>
      </body>
    </html>
  `;

  ipcMain.on('render-complete', (event, dataUrl) => {
    const base64Data = dataUrl.replace(/^data:image\/png;base64,/, "");
    const buffer = Buffer.from(base64Data, 'base64');
    fs.writeFileSync(path.join(root, 'public', 'icon.png'), buffer);
    console.log('Successfully generated public/icon.png');
    app.quit();
  });

  // Enable nodeIntegration for the temporary render window
  win.webContents.executeJavaScript(`
    const { ipcRenderer } = require('electron');
    const svg = \`${svgContent.replace(/`/g, '\\`').replace(/\${/g, '\\${')}\`;
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    const img = new Image();
    const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    img.onload = () => {
      ctx.drawImage(img, 0, 0, 1024, 1024);
      ipcRenderer.send('render-complete', canvas.toDataURL('image/png'));
    };
    img.src = url;
  `);
});
