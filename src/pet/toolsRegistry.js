/** 小工具与常用站点 — 元数据导出 */
export { TOOL_APPS } from './tools/toolDefinitions.js';

export const SITE_GROUPS = [
  {
    id: 'study',
    label: '学习科研',
    links: [
      { id: 'scholar', name: 'Google Scholar', desc: '学术检索', url: 'https://scholar.google.com/', accent: '#4285f4', icon: '🎓' },
      { id: 'semantic', name: 'Semantic Scholar', desc: 'AI 文献', url: 'https://www.semanticscholar.org/', accent: '#1857b6', icon: '🔬' },
      { id: 'arxiv', name: 'arXiv', desc: '预印本', url: 'https://arxiv.org/', accent: '#b31b1b', icon: '📚' },
      { id: 'pubmed', name: 'PubMed', desc: '生物医学', url: 'https://pubmed.ncbi.nlm.nih.gov/', accent: '#326599', icon: '🧬' },
      { id: 'cnki', name: '中国知网', desc: '中文文献', url: 'https://www.cnki.net/', accent: '#0066cc', icon: '📖' },
      { id: 'overleaf', name: 'Overleaf', desc: 'LaTeX 协作', url: 'https://www.overleaf.com/', accent: '#47a141', icon: '✍️' },
      { id: 'zotero', name: 'Zotero', desc: '文献管理', url: 'https://www.zotero.org/', accent: '#cc2936', icon: '📁' },
    ],
  },
  {
    id: 'life',
    label: '日常生活',
    links: [
      { id: 'bilibili', name: '哔哩哔哩', desc: '视频 · 学习娱乐', url: 'https://www.bilibili.com/', accent: '#fb7299', icon: '📺' },
      { id: 'douban', name: '豆瓣', desc: '书影音 · 评分', url: 'https://www.douban.com/', accent: '#007722', icon: '🎬' },
      { id: 'meituan', name: '美团', desc: '外卖 · 团购', url: 'https://www.meituan.com/', accent: '#ffc300', icon: '🍜' },
      { id: '12306', name: '12306', desc: '火车票', url: 'https://www.12306.cn/', accent: '#0066cc', icon: '🚄' },
      { id: 'dianping', name: '大众点评', desc: '探店 · 评价', url: 'https://www.dianping.com/', accent: '#ff6633', icon: '🍽' },
      { id: 'xhs', name: '小红书', desc: '生活灵感', url: 'https://www.xiaohongshu.com/', accent: '#ff2442', icon: '📕' },
    ],
  },
  {
    id: 'tools',
    label: '实用工具',
    links: [
      { id: 'github', name: 'GitHub', desc: '代码托管', url: 'https://github.com/', accent: '#24292f', icon: '💻' },
      { id: 'notion', name: 'Notion', desc: '笔记知识库', url: 'https://www.notion.so/', accent: '#37352f', icon: '📓' },
      { id: 'deepl', name: 'DeepL', desc: '翻译', url: 'https://www.deepl.com/translator', accent: '#0f2b46', icon: '🌐' },
      { id: 'youdao', name: '有道词典', desc: '查词翻译', url: 'https://www.youdao.com/', accent: '#e62828', icon: '📘' },
      { id: 'processon', name: 'ProcessOn', desc: '思维导图', url: 'https://www.processon.com/', accent: '#067bef', icon: '🗺' },
      { id: 'figma', name: 'Figma', desc: '设计协作', url: 'https://www.figma.com/', accent: '#a259ff', icon: '🎨' },
      { id: 'crossref', name: 'Crossref', desc: 'DOI 查询', url: 'https://search.crossref.org/', accent: '#f68212', icon: '🔍' },
      { id: 'connected', name: 'Connected Papers', desc: '文献图谱', url: 'https://www.connectedpapers.com/', accent: '#6c5ce7', icon: '🕸️' },
    ],
  },
];

/** @deprecated 兼容旧引用 */
export const RESEARCH_LINKS = SITE_GROUPS.flatMap((g) => g.links);

export const REPEAT_LABELS = {
  none: '不重复',
  daily: '每天',
  weekly: '每周',
  yearly: '每年',
};

export const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

export const MONTHS = [
  '一月', '二月', '三月', '四月', '五月', '六月',
  '七月', '八月', '九月', '十月', '十一月', '十二月',
];
