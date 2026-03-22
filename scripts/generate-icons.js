import { nativeImage } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

async function generate() {
  const svgPath = path.join(root, 'public', 'favicon.svg');
  const pngPath = path.join(root, 'public', 'icon.png');

  console.log(`Reading SVG from: ${svgPath}`);
  
  // Use Electron's nativeImage to handle SVG to PNG
  // We specify a large size for better quality
  const image = nativeImage.createFromPath(svgPath);
  
  if (image.isEmpty()) {
    console.error('Failed to load SVG. Make sure the path is correct.');
    process.exit(1);
  }

  // Resizing to a standard large icon size
  const pngBuffer = image.resize({ width: 1024, height: 1024 }).toPNG();
  
  fs.writeFileSync(pngPath, pngBuffer);
  console.log(`Successfully generated PNG at: ${pngPath}`);
  process.exit(0);
}

generate().catch(err => {
  console.error(err);
  process.exit(1);
});
