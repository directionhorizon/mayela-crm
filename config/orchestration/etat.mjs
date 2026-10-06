// ============================================================================
// Etat reel du chantier - ce que le harnais sait avant de juger quoi que ce soit.
//
// C'est le module qui repond a la question que THE 100TRAL ne pose jamais : sur
// quel etat du projet un rapport peut-il etre juge ? Un gate qui verifie "la
// migration V16 est-elle documentee" ne vaut rien si le harnais ignore que V16
// est appliquee en base et absente de git. Le juge alors une base fausse, et
// declare conforme un depot qui ne sera pas reconstruisible.
//
// C'est aussi le travail le plus rentable du plan. Au moment de l'ecriture :
//
//   - V14, V15 et V16 sont appliquees en base et ne sont versionnees nulle part ;
//   - config/scripts/ lui-meme - l'orchestrateur de verification - n'est pas
//     suivi, donc l'outil de securite n'est pas securise ;
//   - une trentaine de fichiers sont modifies sans commit.
//
// Ce module lit cet etat. Il ne le corrige pas : corriger reste une decision
// humaine, et un outil qui commit ou pousse tout seul Learning a transformer un
// risque en surprise.
//
// Il ne reimplement rien. L'etat du chantier vient de `orchestrator.mjs suivi
// --json`, dont le parseur fait deja autorite dans le depot ; l'etat des
// migrations vient de `orchestrator.mjs verif-migrations`. Un second parseur de
// EN_ATTENTE.md divergerait du premier en quelques semaines, et c'est exactement
// le piege que `ORCHESTRATEUR.md` signale deja pour les controles RLS.
// ============================================================================

import { spawn } from "node:child_process";
import path from "node:path";
import { existsSync } from "node:fs";

const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..");
const VERIF = path.join(REPO_ROOT, "config", "scripts", "orchestrator.mjs");

function executer(cmd, args, delaiMs = 60000) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      cwd: REPO_ROOT,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    let stdout = "", stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    const t = setTimeout(() => child.kill(), delaiMs);
    child.on("error", (e) => {
      clearTimeout(t);
      resolve({ code: null, stdout, stderr: String(e) });
    });
    child.on("close", (code) => {
      clearTimeout(t);
      resolve({ code, stdout, stderr });
    });
  });
}

async function git(args) {
  const r = await executer("git", args, 20000);
  return r.code === 0 ? r.stdout.trim() : "";
}

/** Etat git. `propre` est le seul champ qui compte pour la suite. */
export async function etatGit() {
  const [branche, sha, sujet, modifies, nonSuivis, enAhead] = await Promise.all([
    git(["rev-parse", "--abbrev-ref", "HEAD"]),
    git(["rev-parse", "--short", "HEAD"]),
    git(["log", "-1", "--pretty=%s"]),
    git(["status", "--porcelain", "--untracked-files=no"]),
    git(["ls-files", "--others", "--exclude-standard"]),
    git(["rev-list", "--count", "@{u}..HEAD"]),
  ]);

  const nModifies = modifies ? modifies.split(/\r?\n/).filter(Boolean).length : 0;
  const nNonSuivis = nonSuivis ? nonSuivis.split(/\r?\n/).filter(Boolean).length : 0;

  return {
    branche: branche || "(detachee)",
    sha,
    sujet: sujet.slice(0, 90),
    modifies: nModifies,
    non_suivis: nNonSuivis,
    en_avance: enAhead === "" ? null : Number(enAhead),
    propre: nModifies === 0 && nNonSuivis === 0,
  };
}

/**
 * Etat du chantier, lu par l'orchestrateur de verification existant.
 * Le `--json` est un contrat : on ne le repare pas.
 */
export async function etatSuivi() {
  if (!existsSync(VERIF)) {
    return { disponible: false, raison: "config/scripts/orchestrator.mjs introuvable" };
  }
  const r = await executer("node", [VERIF, "suivi", "--json"], 30000);
  if (r.code !== 0) {
    return { disponible: false, raison: r.stderr.trim().split("\n")[0] || `code ${r.code}` };
  }
  // La sortie humaine precede le JSON : on isole le bloc qui commence par "{".
  const debut = r.stdout.indexOf("{");
  if (debut === -1) {
    return { disponible: false, raison: "aucun bloc JSON dans la sortie de `suivi --json`" };
  }
  try {
    const j = JSON.parse(r.stdout.slice(debut));
    return {
      disponible: true,
      points: j.sections,
      actions_ouvertes: j.open_actions,
      actions_faites: j.done_actions,
      // La sortie `--json` ne porte pas le statut par point, seulement le
      // nombre d'actions ouvertes. On ne deduit donc pas les bloquants ici :
      // un statut inventerait un blocage qui n'existe pas.
      items: (j.items || []).map((i) => ({ num: i.num, titre: i.titre, ouvertes: i.open })),
    };
  } catch (e) {
    return { disponible: false, raison: `sortie illisible : ${e.message}` };
  }
}

/**
 * Etat des migrations face a la base reelle.
 * Delegue a `orchestrator.mjs verif-migrations`, qui interroge information_schema.
 */
export async function etatMigrations({ net = true } = {}) {
  if (!existsSync(VERIF)) {
    return { verifie: false, raison: "config/scripts/orchestrator.mjs introuvable" };
  }
  const args = [VERIF, "verif-migrations"];
  if (!net) args.push("--no-net");

  const r = await executer("node", args, 60000);
  const detail = (r.stdout || r.stderr).trim().split(/\r?\n/).filter(Boolean).slice(-4).join(" ; ");

  return {
    verifie: true,
    appliquees: r.code === 0,
    raison: r.code === 0 ? "" : detail || `code de sortie ${r.code}`,
  };
}

/**
 * Etat complet. Aucun champ n'est optionnel : une section indisponible est
 * declaree indisponible, pas omise. Un harnais qui affiche "propre" sans avoir
 * reussi a lire git mentirait.
 */
export async function etat({ net = true } = {}) {
  const [g, s, m] = await Promise.all([
    etatGit(),
    etatSuivi(),
    etatMigrations({ net }),
  ]);

  return {
    git: g,
    suivi: s,
    migrations: m,
    resume: resume({ git: g, suivi: s, migrations: m }),
  };
}

/**
 * La ligne reelle, injectee dans les prompts.
 *
 * Elle est volontairement pessimiste sur le versionnement : un gate qui juge
 * "la doc suit-elle les migrations" doit savoir que trois migrations ne sont pas
 * versionnees, sinon il peut declarer un depot propre alors que la base et le
 * depot ont diverge.
 */
function resume({ git: g, suivi: s, migrations: m }) {
  const lignes = [
    `Depot : branche ${g.branche} @ ${g.sha} - ${g.propre ? "propre" : `${g.modifies} modifie(s), ${g.non_suivis} non suivi(s)`}`,
  ];
  if (m.verifie) {
    lignes.push(
      `Migrations : ${m.appliquees ? "toutes appliquees en base" : `ECART - ${m.raison}`}`,
    );
  }
  if (s.disponible) {
    lignes.push(
      `Suivi : ${s.points} points, ${s.actions_ouvertes} action(s) ouverte(s), ${s.actions_faites} faite(s)`,
    );
  } else {
    lignes.push(`Suivi : indisponible (${s.raison})`);
  }
  return lignes.join("\n");
}