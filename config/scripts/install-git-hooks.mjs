// Installe les crochets git versionnes par le depot dans .git/hooks.
//
// Pourquoi un script d'installation plutôt que de versionner .git/hooks :
// .git/hooks n'est pas suivi par git (c'est un repertoire local, propre a chaque
// clone). Les crochets sont donc versionnes dans config/git-hooks/ et copies ici.
//
// Usage :
//     node config/scripts/install-git-hooks.mjs          installation
//     node config/scripts/install-git-hooks.mjs --check  verifier sans ecrire
//     node config/scripts/install-git-hooks.mjs --remove  desinstaller

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..");
const SRC_DIR = path.join(REPO_ROOT, "config", "git-hooks");
const HOOKS_DIR = path.join(REPO_ROOT, ".git", "hooks");

const args = new Set(process.argv.slice(2));
const check = args.has("--check");
const remove = args.has("--remove");

if (!fs.existsSync(SRC_DIR)) {
  console.error(`introuvable : ${path.relative(REPO_ROOT, SRC_DIR)}`);
  process.exit(1);
}

const hooks = fs.readdirSync(SRC_DIR).filter((f) => !f.endsWith(".sample"));
if (!hooks.length) {
  console.error(`aucun crochet a installer dans ${path.relative(REPO_ROOT, SRC_DIR)}`);
  process.exit(1);
}

if (remove) {
  for (const name of hooks) {
    const target = path.join(HOOKS_DIR, name);
    if (fs.existsSync(target)) {
      fs.rmSync(target);
      console.log(`supprime  ${name}`);
    }
  }
  process.exit(0);
}

if (!fs.existsSync(HOOKS_DIR)) {
  console.error(
    "pas de dossier .git/hooks : le repertoire courant n'est pas un depot git, ou le travail est dans un sous-module.",
  );
  process.exit(1);
}

let drift = 0;
for (const name of hooks) {
  const src = path.join(SRC_DIR, name);
  const target = path.join(HOOKS_DIR, name);
  const fresh = fs.readFileSync(src, "utf8");

  if (check) {
    if (!fs.existsSync(target)) {
      console.log(`absent    ${name}`);
      drift++;
    } else if (fs.readFileSync(target, "utf8") !== fresh) {
      console.log(`modifie   ${name} (diverge de config/git-hooks/${name})`);
      drift++;
    } else {
      console.log(`a jour    ${name}`);
    }
    continue;
  }

  fs.writeFileSync(target, fresh);
  if (process.platform !== "win32") {
    fs.chmodSync(target, 0o755);
  }
  console.log(`installe  ${name}`);
}

if (check) {
  if (drift) {
    console.error(`\n${drift} crochet(s) a remettre a jour : node config/scripts/install-git-hooks.mjs`);
    process.exit(1);
  }
  process.exit(0);
}

console.log("\nLe crochet pre-push bloque un push si la doc du schema diverge des migrations.");
console.log("Contournement ponctuel : git push --no-verify");
