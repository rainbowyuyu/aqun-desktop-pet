import { copyText, openUrl, setStatus } from './helpers.js';
import {
  fetchCrossrefDoi,
  searchCrossref,
  searchSemanticScholar,
  fetchArxivMeta,
  fetchExchangeRates,
  normalizeDoi,
  normalizeArxivId,
  crossrefToBibtex,
  crossrefToGbCite,
  descriptiveStats,
  pearsonCorrelation,
  parseNumberList,
} from './academicApi.js';

function escHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escAttr(s) {
  return String(s ?? '').replace(/"/g, '&quot;');
}

function bindSubnav(body, tabAttr, paneAttr) {
  body.querySelectorAll(`[${tabAttr}]`).forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute(tabAttr);
      body.querySelectorAll(`[${tabAttr}]`).forEach((b) => b.classList.toggle('is-active', b === btn));
      body.querySelectorAll(`[${paneAttr}]`).forEach((p) => {
        p.classList.toggle('is-active', p.getAttribute(paneAttr) === id);
      });
    });
  });
}

function detectPaperId(raw) {
  const s = String(raw || '').trim();
  if (!s) return null;
  if (/arxiv|^\d{4}\.\d{4,5}/i.test(s)) {
    const id = normalizeArxivId(s);
    if (id) return { type: 'arxiv', id };
  }
  const doi = normalizeDoi(s);
  if (doi) return { type: 'doi', id: doi };
  return null;
}

function loadJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveJson(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}

function authorsToDisplay(authors) {
  if (!authors?.length) return '';
  return authors.map((a) => `${a.family || ''}${a.given ? ` ${a.given}` : ''}`.trim()).join(', ');
}

const ACADEMIC_LINKS = [
  { name: 'Google Scholar', desc: '学术搜索', url: 'https://scholar.google.com', icon: '🎓', accent: '#4285f4' },
  { name: 'Semantic Scholar', desc: 'AI 文献检索', url: 'https://www.semanticscholar.org', icon: '🔬', accent: '#1857b6' },
  { name: 'Zotero', desc: '文献管理', url: 'https://www.zotero.org', icon: '📚', accent: '#cc2936' },
  { name: 'Overleaf', desc: 'LaTeX 协作', url: 'https://www.overleaf.com', icon: '📝', accent: '#47a141' },
  { name: 'arXiv', desc: '预印本库', url: 'https://arxiv.org', icon: '📜', accent: '#b31b1b' },
  { name: 'PubMed', desc: '生物医学', url: 'https://pubmed.ncbi.nlm.nih.gov', icon: '🧬', accent: '#326599' },
  { name: 'CNKI 知网', desc: '中文文献', url: 'https://www.cnki.net', icon: '🇨🇳', accent: '#0066cc' },
  { name: '万方数据', desc: '中文学位论文', url: 'https://www.wanfangdata.com.cn', icon: '📖', accent: '#0084ff' },
  { name: 'Connected Papers', desc: '文献图谱', url: 'https://www.connectedpapers.com', icon: '🕸', accent: '#6c5ce7' },
  { name: 'Research Rabbit', desc: '文献追踪', url: 'https://www.researchrabbit.ai', icon: '🐇', accent: '#ff6b6b' },
  { name: 'DBLP', desc: '计算机文献', url: 'https://dblp.org', icon: '💻', accent: '#004488' },
  { name: 'IEEE Xplore', desc: '工程文献', url: 'https://ieeexplore.ieee.org', icon: '⚡', accent: '#00629b' },
];

export const STUDENT_TOOL_APPS = [
  { id: 'literature', icon: '🔬', name: '文献中心', desc: '检索 · DOI/arXiv · 引用 · 站点', category: '科研' },
  { id: 'stat', icon: '📈', name: '统计助手', desc: '均值 · 标准差 · 相关分析', category: '科研' },
  { id: 'thesis', icon: '📝', name: '写作进度', desc: '字数 · 章节 · 阅读估算', category: '写作' },
  { id: 'schedule', icon: '📅', name: '日程规划', desc: '周课表 · 考试倒计时', category: '效率' },
  { id: 'flashcard', icon: '🃏', name: '闪卡记忆', desc: '本地背诵 · 间隔复习', category: '效率' },
  { id: 'gpa', icon: '📊', name: 'GPA 计算', desc: '学分加权 · 4.0 / 5.0 制', category: '生活' },
  { id: 'budget', icon: '💰', name: '生活费账本', desc: '月度预算 · 支出记录', category: '生活' },
  { id: 'currency', icon: '💱', name: '汇率换算', desc: 'Frankfurter 实时汇率', category: '生活' },
  { id: 'sleep', icon: '😴', name: '作息助手', desc: '睡眠周期 · 最佳起床', category: '生活' },
];

function renderPaperList(el, papers) {
  if (!el) return;
  if (!papers.length) {
    el.innerHTML = '<p class="tools-paper-empty">未找到相关文献，试试换关键词或切换数据源</p>';
    return;
  }
  el.innerHTML = papers.map((p) => `
    <article class="tools-paper-card">
      <h4 class="tools-paper-title">${escHtml(p.title)}</h4>
      <p class="tools-paper-meta">${escHtml(p.authors || '—')} · ${p.year || '—'}${p.citations != null ? ` · 被引 ${p.citations}` : ''}${p.venue ? ` · ${escHtml(p.venue)}` : ''}</p>
      ${p.abstract ? `<p class="tools-paper-abstract">${escHtml(p.abstract.slice(0, 280))}${p.abstract.length > 280 ? '…' : ''}</p>` : ''}
      <div class="tools-paper-actions">
        ${p.url ? `<button type="button" class="tools-chip-btn" data-paper-open="${escHtml(p.url)}">打开</button>` : ''}
        ${p.pdf ? `<button type="button" class="tools-chip-btn" data-paper-pdf="${escHtml(p.pdf)}">PDF</button>` : ''}
        ${p.doi ? `<button type="button" class="tools-chip-btn" data-paper-doi="${escHtml(p.doi)}">DOI</button>` : ''}
        <span class="tools-paper-src">${p.source === 's2' ? 'Semantic Scholar' : 'Crossref'}</span>
      </div>
    </article>`).join('');
  el.querySelectorAll('[data-paper-open]').forEach((btn) => {
    btn.addEventListener('click', () => openUrl(btn.dataset.paperOpen));
  });
  el.querySelectorAll('[data-paper-pdf]').forEach((btn) => {
    btn.addEventListener('click', () => openUrl(btn.dataset.paperPdf));
  });
  el.querySelectorAll('[data-paper-doi]').forEach((btn) => {
    btn.addEventListener('click', () => openUrl(`https://doi.org/${btn.dataset.paperDoi}`));
  });
}

export const STUDENT_TEMPLATES = {
  literature: `
    <div class="tools-page">
      <h3 class="tools-page-title">🔬 文献中心</h3>
      <p class="tools-page-desc">检索论文、解析 DOI/arXiv、导出引用，一站完成科研文献工作流</p>
      <div class="tools-subnav">
        <button type="button" class="tools-subnav-btn is-active" data-lit-tab="search"><span>检索</span></button>
        <button type="button" class="tools-subnav-btn" data-lit-tab="paper"><span>解析</span></button>
        <button type="button" class="tools-subnav-btn" data-lit-tab="sites"><span>站点</span></button>
      </div>
      <div class="tools-section is-active" data-lit-pane="search">
        <div class="tools-form-row">
          <input class="tools-input" data-lit-query placeholder="关键词、论文标题、作者…" />
          <button type="button" class="tools-primary-btn" data-lit-search>检索</button>
        </div>
        <div class="tools-chip-row">
          <button type="button" class="tools-chip-btn is-active" data-lit-src="both">双源</button>
          <button type="button" class="tools-chip-btn" data-lit-src="s2">Semantic Scholar</button>
          <button type="button" class="tools-chip-btn" data-lit-src="crossref">Crossref</button>
        </div>
        <p class="tools-stats-line" data-lit-status>输入关键词开始检索</p>
        <div class="tools-paper-list" data-lit-results></div>
      </div>
      <div class="tools-section" data-lit-pane="paper">
        <p class="tools-hint-line">粘贴 DOI、doi.org 链接或 arXiv ID，自动识别来源</p>
        <input class="tools-input" data-paper-input placeholder="10.xxxx/xxxxx · arxiv.org/abs/2301.00001" />
        <div class="tools-page-actions">
          <button type="button" class="tools-primary-btn" data-paper-fetch>解析</button>
          <button type="button" class="tools-chip-btn" data-paper-open>打开文献</button>
          <button type="button" class="tools-chip-btn" data-paper-pdf>PDF</button>
          <button type="button" class="tools-chip-btn" data-paper-bib>复制 BibTeX</button>
          <button type="button" class="tools-chip-btn" data-paper-gb>复制 GB/T</button>
        </div>
        <p class="tools-stats-line" data-paper-status>—</p>
        <div class="tools-paper-card tools-paper-card--detail" data-paper-card hidden>
          <h4 class="tools-paper-title" data-paper-title>—</h4>
          <p class="tools-paper-meta" data-paper-meta>—</p>
          <p class="tools-paper-abstract" data-paper-abstract></p>
        </div>
      </div>
      <div class="tools-section" data-lit-pane="sites">
        <div class="tools-site-grid tools-site-grid--4">${ACADEMIC_LINKS.map(
          (l) => `
          <button type="button" class="tools-site-btn" data-open-url="${l.url}" style="--link-accent:${l.accent}">
            <span class="tools-site-icon">${l.icon}</span>
            <span class="tools-site-name">${l.name}</span>
            <span class="tools-site-desc">${l.desc}</span>
          </button>`,
        ).join('')}</div>
        <p class="tools-hint-line">推荐：Zotero 管理 → Overleaf 写作 → 本工具检索补充</p>
      </div>
    </div>`,

  stat: `
    <div class="tools-page">
      <h3 class="tools-page-title">📈 统计助手</h3>
      <p class="tools-page-desc">实验课 / 课程论文常用：描述统计与 Pearson 相关（本地计算）</p>
      <p class="tools-section-label">样本数据（空格 / 逗号 / 换行分隔）</p>
      <textarea class="tools-textarea" data-stat-a placeholder="例如：12.3, 14.1, 11.8, 13.5, 12.9" rows="3"></textarea>
      <textarea class="tools-textarea" data-stat-b placeholder="第二组数据（相关分析，可选）" rows="3"></textarea>
      <button type="button" class="tools-primary-btn" data-stat-run>计算</button>
      <div class="tools-stats-grid tools-stats-grid--3" data-stat-out>
        <div class="tools-stat-box"><span data-st-n>—</span><label>样本量 n</label></div>
        <div class="tools-stat-box"><span data-st-mean>—</span><label>均值 x̄</label></div>
        <div class="tools-stat-box"><span data-st-std>—</span><label>标准差 s</label></div>
        <div class="tools-stat-box"><span data-st-median>—</span><label>中位数</label></div>
        <div class="tools-stat-box"><span data-st-minmax>—</span><label>最小 ~ 最大</label></div>
        <div class="tools-stat-box"><span data-st-r>—</span><label>Pearson r</label></div>
      </div>
      <p class="tools-hint-line">适用于样本量较小的描述统计；正式论文请用 SPSS / R / Python 复核。</p>
    </div>`,

  gpa: `
    <div class="tools-page">
      <h3 class="tools-page-title">📊 GPA 计算</h3>
      <p class="tools-page-desc">按学分加权，支持 4.0 制与 5.0 制，数据保存在本机</p>
      <div class="tools-inline-form">
        <label class="tools-inline-label">制式
          <select class="tools-select" data-gpa-scale>
            <option value="4">4.0 制</option>
            <option value="5">5.0 制</option>
          </select>
        </label>
        <button type="button" class="tools-chip-btn" data-gpa-add>+ 添加课程</button>
        <button type="button" class="tools-chip-btn" data-gpa-clear>清空</button>
      </div>
      <div class="tools-gpa-table" data-gpa-rows></div>
      <div class="tools-gpa-result">
        <span>加权 GPA</span>
        <strong data-gpa-val>—</strong>
        <small data-gpa-credits>0 学分</small>
      </div>
    </div>`,

  flashcard: `
    <div class="tools-page">
      <h3 class="tools-page-title">🃏 闪卡记忆</h3>
      <p class="tools-page-desc">本地闪卡 · 点击翻面 · 标记「会了 / 再背」间隔复习</p>
      <div class="tools-form-row">
        <input class="tools-input" data-fc-front placeholder="正面（问题 / 术语）" />
        <input class="tools-input" data-fc-back placeholder="背面（答案 / 解释）" />
        <button type="button" class="tools-primary-btn" data-fc-add>添加</button>
      </div>
      <div class="tools-flashcard" data-fc-card hidden>
        <button type="button" class="tools-flashcard-inner" data-fc-flip>
          <span class="tools-flashcard-front" data-fc-display-front>—</span>
          <span class="tools-flashcard-back" data-fc-display-back>—</span>
        </button>
        <div class="tools-page-actions">
          <button type="button" class="tools-chip-btn" data-fc-hard>再背</button>
          <button type="button" class="tools-primary-btn" data-fc-easy>会了</button>
        </div>
      </div>
      <p class="tools-stats-line" data-fc-status>暂无闪卡，先添加几张吧</p>
      <ul class="tools-todo-list" data-fc-list></ul>
    </div>`,

  thesis: `
    <div class="tools-page">
      <h3 class="tools-page-title">📝 写作进度</h3>
      <p class="tools-page-desc">追踪论文字数、章节进度，粘贴文本可自动统计字数与阅读时长</p>
      <div class="tools-form-stack">
        <input class="tools-input" data-th-title placeholder="论文题目（可选）" />
        <div class="tools-inline-form">
          <input class="tools-input" data-th-target type="number" placeholder="总目标字数" min="1000" step="500" />
          <input class="tools-input" data-th-current type="number" placeholder="当前总字数" min="0" step="100" />
        </div>
      </div>
      <div class="tools-thesis-bar" data-th-bar><div class="tools-thesis-bar-fill" data-th-fill></div></div>
      <p class="tools-stats-line" data-th-summary>—</p>
      <p class="tools-section-label">粘贴章节文本 · 自动统计</p>
      <textarea class="tools-textarea" data-th-paste placeholder="粘贴本章草稿，自动统计字数与预估阅读时间…" rows="4"></textarea>
      <div class="tools-stats-grid tools-stats-grid--3">
        <div class="tools-stat-box"><span data-th-chars>0</span><label>字符</label></div>
        <div class="tools-stat-box"><span data-th-cn>0</span><label>中文</label></div>
        <div class="tools-stat-box"><span data-th-read>0</span><label>阅读(分)</label></div>
      </div>
      <button type="button" class="tools-chip-btn" data-th-apply>将字数填入「当前总字数」</button>
      <p class="tools-section-label">章节进度</p>
      <div class="tools-form-row">
        <input class="tools-input" data-th-ch-name placeholder="章节名（如 绪论）" />
        <input class="tools-input tools-input--xs" data-th-ch-words type="number" placeholder="字数" min="0" />
        <button type="button" class="tools-chip-btn" data-th-ch-add>添加</button>
      </div>
      <ul class="tools-todo-list" data-th-chapters></ul>
      <button type="button" class="tools-primary-btn" data-th-save>保存进度</button>
    </div>`,

  schedule: `
    <div class="tools-page">
      <h3 class="tools-page-title">📅 日程规划</h3>
      <p class="tools-page-desc">周课表与考试倒计时，数据保存在本机</p>
      <div class="tools-subnav">
        <button type="button" class="tools-subnav-btn is-active" data-sch-tab="week"><span>周课表</span></button>
        <button type="button" class="tools-subnav-btn" data-sch-tab="exam"><span>倒计时</span></button>
      </div>
      <div class="tools-section is-active" data-sch-pane="week">
        <div class="tools-study-grid" data-sw-grid></div>
        <div class="tools-form-row">
          <select class="tools-select" data-sw-day>
            <option value="1">周一</option><option value="2">周二</option><option value="3">周三</option>
            <option value="4">周四</option><option value="5">周五</option><option value="6">周六</option><option value="0">周日</option>
          </select>
          <input class="tools-input" data-sw-time placeholder="08:00-09:40" />
          <input class="tools-input" data-sw-label placeholder="课程 / 自习内容" />
          <button type="button" class="tools-primary-btn" data-sw-add>添加</button>
        </div>
      </div>
      <div class="tools-section" data-sch-pane="exam">
        <input class="tools-input" type="date" data-cd-date />
        <input class="tools-input" data-cd-label placeholder="事件名称（如 期末考 · 高数）" />
        <button type="button" class="tools-primary-btn" data-cd-calc>计算</button>
        <p class="tools-countdown-result" data-cd-result>—</p>
        <p class="tools-hint-line">倒计时会自动保存，下次打开仍能看到</p>
      </div>
    </div>`,

  budget: `
    <div class="tools-page">
      <h3 class="tools-page-title">💰 生活费账本</h3>
      <p class="tools-page-desc">月度预算与支出记录，本地保存（不上传网络）</p>
      <div class="tools-inline-form">
        <input class="tools-input" data-bg-month type="month" />
        <input class="tools-input" data-bg-limit type="number" placeholder="月预算 ¥" min="0" step="100" />
        <button type="button" class="tools-chip-btn" data-bg-set-limit>设预算</button>
      </div>
      <div class="tools-budget-summary" data-bg-summary>—</div>
      <div class="tools-form-row">
        <input class="tools-input" data-bg-amount type="number" placeholder="金额 ¥" step="0.01" min="0" />
        <input class="tools-input" data-bg-note placeholder="备注（餐饮 / 交通…）" />
        <button type="button" class="tools-primary-btn" data-bg-add>记一笔</button>
      </div>
      <ul class="tools-todo-list" data-bg-list></ul>
    </div>`,

  currency: `
    <div class="tools-page">
      <h3 class="tools-page-title">💱 汇率换算</h3>
      <p class="tools-page-desc">Frankfurter 欧洲央行参考汇率，适合留学 / 海淘估算</p>
      <div class="tools-inline-form">
        <input class="tools-input" data-fx-amount type="number" value="100" step="any" min="0" />
        <select class="tools-select" data-fx-from>
          <option value="USD">USD 美元</option>
          <option value="EUR">EUR 欧元</option>
          <option value="GBP">GBP 英镑</option>
          <option value="JPY">JPY 日元</option>
          <option value="CNY">CNY 人民币</option>
          <option value="KRW">KRW 韩元</option>
        </select>
        <span class="tools-inline-sep">→</span>
        <select class="tools-select" data-fx-to>
          <option value="CNY" selected>CNY 人民币</option>
          <option value="USD">USD 美元</option>
          <option value="EUR">EUR 欧元</option>
          <option value="GBP">GBP 英镑</option>
          <option value="JPY">JPY 日元</option>
        </select>
        <button type="button" class="tools-primary-btn" data-fx-convert>换算</button>
      </div>
      <p class="tools-mono tools-mono--lg" data-fx-result>—</p>
      <p class="tools-stats-line" data-fx-rates>—</p>
      <button type="button" class="tools-chip-btn" data-fx-refresh>刷新汇率</button>
    </div>`,

  sleep: `
    <div class="tools-page">
      <h3 class="tools-page-title">😴 作息助手</h3>
      <p class="tools-page-desc">按 90 分钟睡眠周期推算最佳入睡 / 起床时间</p>
      <div class="tools-chip-row">
        <button type="button" class="tools-chip-btn is-active" data-slp-mode="wake">我想几点起</button>
        <button type="button" class="tools-chip-btn" data-slp-mode="sleep">我想几点睡</button>
      </div>
      <input class="tools-input" type="time" data-slp-time value="07:00" />
      <button type="button" class="tools-primary-btn" data-slp-calc>计算入睡时间</button>
      <div class="tools-sleep-list" data-slp-results></div>
      <p class="tools-hint-line">浅睡周期约 90 分钟；入睡通常需 15 分钟，结果已预留缓冲。</p>
    </div>`,
};

export const STUDENT_BINDERS = {
  literature(panel) {
    const body = panel._detailBody;
    bindSubnav(body, 'data-lit-tab', 'data-lit-pane');

    const query = body.querySelector('[data-lit-query]');
    const status = body.querySelector('[data-lit-status]');
    const results = body.querySelector('[data-lit-results]');
    let src = 'both';

    body.querySelectorAll('[data-lit-src]').forEach((btn) => {
      btn.addEventListener('click', () => {
        src = btn.dataset.litSrc;
        body.querySelectorAll('[data-lit-src]').forEach((b) => b.classList.toggle('is-active', b === btn));
      });
    });

    const search = async () => {
      const q = query?.value.trim();
      if (!q) {
        setStatus(status, '请输入检索关键词', false);
        return;
      }
      setStatus(status, '检索中…', true);
      results.innerHTML = '<p class="tools-paper-empty">加载中…</p>';
      try {
        let papers = [];
        if (src === 'both') {
          const [a, b] = await Promise.all([searchSemanticScholar(q, 6), searchCrossref(q, 6)]);
          papers = [...a, ...b];
        } else if (src === 's2') {
          papers = await searchSemanticScholar(q);
        } else {
          papers = await searchCrossref(q);
        }
        renderPaperList(results, papers);
        setStatus(status, papers.length ? `✓ 找到 ${papers.length} 条结果` : '未找到结果，试试换关键词或切换数据源', !!papers.length);
      } catch (e) {
        setStatus(status, `✗ 网络异常：${e.message}。请检查网络后重试`, false);
        results.innerHTML = '<p class="tools-paper-empty">检索失败，可切换到单一数据源再试</p>';
      }
    };

    body.querySelector('[data-lit-search]')?.addEventListener('click', search);
    query?.addEventListener('keydown', (e) => { if (e.key === 'Enter') search(); });

    body.querySelectorAll('[data-open-url]').forEach((btn) => {
      btn.addEventListener('click', () => openUrl(btn.dataset.openUrl));
    });

    const paperInput = body.querySelector('[data-paper-input]');
    const paperStatus = body.querySelector('[data-paper-status]');
    const paperCard = body.querySelector('[data-paper-card]');
    let lastPaper = null;

    const showPaper = (title, meta, abstract) => {
      body.querySelector('[data-paper-title]').textContent = title || '—';
      body.querySelector('[data-paper-meta]').textContent = meta || '—';
      const absEl = body.querySelector('[data-paper-abstract]');
      absEl.textContent = abstract || '（暂无摘要）';
      absEl.hidden = !abstract;
      paperCard.hidden = false;
    };

    const fetchPaper = async () => {
      const detected = detectPaperId(paperInput?.value);
      if (!detected) {
        setStatus(paperStatus, '请输入有效的 DOI 或 arXiv ID', false);
        return;
      }
      setStatus(paperStatus, '查询中…', true);
      try {
        if (detected.type === 'arxiv') {
          lastPaper = await fetchArxivMeta(detected.id);
          lastPaper.kind = 'arxiv';
          showPaper(
            lastPaper.title,
            `${lastPaper.authors.join(', ')} · ${lastPaper.published} · arXiv:${lastPaper.id}`,
            lastPaper.summary,
          );
        } else {
          const work = await fetchCrossrefDoi(detected.id);
          const msg = work.message;
          lastPaper = {
            kind: 'doi',
            work,
            bib: crossrefToBibtex(work),
            url: `https://doi.org/${msg.DOI}`,
            pdf: null,
          };
          const abs = msg.abstract?.replace(/<[^>]+>/g, '') || '';
          showPaper(
            msg.title?.[0] || '—',
            [authorsToDisplay(msg.author), msg.published?.['date-parts']?.[0]?.[0], msg['container-title']?.[0], msg.DOI ? `DOI: ${msg.DOI}` : ''].filter(Boolean).join(' · '),
            abs,
          );
        }
        setStatus(paperStatus, '✓ 解析成功', true);
      } catch (e) {
        setStatus(paperStatus, `✗ ${e.message}`, false);
        paperCard.hidden = true;
        lastPaper = null;
      }
    };

    body.querySelector('[data-paper-fetch]')?.addEventListener('click', fetchPaper);
    paperInput?.addEventListener('keydown', (e) => { if (e.key === 'Enter') fetchPaper(); });
    body.querySelector('[data-paper-open]')?.addEventListener('click', () => {
      if (lastPaper?.kind === 'arxiv') openUrl(lastPaper.arxivUrl);
      else if (lastPaper?.url) openUrl(lastPaper.url);
    });
    body.querySelector('[data-paper-pdf]')?.addEventListener('click', () => {
      if (lastPaper?.kind === 'arxiv' && lastPaper.pdf) openUrl(lastPaper.pdf);
      else setStatus(paperStatus, '仅 arXiv 预印本支持直接打开 PDF', false);
    });
    body.querySelector('[data-paper-bib]')?.addEventListener('click', async () => {
      const bib = lastPaper?.kind === 'arxiv' ? lastPaper.bib : lastPaper?.bib || (lastPaper?.work ? crossrefToBibtex(lastPaper.work) : '');
      if (bib) {
        await copyText(bib);
        setStatus(paperStatus, '✓ BibTeX 已复制', true);
      }
    });
    body.querySelector('[data-paper-gb]')?.addEventListener('click', async () => {
      if (lastPaper?.work) {
        await copyText(crossrefToGbCite(lastPaper.work));
        setStatus(paperStatus, '✓ GB/T 7714 已复制', true);
      } else {
        setStatus(paperStatus, 'GB/T 格式需 DOI 来源（Crossref）', false);
      }
    });
  },

  stat(panel) {
    const body = panel._detailBody;
    body.querySelector('[data-stat-run]')?.addEventListener('click', () => {
      try {
        const a = parseNumberList(body.querySelector('[data-stat-a]')?.value);
        const b = parseNumberList(body.querySelector('[data-stat-b]')?.value);
        const s = descriptiveStats(a);
        body.querySelector('[data-st-n]').textContent = s.n;
        body.querySelector('[data-st-mean]').textContent = s.mean.toFixed(4);
        body.querySelector('[data-st-std]').textContent = s.std.toFixed(4);
        body.querySelector('[data-st-median]').textContent = s.median.toFixed(4);
        body.querySelector('[data-st-minmax]').textContent = `${s.min.toFixed(2)} ~ ${s.max.toFixed(2)}`;
        body.querySelector('[data-st-r]').textContent = b.length >= 2 ? pearsonCorrelation(a, b).toFixed(4) : '—';
      } catch (e) {
        body.querySelector('[data-st-mean]').textContent = '✗';
        body.querySelector('[data-st-r]').textContent = e.message;
      }
    });
  },

  gpa(panel) {
    const body = panel._detailBody;
    const KEY = 'aqun-gpa-courses';
    const rowsEl = body.querySelector('[data-gpa-rows]');
    const scaleEl = body.querySelector('[data-gpa-scale]');
    let courses = loadJson(KEY, [{ name: '示例课程', credit: 3, score: 85 }]);

    const gradeToPoint = (score, scale) => {
      const s = Number(score);
      if (scale === '5') {
        if (s >= 90) return 4.5;
        if (s >= 85) return 4.0;
        if (s >= 82) return 3.7;
        if (s >= 78) return 3.3;
        if (s >= 75) return 3.0;
        if (s >= 72) return 2.7;
        if (s >= 68) return 2.3;
        if (s >= 64) return 2.0;
        if (s >= 60) return 1.0;
        return 0;
      }
      if (s >= 90) return 4.0;
      if (s >= 85) return 3.7;
      if (s >= 82) return 3.3;
      if (s >= 78) return 3.0;
      if (s >= 75) return 2.7;
      if (s >= 72) return 2.3;
      if (s >= 68) return 2.0;
      if (s >= 64) return 1.5;
      if (s >= 60) return 1.0;
      return 0;
    };

    const calc = () => {
      const scale = scaleEl?.value || '4';
      let pts = 0;
      let credits = 0;
      for (const c of courses) {
        const cr = Number(c.credit) || 0;
        pts += gradeToPoint(c.score, scale) * cr;
        credits += cr;
      }
      body.querySelector('[data-gpa-val]').textContent = credits ? (pts / credits).toFixed(2) : '—';
      body.querySelector('[data-gpa-credits]').textContent = `${credits} 学分`;
    };

    const render = () => {
      rowsEl.innerHTML = courses.map((c, i) => `
        <div class="tools-gpa-row">
          <input class="tools-input" data-gpa-name="${i}" value="${escHtml(c.name)}" placeholder="课程名" />
          <input class="tools-input tools-input--xs" data-gpa-credit="${i}" type="number" value="${c.credit}" min="0.5" step="0.5" title="学分" />
          <input class="tools-input tools-input--xs" data-gpa-score="${i}" type="number" value="${c.score}" min="0" max="100" title="分数" />
          <button type="button" class="tools-chip-btn" data-gpa-del="${i}">×</button>
        </div>`).join('');

      rowsEl.querySelectorAll('[data-gpa-name]').forEach((el) => {
        el.addEventListener('input', () => { courses[+el.dataset.gpaName].name = el.value; saveJson(KEY, courses); });
      });
      rowsEl.querySelectorAll('[data-gpa-credit]').forEach((el) => {
        el.addEventListener('input', () => { courses[+el.dataset.gpaCredit].credit = +el.value; calc(); saveJson(KEY, courses); });
      });
      rowsEl.querySelectorAll('[data-gpa-score]').forEach((el) => {
        el.addEventListener('input', () => { courses[+el.dataset.gpaScore].score = +el.value; calc(); saveJson(KEY, courses); });
      });
      rowsEl.querySelectorAll('[data-gpa-del]').forEach((btn) => {
        btn.addEventListener('click', () => {
          courses.splice(+btn.dataset.gpaDel, 1);
          render();
          saveJson(KEY, courses);
        });
      });
      calc();
    };

    body.querySelector('[data-gpa-add]')?.addEventListener('click', () => {
      courses.push({ name: '', credit: 2, score: 80 });
      render();
      saveJson(KEY, courses);
    });
    body.querySelector('[data-gpa-clear]')?.addEventListener('click', () => {
      courses = [];
      render();
      saveJson(KEY, courses);
    });
    scaleEl?.addEventListener('change', calc);
    render();
  },

  flashcard(panel) {
    const body = panel._detailBody;
    const KEY = 'aqun-flashcards';
    let deck = loadJson(KEY, []);
    let queue = [];
    let idx = 0;

    const listEl = body.querySelector('[data-fc-list]');
    const cardEl = body.querySelector('[data-fc-card]');
    const status = body.querySelector('[data-fc-status]');

    const rebuildQueue = () => {
      queue = deck.filter((c) => c.due <= Date.now()).sort((a, b) => a.due - b.due);
      if (!queue.length) queue = [...deck];
      idx = 0;
      showCard();
    };

    const showCard = () => {
      if (!deck.length) {
        cardEl.hidden = true;
        setStatus(status, '暂无闪卡，先添加几张吧', true);
        return;
      }
      const c = queue[idx];
      if (!c) {
        cardEl.hidden = true;
        setStatus(status, '本轮复习完成 🎉', true);
        return;
      }
      cardEl.hidden = false;
      body.querySelector('[data-fc-display-front]').textContent = c.front;
      body.querySelector('[data-fc-display-back]').textContent = c.back;
      body.querySelector('[data-fc-flip]').classList.remove('is-flipped');
      setStatus(status, `待复习 ${queue.length} 张 · 共 ${deck.length} 张`, true);
    };

    const renderList = () => {
      listEl.innerHTML = deck.map((c, i) => `
        <li class="tools-todo-item">
          <span>${escHtml(c.front)} → ${escHtml(c.back)}</span>
          <button type="button" class="tools-chip-btn" data-fc-rm="${i}">删</button>
        </li>`).join('');
      listEl.querySelectorAll('[data-fc-rm]').forEach((btn) => {
        btn.addEventListener('click', () => {
          deck.splice(+btn.dataset.fcRm, 1);
          saveJson(KEY, deck);
          rebuildQueue();
          renderList();
        });
      });
    };

    body.querySelector('[data-fc-add]')?.addEventListener('click', () => {
      const front = body.querySelector('[data-fc-front]')?.value.trim();
      const back = body.querySelector('[data-fc-back]')?.value.trim();
      if (!front || !back) return;
      deck.push({ front, back, due: Date.now(), ease: 1 });
      saveJson(KEY, deck);
      body.querySelector('[data-fc-front]').value = '';
      body.querySelector('[data-fc-back]').value = '';
      rebuildQueue();
      renderList();
    });

    body.querySelector('[data-fc-flip]')?.addEventListener('click', () => {
      body.querySelector('[data-fc-flip]').classList.toggle('is-flipped');
    });

    const advance = (days) => {
      const c = queue[idx];
      if (!c) return;
      c.due = Date.now() + days * 86400000;
      c.ease = Math.min(30, (c.ease || 1) * (days > 1 ? 1.5 : 1));
      saveJson(KEY, deck);
      idx += 1;
      showCard();
    };

    body.querySelector('[data-fc-easy]')?.addEventListener('click', () => advance(queue[idx]?.ease || 3));
    body.querySelector('[data-fc-hard]')?.addEventListener('click', () => advance(0.5));

    renderList();
    rebuildQueue();
  },

  thesis(panel) {
    const body = panel._detailBody;
    const KEY = 'aqun-thesis-progress';
    const data = loadJson(KEY, { title: '', target: 20000, current: 0, chapters: [] });

    body.querySelector('[data-th-title]').value = data.title || '';
    body.querySelector('[data-th-target]').value = data.target || '';
    body.querySelector('[data-th-current]').value = data.current || '';

    const updatePasteStats = () => {
      const text = body.querySelector('[data-th-paste]')?.value || '';
      const cn = (text.match(/[\u4e00-\u9fff]/g) || []).length;
      const en = (text.match(/[a-zA-Z]+/g) || []).length;
      body.querySelector('[data-th-chars]').textContent = text.length;
      body.querySelector('[data-th-cn]').textContent = cn;
      body.querySelector('[data-th-read]').textContent = text.trim() ? Math.max(1, Math.ceil(cn / 400 + en / 200)) : 0;
    };

    body.querySelector('[data-th-paste]')?.addEventListener('input', updatePasteStats);

    const refresh = () => {
      const target = +body.querySelector('[data-th-target]').value || 0;
      const current = +body.querySelector('[data-th-current]').value || 0;
      const pct = target ? Math.min(100, Math.round((current / target) * 100)) : 0;
      body.querySelector('[data-th-fill]').style.width = `${pct}%`;
      body.querySelector('[data-th-summary]').textContent = target
        ? `已完成 ${pct}%（${current.toLocaleString()} / ${target.toLocaleString()} 字）${current >= target ? ' · 达标 🎉' : ` · 还差 ${(target - current).toLocaleString()} 字`}`
        : '请设置目标字数';
      const chEl = body.querySelector('[data-th-chapters]');
      chEl.innerHTML = data.chapters.map((c, i) => `
        <li class="tools-todo-item"><span>${escHtml(c.name)} · ${c.words} 字</span>
        <button type="button" class="tools-chip-btn" data-th-rm="${i}">删</button></li>`).join('');
      chEl.querySelectorAll('[data-th-rm]').forEach((btn) => {
        btn.addEventListener('click', () => {
          data.chapters.splice(+btn.dataset.thRm, 1);
          saveJson(KEY, data);
          refresh();
        });
      });
    };

    body.querySelector('[data-th-ch-add]')?.addEventListener('click', () => {
      const name = body.querySelector('[data-th-ch-name]')?.value.trim();
      const words = +body.querySelector('[data-th-ch-words]')?.value || 0;
      if (!name) return;
      data.chapters.push({ name, words });
      saveJson(KEY, data);
      body.querySelector('[data-th-ch-name]').value = '';
      body.querySelector('[data-th-ch-words]').value = '';
      refresh();
    });

    body.querySelector('[data-th-save]')?.addEventListener('click', () => {
      data.title = body.querySelector('[data-th-title]')?.value.trim();
      data.target = +body.querySelector('[data-th-target]')?.value || 0;
      data.current = +body.querySelector('[data-th-current]')?.value || 0;
      saveJson(KEY, data);
      refresh();
    });

    body.querySelector('[data-th-target]')?.addEventListener('input', refresh);
    body.querySelector('[data-th-current]')?.addEventListener('input', refresh);
    body.querySelector('[data-th-apply]')?.addEventListener('click', () => {
      const text = body.querySelector('[data-th-paste]')?.value || '';
      const cn = (text.match(/[\u4e00-\u9fff]/g) || []).length;
      const en = (text.match(/[a-zA-Z]+/g) || []).length;
      const words = cn + en;
      if (words) {
        body.querySelector('[data-th-current]').value = words;
        refresh();
      }
    });
    refresh();
  },

  schedule(panel) {
    const body = panel._detailBody;
    bindSubnav(body, 'data-sch-tab', 'data-sch-pane');

    const WEEK_KEY = 'aqun-study-week';
    const CD_KEY = 'aqun-countdown';
    const DAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    let plan = loadJson(WEEK_KEY, {});

    const renderWeek = () => {
      const grid = body.querySelector('[data-sw-grid]');
      grid.innerHTML = [1, 2, 3, 4, 5, 6, 0].map((d) => {
        const items = plan[d] || [];
        return `<div class="tools-study-day"><h4>${DAYS[d]}</h4><ul>${items.map((it, i) =>
          `<li><span>${escHtml(it.time)} ${escHtml(it.label)}</span><button type="button" data-sw-del="${d}-${i}">×</button></li>`).join('') || '<li class="tools-study-empty">—</li>'}</ul></div>`;
      }).join('');
      grid.querySelectorAll('[data-sw-del]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const [day, i] = btn.dataset.swDel.split('-').map(Number);
          plan[day].splice(i, 1);
          saveJson(WEEK_KEY, plan);
          renderWeek();
        });
      });
    };

    body.querySelector('[data-sw-add]')?.addEventListener('click', () => {
      const day = +body.querySelector('[data-sw-day]')?.value;
      const time = body.querySelector('[data-sw-time]')?.value.trim();
      const label = body.querySelector('[data-sw-label]')?.value.trim();
      if (!time || !label) return;
      if (!plan[day]) plan[day] = [];
      plan[day].push({ time, label });
      saveJson(WEEK_KEY, plan);
      body.querySelector('[data-sw-label]').value = '';
      renderWeek();
    });
    renderWeek();

    const cdDate = body.querySelector('[data-cd-date]');
    const cdLabel = body.querySelector('[data-cd-label]');
    const cdResult = body.querySelector('[data-cd-result]');
    const saved = loadJson(CD_KEY, {});

    if (saved.date && cdDate) cdDate.value = saved.date;
    if (saved.label && cdLabel) cdLabel.value = saved.label;
    if (saved.date) calcCountdown();

    function calcCountdown() {
      const raw = cdDate?.value;
      const label = cdLabel?.value.trim();
      if (!raw) {
        cdResult.textContent = '请选择日期';
        return;
      }
      saveJson(CD_KEY, { date: raw, label: label || '' });
      const target = new Date(raw);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      target.setHours(0, 0, 0, 0);
      const diff = Math.round((target - today) / 86400000);
      const name = label || '目标日';
      if (diff > 0) cdResult.textContent = `距离「${name}」还有 ${diff} 天 — 加油！`;
      else if (diff === 0) cdResult.textContent = `今天就是「${name}」！`;
      else cdResult.textContent = `「${name}」已过去 ${Math.abs(diff)} 天`;
    }

    body.querySelector('[data-cd-calc]')?.addEventListener('click', calcCountdown);
    cdDate?.addEventListener('change', calcCountdown);
  },

  budget(panel) {
    const body = panel._detailBody;
    const monthEl = body.querySelector('[data-bg-month]');
    const now = new Date();
    monthEl.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const key = () => `aqun-budget-${monthEl.value}`;

    const refresh = () => {
      const data = loadJson(key(), { limit: 2000, items: [] });
      body.querySelector('[data-bg-limit]').value = data.limit || '';
      const spent = data.items.reduce((s, it) => s + it.amount, 0);
      const left = (data.limit || 0) - spent;
      body.querySelector('[data-bg-summary]').innerHTML = `
        <span>预算 ¥${(data.limit || 0).toFixed(0)}</span>
        <span>已花 ¥${spent.toFixed(2)}</span>
        <span class="${left >= 0 ? 'is-ok' : 'is-warn'}">剩余 ¥${left.toFixed(2)}</span>`;
      const list = body.querySelector('[data-bg-list]');
      list.innerHTML = data.items.slice().reverse().map((it, i) => `
        <li class="tools-todo-item"><span>¥${it.amount.toFixed(2)} · ${escHtml(it.note)}</span>
        <button type="button" class="tools-chip-btn" data-bg-del="${data.items.length - 1 - i}">删</button></li>`).join('') || '<li class="tools-todo-item"><span>暂无记录</span></li>';
      list.querySelectorAll('[data-bg-del]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const d = loadJson(key(), { limit: 2000, items: [] });
          d.items.splice(+btn.dataset.bgDel, 1);
          saveJson(key(), d);
          refresh();
        });
      });
    };

    body.querySelector('[data-bg-set-limit]')?.addEventListener('click', () => {
      const data = loadJson(key(), { limit: 0, items: [] });
      data.limit = +body.querySelector('[data-bg-limit]')?.value || 0;
      saveJson(key(), data);
      refresh();
    });

    body.querySelector('[data-bg-add]')?.addEventListener('click', () => {
      const amount = +body.querySelector('[data-bg-amount]')?.value;
      const note = body.querySelector('[data-bg-note]')?.value.trim() || '支出';
      if (!Number.isFinite(amount) || amount <= 0) return;
      const data = loadJson(key(), { limit: 0, items: [] });
      data.items.push({ amount, note, at: Date.now() });
      saveJson(key(), data);
      body.querySelector('[data-bg-amount]').value = '';
      refresh();
    });

    monthEl?.addEventListener('change', refresh);
    refresh();
  },

  currency(panel) {
    const body = panel._detailBody;
    const result = body.querySelector('[data-fx-result]');
    const ratesEl = body.querySelector('[data-fx-rates]');
    let cache = null;

    const convert = async () => {
      const amount = +body.querySelector('[data-fx-amount]')?.value || 0;
      const from = body.querySelector('[data-fx-from]')?.value || 'USD';
      const to = body.querySelector('[data-fx-to]')?.value || 'CNY';
      try {
        if (!cache || cache.base !== from) {
          ratesEl.textContent = '获取汇率中…';
          cache = await fetchExchangeRates(from, 'CNY,USD,EUR,GBP,JPY,KRW');
        }
        const rate = from === to ? 1 : (cache.rates?.[to] ?? null);
        if (rate == null && from !== to) {
          const rev = await fetchExchangeRates(to, from);
          const r = rev.rates?.[from];
          if (!r) throw new Error('不支持该货币对');
          result.textContent = `${amount} ${from} ≈ ${(amount / r).toFixed(2)} ${to}`;
        } else {
          result.textContent = `${amount} ${from} ≈ ${(amount * rate).toFixed(2)} ${to}`;
        }
        ratesEl.textContent = `参考日期 ${cache.date} · 1 ${from} = ${rate ?? '—'} ${to}`;
      } catch (e) {
        result.textContent = '—';
        ratesEl.textContent = `✗ ${e.message}`;
      }
    };

    body.querySelector('[data-fx-convert]')?.addEventListener('click', convert);
    body.querySelector('[data-fx-refresh]')?.addEventListener('click', () => { cache = null; convert(); });
    convert();
  },

  sleep(panel) {
    const body = panel._detailBody;
    let mode = 'wake';
    const calcBtn = body.querySelector('[data-slp-calc]');

    body.querySelectorAll('[data-slp-mode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        mode = btn.dataset.slpMode;
        body.querySelectorAll('[data-slp-mode]').forEach((b) => b.classList.toggle('is-active', b === btn));
        calcBtn.textContent = mode === 'wake' ? '计算入睡时间' : '计算起床时间';
      });
    });

    calcBtn?.addEventListener('click', () => {
      const [hh, mm] = (body.querySelector('[data-slp-time]')?.value || '07:00').split(':').map(Number);
      const base = new Date();
      base.setHours(hh, mm, 0, 0);
      const cycles = [6, 5.5, 5, 4.5, 4, 3.5];
      const list = body.querySelector('[data-slp-results]');
      const fmt = (d) => d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
      list.innerHTML = cycles.map((c) => {
        const ms = c * 90 * 60000 + 15 * 60000;
        const t = new Date(mode === 'wake' ? base.getTime() - ms : base.getTime() + ms);
        const label = mode === 'wake' ? `睡 ${c} 周期 · ${fmt(t)} 入睡` : `睡 ${c} 周期 · ${fmt(t)} 起床`;
        return `<div class="tools-sleep-item${c >= 5 ? ' is-best' : ''}">${label}</div>`;
      }).join('');
    });
  },
};
