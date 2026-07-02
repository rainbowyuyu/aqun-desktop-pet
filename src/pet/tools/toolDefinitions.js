import { copyText, copyHtml, openUrl, searchUrl, setStatus } from './helpers.js';
import { latexToUnicode, latexToMathML, latexToWordHtml, LATEX_SNIPPETS } from './latexUtils.js';
import { fetchWeather, getCachedWeather } from '../weatherService.js';
import { DEFAULT_WEATHER_CITY } from '../locationDefaults.js';

/** 小工具目录：元数据 + 页面模板 + 绑定逻辑 */
export const TOOL_APPS = [
  { id: 'weather', icon: '🌤', name: '天气查询', desc: '当前 · 近7天预报', category: '生活' },
  { id: 'countdown', icon: '⏳', name: '倒计时', desc: '距目标日还有几天', category: '生活' },
  { id: 'todo', icon: '✅', name: '待办清单', desc: '本地便签 · 勾选完成', category: '效率' },
  { id: 'calc', icon: '🧮', name: '计算器', desc: '日常四则运算', category: '生活' },
  { id: 'pomo', icon: '🍅', name: '专注计时', desc: '番茄钟 · 25/5', category: '效率' },
  { id: 'search', icon: '🔍', name: '网页搜索', desc: '多引擎一键搜', category: '搜索' },
  { id: 'latex', icon: '∑', name: 'LaTeX 转换', desc: 'Word · MathML · Unicode', category: '写作' },
  { id: 'latex-snip', icon: '📐', name: '公式片段', desc: '常用 LaTeX 模板', category: '写作' },
  { id: 'markdown', icon: 'MD', name: 'Markdown', desc: '预览 · 转 HTML', category: '格式' },
  { id: 'stats', icon: '📝', name: '字数统计', desc: '字符 · 词数 · 行数', category: '写作' },
  { id: 'reading', icon: '📖', name: '阅读时长', desc: '估算阅读分钟数', category: '写作' },
  { id: 'case', icon: 'Aa', name: '命名转换', desc: '驼峰 · 蛇形 · 大小写', category: '格式' },
  { id: 'doi', icon: '📄', name: 'DOI 跳转', desc: '文献 DOI 打开', category: '学术' },
  { id: 'bibtex', icon: '📚', name: 'BibTeX', desc: '格式化 · 校验', category: '学术' },
  { id: 'cite', icon: '「引」', name: '参考文献', desc: 'APA · GB/T 7714', category: '学术' },
  { id: 'json', icon: '{ }', name: 'JSON', desc: '格式化 · 压缩', category: '格式' },
  { id: 'encode', icon: '🔐', name: '编解码', desc: 'Base64 · URL', category: '格式' },
  { id: 'diff', icon: '≠', name: '文本对比', desc: '两段文本 diff', category: '格式' },
  { id: 'table-md', icon: '▦', name: 'Markdown 表格', desc: '可视化生成表格', category: '写作' },
  { id: 'latex-table', icon: '⊞', name: 'LaTeX 表格', desc: 'tabular 生成', category: '写作' },
  { id: 'unit', icon: '⇄', name: '单位换算', desc: '存储 · 温度 · 长度', category: '计算' },
  { id: 'percent', icon: '%', name: '百分比', desc: '比例 · 增减计算', category: '计算' },
  { id: 'timestamp', icon: '🕐', name: '时间戳', desc: 'Unix 毫秒转换', category: '计算' },
  { id: 'uuid', icon: '🆔', name: 'ID 生成', desc: 'UUID · 随机串', category: '开发' },
  { id: 'color', icon: '🎨', name: '颜色转换', desc: 'HEX · RGB · HSL', category: '开发' },
  { id: 'regex', icon: '.*', name: '正则测试', desc: '匹配 · 替换预览', category: '开发' },
  { id: 'pwd', icon: '🔑', name: '密码生成', desc: '安全随机密码', category: '开发' },
];

export function getToolTemplate(id) {
  return TEMPLATES[id] || '';
}

export function bindTool(id, panel) {
  BINDERS[id]?.(panel);
}

const TEMPLATES = {
  weather: `
    <div class="tools-page">
      <h3 class="tools-page-title">🌤 天气查询</h3>
      <p class="tools-page-desc">输入城市名，查看当前天气与近 7 天预报（数据来自 Open-Meteo）</p>
      <div class="tools-form-row">
        <input class="tools-input" data-weather-city placeholder="例如：嘉定、北京" />
        <button type="button" class="tools-primary-btn" data-weather-load>查询</button>
      </div>
      <p class="tools-stats-line" data-weather-status>—</p>
      <div class="tools-weather-now" data-weather-now>—</div>
      <div class="tools-weather-days" data-weather-days></div>
    </div>`,

  countdown: `
    <div class="tools-page">
      <h3 class="tools-page-title">⏳ 倒计时</h3>
      <p class="tools-page-desc">计算距离某个日子还有多少天</p>
      <input class="tools-input" type="date" data-cd-date />
      <input class="tools-input" data-cd-label placeholder="事件名称（可选）" />
      <button type="button" class="tools-primary-btn" data-cd-calc>计算</button>
      <p class="tools-countdown-result" data-cd-result>—</p>
    </div>`,

  todo: `
    <div class="tools-page">
      <h3 class="tools-page-title">✅ 待办清单</h3>
      <p class="tools-page-desc">保存在本机浏览器，关闭后仍会保留</p>
      <div class="tools-form-row">
        <input class="tools-input" data-todo-input placeholder="添加待办…" maxlength="60" />
        <button type="button" class="tools-primary-btn" data-todo-add>添加</button>
      </div>
      <ul class="tools-todo-list" data-todo-list></ul>
    </div>`,

  calc: `
    <div class="tools-page">
      <h3 class="tools-page-title">🧮 计算器</h3>
      <input class="tools-input tools-calc-display" data-calc-display readonly value="0" />
      <div class="tools-calc-grid" data-calc-grid>
        ${['C', '⌫', '%', '÷', '7', '8', '9', '×', '4', '5', '6', '-', '1', '2', '3', '+', '0', '.', '='].map((k) => `<button type="button" class="tools-calc-key" data-calc-key="${k}">${k}</button>`).join('')}
      </div>
    </div>`,

  pomo: `
    <div class="tools-page">
      <h3 class="tools-page-title">🍅 专注计时</h3>
      <p class="tools-page-desc">25 分钟专注，5 分钟休息，循环进行</p>
      <div class="tools-pomo-ring" data-pomo-display>25:00</div>
      <p class="tools-pomo-mode" data-pomo-mode>专注中</p>
      <div class="tools-page-actions">
        <button type="button" class="tools-primary-btn" data-pomo-start>开始</button>
        <button type="button" class="tools-chip-btn" data-pomo-reset>重置</button>
      </div>
      <div class="tools-pomo-presets">
        <button type="button" class="tools-chip-btn" data-pomo-preset="25">25 分</button>
        <button type="button" class="tools-chip-btn" data-pomo-preset="45">45 分</button>
        <button type="button" class="tools-chip-btn" data-pomo-preset="5">休息 5 分</button>
      </div>
    </div>`,

  search: `
    <div class="tools-page">
      <h3 class="tools-page-title">🔍 网页搜索</h3>
      <p class="tools-page-desc">输入关键词，选择搜索引擎一键打开（也可 Ctrl+Enter 用默认引擎）</p>
      <textarea class="tools-textarea" data-search-input placeholder="输入搜索内容…" rows="3"></textarea>
      <div class="tools-search-grid">
        <button type="button" class="tools-search-btn" data-search-engine="google">Google</button>
        <button type="button" class="tools-search-btn" data-search-engine="scholar">Scholar</button>
        <button type="button" class="tools-search-btn" data-search-engine="bing">Bing</button>
        <button type="button" class="tools-search-btn" data-search-engine="baidu">百度</button>
        <button type="button" class="tools-search-btn" data-search-engine="pubmed">PubMed</button>
        <button type="button" class="tools-search-btn" data-search-engine="arxiv">arXiv</button>
        <button type="button" class="tools-search-btn" data-search-engine="github">GitHub</button>
        <button type="button" class="tools-search-btn" data-search-engine="stackoverflow">StackOverflow</button>
        <button type="button" class="tools-search-btn" data-search-engine="zhihu">知乎</button>
      </div>
    </div>`,

  latex: `
    <div class="tools-page">
      <h3 class="tools-page-title">∑ LaTeX 转换</h3>
      <p class="tools-page-desc">将 LaTeX 公式转为 Word 可粘贴格式、MathML 或 Unicode 符号</p>
      <textarea class="tools-textarea tools-textarea--lg" data-latex-input placeholder="例如：\\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}"></textarea>
      <div class="tools-page-actions">
        <button type="button" class="tools-primary-btn" data-latex-word>复制到 Word</button>
        <button type="button" class="tools-chip-btn" data-latex-mathml>复制 MathML</button>
        <button type="button" class="tools-chip-btn" data-latex-unicode>复制 Unicode</button>
        <button type="button" class="tools-chip-btn" data-latex-strip>去定界符</button>
      </div>
      <p class="tools-section-label">预览</p>
      <div class="tools-preview-box" data-latex-preview>—</div>
      <p class="tools-stats-line" data-latex-status>—</p>
      <p class="tools-hint-line">Word 粘贴：优先用「复制到 Word」；若公式异常，可试 MathML 或 Unicode 纯文本。</p>
    </div>`,

  'latex-snip': `
    <div class="tools-page">
      <h3 class="tools-page-title">📐 公式片段库</h3>
      <p class="tools-page-desc">点击片段复制 LaTeX，可粘贴到 Overleaf 或上方「LaTeX 转换」</p>
      <div class="tools-snip-grid" data-snip-grid></div>
    </div>`,

  markdown: `
    <div class="tools-page">
      <h3 class="tools-page-title">MD Markdown</h3>
      <p class="tools-page-desc">简易 Markdown 预览，复制 HTML 用于文档或博客</p>
      <textarea class="tools-textarea tools-textarea--lg" data-md-input placeholder="# 标题\\n\\n**粗体** · *斜体* · \`代码\`\\n\\n- 列表项"></textarea>
      <div class="tools-page-actions">
        <button type="button" class="tools-primary-btn" data-md-copy-html>复制 HTML</button>
        <button type="button" class="tools-chip-btn" data-md-copy-md>复制 Markdown</button>
      </div>
      <p class="tools-section-label">预览</p>
      <div class="tools-preview-box tools-preview-box--html" data-md-preview></div>
    </div>`,

  stats: `
    <div class="tools-page">
      <h3 class="tools-page-title">📝 字数统计</h3>
      <p class="tools-page-desc">实时统计字符、词数、行数与中文字符</p>
      <textarea class="tools-textarea tools-textarea--lg" data-stats-input placeholder="粘贴或输入文本…"></textarea>
      <div class="tools-stats-grid">
        <div class="tools-stat-box"><span data-stat-chars>0</span><label>字符</label></div>
        <div class="tools-stat-box"><span data-stat-words>0</span><label>词数</label></div>
        <div class="tools-stat-box"><span data-stat-lines>0</span><label>行数</label></div>
        <div class="tools-stat-box"><span data-stat-cn>0</span><label>中文</label></div>
      </div>
    </div>`,

  reading: `
    <div class="tools-page">
      <h3 class="tools-page-title">📖 阅读时长</h3>
      <p class="tools-page-desc">按中文 400 字/分、英文 200 词/分估算</p>
      <textarea class="tools-textarea tools-textarea--lg" data-read-input placeholder="粘贴论文摘要或章节…"></textarea>
      <div class="tools-stats-grid tools-stats-grid--3">
        <div class="tools-stat-box"><span data-read-min>0</span><label>分钟</label></div>
        <div class="tools-stat-box"><span data-read-cn>0</span><label>中文字</label></div>
        <div class="tools-stat-box"><span data-read-en>0</span><label>英文词</label></div>
      </div>
    </div>`,

  case: `
    <div class="tools-page">
      <h3 class="tools-page-title">Aa 命名 / 大小写</h3>
      <p class="tools-page-desc">变量名、文件名、标题格式一键转换</p>
      <textarea class="tools-textarea" data-case-input placeholder="hello_world_example"></textarea>
      <div class="tools-chip-row">
        <button type="button" class="tools-chip-btn" data-case-type="upper">UPPER</button>
        <button type="button" class="tools-chip-btn" data-case-type="lower">lower</button>
        <button type="button" class="tools-chip-btn" data-case-type="title">Title Case</button>
        <button type="button" class="tools-chip-btn" data-case-type="camel">camelCase</button>
        <button type="button" class="tools-chip-btn" data-case-type="pascal">PascalCase</button>
        <button type="button" class="tools-chip-btn" data-case-type="snake">snake_case</button>
        <button type="button" class="tools-chip-btn" data-case-type="kebab">kebab-case</button>
      </div>
      <textarea class="tools-textarea" data-case-output readonly placeholder="转换结果…"></textarea>
      <button type="button" class="tools-chip-btn" data-case-copy>复制结果</button>
    </div>`,

  doi: `
    <div class="tools-page">
      <h3 class="tools-page-title">📄 DOI 跳转</h3>
      <p class="tools-page-desc">输入 DOI 或 doi.org 链接，一键打开文献</p>
      <input class="tools-input" data-doi-input placeholder="10.xxxx/xxxxx 或完整链接" />
      <div class="tools-page-actions">
        <button type="button" class="tools-primary-btn" data-doi-open>打开文献</button>
        <button type="button" class="tools-chip-btn" data-doi-copy>复制链接</button>
      </div>
      <p class="tools-stats-line" data-doi-preview>—</p>
    </div>`,

  bibtex: `
    <div class="tools-page">
      <h3 class="tools-page-title">📚 BibTeX 工具</h3>
      <p class="tools-page-desc">格式化 BibTeX 条目，检查基本字段</p>
      <textarea class="tools-textarea tools-textarea--lg" data-bib-input placeholder="@article{key,\\n  title = {...},\\n  author = {...},\\n  year = {2024}\\n}"></textarea>
      <div class="tools-page-actions">
        <button type="button" class="tools-primary-btn" data-bib-format>格式化</button>
        <button type="button" class="tools-chip-btn" data-bib-copy>复制</button>
      </div>
      <p class="tools-stats-line" data-bib-status>—</p>
    </div>`,

  cite: `
    <div class="tools-page">
      <h3 class="tools-page-title">「引」参考文献格式</h3>
      <p class="tools-page-desc">填写基本信息，生成 APA 或 GB/T 7714 引用格式</p>
      <div class="tools-form-stack">
        <input class="tools-input" data-cite-authors placeholder="作者（如 Zhang, L.; Wang, M.）" />
        <input class="tools-input" data-cite-year placeholder="年份（2024）" />
        <input class="tools-input" data-cite-title placeholder="标题" />
        <input class="tools-input" data-cite-journal placeholder="期刊 / 会议 / 出版社" />
        <input class="tools-input" data-cite-vol placeholder="卷(期):页码（可选）" />
      </div>
      <div class="tools-page-actions">
        <button type="button" class="tools-chip-btn" data-cite-apa>APA 7</button>
        <button type="button" class="tools-chip-btn" data-cite-gb>GB/T 7714</button>
        <button type="button" class="tools-primary-btn" data-cite-copy>复制</button>
      </div>
      <textarea class="tools-textarea" data-cite-output readonly placeholder="引用格式…"></textarea>
    </div>`,

  json: `
    <div class="tools-page">
      <h3 class="tools-page-title">{ } JSON 工具</h3>
      <p class="tools-page-desc">格式化、压缩与语法校验</p>
      <textarea class="tools-textarea tools-textarea--lg" data-json-input placeholder='{"key":"value"}'></textarea>
      <div class="tools-page-actions">
        <button type="button" class="tools-primary-btn" data-json-format>格式化</button>
        <button type="button" class="tools-chip-btn" data-json-minify>压缩</button>
        <button type="button" class="tools-chip-btn" data-json-copy>复制</button>
      </div>
      <p class="tools-stats-line" data-json-status>—</p>
    </div>`,

  encode: `
    <div class="tools-page">
      <h3 class="tools-page-title">🔐 编解码</h3>
      <p class="tools-page-desc">Base64 与 URL 百分号编码互转</p>
      <select class="tools-select" data-enc-mode>
        <option value="b64-enc">文本 → Base64</option>
        <option value="b64-dec">Base64 → 文本</option>
        <option value="url-enc">URL 编码</option>
        <option value="url-dec">URL 解码</option>
      </select>
      <textarea class="tools-textarea tools-textarea--lg" data-enc-input placeholder="输入内容…"></textarea>
      <div class="tools-page-actions">
        <button type="button" class="tools-primary-btn" data-enc-run>转换</button>
        <button type="button" class="tools-chip-btn" data-enc-copy>复制结果</button>
      </div>
      <textarea class="tools-textarea" data-enc-output readonly placeholder="结果…"></textarea>
      <p class="tools-stats-line" data-enc-status>—</p>
    </div>`,

  diff: `
    <div class="tools-page">
      <h3 class="tools-page-title">≠ 文本对比</h3>
      <p class="tools-page-desc">比较两段文本，高亮行级差异</p>
      <div class="tools-diff-cols">
        <textarea class="tools-textarea" data-diff-a placeholder="原文…"></textarea>
        <textarea class="tools-textarea" data-diff-b placeholder="修改后…"></textarea>
      </div>
      <button type="button" class="tools-primary-btn" data-diff-run>对比</button>
      <div class="tools-preview-box tools-preview-box--diff" data-diff-result></div>
    </div>`,

  'table-md': `
    <div class="tools-page">
      <h3 class="tools-page-title">▦ Markdown 表格</h3>
      <p class="tools-page-desc">填表生成 Markdown，可复制到笔记或 README</p>
      <div class="tools-inline-form">
        <label class="tools-inline-label">行 <input class="tools-input tools-input--xs" data-tmd-rows type="number" min="2" max="12" value="3" /></label>
        <label class="tools-inline-label">列 <input class="tools-input tools-input--xs" data-tmd-cols type="number" min="2" max="8" value="3" /></label>
        <button type="button" class="tools-chip-btn" data-tmd-build>生成表格</button>
      </div>
      <div class="tools-table-editor" data-tmd-editor></div>
      <textarea class="tools-textarea" data-tmd-output readonly rows="6"></textarea>
      <button type="button" class="tools-primary-btn" data-tmd-copy>复制 Markdown</button>
    </div>`,

  'latex-table': `
    <div class="tools-page">
      <h3 class="tools-page-title">⊞ LaTeX 表格</h3>
      <p class="tools-page-desc">生成 tabular 环境代码</p>
      <div class="tools-inline-form">
        <label class="tools-inline-label">行 <input class="tools-input tools-input--xs" data-ltx-rows type="number" min="2" max="12" value="3" /></label>
        <label class="tools-inline-label">列 <input class="tools-input tools-input--xs" data-ltx-cols type="number" min="2" max="8" value="3" /></label>
        <button type="button" class="tools-chip-btn" data-ltx-build>生成</button>
      </div>
      <div class="tools-table-editor" data-ltx-editor></div>
      <textarea class="tools-textarea tools-textarea--lg" data-ltx-output readonly rows="8"></textarea>
      <button type="button" class="tools-primary-btn" data-ltx-copy>复制 LaTeX</button>
    </div>`,

  unit: `
    <div class="tools-page">
      <h3 class="tools-page-title">⇄ 单位换算</h3>
      <p class="tools-page-desc">存储、温度、长度、质量换算</p>
      <div class="tools-inline-form">
        <input class="tools-input" data-unit-input type="number" placeholder="数值" step="any" />
        <select class="tools-select" data-unit-dir>
          <optgroup label="存储">
            <option value="kb-mb">KB → MB</option>
            <option value="mb-gb">MB → GB</option>
            <option value="gb-mb">GB → MB</option>
            <option value="gb-tb">GB → TB</option>
          </optgroup>
          <optgroup label="温度">
            <option value="c-f">°C → °F</option>
            <option value="f-c">°F → °C</option>
            <option value="c-k">°C → K</option>
          </optgroup>
          <optgroup label="长度">
            <option value="cm-m">cm → m</option>
            <option value="m-km">m → km</option>
            <option value="in-cm">inch → cm</option>
            <option value="ft-m">ft → m</option>
          </optgroup>
          <optgroup label="质量">
            <option value="g-kg">g → kg</option>
            <option value="kg-lb">kg → lb</option>
          </optgroup>
        </select>
      </div>
      <p class="tools-mono tools-mono--lg" data-unit-result>—</p>
    </div>`,

  percent: `
    <div class="tools-page">
      <h3 class="tools-page-title">% 百分比计算</h3>
      <p class="tools-page-desc">占比、增减、反向推算</p>
      <div class="tools-form-stack">
        <div class="tools-inline-form">
          <input class="tools-input" data-pct-a type="number" placeholder="部分" step="any" />
          <span class="tools-inline-sep">/</span>
          <input class="tools-input" data-pct-b type="number" placeholder="整体" step="any" />
          <button type="button" class="tools-chip-btn" data-pct-ratio>占比</button>
        </div>
        <div class="tools-inline-form">
          <input class="tools-input" data-pct-base type="number" placeholder="基数" step="any" />
          <input class="tools-input" data-pct-rate type="number" placeholder="增减 %" step="any" />
          <button type="button" class="tools-chip-btn" data-pct-change>增减后</button>
        </div>
      </div>
      <p class="tools-mono tools-mono--lg" data-pct-result>—</p>
    </div>`,

  timestamp: `
    <div class="tools-page">
      <h3 class="tools-page-title">🕐 时间戳</h3>
      <p class="tools-page-desc">Unix 毫秒时间戳与日期互转</p>
      <p class="tools-mono tools-mono--lg" data-ts-now></p>
      <button type="button" class="tools-chip-btn" data-ts-copy>复制当前毫秒戳</button>
      <div class="tools-inline-form">
        <input class="tools-input" data-ts-input placeholder="输入毫秒时间戳" />
        <button type="button" class="tools-primary-btn" data-ts-convert>转换</button>
      </div>
      <p class="tools-stats-line" data-ts-result>—</p>
    </div>`,

  uuid: `
    <div class="tools-page">
      <h3 class="tools-page-title">🆔 ID 生成</h3>
      <p class="tools-page-desc">UUID v4、短随机串、nanoid 风格</p>
      <div class="tools-page-actions">
        <button type="button" class="tools-primary-btn" data-uuid-gen>生成 UUID</button>
        <button type="button" class="tools-chip-btn" data-uuid-short>8 位短 ID</button>
        <button type="button" class="tools-chip-btn" data-uuid-nano>21 位 Nano</button>
        <button type="button" class="tools-chip-btn" data-uuid-copy>复制</button>
      </div>
      <p class="tools-mono tools-mono--lg" data-uuid-out>—</p>
    </div>`,

  color: `
    <div class="tools-page">
      <h3 class="tools-page-title">🎨 颜色转换</h3>
      <p class="tools-page-desc">HEX · RGB · HSL 互转，带色块预览</p>
      <div class="tools-inline-form">
        <input class="tools-input" data-color-input placeholder="#e898a8 或 rgb(232,152,168)" />
        <input type="color" class="tools-color-picker" data-color-picker value="#e898a8" />
      </div>
      <div class="tools-color-swatch" data-color-swatch></div>
      <div class="tools-form-stack tools-mono" data-color-lines>
        <p data-color-hex>—</p>
        <p data-color-rgb>—</p>
        <p data-color-hsl>—</p>
      </div>
      <button type="button" class="tools-chip-btn" data-color-copy>复制 HEX</button>
    </div>`,

  regex: `
    <div class="tools-page">
      <h3 class="tools-page-title">.* 正则测试</h3>
      <p class="tools-page-desc">测试匹配与替换（JavaScript 语法）</p>
      <input class="tools-input" data-regex-pattern placeholder="正则，如 \\d+" />
      <input class="tools-input" data-regex-flags placeholder="flags，如 gim" value="g" />
      <textarea class="tools-textarea" data-regex-text placeholder="待匹配文本…"></textarea>
      <input class="tools-input" data-regex-repl placeholder="替换为（可选）" />
      <button type="button" class="tools-primary-btn" data-regex-run>测试</button>
      <p class="tools-stats-line" data-regex-status>—</p>
      <textarea class="tools-textarea" data-regex-result readonly placeholder="匹配 / 替换结果…"></textarea>
    </div>`,

  pwd: `
    <div class="tools-page">
      <h3 class="tools-page-title">🔑 密码生成</h3>
      <p class="tools-page-desc">本地随机生成，不上传网络</p>
      <div class="tools-inline-form">
        <input class="tools-input" data-pwd-len type="number" min="8" max="64" value="16" />
        <label class="tools-check-label"><input type="checkbox" data-pwd-sym checked /> 符号</label>
        <label class="tools-check-label"><input type="checkbox" data-pwd-num checked /> 数字</label>
      </div>
      <div class="tools-page-actions">
        <button type="button" class="tools-primary-btn" data-pwd-gen>生成</button>
        <button type="button" class="tools-chip-btn" data-pwd-copy>复制</button>
      </div>
      <p class="tools-mono tools-mono--lg" data-pwd-out>—</p>
    </div>`,
};

const BINDERS = {
  weather(panel) {
    const body = panel._detailBody;
    const status = body.querySelector('[data-weather-status]');
    const nowEl = body.querySelector('[data-weather-now]');
    const daysEl = body.querySelector('[data-weather-days]');
    const cityInput = body.querySelector('[data-weather-city]');
    const load = async () => {
      const city = cityInput?.value.trim() || DEFAULT_WEATHER_CITY;
      try {
        setStatus(status, '查询中…', true);
        const data = await fetchWeather({ city, force: true });
        if (nowEl && data.current) {
          nowEl.innerHTML = `<strong>${data.label || city}</strong> · 现在 <b>${data.current.temp}°C</b> · ${data.current.label}`;
        }
        if (daysEl && data.daily?.length) {
          daysEl.innerHTML = data.daily.slice(0, 7).map((d) => {
            const wd = new Date(d.date).toLocaleDateString('zh-CN', { weekday: 'short', month: 'numeric', day: 'numeric' });
            return `<div class="tools-weather-day"><span>${wd}</span><span>${d.label}</span><span>${d.min}~${d.max}°C</span></div>`;
          }).join('');
        }
        setStatus(status, '✓ 已更新', true);
      } catch (e) {
        setStatus(status, `✗ ${e.message}`, false);
      }
    };
    body.querySelector('[data-weather-load]')?.addEventListener('click', load);
    cityInput?.addEventListener('keydown', (e) => { if (e.key === 'Enter') load(); });
    const cached = getCachedWeather();
    if (cached?.city && cityInput) cityInput.value = cached.city;
    load();
  },

  countdown(panel) {
    const body = panel._detailBody;
    const result = body.querySelector('[data-cd-result]');
    body.querySelector('[data-cd-calc]')?.addEventListener('click', () => {
      const raw = body.querySelector('[data-cd-date]')?.value;
      const label = body.querySelector('[data-cd-label]')?.value.trim();
      if (!raw) {
        result.textContent = '请选择日期';
        return;
      }
      const target = new Date(raw);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      target.setHours(0, 0, 0, 0);
      const diff = Math.round((target - today) / 86400000);
      const name = label || '目标日';
      if (diff > 0) result.textContent = `距离「${name}」还有 ${diff} 天`;
      else if (diff === 0) result.textContent = `今天就是「${name}」！`;
      else result.textContent = `「${name}」已过去 ${Math.abs(diff)} 天`;
    });
  },

  todo(panel) {
    const body = panel._detailBody;
    const KEY = 'aqun-todo-list';
    const listEl = body.querySelector('[data-todo-list]');
    const input = body.querySelector('[data-todo-input]');
    const load = () => {
      try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
    };
    const save = (items) => localStorage.setItem(KEY, JSON.stringify(items));
    const render = () => {
      const items = load();
      if (!listEl) return;
      listEl.innerHTML = items.length
        ? items.map((t, i) => `
          <li class="tools-todo-item${t.done ? ' is-done' : ''}">
            <label><input type="checkbox" data-todo-check="${i}" ${t.done ? 'checked' : ''} /><span>${escHtml(t.text)}</span></label>
            <button type="button" class="tools-icon-btn tools-icon-btn--danger" data-todo-del="${i}">删</button>
          </li>`).join('')
        : '<li class="tools-reminder-empty">还没有待办</li>';
      listEl.querySelectorAll('[data-todo-check]').forEach((cb) => {
        cb.addEventListener('change', () => {
          const arr = load();
          const idx = Number(cb.dataset.todoCheck);
          if (arr[idx]) arr[idx].done = cb.checked;
          save(arr);
          render();
        });
      });
      listEl.querySelectorAll('[data-todo-del]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const arr = load();
          arr.splice(Number(btn.dataset.todoDel), 1);
          save(arr);
          render();
        });
      });
    };
    body.querySelector('[data-todo-add]')?.addEventListener('click', () => {
      const text = input?.value.trim();
      if (!text) return;
      const arr = load();
      arr.unshift({ text, done: false });
      save(arr);
      if (input) input.value = '';
      render();
    });
    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') body.querySelector('[data-todo-add]')?.click();
    });
    render();
  },

  calc(panel) {
    const body = panel._detailBody;
    const display = body.querySelector('[data-calc-display]');
    let expr = '0';
    let fresh = true;
    const render = () => { if (display) display.value = expr; };
    const safeEval = (s) => {
      const normalized = s.replace(/×/g, '*').replace(/÷/g, '/').replace(/%/g, '/100');
      if (!/^[0-9+\-*/().\s]+$/.test(normalized)) throw new Error('无效表达式');
      // eslint-disable-next-line no-new-func
      return Function(`"use strict"; return (${normalized})`)();
    };
    body.querySelectorAll('[data-calc-key]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const k = btn.dataset.calcKey;
        if (k === 'C') { expr = '0'; fresh = true; render(); return; }
        if (k === '⌫') { expr = expr.length > 1 ? expr.slice(0, -1) : '0'; render(); return; }
        if (k === '=') {
          try { expr = String(safeEval(expr)); fresh = true; } catch { expr = '错误'; fresh = true; }
          render(); return;
        }
        if (fresh && !'+-×÷'.includes(k)) { expr = k === '.' ? '0.' : k; fresh = false; }
        else if (fresh && '+-×÷'.includes(k)) { expr = expr + k; fresh = false; }
        else expr += k;
        render();
      });
    });
  },

  pomo(panel) {
    const body = panel._detailBody;
    const display = body.querySelector('[data-pomo-display]');
    const modeEl = body.querySelector('[data-pomo-mode]');
    const startBtn = body.querySelector('[data-pomo-start]');
    startBtn?.addEventListener('click', () => {
      if (panel._pomo.running) {
        panel._stopPomo();
        startBtn.textContent = '继续';
        return;
      }
      panel._startPomo(display, modeEl, startBtn);
    });
    body.querySelector('[data-pomo-reset]')?.addEventListener('click', () => {
      panel._stopPomo();
      panel._pomo.left = panel._pomo.mode === 'focus' ? 25 * 60 : 5 * 60;
      panel._updatePomoDisplay(display, modeEl);
      startBtn.textContent = '开始';
    });
    body.querySelectorAll('[data-pomo-preset]').forEach((btn) => {
      btn.addEventListener('click', () => {
        panel._stopPomo();
        const mins = Number(btn.dataset.pomoPreset);
        panel._pomo.mode = mins <= 10 ? 'break' : 'focus';
        panel._pomo.left = mins * 60;
        panel._updatePomoDisplay(display, modeEl);
        startBtn.textContent = '开始';
      });
    });
  },

  search(panel) {
    const body = panel._detailBody;
    const input = body.querySelector('[data-search-input]');
    const go = (engine) => {
      const url = searchUrl(engine, input?.value);
      if (url) openUrl(url);
    };
    body.querySelectorAll('[data-search-engine]').forEach((btn) => {
      btn.addEventListener('click', () => go(btn.dataset.searchEngine));
    });
    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) go('google');
      if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) go('google');
    });
  },

  latex(panel) {
    const body = panel._detailBody;
    const input = body.querySelector('[data-latex-input]');
    const preview = body.querySelector('[data-latex-preview]');
    const status = body.querySelector('[data-latex-status]');
    const refresh = () => {
      const raw = input?.value || '';
      preview.textContent = latexToUnicode(raw) || '—';
    };
    input?.addEventListener('input', refresh);
    refresh();
    body.querySelector('[data-latex-word]')?.addEventListener('click', async () => {
      const ok = await copyHtml(latexToWordHtml(input?.value || ''), latexToUnicode(input?.value || ''));
      setStatus(status, ok ? '✓ 已复制 Word HTML（粘贴到 Word 试试）' : '✗ 复制失败', ok);
    });
    body.querySelector('[data-latex-mathml]')?.addEventListener('click', async () => {
      const m = latexToMathML(input?.value || '');
      const ok = await copyText(m);
      setStatus(status, ok ? '✓ 已复制 MathML' : '✗ 复制失败', ok);
    });
    body.querySelector('[data-latex-unicode]')?.addEventListener('click', async () => {
      const ok = await copyText(latexToUnicode(input?.value || ''));
      setStatus(status, ok ? '✓ 已复制 Unicode' : '✗ 复制失败', ok);
    });
    body.querySelector('[data-latex-strip]')?.addEventListener('click', async () => {
      const s = (input?.value || '').replace(/^\$\$?|\$\$?$/g, '').trim();
      input.value = s;
      refresh();
      const ok = await copyText(s);
      setStatus(status, ok ? '✓ 已去定界符并复制' : '✗ 复制失败', ok);
    });
  },

  'latex-snip'(panel) {
    const grid = panel._detailBody.querySelector('[data-snip-grid]');
    if (!grid) return;
    grid.innerHTML = LATEX_SNIPPETS.map(
      (s) => `
      <button type="button" class="tools-snip-btn" data-snip-latex="${escAttr(s.latex)}">
        <span class="tools-snip-name">${s.name}</span>
        <code class="tools-snip-code">${escHtml(s.latex)}</code>
      </button>`
    ).join('');
    grid.querySelectorAll('[data-snip-latex]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        await copyText(btn.dataset.snipLatex || '');
        btn.classList.add('is-copied');
        setTimeout(() => btn.classList.remove('is-copied'), 800);
      });
    });
  },

  markdown(panel) {
    const body = panel._detailBody;
    const input = body.querySelector('[data-md-input]');
    const preview = body.querySelector('[data-md-preview]');
    const render = () => {
      preview.innerHTML = mdToHtml(input?.value || '');
    };
    input?.addEventListener('input', render);
    render();
    body.querySelector('[data-md-copy-html]')?.addEventListener('click', () =>
      copyHtml(preview.innerHTML, input?.value || ''));
    body.querySelector('[data-md-copy-md]')?.addEventListener('click', () =>
      copyText(input?.value || ''));
  },

  stats(panel) {
    const body = panel._detailBody;
    const input = body.querySelector('[data-stats-input]');
    const update = () => {
      const text = input?.value || '';
      const cn = (text.match(/[\u4e00-\u9fff]/g) || []).length;
      body.querySelector('[data-stat-chars]').textContent = text.length;
      body.querySelector('[data-stat-words]').textContent = text.trim() ? text.trim().split(/\s+/).length : 0;
      body.querySelector('[data-stat-lines]').textContent = text ? text.split(/\n/).length : 0;
      body.querySelector('[data-stat-cn]').textContent = cn;
    };
    input?.addEventListener('input', update);
    update();
  },

  reading(panel) {
    const body = panel._detailBody;
    const input = body.querySelector('[data-read-input]');
    const update = () => {
      const text = input?.value || '';
      const cn = (text.match(/[\u4e00-\u9fff]/g) || []).length;
      const en = (text.match(/[a-zA-Z]+/g) || []).length;
      const min = Math.max(1, Math.ceil(cn / 400 + en / 200));
      body.querySelector('[data-read-min]').textContent = min;
      body.querySelector('[data-read-cn]').textContent = cn;
      body.querySelector('[data-read-en]').textContent = en;
    };
    input?.addEventListener('input', update);
    update();
  },

  case(panel) {
    const body = panel._detailBody;
    const input = body.querySelector('[data-case-input]');
    const output = body.querySelector('[data-case-output]');
    const convert = (type) => {
      const s = input?.value || '';
      const words = s.split(/[\s_\-./]+/).filter(Boolean);
      const map = {
        upper: () => s.toUpperCase(),
        lower: () => s.toLowerCase(),
        title: () => words.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' '),
        camel: () => words.map((w, i) => (i ? w.charAt(0).toUpperCase() : w.charAt(0).toLowerCase()) + w.slice(1).toLowerCase()).join(''),
        pascal: () => words.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(''),
        snake: () => words.map((w) => w.toLowerCase()).join('_'),
        kebab: () => words.map((w) => w.toLowerCase()).join('-'),
      };
      output.value = map[type]?.() ?? s;
    };
    body.querySelectorAll('[data-case-type]').forEach((btn) => {
      btn.addEventListener('click', () => convert(btn.dataset.caseType));
    });
    body.querySelector('[data-case-copy]')?.addEventListener('click', () => copyText(output?.value || ''));
    input?.addEventListener('input', () => convert('snake'));
  },

  doi(panel) {
    const body = panel._detailBody;
    const input = body.querySelector('[data-doi-input]');
    const preview = body.querySelector('[data-doi-preview]');
    const normalize = () => {
      const raw = (input?.value || '').trim().replace(/^https?:\/\/(dx\.)?doi\.org\//i, '');
      preview.textContent = raw ? `https://doi.org/${raw}` : '—';
      return raw;
    };
    input?.addEventListener('input', normalize);
    body.querySelector('[data-doi-open]')?.addEventListener('click', () => {
      const doi = normalize();
      if (doi) openUrl(`https://doi.org/${doi}`);
    });
    body.querySelector('[data-doi-copy]')?.addEventListener('click', () => {
      const doi = normalize();
      if (doi) copyText(`https://doi.org/${doi}`);
    });
  },

  bibtex(panel) {
    const body = panel._detailBody;
    const input = body.querySelector('[data-bib-input]');
    const status = body.querySelector('[data-bib-status]');
    body.querySelector('[data-bib-format]')?.addEventListener('click', () => {
      try {
        input.value = formatBibtex(input?.value || '');
        setStatus(status, '✓ 已格式化', true);
      } catch (e) {
        setStatus(status, `✗ ${e.message}`, false);
      }
    });
    body.querySelector('[data-bib-copy]')?.addEventListener('click', () => copyText(input?.value || ''));
  },

  cite(panel) {
    const body = panel._detailBody;
    const get = (sel) => body.querySelector(sel)?.value?.trim() || '';
    const output = body.querySelector('[data-cite-output]');
    const build = (fmt) => {
      const a = get('[data-cite-authors]');
      const y = get('[data-cite-year]');
      const t = get('[data-cite-title]');
      const j = get('[data-cite-journal]');
      const v = get('[data-cite-vol]');
      if (fmt === 'apa') {
        output.value = `${a} (${y}). ${t}. ${j}${v ? `, ${v}` : ''}.`.replace(/\.\./g, '.').trim();
      } else {
        output.value = `${a}. ${t}[J]. ${j}, ${y}${v ? `:${v}` : ''}.`.replace(/\,\s*\./g, '.').trim();
      }
    };
    body.querySelector('[data-cite-apa]')?.addEventListener('click', () => build('apa'));
    body.querySelector('[data-cite-gb]')?.addEventListener('click', () => build('gb'));
    body.querySelector('[data-cite-copy]')?.addEventListener('click', () => copyText(output?.value || ''));
  },

  json(panel) {
    const body = panel._detailBody;
    const input = body.querySelector('[data-json-input]');
    const status = body.querySelector('[data-json-status]');
    const run = (space) => {
      try {
        const out = JSON.stringify(JSON.parse(input?.value || '{}'), null, space);
        input.value = out;
        setStatus(status, `✓ 有效 JSON · ${out.length} 字符`, true);
      } catch (e) {
        setStatus(status, `✗ ${e.message}`, false);
      }
    };
    body.querySelector('[data-json-format]')?.addEventListener('click', () => run(2));
    body.querySelector('[data-json-minify]')?.addEventListener('click', () => run(undefined));
    body.querySelector('[data-json-copy]')?.addEventListener('click', () => copyText(input?.value || ''));
  },

  encode(panel) {
    const body = panel._detailBody;
    const input = body.querySelector('[data-enc-input]');
    const output = body.querySelector('[data-enc-output]');
    const mode = body.querySelector('[data-enc-mode]');
    const status = body.querySelector('[data-enc-status]');
    const run = () => {
      try {
        const s = input?.value ?? '';
        const m = mode?.value;
        let out = '';
        if (m === 'b64-enc') out = btoa(unescape(encodeURIComponent(s)));
        else if (m === 'b64-dec') out = decodeURIComponent(escape(atob(s.trim())));
        else if (m === 'url-enc') out = encodeURIComponent(s);
        else if (m === 'url-dec') out = decodeURIComponent(s);
        output.value = out;
        setStatus(status, '✓ 转换成功', true);
      } catch (e) {
        setStatus(status, `✗ ${e.message}`, false);
      }
    };
    body.querySelector('[data-enc-run]')?.addEventListener('click', run);
    body.querySelector('[data-enc-copy]')?.addEventListener('click', () => copyText(output?.value || ''));
  },

  diff(panel) {
    const body = panel._detailBody;
    body.querySelector('[data-diff-run]')?.addEventListener('click', () => {
      const a = (body.querySelector('[data-diff-a]')?.value || '').split('\n');
      const b = (body.querySelector('[data-diff-b]')?.value || '').split('\n');
      const max = Math.max(a.length, b.length);
      const lines = [];
      for (let i = 0; i < max; i += 1) {
        const la = a[i] ?? '';
        const lb = b[i] ?? '';
        if (la === lb) lines.push(`<div class="diff-eq">${escHtml(la || ' ')}</div>`);
        else {
          if (la) lines.push(`<div class="diff-del">− ${escHtml(la)}</div>`);
          if (lb) lines.push(`<div class="diff-add">+ ${escHtml(lb)}</div>`);
        }
      }
      body.querySelector('[data-diff-result]').innerHTML = lines.join('') || '<div class="diff-eq">（无差异）</div>';
    });
  },

  'table-md'(panel) {
    bindTableEditor(panel, {
      rowsSel: '[data-tmd-rows]',
      colsSel: '[data-tmd-cols]',
      buildSel: '[data-tmd-build]',
      editorSel: '[data-tmd-editor]',
      outputSel: '[data-tmd-output]',
      copySel: '[data-tmd-copy]',
      toOutput: (cells, cols) => {
        const header = `| ${cells.slice(0, cols).join(' | ')} |`;
        const sep = `| ${Array(cols).fill('---').join(' | ')} |`;
        const bodyRows = [];
        for (let r = 1; r < cells.length / cols; r += 1) {
          bodyRows.push(`| ${cells.slice(r * cols, (r + 1) * cols).join(' | ')} |`);
        }
        return [header, sep, ...bodyRows].join('\n');
      },
    });
  },

  'latex-table'(panel) {
    bindTableEditor(panel, {
      rowsSel: '[data-ltx-rows]',
      colsSel: '[data-ltx-cols]',
      buildSel: '[data-ltx-build]',
      editorSel: '[data-ltx-editor]',
      outputSel: '[data-ltx-output]',
      copySel: '[data-ltx-copy]',
      toOutput: (cells, cols) => {
        const colSpec = 'l'.repeat(cols);
        const rows = [];
        for (let r = 0; r < cells.length / cols; r += 1) {
          rows.push(cells.slice(r * cols, (r + 1) * cols).join(' & '));
        }
        return [
          '\\begin{tabular}{' + colSpec + '}',
          '  ' + rows.join(' \\\\\n  ') + ' \\\\',
          '\\end{tabular}',
        ].join('\n');
      },
    });
  },

  unit(panel) {
    const body = panel._detailBody;
    const unitInput = body.querySelector('[data-unit-input]');
    const unitDir = body.querySelector('[data-unit-dir]');
    const unitResult = body.querySelector('[data-unit-result]');
    const map = {
      'mb-gb': (v) => `${(v / 1024).toFixed(4)} GB`,
      'gb-mb': (v) => `${(v * 1024).toFixed(2)} MB`,
      'kb-mb': (v) => `${(v / 1024).toFixed(4)} MB`,
      'gb-tb': (v) => `${(v / 1024).toFixed(4)} TB`,
      'c-f': (v) => `${((v * 9) / 5 + 32).toFixed(1)} °F`,
      'f-c': (v) => `${(((v - 32) * 5) / 9).toFixed(1)} °C`,
      'c-k': (v) => `${(v + 273.15).toFixed(2)} K`,
      'cm-m': (v) => `${(v / 100).toFixed(4)} m`,
      'm-km': (v) => `${(v / 1000).toFixed(4)} km`,
      'in-cm': (v) => `${(v * 2.54).toFixed(2)} cm`,
      'ft-m': (v) => `${(v * 0.3048).toFixed(3)} m`,
      'g-kg': (v) => `${(v / 1000).toFixed(4)} kg`,
      'kg-lb': (v) => `${(v * 2.20462).toFixed(2)} lb`,
    };
    const calc = () => {
      const v = Number(unitInput?.value);
      if (!Number.isFinite(v)) {
        unitResult.textContent = '—';
        return;
      }
      const fn = map[unitDir?.value];
      unitResult.textContent = fn ? fn(v) : '—';
    };
    unitInput?.addEventListener('input', calc);
    unitDir?.addEventListener('change', calc);
  },

  percent(panel) {
    const body = panel._detailBody;
    const result = body.querySelector('[data-pct-result]');
    body.querySelector('[data-pct-ratio]')?.addEventListener('click', () => {
      const a = Number(body.querySelector('[data-pct-a]')?.value);
      const b = Number(body.querySelector('[data-pct-b]')?.value);
      result.textContent = b ? `${((a / b) * 100).toFixed(2)}%` : '—';
    });
    body.querySelector('[data-pct-change]')?.addEventListener('click', () => {
      const base = Number(body.querySelector('[data-pct-base]')?.value);
      const rate = Number(body.querySelector('[data-pct-rate]')?.value);
      result.textContent = Number.isFinite(base) && Number.isFinite(rate)
        ? `${(base * (1 + rate / 100)).toFixed(4)}（${rate >= 0 ? '+' : ''}${rate}%）`
        : '—';
    });
  },

  timestamp(panel) {
    const body = panel._detailBody;
    const tsNow = body.querySelector('[data-ts-now]');
    const tsInput = body.querySelector('[data-ts-input]');
    const tsResult = body.querySelector('[data-ts-result]');
    const tick = () => {
      const now = Date.now();
      if (tsNow) tsNow.textContent = `${new Date(now).toLocaleString('zh-CN')} · ${now}`;
    };
    tick();
    panel._tsTimer = setInterval(tick, 1000);
    body.querySelector('[data-ts-copy]')?.addEventListener('click', () => copyText(String(Date.now())));
    body.querySelector('[data-ts-convert]')?.addEventListener('click', () => {
      const raw = Number(tsInput?.value);
      tsResult.textContent = Number.isFinite(raw) ? new Date(raw).toLocaleString('zh-CN') : '请输入有效数字';
    });
  },

  uuid(panel) {
    const body = panel._detailBody;
    const out = body.querySelector('[data-uuid-out]');
    const genUuid = () => crypto.randomUUID?.() || 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
    const genShort = () => Math.random().toString(36).slice(2, 10);
    const genNano = () => {
      const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_-';
      return Array.from({ length: 21 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    };
    body.querySelector('[data-uuid-gen]')?.addEventListener('click', () => { out.textContent = genUuid(); });
    body.querySelector('[data-uuid-short]')?.addEventListener('click', () => { out.textContent = genShort(); });
    body.querySelector('[data-uuid-nano]')?.addEventListener('click', () => { out.textContent = genNano(); });
    body.querySelector('[data-uuid-copy]')?.addEventListener('click', () => copyText(out?.textContent || ''));
    out.textContent = genUuid();
  },

  color(panel) {
    const body = panel._detailBody;
    const input = body.querySelector('[data-color-input]');
    const picker = body.querySelector('[data-color-picker]');
    const swatch = body.querySelector('[data-color-swatch]');
    const hexEl = body.querySelector('[data-color-hex]');
    const rgbEl = body.querySelector('[data-color-rgb]');
    const hslEl = body.querySelector('[data-color-hsl]');
    const parse = (raw) => {
      let s = String(raw || '').trim();
      if (/^#[0-9a-f]{6}$/i.test(s)) {
        const n = parseInt(s.slice(1), 16);
        return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
      }
      const m = s.match(/rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i);
      if (m) return { r: +m[1], g: +m[2], b: +m[3] };
      return null;
    };
    const refresh = () => {
      const rgb = parse(input?.value || picker?.value);
      if (!rgb) return;
      const hex = `#${[rgb.r, rgb.g, rgb.b].map((x) => x.toString(16).padStart(2, '0')).join('')}`;
      picker.value = hex;
      swatch.style.background = hex;
      hexEl.textContent = hex.toUpperCase();
      rgbEl.textContent = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
      const rn = rgb.r / 255; const gn = rgb.g / 255; const bn = rgb.b / 255;
      const max = Math.max(rn, gn, bn); const min = Math.min(rn, gn, bn);
      let h = 0; let s = 0; const l = (max + min) / 2;
      if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
        else if (max === gn) h = ((bn - rn) / d + 2) / 6;
        else h = ((rn - gn) / d + 4) / 6;
      }
      hslEl.textContent = `hsl(${Math.round(h * 360)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`;
    };
    input?.addEventListener('input', refresh);
    picker?.addEventListener('input', () => { input.value = picker.value; refresh(); });
    body.querySelector('[data-color-copy]')?.addEventListener('click', () => copyText(hexEl?.textContent || ''));
    refresh();
  },

  regex(panel) {
    const body = panel._detailBody;
    const status = body.querySelector('[data-regex-status]');
    body.querySelector('[data-regex-run]')?.addEventListener('click', () => {
      try {
        const pat = body.querySelector('[data-regex-pattern]')?.value || '';
        const flags = body.querySelector('[data-regex-flags]')?.value || '';
        const text = body.querySelector('[data-regex-text]')?.value || '';
        const repl = body.querySelector('[data-regex-repl]')?.value;
        const re = new RegExp(pat, flags);
        const result = body.querySelector('[data-regex-result]');
        if (repl != null && repl !== '') {
          result.value = text.replace(re, repl);
          setStatus(status, '✓ 替换完成', true);
        } else {
          const m = text.match(re);
          result.value = m ? m.join('\n') : '（无匹配）';
          setStatus(status, m ? `✓ ${m.length} 处匹配` : '无匹配', !!m);
        }
      } catch (e) {
        setStatus(status, `✗ ${e.message}`, false);
      }
    });
  },

  pwd(panel) {
    const body = panel._detailBody;
    const out = body.querySelector('[data-pwd-out]');
    const gen = () => {
      const len = Math.min(64, Math.max(8, Number(body.querySelector('[data-pwd-len]')?.value) || 16));
      const sym = body.querySelector('[data-pwd-sym]')?.checked;
      const num = body.querySelector('[data-pwd-num]')?.checked;
      let pool = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
      if (num) pool += '0123456789';
      if (sym) pool += '!@#$%^&*-_+=';
      const arr = new Uint32Array(len);
      crypto.getRandomValues(arr);
      out.textContent = Array.from(arr, (n) => pool[n % pool.length]).join('');
    };
    body.querySelector('[data-pwd-gen]')?.addEventListener('click', gen);
    body.querySelector('[data-pwd-copy]')?.addEventListener('click', () => copyText(out?.textContent || ''));
    gen();
  },
};

function bindTableEditor(panel, { rowsSel, colsSel, buildSel, editorSel, outputSel, copySel, toOutput }) {
  const body = panel._detailBody;
  const build = () => {
    const rows = Math.min(12, Math.max(2, Number(body.querySelector(rowsSel)?.value) || 3));
    const cols = Math.min(8, Math.max(2, Number(body.querySelector(colsSel)?.value) || 3));
    const editor = body.querySelector(editorSel);
    editor.innerHTML = '';
    editor.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    for (let i = 0; i < rows * cols; i += 1) {
      const inp = document.createElement('input');
      inp.className = 'tools-cell-input';
      inp.placeholder = i < cols ? `列${(i % cols) + 1}` : '';
      inp.dataset.cell = String(i);
      editor.appendChild(inp);
    }
    const sync = () => {
      const cells = [...editor.querySelectorAll('.tools-cell-input')].map((el) => el.value.trim() || ' ');
      body.querySelector(outputSel).value = toOutput(cells, cols);
    };
    editor.querySelectorAll('.tools-cell-input').forEach((el) => el.addEventListener('input', sync));
    sync();
  };
  body.querySelector(buildSel)?.addEventListener('click', build);
  body.querySelector(copySel)?.addEventListener('click', () =>
    copyText(body.querySelector(outputSel)?.value || ''));
  build();
}

function mdToHtml(md) {
  let s = escHtml(md);
  s = s.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  s = s.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  s = s.replace(/^# (.+)$/gm, '<h1>$1</h1>');
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/\*(.+?)\*/g, '<em>$1</em>');
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  s = s.replace(/^\s*[-*] (.+)$/gm, '<li>$1</li>');
  s = s.replace(/(<li>.*<\/li>\n?)+/g, (m) => `<ul>${m}</ul>`);
  s = s.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>');
  s = s.replace(/\n\n/g, '</p><p>');
  s = s.replace(/\n/g, '<br>');
  return `<p>${s}</p>`;
}

function formatBibtex(raw) {
  const trimmed = raw.trim();
  if (!trimmed.startsWith('@')) throw new Error('需要 @article{...} 格式');
  const lines = trimmed.split('\n').map((l) => l.trim()).filter(Boolean);
  return lines
    .map((line, i) => {
      if (i === 0) return line;
      if (line === '}' || line === '},') return line.replace(/,$/, '');
      const m = line.match(/^(\w+)\s*=\s*\{([^}]*)\},?$/);
      if (m) return `  ${m[1]} = {${m[2]}},`;
      return `  ${line.replace(/,$/, '')},`;
    })
    .join('\n')
    .replace(/,\s*\n\}/, '\n}');
}

function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escAttr(s) {
  return String(s).replace(/"/g, '&quot;');
}
