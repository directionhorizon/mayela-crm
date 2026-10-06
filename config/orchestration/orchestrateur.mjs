// ============================================================================
// Orchestrateur - chaine de commandement unique du support de dev mayela-crm.
//
// Traduction headless de THE 100TRAL. Ce qui est garde, ce qui change, et
// pourquoi.
//
// GARDE - la chaine. Une entree, une validation, une decomposition, des
// sous-agents, UN gate, des rapports types. La forme qui descend et le rapport
// qui remonte sont les memes, parce que cette forme est ce qui rend deux
// executions comparables.
//
// GARDE - la decomposition par contrat JSON filtre contre une liste blanche,
// avec repli. Repli REPORTE, jamais muet : THE 100TRAL renonce sans le dire.
//
// GARDE - un seul point de decision, capable de dire non. C'est le mecanisme le
// plus utile de toute l'application.
//
// CHANGE - le support. THE 100TRAL appelle Gemini et Firestore. Ici la
// troisieme source est le binaire opencode, en `--pure`, donc le harnais ne
// depend d'aucun credential et d'aucun routage d'agent.
//
// CHANGE - le dispatch. THE 100TRAL replie en serie : `subCommands.forEach { it
// -> executeSingleCommand(it) }`. Aucun parallélisme. C'est la correction la
// plus nette, parce qu'elle est entierement dans le sens du projet.
//
// CHANGE - le ConflicArbitrator reste supprime. Il n'etait appele nulle part.
// Plutot que le reactiver, le gate detecte les rejets sans motif nomme : un
// rejet que l'agent ne peut pas comprendre n'est pas un rejet, c'est un trou.
//
// CE QUE CE HARNais NE FAIT PAS
//
// Il n'ecrit rien dans le code de l'application. Le perimetre par defaut est
// RELECTURE. Une mission qui deborde est refusee, pas executee puis corrigee.
//
// Il ne commit et ne pousse rien. L'etat du chantier est lu et affiche ; le
// refermer reste une decision humaine. Ce sont trois migrations appliquees en
// base sans commit qui justifient cette retenue.
//
// Il ne remplace pas une recette. Le gate juge un rapport sur des criteres de
// forme et de franchise. Il ne peut pas constater qu'un scenario fonctionne :
// c'est le role du test de bout en bout, et `CHECKLIST_TEST_E2E.md` dit encore
// qu'il n'a jamais ete passe.
//
// Il n'a pas de boucle ReAct. THE 100TRAL fait reagir l'agent a ses propres
// appels d'outils. Ici un agent est un appel borne : le sous-agent possede les
// outils de lecture d'opencode et decide lui-meme ce qu'il ouvre. Une boucle
// `TOOL_CALL` par-dessus aurait ajoute un parseur de plus a maintenir sans
// ajouter d'outil - le seul qui justifierait l'existence d'une boucle.
// ============================================================================

import path from "node:path";
import { interroger } from "./pont-llm.mjs";
import { valider, PERIMETRES } from "./porte-entree.mjs";
import { decomposer, MAX_SOUS_TACHES } from "./decomposition.mjs";
import { juger } from "./gate.mjs";
import { construire, statutDepuisVerdict, ligne, agreger, STATUTS } from "./rapport.mjs";
import { etat } from "./etat.mjs";
import { IDS, DOMAINES } from "./domaines.mjs";

const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..");

/**
 * Concurrence maximale.
 *
 * Mesure, pas intuition : le 2026-10-02, huit modeles interroges en parallele
 * repondaient chacun en ~48s contre ~18s isolement. Le quota anonyme est partage,
 * donc le parallélisme reste un gain net - 48s contre 144s en serie - mais au-dela
 * de quelques appels simultanes chaque requete ralentit tout le monde. Trois est
 * le compromis mesure, pas une convention.
 */
export const CONCURRENCE = 3;

/** Codes de sortie. Un seul par issue, pour qu'un script appelant puisse brancher. */
export const SORTIES = {
  ACCOMPLI: 0,
  NON_CONFORME: 1,
  CONFIG: 2,
  SANS_VERDICT: 3,
};

const CONSIGNE_AGENT =
  "Tu es un agent de revue sur le depot mayela-crm. Lis les fichiers dont tu as besoin " +
  "avec tes outils, puis reponds.\n" +
  "Regles :\n" +
  "- Cite fichier et ligne pour chaque affirmation. Une affirmation sans reference est un motif de rejet.\n" +
  "- Distingue ce que tu as reellement lu de ce que tu supposes. Ecris 'non verifie' quand c'est le cas.\n" +
  "- N'annonce aucune verification que tu n'as pas executee.\n" +
  "- N'ecris aucun fichier.\n" +
  "- Conclus par une liste courte de constats, chacun en une phrase.";

/**
 * Execute une sous-tache : un agent, puis le gate qui juge son rapport.
 * @returns {Promise<object>} rapport type
 */
export async function executerSousTache(sousTache, { mission, etatResume }) {
  const prompt = [
    CONSIGNE_AGENT,
    "",
    `Etat du chantier :\n${etatResume}`,
    "",
    `Ta sous-tache, domaine [${sousTache.domaine}] :`,
    sousTache.instruction,
    "",
    "Mission d'origine, pour le contexte :",
    mission,
  ].join("\n");

  const r = await interroger({ modele: sousTache.modele, prompt, cwd: REPO_ROOT });
  if (!r.ok) {
    return construire({
      mission,
      sousTache,
      statut: STATUTS.ECHEC_APPEL,
      modele: sousTache.modele,
      dureeMs: r.dureeMs,
      erreur: r.erreur,
    });
  }

  const verdict = await juger({ sousTache, rapport: r.texte, modele: sousTache.modele });

  return construire({
    mission,
    sousTache,
    texte: r.texte,
    verdict,
    statut: statutDepuisVerdict(verdict),
    modele: sousTache.modele,
    dureeMs: r.dureeMs + verdict.dureeMs,
  });
}

/**
 * Lance des sous-taches avec une concurrence bornee.
 * THE 100TRAL replie en serie ; ici l'ordre d'arrivee n'a pas de sens, donc on
 * libere un slot des que l'un termine.
 */
export async function dispatch(sousTaches, { mission, etatResume, concurrence = CONCURRENCE }) {
  const resultats = new Array(sousTaches.length);
  let suivant = 0;

  async function worker() {
    for (;;) {
      const i = suivant++;
      if (i >= sousTaches.length) return;
      resultats[i] = await executerSousTache(sousTaches[i], { mission, etatResume });
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrence, sousTaches.length) }, worker),
  );
  return resultats;
}

/** Code de sortie unique, derive de l'agregat. */
export function codeDeSortie(agregat) {
  if (agregat.total === 0) return SORTIES.CONFIG;
  if (agregat.accompli) return SORTIES.ACCOMPLI;
  if (agregat.non_conformes === 0 && agregat.sans_verdict > 0) return SORTIES.SANS_VERDICT;
  return SORTIES.NON_CONFORME;
}

// ---------------------------------------------------------------------------
// Commandes
// ---------------------------------------------------------------------------

const COMMANDES = {
  async run(args) {
    const drapeaux = args.filter((a) => a.startsWith("--"));
    const mission = args.filter((a) => !a.startsWith("--")).join(" ").trim();

    const v = valider(mission, {
      accepterEcriture: drapeaux.includes("--ecriture"),
      perimetre: (drapeaux.find((a) => a.startsWith("--perimetre=")) || "").slice(12) || undefined,
    });

    if (!v.ok) {
      console.error(`\nMission refusee - ${v.refus}\n  ${v.raison}\n`);
      return SORTIES.CONFIG;
    }

    console.log(`\nMission : ${v.mission}`);
    console.log(`Perimetre : ${v.perimetre.id} (ecriture : ${v.perimetre.ecriture})\n`);

    console.log("Etat reel du chantier");
    const e = await etat({ net: !drapeaux.includes("--no-net") });
    for (const l of e.resume.split("\n")) console.log(`  ${l}`);

    console.log("\nDecomposition");
    const d = await decomposer({
      mission: v.mission,
      perimetre: v.perimetre,
      etatChantier: e.resume,
    });
    console.log(`  ${d.diagnostic.statut}${d.diagnostic.raison ? " - " + d.diagnostic.raison : ""}`);
    for (const rej of d.diagnostic.rejetes || []) {
      console.log(`  rejete : "${rej.proposition}" (${rej.raison})`);
    }
    for (const s of d.sousTaches) {
      console.log(`  [${s.domaine}] ${s.instruction.slice(0, 96)}${s.repli ? "  (repli: " + s.repli + ")" : ""}`);
    }

    console.log(`\nExecution - ${d.sousTaches.length} sous-tache(s), concurrence ${CONCURRENCE}`);
    const t0 = Date.now();
    const rapports = await dispatch(d.sousTaches, {
      mission: v.mission,
      etatResume: e.resume,
    });
    console.log(`  terminee en ${Math.round((Date.now() - t0) / 1000)}s\n`);

    console.log("Rapports");
    for (const r of rapports) console.log(ligne(r));

    const a = agreger(rapports);
    console.log(
      `\n${a.conformes}/${a.total} conforme(s), ${a.non_conformes} non conforme(s), ` +
        `${a.sans_verdict} sans verdict\n`,
    );
    console.log(a.accompli ? "Mission'accomplie" : "Mission NON accomplie");
    if (drapeaux.includes("--json")) console.log(JSON.stringify({ etat: e, aggregate: a, rapports }, null, 2));

    return codeDeSortie(a);
  },

  async etat(args) {
    const e = await etat({ net: !args.includes("--no-net") });
    console.log("\nEtat reel du chantier\n");
    for (const l of e.resume.split("\n")) console.log(`  ${l}`);
    console.log(
      `\n  suivi   : ${e.suivi.disponible ? "lu" : "indisponible - " + e.suivi.raison}` +
        `${e.suivi.disponible ? `, ${e.suivi.actions_ouvertes} action(s) ouverte(s)` : ""}\n`,
    );
    return 0;
  },

  async list() {
    console.log("\nDomaines de travail\n");
    for (const id of IDS) {
      const d = DOMAINES[id];
      console.log(`  ${id}`);
      console.log(`      ${d.portee}`);
      console.log(`      modele : ${d.modele}\n`);
    }
    console.log(`Perimetres : ${Object.values(PERIMETRES).map((p) => p.id).join(", ")}`);
    console.log(`Sous-taches max : ${MAX_SOUS_TACHES}   Concurrence : ${CONCURRENCE}`);
    console.log(`\n  node config/orchestration/orchestrateur.mjs run "<mission>" [--ecriture] [--no-net] [--json]`);
    console.log(`  node config/orchestration/orchestrateur.mjs etat`);
    console.log(`  node config/orchestration/orchestrateur.mjs list`);
    console.log(`  node config/orchestration/pont-llm.mjs verifier\n`);
    return 0;
  },
};

const [cmd, ...args] = process.argv.slice(2);
const entree = COMMANDES[cmd];

if (!entree) {
  console.log(`
Orchestrateur - support de developpement mayela-crm

  run <mission>    valide, decompose, execute, juge, rend un rapport type
  etat             etat reel du chantier
  list             domaines, perimetres, commandes

  Traduction headless de la logique d'orchestration de THE 100TRAL.
  Aucun fichier de l'application n'est modifie.
`);
  process.exitCode = SORTIES.CONFIG;
} else {
  process.exitCode = (await entree(args)) || 0;
}