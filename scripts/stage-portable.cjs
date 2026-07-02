/**
 * 将 release/win-unpacked 同步到项目根目录 启动/，便于直接双击运行
 */
const fs = require('fs');
const path = require('path');
const { APP_EXE_NAME, UNPACKED_DIR, STAGE_DIR } = require('./build-config.cjs');

function rimraf(dir) {
  if (!fs.existsSync(dir)) return;
  fs.rmSync(dir, { recursive: true, force: true });
}

function copyRecursive(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyRecursive(from, to);
    } else {
      fs.copyFileSync(from, to);
    }
  }
}

function main() {
  const root = path.join(__dirname, '..');
  const srcDir = path.join(root, UNPACKED_DIR);
  const stageDir = path.join(root, STAGE_DIR);
  const srcExe = path.join(srcDir, APP_EXE_NAME);

  if (!fs.existsSync(srcExe)) {
    console.error(`未找到打包产物: ${srcExe}`);
    console.error('请先运行 npm run build:win');
    process.exit(1);
  }

  console.log(`==> 同步便携版到 ${STAGE_DIR}/`);
  rimraf(stageDir);
  copyRecursive(srcDir, stageDir);

  const stageExe = path.join(stageDir, APP_EXE_NAME);
  console.log(`✓ ${stageExe}`);

  // 根目录快捷入口（跳转到 启动/ 目录运行，避免缺少 DLL）
  const rootLauncher = path.join(root, '启动.bat');
  fs.writeFileSync(
    rootLauncher,
    '@echo off\r\nstart "" "%~dp0启动\\启动.exe"\r\n',
    'utf8',
  );
  console.log(`✓ ${rootLauncher}`);
}

main();
