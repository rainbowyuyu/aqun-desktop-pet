/** 应用版本与功能说明 */
export const APP_VERSION = 'v2.4.0';
export const APP_RELEASE_DATE = '2026-07-03';
export const APP_YEAR = '2026';
export const APP_VERSION_LABEL = `${APP_VERSION} · ${APP_RELEASE_DATE}`;
export const FEATURE_SUMMARY = '绑骨模型 · 姿势编辑 · 日历 · 工具 · 站点';

/** 功能一览 — 非更新日志 */
export const FEATURE_CATALOG = [
  {
    title: '桌面模型',
    icon: '◎',
    tone: 'rose',
    items: [
      '3D 阿群绑骨模型常驻桌面，透明窗口不挡操作',
      'aqun_rig 骨骼绑定：眼神跟随、idle / 挥手 / 点头等 GLB 动画',
      '键盘敲击时在模型前方显示按键标签与动效',
      '左键拖动移动窗口 · 右键左右滑缩放大小',
      '单击戳一下 · 双击挥手 · 三击转圈',
      '眼神灵敏度可调（总体 + 头 / 身 / 手分项）',
      '气泡随机说话：日常关心、热梗、天气穿衣建议',
    ],
  },
  {
    title: '控制中心',
    icon: '✦',
    tone: 'sky',
    items: [
      '独立窗口：功能（首页 / 日历 / 站点 / 工具）+ 设置（模型 / 互动 / 窗口 / 高级）',
      '首页快捷入口：一键跳转常用设置与日历',
      '卡片式设置页：分组清晰，开关 2 列布局，切换 Tab 丝滑入场',
      '模型：切换绑骨/静态模型、大小与透明度滑块可手输百分比',
      '互动：眼神灵敏度、键盘标签、气泡、联网热梗',
      '窗口：置顶 / 穿透 / 锁定 / 按键监听 / 提醒开关',
      '高级：分类重置、动画预览、骨骼姿势编辑器入口',
    ],
  },
  {
    title: '骨骼姿势编辑器',
    icon: '🦴',
    tone: 'violet',
    items: [
      '独立窗口 · Rainbow 鱼工作室绑骨姿势工具',
      'Blender 风格视口：移动 / 旋转 Gizmo、骨骼框选、骨架线',
      '右侧分类面板：骨骼 / 部件 / 姿势库 / 过渡',
      '独立设置面板：显示选项与快捷键自定义',
      '姿势 JSON 导入导出，一键同步到主窗口模型',
    ],
  },
  {
    title: '日历 · 课表 · 天气',
    icon: '📅',
    tone: 'mint',
    items: [
      '月历视图：节气、节日、工作日/调休标记',
      '右键日期快速添加提醒，支持每天/每周/每年重复',
      '到期提醒：系统通知 + 模型窗口前方提醒卡片',
      '课表导入：CSV 表格或 ICS 日历文件，自动生成每周课前提醒',
      '天气：输入城市或一键定位，查看当前与未来 5 日预报',
      '选中日期显示当日天气与节气/节日信息',
    ],
  },
  {
    title: '常用站点',
    icon: '🔗',
    tone: 'amber',
    items: [
      '学习科研：Scholar、知网、arXiv、PubMed、Overleaf、Zotero 等',
      '日常生活：哔哩哔哩、豆瓣、美团、12306、大众点评、小红书',
      '实用工具：GitHub、Notion、DeepL、有道、ProcessOn、Figma 等',
      '点击即在新浏览器窗口打开，无需反复复制链接',
    ],
  },
  {
    title: '小工具',
    icon: '🛠',
    tone: 'sage',
    items: [
      '生活：天气查询、倒计时、待办清单、计算器',
      '效率：番茄专注计时、网页多引擎搜索',
      '写作：LaTeX 转换/片段、Markdown 预览、字数统计、阅读时长',
      '学术：DOI 跳转、BibTeX 格式化、参考文献 APA/GB7714',
      '格式：JSON、编解码、文本对比、Markdown/LaTeX 表格生成',
      '开发：UUID/随机串、颜色转换、正则测试、密码生成、单位/百分比/时间戳换算',
    ],
  },
  {
    title: '教程 · 生日 · 彩蛋',
    icon: '🎂',
    tone: 'violet',
    items: [
      '首次使用：模型窗口右下角隐蔽光点，点开完整分步教程',
      '关于页「上手小提示」可再次播放教程动画',
        '7 月 4 日生日：当年首次启动播放祝福信 + 点击拆开礼物 + 模型登场',
      '生日彩蛋：Konami 代码、连戳、头像点击等隐藏反应',
      '托盘图标右键：显示/隐藏、控制中心、穿透、退出',
      '右键快捷菜单：玻璃拟态按钮、状态 Chip、帮助提示',
    ],
  },
];

/** @typedef {{ title: string, items: string[] }} ReleaseSection */
/** @typedef {{ version: string, date: string, title: string, sections: ReleaseSection[] }} ReleaseNote */

/** @type {ReleaseNote[]} 从新到旧 */
export const RELEASE_NOTES = [
  {
    version: 'v2.4.0',
    date: '2026-07-03',
    title: '控制中心 · 姿势编辑器 · 界面升级',
    sections: [
      {
        title: '控制中心',
        items: [
          '导航分为「功能 / 设置」，首页增加快捷入口卡片',
          '设置页卡片化：模型 / 互动 / 窗口 / 高级，不再杂乱堆叠',
          '开关改为 2 列卡片式 Toggle，切换 Tab 自动回顶 + 入场动画',
          '高级页集中：重置中心、动画预览、姿势编辑器、开发者信息',
        ],
      },
      {
        title: '骨骼姿势编辑器',
        items: [
          'Blender 风格 3D 视口：左侧移动 / 旋转工具栏，G/R 快捷键',
          '右侧分类 Tab：骨骼 · 部件 · 姿势 · 过渡',
          '独立设置面板：骨架线、骨骼框选、快捷键自定义',
        ],
      },
      {
        title: '交互与样式',
        items: [
          '右键快捷菜单按钮升级为玻璃拟态 + 渐变描边 + 悬停动效',
          '键盘反馈 overlay 全面重设计：奶油玻璃外壳、粉蓝渐变描边、柔和按键动效',
          '版本标签显示发布日期 2026-07-03',
        ],
      },
    ],
  },
  {
    version: 'v2.3.3',
    date: '2026-07-01',
    title: '骨骼姿势编辑器 · 初版',
    sections: [{
      title: '更新',
      items: [
        '新增独立「骨骼姿势编辑器」窗口（Rainbow 鱼 logo）',
        '视口点选骨骼、TransformControls 旋转 Gizmo',
        '姿势库 CRUD、idle/打字分配、姿势过渡预览与保存',
        '预览 / 编辑模式、骨骼框选辅助、网格部件显隐',
        '设置持久化、JSON 导入导出、应用到主窗口',
      ],
    }],
  },
  {
    version: 'v2.3.2',
    date: '2026-06-29',
    title: '绑骨模型 · 眼神修复',
    sections: [
      {
        title: '绑骨与动画',
        items: [
          '默认模型切换为 aqun_rig 绑骨 GLB（idle / wave / nod / poke / sway）',
          'SkeletalRig 运行时：lookGroup 转体 + 头骨眼神，颈骨不参与旋转',
          '模型检测：有蒙皮即视为绑骨，不再强制要求动画 clip',
        ],
      },
      {
        title: '眼神与灵敏度',
        items: [
          '修复眼神四元数累积导致头部转圈 / 麻花',
          '非手势时每帧 restoreHeadNeckBind 再叠加眼神，YXZ 欧拉避免拧转',
          '默认头部灵敏度约 80%，身体约 48%，可在互动页分项调节',
        ],
      },
    ],
  },
  {
    version: 'v2.3.1',
    date: '2026-06-27',
    title: '定位 · 话语编排 · 更新记录',
    sections: [{
      title: '更新',
      items: [
        '日历天气新增「定位」按钮，自动获取当前城市与坐标',
        '空闲话语改为 ChatterComposer 编排：关心为主、热梗与天气建议降频',
        '天气话语改为穿衣/防晒/带伞等建议，不再复读气温数字',
        '关于页「功能」展示功能介绍，「版本」展示完整更新日志',
        '修复更新记录弹窗关闭按钮难以点击的问题',
      ],
    }],
  },
  {
    version: 'v2.3.0',
    date: '2026-06-25',
    title: '生活主题 · 课表 · 天气',
    sections: [{
      title: '更新',
      items: [
        '产品定位扩展为学习 + 日常生活，全面改写界面文案',
        '常用站点三分组；小工具新增天气/倒计时/待办/计算器',
        '日历支持 CSV·ICS 课表导入、课前提醒、侧栏天气预报',
        '重置确认改为毛玻璃弹窗；生日需点击礼物后才开箱',
        '教程/生日 UI 升级并修复「下一步」无法点击',
      ],
    }],
  },
  {
    version: 'v2.2.2',
    date: '2026-05',
    title: '教程与生日视觉升级',
    sections: [{
      title: '更新',
      items: [
        '新手教程：毛玻璃卡片、进度条、扫光动效、背景遮罩',
        '生日祝福：信件式排版、浮动爱心、印章署名、更精致礼盒',
        '修复教程面板 z-index 与 Interaction 冲突导致按钮无效',
        'GSAP 居中改用 xPercent，避免 transform 覆盖点击区域',
      ],
    }],
  },
  {
    version: 'v2.2.1',
    date: '2026-05',
    title: '动画预览测试入口',
    sections: [{
      title: '更新',
      items: [
        '系统页设置中心增加「播放教程动画」「播放生日祝福」',
        '预览自动聚焦模型窗口，不写入 tutorialSeen / birthdayIntroYear',
        '预览状态栏反馈成功或失败原因',
      ],
    }],
  },
  {
    version: 'v2.2.0',
    date: '2026-05',
    title: '设置中心与分类重置',
    sections: [{
      title: '更新',
      items: [
        '系统页重构为设置中心：预览卡片 + 分类重置 chips + 全部恢复',
        '六类重置：外观/互动/系统/教程/提醒/全部，IPC 按 scope 恢复',
        '重置后自动刷新日历、同步模型窗口 settings-changed',
        'busy 态与 hub 状态文案反馈',
      ],
    }],
  },
  {
    version: 'v2.1.2',
    date: '2026-04',
    title: '滑块百分比输入',
    sections: [{
      title: '更新',
      items: [
        '外观/互动百分比滑块旁增加数字输入框',
        '支持手动输入 60–180% 等范围，与滑块双向同步',
        'live preview 仍走 previewSettings / previewPetScale',
      ],
    }],
  },
  {
    version: 'v2.1.1',
    date: '2026-04',
    title: '日历右键与模型提醒',
    sections: [{
      title: '更新',
      items: [
        '日历网格右键菜单：添加提醒 / 查看当日',
        'ModelReminderHud：模型前方 3D 倾斜提醒卡片',
        '提醒触发时模型窗口 toast + 系统 Notification',
        '日历侧边栏独立布局，月历 + 提醒表单',
      ],
    }],
  },
  {
    version: 'v2.1.0',
    date: '2026-04',
    title: '生日开箱祝福动画',
    sections: [{
      title: '更新',
      items: [
        '7 月 4 日当年首次启动播放 BirthdayIntro 全屏动画',
        '祝福信 → 礼盒升起 → 开盖 → 模型从盒中登场',
        'confetti 粒子、极光背景、birthdayIntroYear 年度标记',
        '跳过后仍正常显示模型，彩虹环收尾',
      ],
    }],
  },
  {
    version: 'v2.0.2',
    date: '2026-03',
    title: '首次使用教程',
    sections: [{
      title: '更新',
      items: [
        'FirstRunTutorial：右下角隐蔽光点入口',
        '五步引导：拖动/缩放/点击/右键菜单/控制中心',
        '每步动画演示 + 跳过/下一步，完成后 tutorialSeen 持久化',
        '重置教程 scope 可重现光点',
      ],
    }],
  },
  {
    version: 'v2.0.1',
    date: '2026-03',
    title: '窗口拖动与实时缩放',
    sections: [{
      title: '更新',
      items: [
        '专用 IPC pet-scale-live / window-bounds-changed',
        '左键拖动改用 screen 坐标 + rAF 节流，消除白边闪烁',
        '右键水平拖动实时缩放，PetScene.onResize 显式同步',
        '移除 drag 结束 blur 重置，避免窗口跳变',
      ],
    }],
  },
  {
    version: 'v2.0.0',
    date: '2026-03',
    title: '独立控制中心',
    sections: [{
      title: '更新',
      items: [
        'panel.html 独立 BrowserWindow，aq-shell 左侧导航布局',
        '启动不再自动打开控制中心，settingsOpen 不持久化',
        '关于/日历/站点/工具/外观/互动/系统分页',
        'panelBounds 记忆窗口尺寸位置',
      ],
    }],
  },
  {
    version: 'v1.5.2',
    date: '2025-12',
    title: 'Konami 彩蛋',
    sections: [{
      title: '更新',
      items: [
        '输入 ↑↑↓↓←→←→BA 触发隐藏反应与 confetti',
        'BirthdaySecrets 统一管理彩蛋话语池',
        '气泡与 FSM 联动特殊动画',
      ],
    }],
  },
  {
    version: 'v1.5.1',
    date: '2025-12',
    title: '生日秘密与连戳',
    sections: [{
      title: '更新',
      items: [
        '快速连戳模型触发 pokeStorm 话语',
        '生日当天非首次启动的轻量问候',
        '关于页头像点击彩蛋',
      ],
    }],
  },
  {
    version: 'v1.5.0',
    date: '2025-11',
    title: '联网热梗',
    sections: [{
      title: '更新',
      items: [
        'ChatterFeed 拉取微博/知乎热榜（vvhan API）',
        '空闲气泡随机插入「听说：xxx」类热梗',
        'networkChatter 开关，30 分钟缓存，失败静默',
      ],
    }],
  },
  {
    version: 'v1.4.2',
    date: '2025-11',
    title: '科研站点页',
    sections: [{
      title: '更新',
      items: [
        'SitesPanel 网格展示常用科研链接',
        'Scholar / arXiv / PubMed / 知网 / Overleaf 等 12 站',
        'openExternal IPC 系统浏览器打开',
      ],
    }],
  },
  {
    version: 'v1.4.1',
    date: '2025-10',
    title: 'LaTeX 与学术小工具',
    sections: [{
      title: '更新',
      items: [
        'LaTeX 转 Word/MathML/Unicode，公式片段库',
        'DOI 跳转、BibTeX 格式化、APA/GB7714 参考文献',
        'Markdown/LaTeX 可视化表格生成',
      ],
    }],
  },
  {
    version: 'v1.4.0',
    date: '2025-10',
    title: '小工具中心',
    sections: [{
      title: '更新',
      items: [
        'ToolsPanel 图标网格 + 详情页',
        '番茄钟、多引擎搜索、字数统计、JSON/编解码/对比',
        '单位/百分比/时间戳/UUID/颜色/正则/密码生成',
        'toolDefinitions 三件套注册模式',
      ],
    }],
  },
  {
    version: 'v1.3.2',
    date: '2025-09',
    title: '节气与节日',
    sections: [{
      title: '更新',
      items: [
        'calendarMarks：二十四节气、农历节日、西方节日',
        'CN_HOLIDAYS / CN_WORK_WEEKENDS 2025–2026 调休',
        '月历格显示小点与节日名称',
      ],
    }],
  },
  {
    version: 'v1.3.1',
    date: '2025-09',
    title: '日历组件',
    sections: [{
      title: '更新',
      items: [
        'CalendarWidget 月视图、上一月/下一月、选中今天',
        '侧边栏按日列表提醒，表单添加 title/note/time/repeat',
        'reminders.json 持久化于 userData',
      ],
    }],
  },
  {
    version: 'v1.3.0',
    date: '2025-08',
    title: '提醒系统',
    sections: [{
      title: '更新',
      items: [
        'electron reminders.cjs：20s tick 检测到期',
        'get/save/delete/toggle/import IPC 全套',
        '默认种子：生日 yearly + 每日休息提醒',
        'remindersEnabled 总开关',
      ],
    }],
  },
  {
    version: 'v1.2.3',
    date: '2025-08',
    title: '空闲话语',
    sections: [{
      title: '更新',
      items: [
        'bubbleCopy 多类台词：idle/poke/wave/enter/backspace',
        'PetStateMachine 空闲超时自动 show bubble',
        'idleChatter 设置项控制开关',
      ],
    }],
  },
  {
    version: 'v1.2.2',
    date: '2025-07',
    title: '三连击与 FSM',
    sections: [{
      title: '更新',
      items: [
        'PetStateMachine：idle/drag/wave/spin/poke 状态',
        '三击触发转圈动画，双击挥手',
        '戳击 ripple 视觉反馈',
      ],
    }],
  },
  {
    version: 'v1.2.1',
    date: '2025-07',
    title: '位置锁定',
    sections: [{
      title: '更新',
      items: [
        'positionLocked 禁止拖动，右键菜单与设置页可切换',
        '锁定时 cursor 与 Interaction 手势相应调整',
      ],
    }],
  },
  {
    version: 'v1.2.0',
    date: '2025-07',
    title: '鼠标穿透',
    sections: [{
      title: '更新',
      items: [
        'clickThrough + setIgnoreMouseEvents forward 模式',
        '拖动/缩放时自动取消穿透，结束后恢复',
        '右键菜单显示穿透状态 chip',
      ],
    }],
  },
  {
    version: 'v1.1.3',
    date: '2025-07',
    title: '窗口置顶',
    sections: [{
      title: '更新',
      items: [
        'alwaysOnTop 设置与托盘同步',
        'applySettingsSideEffects 即时生效',
      ],
    }],
  },
  {
    version: 'v1.1.2',
    date: '2025-07',
    title: '透明度与缩放',
    sections: [{
      title: '更新',
      items: [
        'opacity 0.35–1.0 滑块实时预览',
        'petScale 0.6–1.8 窗口等比缩放',
        'settings-live 通道减少写入频率',
      ],
    }],
  },
  {
    version: 'v1.1.1',
    date: '2025-07',
    title: '模型切换',
    sections: [{
      title: '更新',
      items: [
        'ModelPicker 卡片列表，modelRegistry 多模型',
        'getModelUrl IPC 从 asar/资源目录加载 glb',
        '切换时 loading 态与 PetScene 重建',
      ],
    }],
  },
  {
    version: 'v1.1.0',
    date: '2025-07',
    title: '设置面板',
    sections: [{
      title: '更新',
      items: [
        'SettingsPanel 嵌入模型窗口（后期改为独立窗）',
        '分区：外观/互动/系统 toggle 与 slider',
        'getSettings / updateSettings IPC',
      ],
    }],
  },
  {
    version: 'v1.0.5',
    date: '2025-07',
    title: '托盘与右键菜单',
    sections: [{
      title: '更新',
      items: [
        '系统托盘图标，双击显示/隐藏模型',
        'ContextMenu：控制中心/穿透/隐藏/退出',
        'context-popup 独立小窗口菜单',
      ],
    }],
  },
  {
    version: 'v1.0.4',
    date: '2025-07',
    title: '眼神灵敏度',
    sections: [{
      title: '更新',
      items: [
        'lookSensitivity 倍率调节 GlobalLook',
        '低功耗模式降低渲染与跟踪频率',
      ],
    }],
  },
  {
    version: 'v1.0.3',
    date: '2025-07',
    title: '键盘可视化',
    sections: [{
      title: '更新',
      items: [
        'keyboard.cjs 全局低级键盘钩子（Windows）',
        'InputOverlay SVG 键盘与按键浮层',
        'keyboardOpacity / keyPressColor 自定义',
        'keyboardPaused 暂停监听',
      ],
    }],
  },
  {
    version: 'v1.0.2',
    date: '2025-07',
    title: '气泡 UI',
    sections: [{
      title: '更新',
      items: [
        'BubbleUI 顶部圆角气泡，gsap 淡入淡出',
        'showBubble 总开关，键盘/互动触发分类台词',
      ],
    }],
  },
  {
    version: 'v1.0.1',
    date: '2025-07',
    title: '加载体验',
    sections: [{
      title: '更新',
      items: [
        'loading 呼吸动画 logo + 进度文案',
        'PetScene 环境光 fadeInDaylight 模型登场',
        '加载失败自动重试一次',
      ],
    }],
  },
  {
    version: 'v1.0.0',
    date: '2025-07-04',
    title: '首发 · 阿群桌面模型',
    sections: [{
      title: '首发',
      items: [
        'Electron 透明无边框窗口 + Three.js 渲染 glb 模型',
        '鼠标跟踪眼神、基础点击互动',
        'settings.json 持久化，electron-builder 打包 exe',
        '阿群 7 月 4 日生日设定',
      ],
    }],
  },
];

function formatReleaseDate(dateStr) {
  if (!dateStr) return '';
  const parts = String(dateStr).split('-').map((p) => parseInt(p, 10));
  if (parts.length >= 3 && parts.every((n) => Number.isFinite(n))) {
    return `${parts[1]}月${parts[2]}日`;
  }
  if (parts.length >= 2 && Number.isFinite(parts[1])) {
    return `${parts[1]}月`;
  }
  return dateStr;
}

export function renderFeaturesHtml() {
  return `
    <div class="aq-features-hero">
      <span class="aq-features-hero-badge">FEATURES</span>
      <p class="aq-features-hero-sub">${FEATURE_SUMMARY}</p>
    </div>
    <div class="aq-features-grid">
      ${FEATURE_CATALOG.map(
        (group, index) => `
        <article class="aq-feature-card aq-feature-card--${group.tone || 'mint'}" style="--fi:${index}">
          <div class="aq-feature-card-glow" aria-hidden="true"></div>
          <header class="aq-feature-card-head">
            <span class="aq-feature-icon" aria-hidden="true">${group.icon || '✦'}</span>
            <h4 class="aq-feature-group-title">${group.title}</h4>
          </header>
          <ul class="aq-feature-list">
            ${group.items
              .map(
                (item) => `
              <li>
                <span class="aq-feature-bullet" aria-hidden="true"></span>
                <span>${item}</span>
              </li>`,
              )
              .join('')}
          </ul>
        </article>`,
      ).join('')}
    </div>`;
}

export function renderChangelogHtml() {
  return RELEASE_NOTES.map(
    (note) => `
      <article class="aq-changelog-item">
        <header class="aq-changelog-head">
          <strong>${note.version}</strong>
          <span>${formatReleaseDate(note.date)}</span>
        </header>
        <p class="aq-changelog-title">${note.title}</p>
        ${note.sections
          .map(
            (sec) => `
          <div class="aq-changelog-section">
            <h4>${sec.title}</h4>
            <ul>${sec.items.map((item) => `<li>${item}</li>`).join('')}</ul>
          </div>`,
          )
          .join('')}
      </article>`,
  ).join('');
}
