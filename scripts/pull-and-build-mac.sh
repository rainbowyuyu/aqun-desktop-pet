#!/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> 结束运行中的桌宠进程（如有）"
pkill -f "${ROOT}/给阿群的生日礼物/启动.app" 2>/dev/null || true
pkill -f "启动.app/Contents/MacOS" 2>/dev/null || true

echo "==> git pull"
git pull

echo "==> npm install"
npm install

echo "==> npm run build:mac"
npm run build:mac

echo "✓ 完成。双击 给阿群的生日礼物.command 或 给阿群的生日礼物/启动.app 运行。"
