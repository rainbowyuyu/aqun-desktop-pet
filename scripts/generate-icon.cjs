/** 从 aq logo 生成 Windows .ico 与 macOS/通用 .png 图标 */
const fs = require('fs');
const path = require('path');

const ICON_PNG_SIZE = 512;

async function writeIconPng(src, dest) {
  const sharp = require('sharp');
  const meta = await sharp(src).metadata();
  const maxDim = Math.max(meta.width || 0, meta.height || 0);

  if (maxDim >= ICON_PNG_SIZE) {
    await sharp(src).png().toFile(dest);
    console.log(`icon png ready: ${dest} (${meta.width}x${meta.height})`);
    return dest;
  }

  await sharp(src)
    .resize(ICON_PNG_SIZE, ICON_PNG_SIZE, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toFile(dest);
  console.log(`icon png upscaled to ${ICON_PNG_SIZE}x${ICON_PNG_SIZE}: ${dest}`);
  return dest;
}

async function main() {
  const root = path.join(__dirname, '..');
  const src = path.join(root, 'public/logo.png');
  const buildDir = path.join(root, 'build');
  const pngOut = path.join(buildDir, 'icon.png');
  const icoOut = path.join(buildDir, 'icon.ico');

  if (!fs.existsSync(src)) {
    console.error('logo not found:', src);
    process.exit(1);
  }

  fs.mkdirSync(buildDir, { recursive: true });
  const iconSrc = await writeIconPng(src, pngOut);

  if (process.platform !== 'win32') return;

  let pngToIco;
  try {
    pngToIco = require('png-to-ico');
  } catch {
    console.warn('png-to-ico not installed, skipping .ico generation');
    return;
  }

  try {
    const buf = await pngToIco(iconSrc);
    fs.writeFileSync(icoOut, buf);
    console.log('icon generated:', icoOut);
  } catch (err) {
    console.warn('png-to-ico failed, skipping .ico generation:', err.message);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
