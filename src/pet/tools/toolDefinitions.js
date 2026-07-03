import { copyText, copyHtml, openUrl, searchUrl, setStatus } from './helpers.js';
import { latexToUnicode, latexToMathML, latexToWordHtml, LATEX_SNIPPETS } from './latexUtils.js';
import { fetchWeather, getCachedWeather } from '../weatherService.js';
import { DEFAULT_WEATHER_CITY } from '../locationDefaults.js';
import {
  STUDENT_TOOL_APPS,
  STUDENT_TEMPLATES,
  STUDENT_BINDERS,
} from './studentTools.js';

/** 小工具目录：元数据 + 页面模板 + 绑定逻辑 */
const CORE_TOOL_APPS = [
  { id: 'pomo', icon: '🍅', name: '专注番茄钟', desc: '25/5 循环 · 完成提醒', category: '效率' },
  { id: 'todo', icon: '✅', name: '待办清单', desc: '本地便签 · 勾选完成', category: '效率' },
  { id: 'search', icon: '🔍', name: '聚合搜索', desc: '学术 · 通用 · 开发引擎', category: '搜索' },
  { id: 'latex', icon: '∑', name: 'LaTeX 公式', desc: 'Word · MathML · 常用片段', category: '写作' },
  { id: 'table-gen', icon: '▦', name: '表格生成', desc: 'Markdown · LaTeX tabular', category: '写作' },
  { id: 'markdown', icon: 'MD', name: 'Markdown', desc: '预览 · 转 HTML', category: '写作' },
  { id: 'weather', icon: '🌤', name: '天气查询', desc: '当前 · 近7天预报', category: '生活' },
  { id: 'calc', icon: '🧮', name: '计算器', desc: '日常四则运算', category: '生活' },
];

export const TOOL_APPS = [...STUDENT_TOOL_APPS, ...CORE_TOOL_APPS];

export function getToolTemplate(id) {
  return STUDENT_TEMPLATES[id] || TEMPLATES[id] || '';
}

export function bindTool(id, panel) {
  (STUDENT_BINDERS[id] ?? BINDERS[id])?.(panel);
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

  todo: `
    <div class="tools-page">
      <h3 class="tools-page-title">✅ 待办清单</h3>
      <p class="tools-page-desc">保存在本机，关闭后仍会保留</p>
      <div class="tools-form-row">
        <input class="tools-input" data-todo-input placeholder="添加待办…" maxlength="60" />
        <button type="button" class="tools-primary-btn" data-todo-add>添加</button>
      </div>
      <div class="tools-page-actions">
        <button type="button" class="tools-chip-btn" data-todo-clear-done>清除已完成</button>
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
      <h3 class="tools-page-title">🍅 专注番茄钟</h3>
      <p class="tools-page-desc">25 分钟专注 + 5 分钟休息，阶段结束会提醒</p>
      <div class="tools-pomo-ring" data-pomo-display>25:00</div>
      <p class="tools-pomo-mode" data-pomo-mode>专注中</p>
      <p class="tools-stats-line" data-pomo-sessions>今日完成 0 个番茄</p>
      <div class="tools-page-actions">
        <button type="button" class="tools-primary-btn" data-pomo-start>开始</button>
        <button type="button" class="tools-chip-btn" data-pomo-reset>重置</button>
        <button type="button" class="tools-chip-btn" data-pomo-notify>开启提醒</button>
      </div>
      <div class="tools-pomo-presets">
        <button type="button" class="tools-chip-btn" data-pomo-preset="25">25 分</button>
        <button type="button" class="tools-chip-btn" data-pomo-preset="45">45 分</button>
        <button type="button" class="tools-chip-btn" data-pomo-preset="5">休息 5 分</button>
      </div>
    </div>`,

  search: `
    <div class="tools-page">
      <h3 class="tools-page-title">🔍 聚合搜索</h3>
      <p class="tools-page-desc">Enter 默认 Google · Scholar / 知网 / arXiv 等学术引擎一键打开</p>
      <textarea class="tools-textarea" data-search-input placeholder="输入搜索内容…" rows="3"></textarea>
      <div class="tools-search-grid">
        <button type="button" class="tools-search-btn" data-search-engine="google">Google</button>
        <button type="button" class="tools-search-btn" data-search-engine="scholar">Scholar</button>
        <button type="button" class="tools-search-btn" data-search-engine="semantic">Semantic Scholar</button>
        <button type="button" class="tools-search-btn" data-search-engine="cnki">知网</button>
        <button type="button" class="tools-search-btn" data-search-engine="bing">Bing</button>
        <button type="button" class="tools-search-btn" data-search-engine="baidu">百度</button>
        <button type="button" class="tools-search-btn" data-search-engine="pubmed">PubMed</button>
        <button type="button" class="tools-search-btn" data-search-engine="arxiv">arXiv</button>
        <button type="button" class="tools-search-btn" data-search-engine="dblp">DBLP</button>
        <button type="button" class="tools-search-btn" data-search-engine="github">GitHub</button>
        <button type="button" class="tools-search-btn" data-search-engine="stackoverflow">StackOverflow</button>
        <button type="button" class="tools-search-btn" data-search-engine="zhihu">知乎</button>
      </div>
    </div>`,

  latex: `
    <div class="tools-page">
      <h3 class="tools-page-title">∑ LaTeX 公式</h3>
      <p class="tools-page-desc">公式转换 + 常用片段，写论文 / 作业一站式</p>
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
      <p class="tools-section-label">常用片段 · 点击复制</p>
      <div class="tools-snip-grid" data-snip-grid></div>
      <p class="tools-hint-line">Word 粘贴：优先用「复制到 Word」；若公式异常，可试 MathML 或 Unicode。</p>
    </div>`,

  'table-gen': `
    <div class="tools-page">
      <h3 class="tools-page-title">▦ 表格生成</h3>
      <p class="tools-page-desc">可视化填表，导出 Markdown 或 LaTeX tabular</p>
      <div class="tools-subnav">
        <button type="button" class="tools-subnav-btn is-active" data-tbl-tab="md"><span>Markdown</span></button>
        <button type="button" class="tools-subnav-btn" data-tbl-tab="latex"><span>LaTeX</span></button>
      </div>
      <div class="tools-section is-active" data-tbl-pane="md">
        <div class="tools-inline-form">
          <label class="tools-inline-label">行 <input class="tools-input tools-input--xs" data-tmd-rows type="number" min="2" max="12" value="3" /></label>
          <label class="tools-inline-label">列 <input class="tools-input tools-input--xs" data-tmd-cols type="number" min="2" max="8" value="3" /></label>
          <button type="button" class="tools-chip-btn" data-tmd-build>生成表格</button>
        </div>
        <div class="tools-table-editor" data-tmd-editor></div>
        <textarea class="tools-textarea" data-tmd-output readonly rows="6"></textarea>
        <button type="button" class="tools-primary-btn" data-tmd-copy>复制 Markdown</button>
      </div>
      <div class="tools-section" data-tbl-pane="latex">
        <div class="tools-inline-form">
          <label class="tools-inline-label">行 <input class="tools-input tools-input--xs" data-ltx-rows type="number" min="2" max="12" value="3" /></label>
          <label class="tools-inline-label">列 <input class="tools-input tools-input--xs" data-ltx-cols type="number" min="2" max="8" value="3" /></label>
          <button type="button" class="tools-chip-btn" data-ltx-build>生成</button>
        </div>
        <div class="tools-table-editor" data-ltx-editor></div>
        <textarea class="tools-textarea tools-textarea--lg" data-ltx-output readonly rows="8"></textarea>
        <button type="button" class="tools-primary-btn" data-ltx-copy>复制 LaTeX</button>
      </div>
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
    body.querySelector('[data-todo-clear-done]')?.addEventListener('click', () => {
      const arr = load().filter((t) => !t.done);
      save(arr);
      render();
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
    const sessionsEl = body.querySelector('[data-pomo-sessions]');
    const startBtn = body.querySelector('[data-pomo-start]');
    const notifyBtn = body.querySelector('[data-pomo-notify]');

    const todayKey = () => {
      const d = new Date();
      return `aqun-pomo-${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    };
    const getSessions = () => {
      try { return Number(localStorage.getItem(todayKey()) || 0); } catch { return 0; }
    };
    const setSessions = (n) => localStorage.setItem(todayKey(), String(n));
    const refreshSessions = () => {
      if (sessionsEl) sessionsEl.textContent = `今日完成 ${getSessions()} 个番茄`;
    };
    refreshSessions();

    if (notifyBtn) {
      const syncNotify = () => {
        if (typeof Notification === 'undefined') {
          notifyBtn.textContent = '浏览器不支持提醒';
          return;
        }
        notifyBtn.textContent = Notification.permission === 'granted' ? '提醒已开启' : '开启提醒';
      };
      syncNotify();
      notifyBtn.addEventListener('click', async () => {
        if (typeof Notification === 'undefined') return;
        if (Notification.permission === 'granted') syncNotify();
        else if (Notification.permission !== 'denied') {
          await Notification.requestPermission();
          syncNotify();
        }
      });
    }

    panel._pomoOnPhaseEnd = (prevMode) => {
      if (prevMode === 'focus') {
        setSessions(getSessions() + 1);
        refreshSessions();
      }
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        const title = prevMode === 'focus' ? '专注完成，休息一下吧' : '休息结束，继续专注';
        new Notification(title, { body: prevMode === 'focus' ? '5 分钟休息后开始下一轮' : '25 分钟专注，你可以的' });
      }
    };

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
    const grid = body.querySelector('[data-snip-grid]');
    if (grid) {
      grid.innerHTML = LATEX_SNIPPETS.map(
        (s) => `
        <button type="button" class="tools-snip-btn" data-snip-latex="${escAttr(s.latex)}">
          <span class="tools-snip-name">${s.name}</span>
          <code class="tools-snip-code">${escHtml(s.latex)}</code>
        </button>`,
      ).join('');
      grid.querySelectorAll('[data-snip-latex]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const latex = btn.dataset.snipLatex || '';
          await copyText(latex);
          if (input) { input.value = latex; refresh(); }
          btn.classList.add('is-copied');
          setTimeout(() => btn.classList.remove('is-copied'), 800);
        });
      });
    }
  },

  'table-gen'(panel) {
    const body = panel._detailBody;
    body.querySelectorAll('[data-tbl-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.tblTab;
        body.querySelectorAll('[data-tbl-tab]').forEach((b) => b.classList.toggle('is-active', b === btn));
        body.querySelectorAll('[data-tbl-pane]').forEach((p) => {
          p.classList.toggle('is-active', p.dataset.tblPane === id);
        });
      });
    });
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

function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escAttr(s) {
  return String(s).replace(/"/g, '&quot;');
}
