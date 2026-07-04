/**
 * 将 release/mac-* 下的 .app 同步到项目根目录便携文件夹，便于双击运行
 */
const fs = require('fs');
const path = require('path');
const {
  MAC_APP_NAME,
  MAC_RELEASE_DIR,
  STAGE_DIR,
  STAGE_LAUNCHER_COMMAND,
  LEGACY_STAGE_DIRS = [],
} = require('./build-config.cjs');

function rimraf(target) {
  if (!fs.existsSync(target)) return;
  fs.rmSync(target, { recursive: true, force: true });
}

function findMacApp(root) {
  const releaseDir = path.join(root, MAC_RELEASE_DIR);
  if (!fs.existsSync(releaseDir)) return null;

  const dirs = fs
    .readdirSync(releaseDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith('mac'))
    .map((entry) => entry.name)
    .sort();

  for (const dir of dirs) {
    const appPath = path.join(releaseDir, dir, MAC_APP_NAME);
    if (fs.existsSync(appPath)) return appPath;
  }

  return null;
}

function copyAppBundle(srcApp, destApp) {
  rimraf(destApp);
  fs.cpSync(srcApp, destApp, { recursive: true });
}

function main() {
  const root = path.join(__dirname, '..');
  const srcApp = findMacApp(root);

  if (!srcApp) {
    console.error(`未找到打包产物: ${MAC_APP_NAME}`);
    console.error('请先在本机 macOS 上运行 npm run build:mac');
    process.exit(1);
  }

  for (const legacy of LEGACY_STAGE_DIRS) {
    if (legacy && legacy !== STAGE_DIR) {
      rimraf(path.join(root, legacy));
    }
  }

  const stageDir = path.join(root, STAGE_DIR);
  const stageApp = path.join(stageDir, MAC_APP_NAME);

  console.log(`==> 同步便携版到 ${STAGE_DIR}/`);
  rimraf(stageDir);
  fs.mkdirSync(stageDir, { recursive: true });
  copyAppBundle(srcApp, stageApp);
  console.log(`✓ ${stageApp}`);

  const launcherPath = path.join(root, STAGE_LAUNCHER_COMMAND);
  const launcherBody = `#!/bin/bash
cd "$(dirname "$0")"
open "./${STAGE_DIR}/${MAC_APP_NAME}"
`;
  fs.writeFileSync(launcherPath, launcherBody, 'utf8');
  fs.chmodSync(launcherPath, 0o755);
  console.log(`✓ ${launcherPath}`);
}

main();
