/** GLB 完整性校验 — 检测微信/解压导致的二进制损坏 */

let _manifestCache = null;
let _manifestBase = null;

async function sha256Hex(buffer) {
  const hash = await crypto.subtle.digest('SHA-256', buffer);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function manifestUrlFromModelUrl(url) {
  const u = String(url || '');
  const slash = u.lastIndexOf('/');
  if (slash < 0) return null;
  return `${u.slice(0, slash + 1)}models.manifest.json`;
}

function fileNameFromUrl(url) {
  const u = String(url || '');
  const slash = u.lastIndexOf('/');
  const name = slash >= 0 ? u.slice(slash + 1) : u;
  return name.split('?')[0].split('#')[0];
}

async function loadManifest(manifestUrl) {
  if (_manifestCache && _manifestBase === manifestUrl) return _manifestCache;
  try {
    const res = await fetch(manifestUrl);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.files) return null;
    _manifestCache = data;
    _manifestBase = manifestUrl;
    return data;
  } catch {
    return null;
  }
}

const CORRUPT_MSG = '模型文件校验失败，可能因微信压缩/解压损坏。请用网盘或 7-Zip 重新传输，不要通过微信发送大文件。';

/**
 * @param {string} modelUrl 模型 fetch URL
 * @param {ArrayBuffer} buffer 已下载的 GLB 二进制
 */
export async function verifyModelBuffer(modelUrl, buffer) {
  const manifestUrl = manifestUrlFromModelUrl(modelUrl);
  const fileName = fileNameFromUrl(modelUrl);
  if (!manifestUrl || !fileName?.endsWith('.glb')) return;

  const manifest = await loadManifest(manifestUrl);
  const expected = manifest?.files?.[fileName];
  if (!expected) return;

  if (buffer.byteLength !== expected.size) {
    throw new Error(`${CORRUPT_MSG}（${fileName}：大小 ${buffer.byteLength} ≠ ${expected.size}）`);
  }

  const hash = await sha256Hex(buffer);
  if (hash !== expected.sha256) {
    throw new Error(`${CORRUPT_MSG}（${fileName}：校验和不匹配）`);
  }
}

export function clearManifestCache() {
  _manifestCache = null;
  _manifestBase = null;
}
