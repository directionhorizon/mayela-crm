// ============================================================================
// Orchestrateur de verification du projet MAYELA CRM.
//
// Regroupe en un seul point d'entree des controles aujourd'hui disperses :
// une commande pour la doc, une pour le cloisonnement, une pour la syntaxe JS.
// L'interet n'est pas de regrouper pour le plaisir de regrouper, mais de
// pouvoir repondre a "le depot est-il coherent ?" par un seul code de sortie.
//
//   node config/scripts/orchestrator.mjs precheck     avant commit / push
//   node config/scripts/orchestrator.mjs postmigrate apres un changement en base
//   node config/scripts/orchestrator.mjs suivi        etat du chantier
//   node config/scripts/orchestrator.mjs list         controles disponibles
//
// Chaque controle declare ce qu'il touche et s'il a besoin du reseau, ce qui
// permet a `precheck` de sauter proprement les controles reseau hors ligne.
//
// Code de sortie : 0 si tout passe, 1 sinon, 2 si la configuration est erronee.
// ============================================================================

import { spawn } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..");
const PYTHON = process.env.PYTHON || "python";

// ---------------------------------------------------------------------------
// Execution
// ---------------------------------------------------------------------------
// Aucun shell intermediaire : `shell: true` ferait interpreter les arguments
// par cmd.exe (espaces, &, |) et Node emet alors un DeprecationWarning. Sur
// Windows, CreateProcess resout directement un binaire sans extension depuis le
// PATH, donc `python` et `node` se lancent sans shell. Pour node lui-meme on
// passe par process.execPath, qui est le binaire exact de l'interpreteur
// courant plutot qu'une recherche dans le PATH.
//
// Pour Python on ne passe PAS par `py -3` : ce lanceur selectionne le
// interpreteur par defaut du systeme, qui n'est pas necessairement celui du
// depot. Ici, c'est le Python du PATH (celui de l'environnement de travail) qui
// doit tourner, parce que c'est la que PyYAML est installe. Definir la variable
// d'environnement PYTHON permet de viser un autre interpreteur.

function binary(cmd) {
  if (cmd === "node") return process.execPath;
  return cmd;
}

function run(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    const child = spawn(binary(cmd), args, {
      cwd: REPO_ROOT,
      env: { ...process.env, ...opts.env },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));

    const timer = opts.timeout
      ? setTimeout(() => child.kill(), opts.timeout)
      : null;

    child.on("error", (err) => {
      if (timer) clearTimeout(timer);
      // ENOENT : l'outil n'est pas installe. Distinct d'un echec de controle,
      // sinon un Python absent se lirait comme une doc divergente.
      resolve({ code: null, missing: err.code === "ENOENT", stdout, stderr: String(err) });
    });

    child.on("close", (code) => {
      if (timer) clearTimeout(timer);
      resolve({ code, missing: false, stdout, stderr });
    });
  });
}

function have(cmd) {
  return new Promise((resolve) => {
    const child = spawn(binary(cmd), ["--version"], {
      cwd: REPO_ROOT,
      stdio: "ignore",
    });
    child.on("error", () => resolve(false));
    child.on("close", (code) => resolve(code === 0));
  });
}

// ---------------------------------------------------------------------------
// Registre de controles
// ---------------------------------------------------------------------------
//
// `needs: "net"` = contacte la base Supabase. Reseigne en clair plutot que
// devine : un controle reseau qui echoue parce qu'il n'y a pas de reseau doit
// se distinguer d'un controle qui a trouve un vrai probleme.

const CHECKS = {
  "doc-audit": {
    label: "Documentation du schema alignee sur les migrations",
    cmd: PYTHON,
    args: ["config/scripts/audit_docs.py"],
    needs: null,
    weight: "bloquant",
    why: "Une migration appliquee sans mise a jour de la doc laisse l'equipe decoder le schema a rebours.",
  },
  "js-syntax": {
    label: "Syntaxe des blocs <script> de mayela-crm.html",
    cmd: "node",
    args: ["config/_check_js.mjs"],
    needs: null,
    weight: "bloquant",
    why: "Une erreur de syntaxe casse toute la page, pas seulement une fonction.",
  },
  "rls-espaces": {
    label: "Cloisonnement entre espaces (migration V13)",
    cmd: "node",
    args: ["config/verify_v13_isolation.mjs"],
    needs: "net",
    weight: "bloquant",
    why: "Un user qui voit les donnees d'un autre espace est une fuite de donnees clients.",
  },
  "rls-solo": {
    label: "Mode sans espace (migration V14)",
    cmd: "node",
    args: ["config/verify_v14_solo.mjs"],
    needs: "net",
    weight: "bloquant",
    why: "La V13 avait casse le mode solo : toute ecriture en 403, y compris du proprietaire.",
  },
  "migrations-appliquees": {
    label: "Migrations du depot appliquees en base",
    cmd: "node",
    args: ["config/scripts/orchestrator.mjs", "verif-migrations"],
    needs: "net",
    weight: "bloquant",
    why: "Une migration ecrite mais jamais appliquee donne un schema different du code.",
  },
};

function hasCmdFor(check) {
  const c = check.cmd;
  if (c === PYTHON) return true;
  return c === "node";
}

// ---------------------------------------------------------------------------
// Rapport
// ---------------------------------------------------------------------------

const SYM = { pass: "OK  ", fail: "ECHEC", skip: "IGNORE", missing: "ABSENT" };

function printResult(name, check, res) {
  const state = res.missing ? "missing" : res.code === 0 ? "pass" : "fail";
  console.log(`  [${SYM[state]}] ${check.label}`);
  if (state === "missing") {
    console.log(`           executable introuvable : ${check.cmd}`);
  } else if (state === "fail") {
    const detail = (res.stdout || res.stderr || "").trim().split("\n").filter(Boolean);
    for (const line of detail.slice(-6)) console.log(`           ${line}`);
  }
  return state === "pass";
}

async function runChecks(names, { net }) {
  const results = [];
  let skipped = 0;

  for (const name of names) {
    const check = CHECKS[name];
    if (!check) {
      console.log(`  [IGNORE] controle inconnu : ${name}`);
      skipped++;
      continue;
    }
    if (check.needs === "net" && !net) {
      console.log(`  [IGNORE] ${check.label} (controle reseau, --no-net)`);
      skipped++;
      continue;
    }
    if (!hasCmdFor(check)) {
      console.log(`  [ABSENT] ${check.label} (${check.cmd} introuvable)`);
      skipped++;
      continue;
    }

    const res = await run(check.cmd, check.args, { timeout: 120000 });
    results.push({ name, check, res, ok: printResult(name, check, res) });
  }

  return { results, skipped };
}

function summaryLine(results, skipped) {
  const passed = results.filter((r) => r.ok).length;
  const failed = results.length - passed;
  return `${passed} reussi(s), ${failed} echec(s), ${skipped} ignore(s)`;
}

// ---------------------------------------------------------------------------
// Commande : list
// ---------------------------------------------------------------------------

function cmdList() {
  console.log("\nControles disponibles\n");
  for (const [name, c] of Object.entries(CHECKS)) {
    console.log(`  ${name}`);
    console.log(`      ${c.label}`);
    console.log(`      reseau : ${c.needs === "net" ? "oui" : "non"} | poids : ${c.weight}`);
    console.log(`      ${c.why}\n`);
  }
}

// ---------------------------------------------------------------------------
// Pertinence : quels controles ont du sens pour ce push ?
// ---------------------------------------------------------------------------
//
// Un push de documentation ne peut pas avoir casse le schema, ni la syntaxe
// JS, ni la RLS. Lancer quand meme ces controles coute du temps et apprend au
// developpeur a ignorer les echecs. On ne declenche donc que sur ce qui peut
// reellement avoir change.
//
// Le push pousse des commits, pas des fichiers : on regarde tous les fichiers
// touches depuis l'upstream (ou depuis HEAD si la branche n'en a pas).

const TRIGGERS = [
  { re: /^config\/MIGRATION_.*\.sql$/, checks: ["doc-audit", "migrations-appliquees", "rls-espaces", "rls-solo"] },
  { re: /^config\/audit\.yaml$/, checks: ["doc-audit"] },
  { re: /^supabase\/functions\//, checks: ["rls-espaces", "rls-solo"] },
  { re: /^(src|mayela-crm\.html|.*\.ts|.*\.mjs)$/, checks: ["js-syntax", "doc-audit"] },
];

async function changedFiles() {
  const upstream = await run("git", ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"], {});
  const range = upstream.code === 0 ? `${upstream.stdout.trim()}..HEAD` : "HEAD~1..HEAD";
  const res = await run("git", ["diff", "--name-only", range], {});
  if (res.code !== 0) {
    const alt = await run("git", ["diff", "--name-only", "HEAD"], {});
    return alt.code === 0 ? alt.stdout.split("\n").filter(Boolean) : [];
  }
  return res.stdout.split("\n").filter(Boolean);
}

async function relevantChecks() {
  const files = await changedFiles();
  if (!files.length) return { names: [], files };

  const names = new Set();
  for (const file of files) {
    for (const t of TRIGGERS) {
      if (t.re.test(file)) for (const c of t.checks) names.add(c);
    }
  }
  return { names: [...names], files };
}

// ---------------------------------------------------------------------------
// Commande : precheck
// ---------------------------------------------------------------------------

async function cmdPrecheck(args) {
  const net = !args.includes("--no-net");
  const force = args.includes("--all");
  const only = args.filter((a) => a.startsWith("--only=")).map((a) => a.slice(7));

  let names;
  if (only.length) {
    names = only.flatMap((o) => o.split(","));
  } else {
    const { names: relevant, files } = await relevantChecks();
    if (!relevant.length && !force) {
      console.log("\nVerification avant commit");
      console.log(`  ${files.length} fichier(s) pousse(s), aucun ne peut affecter le schema ou la RLS.`);
      console.log("  Verification non lancee. Forcer : node config/scripts/orchestrator.mjs precheck --all");
      return 0;
    }
    names = relevant;
  }

  console.log(`\nVerification avant commit${net ? "" : " (hors reseau)"}`);
  console.log(`  ${names.length} controle(s) retenu(s)`);

  if (net && !(await have(PYTHON))) {
    console.log(`  [ABSENT] ${PYTHON} introuvable - controles doc impossibles`);
  }

  const { results, skipped } = await runChecks(names, { net });
  const failed = results.filter((r) => !r.ok);

  console.log(`\n${summaryLine(results, skipped)}`);
  if (failed.length) {
    console.log("\nEchecs :");
    for (const f of failed) {
      console.log(`  - ${f.check.label}`);
      console.log(`    ${f.check.why}`);
    }
    console.log("\nCorriger, ou contourner volontairement : git push --no-verify");
  }
  return failed.length ? 1 : 0;
}

// ---------------------------------------------------------------------------
// Commande : postmigrate
// ---------------------------------------------------------------------------

async function cmdPostmigrate(args) {
  const target = args.find((a) => !a.startsWith("-"));
  const net = !args.includes("--no-net");

  console.log("\nVerification apres changement en base");
  if (target) console.log(`  migration indiquee : ${target}`);

  // L'ordre est impose : la doc d'abord (on vient de migrer, c'est le moment
  // ou elle derive), ensuite la RLS, ensuite l'etat reel des migrations.
  const names = ["doc-audit", "js-syntax", "rls-espaces", "rls-solo", "migrations-appliquees"];
  const { results, skipped } = await runChecks(names, { net });
  const failed = results.filter((r) => !r.ok);

  console.log(`\n${summaryLine(results, skipped)}`);

  if (failed.length) {
    const docFailed = failed.some((f) => f.name === "doc-audit");
    console.log("\nSuite a faire :");
    if (docFailed) {
      console.log("  La doc du schema a derive. Corriger config/SCHEMA_SUPABASE.md :");
      console.log("    - ajouter la section de la table si elle est nouvelle");
      console.log("    - ajouter les colonnes dans le bloc existant, marquees par la version");
      console.log("    - mettre a jour le bandeau de statut en tete de fichier");
      console.log("  Puis relancer : node config/scripts/orchestrator.mjs postmigrate");
    }
    const rlsFailed = failed.filter((f) => f.name.startsWith("rls-"));
    if (rlsFailed.length) {
      console.log("  Cloisonnement casse : ne pas poursuivre tant que ce n'est pas corrige.");
      console.log("  Detail : node config/verify_v13_isolation.mjs");
    }
  } else {
    console.log("\nSchema, documentation et cloisonnement sont coherents.");
  }
  return failed.length ? 1 : 0;
}

// ---------------------------------------------------------------------------
// Commande : verif-migrations (interne, appele par un controle)
// ---------------------------------------------------------------------------
//
// Interroge information_schema pour savoir quelles tables et colonnes du depot
// existent reellement en base. Un `create table` ou un `add column` present dans
// une migration mais absent de la base signale une migration non executee.

async function cmdVerifyMigrations() {
  const envFile = path.join(REPO_ROOT, ".env.deploy");
  if (!existsSync(envFile)) {
    console.log("  .env.deploy absent : impossible de joindre la base");
    return 1;
  }

  const env = {};
  for (const line of readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].trim();
  }

  const ref = env.SUPABASE_PROJECT_REF;
  const token = env.SUPABASE_ACCESS_TOKEN;
  if (!ref || !token) {
    console.log("  SUPABASE_PROJECT_REF ou SUPABASE_ACCESS_TOKEN absent de .env.deploy");
    return 1;
  }

  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: `select table_name, column_name from information_schema.columns
              where table_schema = 'public' order by 1, 2`,
    }),
  });

  if (!r.ok) {
    console.log(`  API Management : ${r.status} ${(await r.text()).slice(0, 200)}`);
    return 1;
  }

  const live = await r.json();
  const liveTables = new Map();
  for (const row of live) {
    if (!liveTables.has(row.table_name)) liveTables.set(row.table_name, new Set());
    liveTables.get(row.table_name).add(row.column_name);
  }

  // Ce que les migrations du depot declarent.
  const declared = parseDeclaredSchema();
  const missing = [];

  for (const [table, cols] of declared) {
    if (!liveTables.has(table)) {
      missing.push({ kind: "table", table, col: null });
      continue;
    }
    for (const col of cols) {
      if (!liveTables.get(table).has(col)) {
        missing.push({ kind: "colonne", table, col });
      }
    }
  }

  if (!missing.length) {
    console.log(`  ${declared.size} tables declarees, toutes presentes en base`);
    return 0;
  }

  console.log(`  ${missing.length} element(s) declare(s) par une migration mais absents de la base :`);
  for (const m of missing.slice(0, 12)) {
    console.log(
      m.kind === "table"
        ? `    - table ${m.table}`
        : `    - ${m.table}.${m.col}`,
    );
  }
  if (missing.length > 12) console.log(`    ... et ${missing.length - 12} autre(s)`);
  console.log("  Une migration existe mais n'a pas ete executee.");
  return 1;
}

// Analyse des migrations : reuses les memes conventions que audit_docs.py.
function parseDeclaredSchema() {
  const dir = path.join(REPO_ROOT, "config");
  const declared = new Map();

  for (const name of readdirSync(dir)) {
    if (!/^MIGRATION_.*\.sql$/.test(name)) continue;
    const sql = readFileSync(path.join(dir, name), "utf8");

    for (const m of sql.matchAll(
      /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?([a-z_][a-z0-9_]*)\s*\(/gi,
    )) {
      if (!declared.has(m[1])) declared.set(m[1], new Set());
    }
    for (const m of sql.matchAll(
      /alter\s+table\s+(?:if\s+exists\s+)?(?:public\.)?([a-z_][a-z0-9_]*)\s+add\s+column\s+(?:if\s+not\s+exists\s+)?([a-z_][a-z0-9_]*)/gi,
    )) {
      if (!declared.has(m[1])) declared.set(m[1], new Set());
      declared.get(m[1]).add(m[2].toLowerCase());
    }
  }
  return declared;
}

// ---------------------------------------------------------------------------
// Commande : suivi
// ---------------------------------------------------------------------------

function cmdSuivi(args) {
  const file = path.join(REPO_ROOT, "docs", "suivi", "EN_ATTENTE.md");
  if (!existsSync(file)) {
    console.log("docs/suivi/EN_ATTENTE.md introuvable");
    return 2;
  }
  const text = readFileSync(file, "utf8");
  const lines = text.split(/\r?\n/);

  // Sections numerotees, avec leur statut.
  const sections = [];
  for (let i = 0; i < lines.length; i++) {
    const h = lines[i].match(/^##\s+(\d+)\.\s+(.*)$/);
    if (!h) continue;
    const body = lines.slice(i + 1, nextSection(lines, i)).join("\n");
    sections.push({
      num: Number(h[1]),
      title: h[2].replace(/[*_`]/g, "").trim(),
      status: h[2],
      body,
      line: i + 1,
    });
  }

  const openBoxes = (text.match(/^\s*-\s*\[ \]/gm) || []).length;
  const doneBoxes = (text.match(/^\s*-\s*\[x\]/gim) || []).length;

  console.log("\nPilotage du chantier - docs/suivi/EN_ATTENTE.md\n");
  console.log(`  ${sections.length} points numerotes | ${openBoxes} actions a faire | ${doneBoxes} faites\n`);

  const counts = { bloque: 0, report: 0, en_cours: 0, clos: 0 };

  for (const s of sections) {
    const state = sectionState(s.status);
    const open = (s.body.match(/^\s*-\s*\[ \]/gm) || []).length;
    counts[state]++;

    const label = {
      bloque: "BLOQUANT ",
      report: "REPORTE  ",
      en_cours: "EN COURS ",
      clos: "CLOS     ",
    }[state];

    const title = s.title.length > 66 ? `${s.title.slice(0, 63)}...` : s.title;
    console.log(`  ${label} ${String(s.num).padStart(2)}. ${title}`);
    if (open) {
      console.log(`            ${open} action(s) ouverte(s)  (EN_ATTENTE.md:${s.line})`);
    }
  }

  const bloquants = sections.filter((s) => sectionState(s.status) === "bloque");
  const reportes = sections.filter((s) => sectionState(s.status) === "report");

  console.log(
    `\n  Repartition : ${counts.bloque} bloquant(s), ${counts.en_cours} en cours, ` +
      `${counts.report} reporte(s), ${counts.clos} clos`,
  );
  if (bloquants.length) {
    console.log(
      `  Bloquants : ${bloquants.map((s) => s.num).join(", ")} - un blocage externe ne se leve pas par du code.`,
    );
  }
  if (reportes.length) {
    console.log(`  Reportes  : ${reportes.map((s) => s.num).join(", ")} - decision differee, a reassurer.`);
  }

  if (args.includes("--json")) {
    console.log(
      "\n" +
        JSON.stringify(
          {
            sections: sections.length,
            open_actions: openBoxes,
            done_actions: doneBoxes,
            items: sections.map((s) => ({
              num: s.num,
              title: s.title,
              open: (s.body.match(/^\s*-\s*\[ \]/gm) || []).length,
              line: s.line,
            })),
          },
          null,
          2,
        ),
    );
  }
  return 0;
}

// Un titre de section porte le statut. Quatre etats, distingues parce qu'ils
// appellent des actions differentes : un blocage externe demande d'attendre,
// un report demande de reassurer, un chantier en cours demande de continuer,
// un point clos demande de ne plus y revenir.
//
// "RESOLU" et "FAIT" ne signifient pas "rien a faire" : un point resolu garde
// souvent une action de recette. Ce qui compte est le nombre de cases decochees
// dans le corps de la section, pas le mot dans le titre.
function sectionState(status) {
  if (/R[eé]jet[eé]|bloqu[eé]|jamais pass[eé]/i.test(status)) return "bloque";
  if (/SANS LIMITE|r[eé]activ|plus tard|report/i.test(status)) return "report";
  if (/R[eé]solu|fait|appliqu[eé]|clos/i.test(status)) return "clos";
  return "en_cours";
}

function nextSection(lines, from) {
  for (let i = from + 1; i < lines.length; i++) {
    if (/^##\s/.test(lines[i])) return i;
  }
  return lines.length;
}

// ---------------------------------------------------------------------------

const COMMANDS = {
  list: () => cmdList(),
  precheck: cmdPrecheck,
  postmigrate: cmdPostmigrate,
  "verif-migrations": cmdVerifyMigrations,
  suivi: cmdSuivi,
};

const [cmd, ...args] = process.argv.slice(2);
const entry = COMMANDS[cmd];

if (!entry) {
  console.log(`
Orchestrateur de verification - MAYELA CRM

  node config/scripts/orchestrator.mjs precheck [--no-net] [--all] [--only=doc-audit,js-syntax]
  node config/scripts/orchestrator.mjs postmigrate [migration] [--no-net]
  node config/scripts/orchestrator.mjs suivi [--json]
  node config/scripts/orchestrator.mjs list

  precheck     controles avant commit / push
  postmigrate  controles apres un changement en base (doc, RLS, etat des migrations)
  suivi        etat du chantier depuis docs/suivi/EN_ATTENTE.md
  list         controles disponibles
`);
  process.exit(2);
}

// On fixe `exitCode` plutot que d'appeler process.exit() : le client HTTP de
// Node garde un socket keep-alive ouvert, et une sortie forcee pendant qu'il se
// ferme provoque un crash libuv (Assertion failed sur win/async.c). Laisser la
// boucle d'evenements se vider termine proprement.
process.exitCode = (await entry(args)) || 0;
