/** 小工具通用辅助 */
export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(String(text ?? ''));
    return true;
  } catch {
    return false;
  }
}

export async function copyHtml(html, plain = '') {
  try {
    const item = new ClipboardItem({
      'text/html': new Blob([html], { type: 'text/html' }),
      'text/plain': new Blob([plain || html.replace(/<[^>]+>/g, '')], { type: 'text/plain' }),
    });
    await navigator.clipboard.write([item]);
    return true;
  } catch {
    return copyText(plain || html);
  }
}

export function openUrl(url) {
  window.aqunPet?.openExternal?.(url);
}

export function searchUrl(engine, query) {
  const q = encodeURIComponent(String(query || '').trim());
  if (!q) return '';
  const urls = {
    google: `https://www.google.com/search?q=${q}`,
    scholar: `https://scholar.google.com/scholar?q=${q}`,
    bing: `https://www.bing.com/search?q=${q}`,
    baidu: `https://www.baidu.com/s?wd=${q}`,
    pubmed: `https://pubmed.ncbi.nlm.nih.gov/?term=${q}`,
    arxiv: `https://arxiv.org/search/?query=${q}&searchtype=all`,
    zhihu: `https://www.zhihu.com/search?q=${q}`,
    github: `https://github.com/search?q=${q}&type=repositories`,
    stackoverflow: `https://stackoverflow.com/search?q=${q}`,
  };
  return urls[engine] || urls.google;
}

export function setStatus(el, msg, ok = true) {
  if (!el) return;
  el.textContent = msg;
  el.dataset.ok = ok ? '1' : '0';
}

export function bindInputCalc(input, calc, output) {
  const run = () => {
    try {
      output.textContent = calc(input?.value ?? '');
    } catch (e) {
      output.textContent = `✗ ${e.message}`;
    }
  };
  input?.addEventListener('input', run);
  run();
}
