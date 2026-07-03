/** 打包前检查内嵌 AI Key 文件是否存在 */
import { existsSync } from 'fs';
import { join } from 'path';

const secretsPath = join(process.cwd(), 'electron', 'aiSecrets.local.cjs');

if (!existsSync(secretsPath)) {
  console.error('[ai] 缺少 electron/aiSecrets.local.cjs，请从 aiSecrets.local.cjs.example 复制并填入 Key');
  process.exit(1);
}

console.log('[ai] embedded secrets file OK');
