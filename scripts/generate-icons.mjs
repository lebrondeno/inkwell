import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const publicDir = path.join(rootDir, 'public');

const svgPath = path.join(publicDir, 'favicon.svg');
const svg = fs.readFileSync(svgPath, 'utf8');

const targets = [
  { name: 'icon-512.png', width: 512, height: 512 },
  { name: 'icon-512x512.png', width: 512, height: 512 },
  { name: 'icon-512x512-maskable.png', width: 512, height: 512 },
  { name: 'icon-192.png', width: 192, height: 192 },
  { name: 'icon-192x192.png', width: 192, height: 192 },
  { name: 'icon-192x192-maskable.png', width: 192, height: 192 },
  { name: 'apple-touch-icon.png', width: 180, height: 180 },
];

for (const target of targets) {
  const resvg = new Resvg(svg, {
    fitTo: {
      mode: 'width',
      value: target.width,
    },
  });
  const pngData = resvg.render();
  const pngBuffer = pngData.asPng();
  const destPath = path.join(publicDir, target.name);
  fs.writeFileSync(destPath, pngBuffer);
  console.log(`Generated ${target.name} (${target.width}x${target.height})`);
}
