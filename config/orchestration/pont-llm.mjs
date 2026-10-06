// ============================================================================
// Pont vers le modele - un seul endroit ou le harnais parle a un LLM.
//
// THE 100TRAL isole l'appel au fournisseur dans `core/ai/ILLMProvider.kt` et ses
// implementations (Gemini, local). Ici l'isolation est la meme, mais la troisieme
// source est le binaire `opencode` : le modele n'est pas choisi par le code, il
// est passe en parametre, et chaque appel est un sous-agent isole.
//
// Deux options portent l'essentiel de la robustesse, et les deux ont ete
// verifiees empiriquement sur `opencode 1.18.34` :
//
//   --pure        execute sans les plugins externes. Consequence : un routage
//                 d'agents casse dans la configuration globale n'atteint pas le
//                 harnais. Le harnais ne depend donc pas de la configuration de
//                 l'agent qui l'ecrit.
//   --format json emet des evenements JSON bruts plutot que du texte affiche.
//                 C'est ce qui permet au contrat de decomposition et au gate de
//                 lire une reponse structuree au lieu de la gratter, et donc de
//                 supprimer le test cassable `reponse.contains("NON")`.
//
// Un appel se termine de quatre facons distinctes, et les quatre sont
// distinguables sans ambiguite. Les confondre rendrait le harnais incapable de
// dire pourquoi il n'a pas de reponse : "l'agent a echoue" et "l'orchestrateur
// est casse" appellent des corrections opposees.
//   ok                  code 0 et au moins un evenement `text`
//   timeout             le delai est depasse, le processus est tue
//   modele_indisponible evenement `error`, le fournisseur refuse la requete
//   binaire_absent     le binaire opencode n'a pas pu etre resolu
// ============================================================================

import { spawn } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

// Un appel de sonde (verifier le bassin) et un appel d'agent (lire le depot,
// rendre un rapport) ne sont pas la meme charge. Mesure du 2026-10-02 : une
// reponse d'une ligne prend ~18s isolee et ~48s a huit en parallele ; un agent
// qui doit lire plusieurs fichiers du depot depasse 120s. Un seul delai pour les
// deux ferait passer tout agent pour un modele indisponible.
export const DELAI_SONDE = 90_000;
export const DELAI_AGENT = 420_000;
export const DELAI_GATE = 240_000;

/** Repli pour un appel dont le delai n'est pas precise : le plus long des trois. */
export const DELAI_PAR_DEFAUT = DELAI_AGENT;

// Le bassin de modeles. `big-pickle` est le seul verifie dans cette session :
// c'est lui qui sert de repli. Les autres viennent d'un test empirique du
// 2026-10-02 et sont declares sans garantie -- `verifierModeles()` les teste
// vraiment plutot que de les supposer operationnels.
export const REPLI = "opencode/big-pickle";

export const BASSIN = [
  { modele: "opencode/big-pickle", role: "repli, seule valeur verifiee dans cette session" },
  { modele: "opencode/nemotron-3-ultra-free", role: "raisonnement lourd" },
  { modele: "opencode/space-bunny-free", role: "lecture rapide, grep" },
  { modele: "opencode/mimo-v2.6-flash-free", role: "travail general" },
  { modele: "opencode/longcat-2.5-preview-free", role: "redaction" },
  { modele: "opencode/fledge-alpha-free", role: "interface, visuel" },
  { modele: "opencode/nemotron-3.5-lightning-free", role: "plan, critique" },
  { modele: "opencode/muse-spark-1.3-contributor-free", role: "travail general" },
];

// ---------------------------------------------------------------------------
// Resolution du binaire
// ---------------------------------------------------------------------------
//
// Sur Windows, `opencode` est un shim npm : `opencode.cmd` et `opencode.ps1`.
// Lancer un `.cmd` depuis Node sans shell est refuse (il faut `shell: true`, que
// ce depot interdit ailleurs pour de bonnes raisons), et un `.ps1` n'est pas
// directement executable. Il faut donc remonter au vrai binaire, qui est
// `opencode.exe` dans le paquet npm.
//
// Le caches est module-level : resoudre puis lancer `--version` coute un
// processus, et une mission en enchaine plusieurs.

let BINAIRE = null;

function candidats() {
  if (process.env.OPENCODE_BIN) return [process.env.OPENCODE_BIN];

  const dirs = (process.env.PATH || "").split(path.delimiter).filter(Boolean);
  const found = [];

  for (const dir of dirs) {
    if (!existsSync(dir)) continue;

    // Sous Windows, le nom reel du paquet est opencode-ai, pas opencode.
    const exe = path.join(
      dir,
      "node_modules",
      "opencode-ai",
      "bin",
      process.platform === "win32" ? "opencode.exe" : "opencode",
    );
    if (existsSync(exe)) found.push(exe);

    // Un binaire pose directement dans un repertoire du PATH.
    for (const nom of process.platform === "win32" ? ["opencode.exe"] : ["opencode"]) {
      const direct = path.join(dir, nom);
      if (existsSync(direct)) found.push(direct);
    }
  }
  return found;
}

/**
 * Resout le binaire opencode, une fois pour toutes.
 * Asynchrone parce que la verification `--version` est elle-meme un processus :
 * sans `await`, le resultat est une promesse et `code` vaut toujours `undefined`,
 * donc aucun candidat ne passe et le harnais se croit sans binaire.
 * @returns {Promise<string|null>} chemin absolu, ou null si aucun candidat ne repond.
 */
export async function resoudreBinaire() {
  if (BINAIRE) return BINAIRE;

  for (const c of candidats()) {
    if (!c) continue;
    const r = await lancerBrut(c, ["--version"], 15000);
    if (r.code === 0) {
      BINAIRE = c;
      return c;
    }
  }
  return null;
}

function lancerBrut(binaire, args, delaiMs) {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(binaire, args, {
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      });
    } catch (e) {
      resolve({ code: null, enoent: e.code === "ENOENT", tue: false, stdout: "", stderr: String(e) });
      return;
    }

    let stdout = "", stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));

    // `tue` porte la cause. Sans elle, un timeout se deduitait de l'absence
    // d'evenement et d'une sortie vide, alors qu'opencode ecrit sur stderr avant
    // d'etre tue : le timeout se faisait alors passer pour un refus du modele.
    let tue = false;
    const t = setTimeout(() => {
      tue = true;
      child.kill();
    }, delaiMs);

    child.on("error", (e) => {
      clearTimeout(t);
      resolve({ code: null, enoent: e.code === "ENOENT", tue, stdout, stderr: String(e) });
    });
    child.on("close", (code) => {
      clearTimeout(t);
      resolve({ code, enoent: false, tue, stdout, stderr });
    });
  });
}

// ---------------------------------------------------------------------------
// Appel
// ---------------------------------------------------------------------------

/**
 * Interroge un modele et renvoie sa reponse sous forme structuree.
 *
 * Ne leve jamais : un echec est un statut. Un harnais qui planterait sur un
 * modele indisponible ne pourrait pas distinguer l'echec de l'agent de la panne
 * de l'orchestrateur, qui appellent des corrections opposees.
 *
 * @param {object} o
 * @param {string} o.modele        identifiant provider/modele
 * @param {string} o.prompt        texte envoye au modele
 * @param {string} [o.cwd]         repertoire de travail du sous-agent
 * @param {string[]} [o.fichiers]  fichiers joints au prompt
 * @param {number} [o.delaiMs]     delai max, defaut DELAI_PAR_DEFAUT
 * @returns {Promise<{ok:boolean, statut:string, texte:string, evenements:object[],
 *                    erreur:string|null, dureeMs:number, modele:string}>}
 */
export async function interroger({
  modele = REPLI,
  prompt,
  cwd,
  fichiers = [],
  delaiMs = DELAI_PAR_DEFAUT,
} = {}) {
  const t0 = Date.now();
  const base = {
    modele,
    texte: "",
    evenements: [],
    erreur: null,
    dureeMs: 0,
  };

  if (typeof prompt !== "string" || !prompt.trim()) {
    return { ...base, ok: false, statut: "prompt_vide", dureeMs: 0,
             erreur: "prompt vide : rien a envoyer au modele" };
  }

  const binaire = await resoudreBinaire();
  if (!binaire) {
    return { ...base, ok: false, statut: "binaire_absent",
             erreur: "binaire opencode introuvable. Definir OPENCODE_BIN, ou installer opencode." };
  }

  const args = ["run", "--pure", "--format", "json", "-m", modele];
  if (cwd) args.push("--dir", cwd);
  for (const f of fichiers) args.push("-f", f);
  args.push(prompt);

  const r = await lancerBrut(binaire, args, delaiMs);
  const dureeMs = Date.now() - t0;

  if (r.enoent) {
    return { ...base, ok: false, statut: "binaire_absent", dureeMs, erreur: r.stderr };
  }

  // Le timeout se lit sur le drapeau du kill, jamais sur l'absence de sortie :
  // c'est la seule information qui distingue "trop lent" de "refuse".
  if (r.tue) {
    return {
      ...base,
      ok: false,
      statut: "timeout",
      dureeMs,
      erreur:
        `aucune reponse en ${Math.round(delaiMs / 1000)}s (delai ${delaiMs}ms). ` +
        `Un agent qui lit le depot demande plus long qu'une sonde : lever le delai.`,
    };
  }

  if (r.code !== 0) {
    const evenements = lireEvenements(r.stdout);
    const evtErr = evenements.find((e) => e.type === "error");
    return {
      ...base,
      ok: false,
      statut: "modele_indisponible",
      dureeMs,
      evenements,
      erreur: evtErr
        ? `${evtErr.error?.name || "Error"} : ${evtErr.error?.data?.message || JSON.stringify(evtErr.error)}`
        : r.stderr.trim() || `code de sortie ${r.code}`,
    };
  }

  const evenements = lireEvenements(r.stdout);
  const texte = extraireTexte(evenements);

  if (!texte.trim()) {
    return { ...base, ok: false, statut: "reponse_vide", dureeMs, evenements,
             erreur: "l'appel a reussi mais aucun evenement `text` n'a ete emis" };
  }

  return { ...base, ok: true, statut: "ok", texte, evenements, dureeMs };
}

/**
 * Ne conserve que les lignes JSON. opencode ecrit aussi des lignes de log sur
 * stdout dans certaines conditions : une ligne illisible doit etre ignoree, pas
 * faire echouer la lecture.
 */
function lireEvenements(sortie) {
  const evenements = [];
  for (const ligne of sortie.split(/\r?\n/)) {
    const t = ligne.trim();
    if (!t.startsWith("{")) continue;
    try {
      evenements.push(JSON.parse(t));
    } catch {
      /* ligne partielle ou journal : sans consequence sur la reponse */
    }
  }
  return evenements;
}

/**
 * Concatene les evenements `text` dans l'ordre. Un modele peut emettre plusieurs
 * morceaux ; les separer perdrait les tokens situes a la frontiere.
 */
function extraireTexte(evenements) {
  return evenements
    .filter((e) => e.type === "text" && typeof e.part?.text === "string")
    .map((e) => e.part.text)
    .join("");
}

// ---------------------------------------------------------------------------
// Verification du bassin
// ---------------------------------------------------------------------------
//
// Le catalogue de modeles gratuits ne dit pas quels modeles repondent sans
// identifiant : le suffixe `-free` decrit un palier de prix, pas l'absence
// d'authentification. Sans identifiant, une partie du catalogue echoue. Declarer
// un bassin sans l'avoir teste revient a repartir de la meme erreur.
//
//   node config/orchestration/pont-llm.mjs verifier

if (process.argv[1] && process.argv[1].endsWith("pont-llm.mjs") &&
    process.argv[2] === "verifier") {
  console.log("\nBassin de modeles - test reel de chaque entree\n");
  const resultats = [];

  // Un test par modele, en parallele : le bassin n'existe que pour
  // l'interroger en parallele, il doit donc survivre a sa propre utilisation.
  const resultatsPromis = BASSIN.map(async (b) => {
    const r = await interroger({
      modele: b.modele,
      prompt: "Reponds exactement: PONT_OK",
      delaiMs: DELAI_SONDE,
    });
    const rep = { ...b, statut: r.statut, dureeMs: r.dureeMs, reponse: r.texte.trim() };
    resultats.push(rep);
    const marque = r.ok && r.texte.includes("PONT_OK") ? "OK   " : "ECHEC";
    console.log(`  [${marque}] ${b.modele.padEnd(46)} ${String(r.dureeMs).padStart(6)}ms  ${r.statut}`);
    return rep;
  });

  await Promise.all(resultatsPromis);

  const operationnels = resultats.filter((r) => r.statut === "ok");
  console.log(`\n${operationnels.length} operationnel(s) sur ${BASSIN.length}`);
  if (!operationnels.length) {
    console.log(`Aucun modele ne repond. Repli garantie : ${REPLI}`);
    console.log("Sans reponse, aucun sous-agent ne peut demarrer.");
  }
  process.exitCode = operationnels.length ? 0 : 1;
}