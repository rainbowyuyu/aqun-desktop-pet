const EXTRA_KEYS = ['aqun-birthday-greeted', 'aqun-pose-editor-settings'];
const KNOWN_PREFIXES = ['aqun-'];

/** 清除渲染进程本地缓存（工具数据、生日问候标记等） */
export function clearLocalPetData() {
  const keys = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (!key) continue;
    if (KNOWN_PREFIXES.some((prefix) => key.startsWith(prefix)) || EXTRA_KEYS.includes(key)) {
      keys.push(key);
    }
  }
  keys.forEach((key) => localStorage.removeItem(key));
}
