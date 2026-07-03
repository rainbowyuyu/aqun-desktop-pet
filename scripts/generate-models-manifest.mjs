/** 生成 public/models/models.manifest.json — 打包前校验 GLB 完整性（防微信传输损坏） */
import { createHash } from 'crypto';
import { readFile, readdir, writeFile } from 'fs/promises';
import { join } from 'path';

const modelsDir = join(process.cwd(), 'public', 'models');
const files = (await readdir(modelsDir)).filter((n) => n.endsWith('.glb')).sort();

const manifest = {
  version: 1,
  generatedAt: new Date().toISOString(),
  files: {},
};

for (const name of files) {
  const buf = await readFile(join(modelsDir, name));
  manifest.files[name] = {
    size: buf.length,
    sha256: createHash('sha256').update(buf).digest('hex'),
  };
}

const outPath = join(modelsDir, 'models.manifest.json');
await writeFile(outPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(`[manifest] wrote ${outPath} (${files.length} models)`);
