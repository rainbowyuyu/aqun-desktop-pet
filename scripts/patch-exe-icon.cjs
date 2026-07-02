/** 打包后为 exe 嵌入 aq logo 图标（无需 winCodeSign） */
const path = require('path');
const fs = require('fs');
const { APP_EXE_NAME, UNPACKED_DIR, STAGE_DIR } = require('./build-config.cjs');

async function patchExe(exePath) {
  if (!fs.existsSync(exePath)) return false;
  const ico = path.join(path.dirname(__dirname), 'build/icon.ico');
  if (!fs.existsSync(ico)) {
    console.warn('icon.ico not found, run build:icon first');
    return false;
  }
  const rcedit = require('rcedit');
  await rcedit(exePath, { icon: ico });
  console.log('exe icon patched:', exePath);
  return true;
}

async function main() {
  const root = path.join(__dirname, '..');
  const targets = [
    path.join(root, UNPACKED_DIR, APP_EXE_NAME),
    path.join(root, STAGE_DIR, APP_EXE_NAME),
  ];

  let patched = 0;
  for (const exe of targets) {
    if (await patchExe(exe)) patched += 1;
  }

  if (!patched) {
    console.warn('no exe found to patch');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
