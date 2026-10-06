// Vérifie la syntaxe de chaque bloc <script> inline de mayela-crm.html.
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync('mayela-crm.html', 'utf8');
const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
let m, i = 0, bad = 0;
while ((m = re.exec(html)) !== null) {
  i++;
  const line = html.slice(0, m.index).split('\n').length;
  try {
    new vm.Script(m[1], { filename: `bloc-${i}.js` });
    console.log(`  bloc ${i} (ligne ${line}) : OK  [${m[1].trim().length} car.]`);
  } catch (e) {
    bad++;
    console.log(`  bloc ${i} (ligne ${line}) : ERREUR -> ${e.message}`);
  }
}
console.log(`\n${i} bloc(s) analysé(s), ${bad} erreur(s).`);
process.exit(bad ? 1 : 0);
