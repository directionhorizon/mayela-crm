import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
// Le hash reflète TOUS les fichiers du PRECACHE de sw.js (le './' = index.html), hors sw.js
// lui-même qui est lu par le navigateur pour la détection de mise à jour (inclus dans son
// propre hash, ce serait cyclique). Les fichiers sont lus en Buffer (les PNG sont binaires).
const CACHE_FILES = ['./index.html', './mayela-crm.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/facebook.png', './icons/whatsapp.png', './icons/tiktok.jpg'];

// La version embarquée (const APP_VERSION) dans mayela-crm.html est normalisée en placeholder
// avant hachage : sinon le hash dépendrait de la version écrite -> circularité (chaque run
// produirait un hash différent).
const PLACEHOLDER = 'mayela-crm-0000000000';
const versionToken = /mayela-crm-[A-Za-z0-9]+/g;

const hash = createHash('sha1');
for (const f of CACHE_FILES) {
  const buf = readFileSync(join(root, f.replace(/^\.\//, '')));
  const normal = f.endsWith('.html') ? buf.toString('utf8').replace(new RegExp('mayela-crm-[A-Za-z0-9]+', 'g'), PLACEHOLDER) : buf;
  hash.update(normal);
  hash.update('\x00');
}
const digest = hash.digest('hex').slice(0, 10);
const version = 'mayela-crm-' + digest;

// 1) Écrit la version dans mayela-crm.html (const APP_VERSION).
const htmlPath = join(root, 'mayela-crm.html');
const html = readFileSync(htmlPath, 'utf8');
const htmlNext = html.replace(/(const APP_VERSION = ')(mayela-crm-[A-Za-z0-9]+)?(')/, `$1${version}$3`);
if (htmlNext !== html) {
  writeFileSync(htmlPath, htmlNext);
  console.log('mayela-crm.html APP_VERSION -> ' + version);
}

// 2) Met à jour le cache du service worker.
const swPath = join(root, 'sw.js');
const sw = readFileSync(swPath, 'utf8');
const next = sw.replace(/mayela-crm-[A-Za-z0-9]+/i, () => version);
if (next === sw && !htmlNext.includes(version)) {
  console.log('sw.js CACHE déjà à jour (' + version + ')');
  console.log('APP_VERSION déjà à jour (' + version + ')');
  process.exit(0);
}
writeFileSync(swPath, next);
console.log('sw.js CACHE -> ' + version);