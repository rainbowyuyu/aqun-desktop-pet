# 首次从 GitHub 克隆并构建
# 用法: .\scripts\setup-from-github.ps1 [-TargetDir "D:\apps\aqun-desktop-pet"]
param(
  [string]$TargetDir = "",
  [string]$Branch = "main"
)

$ErrorActionPreference = "Stop"
$RepoUrl = "https://github.com/rainbowyuyu/aqun-desktop-pet.git"

if (-not $TargetDir) {
  $TargetDir = Join-Path (Get-Location) "aqun-desktop-pet"
}

if (Test-Path $TargetDir) {
  Write-Error "目标目录已存在: $TargetDir`n请删除后重试，或直接进入目录运行 pull-and-build.ps1"
}

Write-Host "==> 克隆仓库..." -ForegroundColor Cyan
git clone --branch $Branch $RepoUrl $TargetDir

Set-Location $TargetDir

Write-Host "==> 安装依赖并打包..." -ForegroundColor Cyan
npm install
npm run build:win

$exe = Join-Path $TargetDir "启动\启动.exe"
Write-Host ""
Write-Host "✓ 完成: $exe" -ForegroundColor Green
