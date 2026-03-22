import sharp from 'sharp';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const svgPath = path.join(root, 'public', 'favicon.svg');
const pngPath = path.join(root, 'public', 'icon.png');

async function convert() {
  console.log(`Converting SVG to PNG: ${svgPath}`);
  
  await sharp(svgPath)
    .resize(1024, 1024)
    .png()
    .toFile(pngPath);
    
  console.log(`Successfully generated: ${pngPath}`);
}

convert().catch(console.error);
