// Verification ciblee : detecte les fautes de frappe reelles et les marqueurs
// de documentation perimee. Heuristique volontairement etroite pour ne pas
// produire de faux positifs sur du francais correct.
import fs from 'node:fs';
import path from 'node:path';

const DIRS = ['CLASSE MARKETING', 'docs'];

// 1) Fautes de frappe observees dans les redactions precedentes.
//    Chaque entree : [mot Incorrect, mot attendu]
const TYPOS = [
  ['rugat', 'de la'],
  ['deserves', 'doivent'],
  ['doubts', 'incertitudes'],
  ['silently', 'silencieusement'],
  ['解读', 'interpretation'],
  ['哪些', 'quels'],
  ['lePendant', 'le pendant de'],
  ['Known', 'connus'],
  ['despense', 'depense'],
  ['depense_api', 'depense'],
  ['ROAS  global', 'ROAS global'],
  ['a savoir', 'a savoir'],
  ['a faire', 'a faire'],
  ['TODO', 'TODO'],
];

// 2) Marqueurs de documentation perimee a signaler.
const STALE = [
  [/Fichier fige au/i, 'mention "Fichier fige au" (la date de congel est obsolete)'],
  [/^\s*\*\*Ref\.\*\*\s*:\s*.*l\.\d+/im, 'reference "Ref. : l.NNNN" (numero de ligne perime)'],
  [/l\.\d{3,5}\b/, 'numero de ligne "l.NNNN" (perime, utiliser le nom de fonction)'],
  [/a (?:\+|moins de )?\d+ jours? (?:de retard|avant)/i, 'formulation "X jours de retard" (verifier)'],
];

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.md')) out.push(p);
  }
  return out;
}

const files = [];
for (const d of DIRS) if (fs.existsSync(d)) walk(d, files);

let typos = 0;
let stale = 0;

for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  const lines = text.split(/\r?\n/);

  lines.forEach((line, i) => {
    for (const [bad, good] of TYPOS) {
      if (line.toLowerCase().includes(bad.toLowerCase())) {
        console.log(`[FAUTE] ${file}:${i + 1}  "${bad}" -> attendu "${good}"`);
        console.log(`        ${line.trim().slice(0, 140)}`);
        typos++;
      }
    }
    for (const [re, why] of STALE) {
      if (re.test(line)) {
        console.log(`[PERIME] ${file}:${i + 1}  ${why}`);
        console.log(`        ${line.trim().slice(0, 140)}`);
        stale++;
      }
    }
  });
}

console.log(`\n${files.length} fichiers verifies.`);
console.log(`Fautes de frappe : ${typos}`);
console.log(`Marqueurs perimes : ${stale}`);
