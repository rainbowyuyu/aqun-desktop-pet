# 从 GitHub 拉取最新代码并打包 Windows 版
# 用法: .\scripts\pull-and-build.ps1 [-Branch main] [-SkipKill]
param(
  [string]$Branch = "main",
  [switch]$SkipKill
)

$ErrorActionPreference = "Stop"
$Root = Split-Path $PSScriptRoot -Parent
Set-Location $Root

Write-Host "==> 阿群模型 · 拉取并打包" -ForegroundColor Cyan
Write-Host "    目录: $Root"
Write-Host "    分支: $Branch"

if (-not (Test-Path ".git")) {
  Write-Error "当前目录不是 git 仓库。请先 clone：`n  git clone https://github.com/rainbowyuyu/aqun-desktop-pet.git"
}

if (-not $SkipKill) {
  Write-Host "==> 结束正在运行的阿群模型..." -ForegroundColor Yellow
  Get-Process -Name "阿群模型", "electron" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 2
}

Write-Host "==> git fetch / pull..." -ForegroundColor Cyan
git fetch origin
$current = git rev-parse --abbrev-ref HEAD
if ($current -ne $Branch) {
  git checkout $Branch
}
git pull origin $Branch

Write-Host "==> npm install..." -ForegroundColor Cyan
npm install

Write-Host "==> npm run check-update..." -ForegroundColor Cyan
npm run check-update
if ($LASTEXITCODE -eq 2) {
  Write-Host "    (远程版本较新，继续打包)" -ForegroundColor DarkYellow
}

Write-Host "==> npm run build:win..." -ForegroundColor Cyan
npm run build:win

$exe = Join-Path $Root "release\win-unpacked\阿群模型.exe"
if (Test-Path $exe) {
  Write-Host ""
  Write-Host "✓ 打包完成" -ForegroundColor Green
  Write-Host "  $exe"
} else {
  Write-Error "未找到输出 exe，请检查 build 日志"
}
