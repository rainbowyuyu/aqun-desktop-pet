# 首次创建 GitHub 仓库并推送（需先 gh auth login）
# 用法: .\scripts\publish-to-github.ps1 [-Private]
param(
  [switch]$Private
)

$ErrorActionPreference = "Stop"
$Root = Split-Path $PSScriptRoot -Parent
Set-Location $Root

$gh = "C:\Program Files\GitHub CLI\gh.exe"
if (-not (Test-Path $gh)) {
  $cmd = Get-Command gh -ErrorAction SilentlyContinue
  if ($cmd) { $gh = $cmd.Source }
}
if (-not $gh) {
  Write-Error "未找到 GitHub CLI。请安装: winget install GitHub.cli`n然后运行: gh auth login"
}

& $gh auth status 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
  Write-Host "请先登录 GitHub:" -ForegroundColor Yellow
  Write-Host "  gh auth login" -ForegroundColor Cyan
  exit 1
}

$visibility = if ($Private) { "--private" } else { "--public" }

Write-Host "==> 创建远程仓库并推送..." -ForegroundColor Cyan
& $gh repo create rainbowyuyu/aqun-desktop-pet $visibility --source=. --remote=origin --push --description "阿群模型 · Windows 透明悬浮 3D 桌面宠物"

if ($LASTEXITCODE -eq 0) {
  Write-Host ""
  Write-Host "✓ 已推送到 https://github.com/rainbowyuyu/aqun-desktop-pet" -ForegroundColor Green
  Write-Host ""
  Write-Host "可选：创建 Release 标签 v2.4.0" -ForegroundColor DarkYellow
  Write-Host "  gh release create v2.4.0 --title v2.4.0 --notes-file README.md"
}
