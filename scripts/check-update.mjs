#!/usr/bin/env node
/**
 * 命令行检查 GitHub 是否有新版本
 * 用法: npm run check-update
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
const { owner, repo, branch } = require(path.join(root, 'electron/repoConfig.cjs'));
const { checkForUpdate } = require(path.join(root, 'electron/updateChecker.cjs'));

const result = await checkForUpdate({
  owner,
  repo,
  branch,
  currentVersion: pkg.version,
});

if (!result.ok) {
  console.error(`检查失败: ${result.error || '未知错误'}`);
  console.error(`仓库可能尚未创建或网络不可达: ${result.repoUrl}`);
  process.exit(1);
}

console.log(`当前版本: v${result.currentVersion}`);
console.log(`远程版本: v${result.latestVersion} (${result.source})`);

if (result.hasUpdate) {
  console.log('\n✦ 发现新版本！');
  console.log(`  发布页: ${result.releaseUrl}`);
  console.log(`  仓库:   ${result.repoUrl}`);
  console.log('\n拉取并打包:');
  console.log('  npm run update:build');
  console.log('或 PowerShell:');
  console.log('  .\\scripts\\pull-and-build.ps1');
  process.exit(2);
}

console.log('\n已是最新版本。');
process.exit(0);
