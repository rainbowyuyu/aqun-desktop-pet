const pkg = require('../package.json');

/** GitHub 仓库信息 — 发布前请确认 owner / repo 与远程一致 */
const OWNER = 'rainbowyuyu';
const REPO = 'aqun-desktop-pet';
const BRANCH = 'main';

function getRepoUrls() {
  const base = `https://github.com/${OWNER}/${REPO}`;
  return {
    repoUrl: base,
    cloneUrl: `${base}.git`,
    releasesUrl: `${base}/releases`,
    treeUrl: `${base}/tree/${BRANCH}`,
    rawPackageUrl: `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/package.json`,
  };
}

module.exports = {
  owner: OWNER,
  repo: REPO,
  branch: BRANCH,
  getCurrentVersion: () => String(pkg.version || '0.0.0'),
  getRepoUrls,
};
