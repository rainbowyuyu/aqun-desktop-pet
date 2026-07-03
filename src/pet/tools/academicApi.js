/** 学术开放 API — Crossref · Semantic Scholar · arXiv · Frankfurter */

const MAILTO = 'aqun-desktop-pet@local';
const CROSSREF = 'https://api.crossref.org';
const S2 = 'https://api.semanticscholar.org/graph/v1';

export function normalizeDoi(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  return s
    .replace(/^https?:\/\/(dx\.)?doi\.org\//i, '')
    .replace(/^doi:\s*/i, '')
    .trim();
}

export function normalizeArxivId(raw) {
  const s = String(raw || '').trim();
  const m = s.match(/(?:arxiv\.org\/abs\/)?(\d{4}\.\d{4,5}(?:v\d+)?|\d+\.\d+(?:v\d+)?)/i);
  return m ? m[1].replace(/v\d+$/i, '') : s.replace(/^arxiv:/i, '').trim();
}

function escBib(s) {
  return String(s ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/[{}]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function bibKeyFromTitle(title, year) {
  const slug = escBib(title)
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 24)
    .toLowerCase();
  return `${slug || 'paper'}${year || ''}`;
}

export function authorsToString(authors, style = 'bibtex') {
  if (!authors?.length) return '';
  if (typeof authors[0] === 'string') {
    return authors.join(style === 'apa' ? ', ' : ' and ');
  }
  const parts = authors.map((a) => {
    if (a.name) return a.name;
    const family = a.family || a.last || '';
    const given = a.given || a.first || '';
    if (style === 'bibtex') return `${family}, ${given}`.trim().replace(/,\s*$/, '');
    return `${given} ${family}`.trim();
  });
  return parts.filter(Boolean).join(style === 'bibtex' ? ' and ' : ', ');
}

export function crossrefToBibtex(work) {
  const msg = work?.message ?? work;
  if (!msg?.DOI) throw new Error('无有效 Crossref 记录');
  const title = escBib(msg.title?.[0] || 'Untitled');
  const year = (msg.published?.['date-parts']?.[0]?.[0]
    || msg.created?.['date-parts']?.[0]?.[0]
    || msg.issued?.['date-parts']?.[0]?.[0]
    || '').toString();
  const journal = escBib(msg['container-title']?.[0] || msg.publisher || '');
  const authors = authorsToString(msg.author || [], 'bibtex');
  const vol = msg.volume || '';
  const num = msg.issue || '';
  const pages = msg.page || '';
  const key = bibKeyFromTitle(title, year);
  const type = msg.type === 'proceedings-article' ? 'inproceedings' : 'article';
  let bib = `@${type}{${key},\n  title = {${title}},\n`;
  if (authors) bib += `  author = {${authors}},\n`;
  if (year) bib += `  year = {${year}},\n`;
  if (journal) bib += `  journal = {${journal}},\n`;
  if (vol) bib += `  volume = {${vol}},\n`;
  if (num) bib += `  number = {${num}},\n`;
  if (pages) bib += `  pages = {${pages}},\n`;
  bib += `  doi = {${msg.DOI}}\n}`;
  return bib;
}

export function crossrefToGbCite(work) {
  const msg = work?.message ?? work;
  const authors = (msg.author || [])
    .map((a) => `${a.family || ''}${a.given ? ` ${a.given.charAt(0).toUpperCase()}.` : ''}`.trim())
    .filter(Boolean)
    .join(', ');
  const year = msg.published?.['date-parts']?.[0]?.[0] || msg.created?.['date-parts']?.[0]?.[0] || '';
  const title = escBib(msg.title?.[0] || '');
  const journal = escBib(msg['container-title']?.[0] || msg.publisher || '');
  const vol = msg.volume ? `${msg.volume}` : '';
  const issue = msg.issue ? `(${msg.issue})` : '';
  const pages = msg.page ? `:${msg.page}` : '';
  return `${authors}. ${title}[J]. ${journal}, ${year}${vol}${issue}${pages}. DOI:${msg.DOI}.`.replace(/\s+/g, ' ').trim();
}

export async function fetchCrossrefDoi(doi) {
  const id = normalizeDoi(doi);
  if (!id) throw new Error('请输入 DOI');
  const url = `${CROSSREF}/works/${encodeURIComponent(id)}?mailto=${encodeURIComponent(MAILTO)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(res.status === 404 ? '未找到该 DOI' : `Crossref 请求失败 (${res.status})`);
  return res.json();
}

export async function searchCrossref(query, rows = 8) {
  const q = String(query || '').trim();
  if (!q) return [];
  const url = new URL(`${CROSSREF}/works`);
  url.searchParams.set('query', q);
  url.searchParams.set('rows', String(rows));
  url.searchParams.set('mailto', MAILTO);
  url.searchParams.set('select', 'DOI,title,author,published,container-title,is-referenced-by-count');
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Crossref 搜索失败 (${res.status})`);
  const data = await res.json();
  return (data?.message?.items || []).map((item) => ({
    source: 'crossref',
    doi: item.DOI,
    title: item.title?.[0] || '—',
    authors: authorsToString(item.author || [], 'apa'),
    year: item.published?.['date-parts']?.[0]?.[0] || '',
    venue: item['container-title']?.[0] || '',
    citations: item['is-referenced-by-count'] ?? null,
    url: item.DOI ? `https://doi.org/${item.DOI}` : '',
  }));
}

export async function searchSemanticScholar(query, limit = 8) {
  const q = String(query || '').trim();
  if (!q) return [];
  const url = new URL(`${S2}/paper/search`);
  url.searchParams.set('query', q);
  url.searchParams.set('limit', String(limit));
  url.searchParams.set(
    'fields',
    'paperId,title,authors,year,citationCount,abstract,externalIds,url,openAccessPdf,journal',
  );
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Semantic Scholar 搜索失败 (${res.status})`);
  const data = await res.json();
  return (data?.data || []).map((p) => ({
    source: 's2',
    paperId: p.paperId,
    doi: p.externalIds?.DOI || '',
    title: p.title || '—',
    authors: (p.authors || []).map((a) => a.name).join(', '),
    year: p.year || '',
    venue: p.journal?.name || '',
    citations: p.citationCount ?? null,
    abstract: p.abstract || '',
    url: p.url || (p.externalIds?.DOI ? `https://doi.org/${p.externalIds.DOI}` : ''),
    pdf: p.openAccessPdf?.url || '',
  }));
}

export async function fetchArxivMeta(arxivId) {
  const id = normalizeArxivId(arxivId);
  if (!id) throw new Error('请输入 arXiv ID');
  const url = `https://export.arxiv.org/api/query?id_list=${encodeURIComponent(id)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`arXiv 请求失败 (${res.status})`);
  const text = await res.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, 'application/xml');
  const entry = doc.querySelector('entry');
  if (!entry) throw new Error('未找到该 arXiv 文献');
  const title = entry.querySelector('title')?.textContent?.replace(/\s+/g, ' ').trim() || '';
  const summary = entry.querySelector('summary')?.textContent?.replace(/\s+/g, ' ').trim() || '';
  const published = entry.querySelector('published')?.textContent?.slice(0, 10) || '';
  const authors = [...entry.querySelectorAll('author name')].map((n) => n.textContent.trim());
  const arxivUrl = entry.querySelector('id')?.textContent?.trim() || `https://arxiv.org/abs/${id}`;
  const pdf = `https://arxiv.org/pdf/${id}.pdf`;
  const year = published.slice(0, 4);
  const key = bibKeyFromTitle(title, year);
  const bib = `@article{${key},\n  title = {${escBib(title)}},\n  author = {${authorsToString(authors, 'bibtex')}},\n  year = {${year}},\n  eprint = {${id}},\n  archivePrefix = {arXiv},\n  primaryClass = {cs},\n  url = {${arxivUrl}}\n}`;
  return { id, title, summary, published, authors, arxivUrl, pdf, bib, year };
}

export async function fetchExchangeRates(base = 'USD', symbols = 'CNY,EUR,JPY,GBP,KRW') {
  const url = `https://api.frankfurter.app/latest?from=${encodeURIComponent(base)}&to=${symbols}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`汇率 API 失败 (${res.status})`);
  const data = await res.json();
  return data;
}

/** 描述统计 + Pearson 相关 */
export function descriptiveStats(nums) {
  const arr = nums.filter((n) => Number.isFinite(n));
  if (!arr.length) throw new Error('请输入有效数字');
  const n = arr.length;
  const mean = arr.reduce((a, b) => a + b, 0) / n;
  const sorted = [...arr].sort((a, b) => a - b);
  const median = n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
  const variance = arr.reduce((s, x) => s + (x - mean) ** 2, 0) / (n > 1 ? n - 1 : 1);
  const std = Math.sqrt(variance);
  const min = sorted[0];
  const max = sorted[n - 1];
  const sum = arr.reduce((a, b) => a + b, 0);
  return { n, sum, mean, median, std, min, max, variance };
}

export function pearsonCorrelation(xs, ys) {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) throw new Error('至少 2 对数据');
  const mx = xs.slice(0, n).reduce((a, b) => a + b, 0) / n;
  const my = ys.slice(0, n).reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i += 1) {
    const vx = xs[i] - mx;
    const vy = ys[i] - my;
    num += vx * vy;
    dx += vx * vx;
    dy += vy * vy;
  }
  const r = num / Math.sqrt(dx * dy);
  return Number.isFinite(r) ? r : 0;
}

export function parseNumberList(text) {
  return String(text || '')
    .split(/[\s,，;；\n]+/)
    .map((s) => parseFloat(s.trim()))
    .filter((n) => Number.isFinite(n));
}
