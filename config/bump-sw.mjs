import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
// Le hash reflète TOUS les fichiers du PRECACHE de sw.js (le './' = index.html), hors sw.js
// lui-même qui est lu par le navigateur pour la détection de mise à jour (inclus dans son
// propre hash, ce serait cyclique). Les fichiers sont lus en Buffer (les PNG sont binaires).
const CACHE_FILES = ['./index.html', './mayela-crm.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png'];
const hash = createHash('sha1');
for (const f of CACHE_FILES) {
  hash.update(readFileSync(join(root, f.replace(/^\.\//, ''))));
  hash.update('\x00');
}
const digest = hash.digest('hex').slice(0, 10);
const swPath = join(root, 'sw.js');
const sw = readFileSync(swPath, 'utf8');
const next = sw.replace(/mayela-crm-[A-Za-z0-9]+/i, () => 'mayela-crm-' + digest);
if (next === sw) {
  console.log('sw.js CACHE déjà à jour (mayela-crm-' + digest + ')');
  process.exit(0);
}
writeFileSync(swPath, next);
console.log('sw.js CACHE -> mayela-crm-' + digest);