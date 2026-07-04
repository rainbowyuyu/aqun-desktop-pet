# 桌面模型 · aqun-desktop-pet

Windows 透明悬浮 3D 桌面宠物：绑骨模型、眼神跟随、键盘反馈、控制中心、日历与姿势编辑器。

**当前版本：** v2.4.0  
**GitHub：** https://github.com/rainbowyuyu/aqun-desktop-pet

---

## 开发

```bash
cd desktop-pet
npm install
npm run dev
```

## 构建

```bash
npm run build:win
# 输出：
#   release/win-unpacked/启动.exe
#   给阿群的生日礼物/启动.exe   ← 项目根目录便携版，可直接双击
```

打包前请关闭正在运行的桌宠或 Electron 进程，否则可能因文件占用失败。

---

## 首次从 GitHub 获取

### 方式 A：克隆已有目录后更新

```powershell
git clone https://github.com/rainbowyuyu/aqun-desktop-pet.git
cd aqun-desktop-pet
npm install
npm run build:win
```

### 方式 B：一键脚本（新目录）

```powershell
.\scripts\setup-from-github.ps1 -TargetDir "D:\apps\aqun-desktop-pet"
```

---

## 检查版本更新

对比本地 `package.json` 与 GitHub 远程（优先 latest release，否则 main 分支 package.json）。

```bash
npm run check-update
```

- 退出码 `0`：已是最新  
- 退出码 `2`：发现新版本  

应用内：**控制中心 → 高级 → 版本更新 → 检查更新**

---

## 拉取新版本并重新打包

在已 clone 的仓库目录中：

```powershell
npm run update:build
```

等价于：

```powershell
.\scripts\pull-and-build.ps1
```

脚本会：结束运行中的 exe → `git pull` → `npm install` → `npm run build:win`

可选参数：

```powershell
.\scripts\pull-and-build.ps1 -Branch main -SkipKill
```

---

## 首次发布到 GitHub（维护者）

本地已 `git init` 并完成首次提交时，只需登录 GitHub 并执行：

```powershell
gh auth login
.\scripts\publish-to-github.ps1
```

脚本会创建公开仓库 `rainbowyuyu/aqun-desktop-pet` 并 push `main` 分支。

也可手动：

```powershell
gh repo create rainbowyuyu/aqun-desktop-pet --public --source=. --remote=origin --push
```

---

## 发布新版本（维护者）

1. 更新 `package.json` 的 `version` 与 `src/pet/releaseNotes.js`
2. 提交并 push 到 `main`
3. 在 GitHub 创建 Release，tag 与 version 一致（如 `v2.4.1`）
4. 用户运行 `npm run check-update` 或在应用内检查更新

---

## 仓库说明

| 路径 | 说明 |
|------|------|
| `electron/` | 主进程、IPC、更新检查 |
| `src/` | 渲染层（模型、UI、工具） |
| `public/models/` | GLB 模型与 poses 配置（体积较大） |
| `scripts/` | 打包、更新、图标脚本 |

`.gitignore` 已排除 `node_modules/`、`dist/`、`release/` 及探测用 `_*.glb` 模型。

---

## 系统要求

- Windows 10/11 x64  
- Node.js 18+（开发/打包）  
- Git（拉取更新）
