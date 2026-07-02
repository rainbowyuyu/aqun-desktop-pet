const https = require('https');

function getJson(url, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: {
          'User-Agent': 'aqun-desktop-pet-update-check',
          Accept: 'application/vnd.github+json, application/json',
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode}`));
            return;
          }
          try {
            resolve(JSON.parse(data));
          } catch (err) {
            reject(err);
          }
        });
      },
    );
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error('请求超时'));
    });
  });
}

function normalizeVersion(v) {
  return String(v || '')
    .trim()
    .replace(/^v/i, '');
}

function compareVersions(a, b) {
  const pa = normalizeVersion(a).split(/[.-]/).map((x) => parseInt(x, 10) || 0);
  const pb = normalizeVersion(b).split(/[.-]/).map((x) => parseInt(x, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i += 1) {
    const da = pa[i] || 0;
    const db = pb[i] || 0;
    if (da > db) return 1;
    if (da < db) return -1;
  }
  return 0;
}

/**
 * 检查 GitHub 是否有新版本
 * 优先对比 latest release，若无 release 则读 main 分支 package.json
 */
async function checkForUpdate({ owner, repo, branch, currentVersion }) {
  const cur = normalizeVersion(currentVersion);
  const urls = {
    repoUrl: `https://github.com/${owner}/${repo}`,
    releasesUrl: `https://github.com/${owner}/${repo}/releases`,
  };

  let latest = null;
  let releaseUrl = urls.releasesUrl;
  let releaseNotes = '';
  let publishedAt = null;
  let source = 'branch';

  try {
    const release = await getJson(`https://api.github.com/repos/${owner}/${repo}/releases/latest`);
    if (release?.tag_name) {
      latest = normalizeVersion(release.tag_name);
      releaseUrl = release.html_url || releaseUrl;
      releaseNotes = release.body || '';
      publishedAt = release.published_at || null;
      source = 'release';
    }
  } catch {
    /* 无 release 时回退到 package.json */
  }

  if (!latest) {
    const pkg = await getJson(
      `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/package.json`,
    );
    latest = normalizeVersion(pkg.version);
    releaseUrl = `https://github.com/${owner}/${repo}/tree/${branch}`;
    source = 'branch';
  }

  const cmp = compareVersions(latest, cur);
  return {
    ok: true,
    currentVersion: cur,
    latestVersion: latest,
    hasUpdate: cmp > 0,
    upToDate: cmp <= 0,
    releaseUrl,
    repoUrl: urls.repoUrl,
    cloneUrl: `${urls.repoUrl}.git`,
    releaseNotes,
    publishedAt,
    source,
  };
}

module.exports = {
  checkForUpdate,
  compareVersions,
  normalizeVersion,
  getJson,
};
