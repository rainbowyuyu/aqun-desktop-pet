/** 从 aq logo 生成 Windows .ico 与 macOS/通用 .png 图标 */
const fs = require('fs');
const path = require('path');

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
  fs.copyFileSync(src, pngOut);
  console.log('icon png ready:', pngOut);

  if (process.platform !== 'win32') return;

  let pngToIco;
  try {
    pngToIco = require('png-to-ico');
  } catch {
    console.warn('png-to-ico not installed, skipping .ico generation');
    return;
  }

  try {
    const buf = await pngToIco(src);
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
