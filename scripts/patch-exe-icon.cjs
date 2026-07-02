/** 打包后为 exe 嵌入 aq logo 图标（无需 winCodeSign） */
const path = require('path');
const fs = require('fs');

async function main() {
  const root = path.join(__dirname, '..');
  const exe = path.join(root, 'release/win-unpacked/阿群模型.exe');
  const ico = path.join(root, 'build/icon.ico');

  if (!fs.existsSync(exe)) {
    console.warn('exe not found, skip icon patch:', exe);
    return;
  }
  if (!fs.existsSync(ico)) {
    console.warn('icon.ico not found, run build:icon first');
    return;
  }

  const rcedit = require('rcedit');
  await rcedit(exe, { icon: ico });
  console.log('exe icon patched:', exe);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
