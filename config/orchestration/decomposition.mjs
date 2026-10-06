// ============================================================================
// Decomposition - d'une mission a un contrat de sous-taches verifiable.
//
// THE 100TRAL fait decomposer la mission par le LLM en `[{domain, instruction}]`,
// avec trois garde-fous : les domaines sont filtres contre la liste disponible,
// l'experience passee est reinjectee, et un parsing rate se replie sur le premier
// domaine. Les trois sont justes. Deux sont mal codes.
//
//   - Le repli est silencieux. `TaskSplitter` ne dit nulle part qu'il a renonce a
//     comprendre la mission : le resultat est un rapport qui pretend venir d'une
//     decomposition alors qu'il n'y en a pas eu. Ici le repli est un statut
//     affiche, et il abaisse la confiance accordee au gate.
//   - Le contrat n'a pas de schema. Le LLM est invite a produire du JSON sans
//     qu'aucune forme ne soit verifiee, donc un JSON invalide ne se distingue pas
//     d'une reflexion entre deux.
//
// Ce qui change aussi : THE 100TRAL replie la ou le LLM a repondu, c'est-a-dire
// ou il a echoue. Ici le repli ne s'applique qu'apres avoir tente une
// recuperation du JSON depuis la reponse brute, parce que les evenements
// `--format json` sont structures mais le *contenu* produit par le modele reste
// du texte libre.
// ============================================================================

import { interroger, REPLI } from "./pont-llm.mjs";
import { blocDomaines, normaliser, DOMAINES } from "./domaines.mjs";
import { blocMission } from "./porte-entree.mjs";
import { blocMemoire } from "./memoire.mjs";
import path from "node:path";

const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..");

/** Nombre maximum de sous-taches. Au-dela, on decompose pour decomposer. */
export const MAX_SOUS_TACHES = 4;

/**
 * Domaine de repli. AUDIT parce qu'il est le seul qui convienne a toutes les
 * missions en mode relecture, y compris celle dont la nature n'a pas ete comprise.
 */
export const DOMAINE_REPLI = "AUDIT";

const INSTRUCTION =
  "Reponds par un unique tableau JSON, sans texte autour, sans commentaire.\n" +
  `Format exact : [{"domaine":"<IDENTIFIANT>","instruction":"<une phrase imperative>"}]\n` +
  `Entre 1 et ${MAX_SOUS_TACHES} elements. Le champ domaine doit reprendre un identifiant de la liste, a l'identique.\n` +
  "Chaque instruction doit etre verifiable : elle dit ce qu'il faut etablir, pas ce qu'il faut faire.";

/**
 * Decompose une mission en sous-taches.
 *
 * @param {object} o
 * @param {string} o.mission         mission deja validee par la porte d'entree
 * @param {object} o.perimetre       perimetre renvoye par `valider()`
 * @param {string} [o.etatChantier]  etat courant, reinjecte depuis EN_ATTENTE.md
 * @param {string} [o.modele]
 * @returns {Promise<object>} rapport de decomposition, jamais une exception
 */
export async function decomposer({
  mission,
  perimetre,
  etatChantier = "",
  modele = REPLI,
} = {}) {
  const prompt = [
    blocMission(mission, perimetre),
    "",
    blocDomaines(),
    "",
    blocMemoire({ etatChantier }),
    "",
    INSTRUCTION,
  ].join("\n");

  const r = await interroger({ modele, prompt, cwd: REPO_ROOT });

  if (!r.ok) {
    return {
      ok: false,
      sousTaches: [repli(mission, "appel_echoue")],
      diagnostic: { statut: "appel_echoue", raison: r.erreur, rejetes: [] },
      dureeMs: r.dureeMs,
    };
  }

  const extraits = extraireTableau(r.texte);
  if (!extraits.ok) {
    return {
      ok: true,
      sousTaches: [repli(mission, "json_illisible")],
      diagnostic: { statut: "json_illisible", raison: extraits.raison, rejetes: [] },
      dureeMs: r.dureeMs,
    };
  }

  const { sousTaches, rejetes } = validerSousTaches(extraits.valeur);

  if (!sousTaches.length) {
    return {
      ok: true,
      sousTaches: [repli(mission, "aucun_domaine_valide")],
      diagnostic: {
        statut: "aucun_domaine_valide",
        raison: `${rejetes.length} proposition(s), aucune avec un domaine de la liste`,
        rejetes,
      },
      dureeMs: r.dureeMs,
    };
  }

  return {
    ok: true,
    sousTaches,
    diagnostic: {
      statut: rejetes.length ? "partiellement_filtre" : "ok",
      raison: rejetes.length
        ? `${rejetes.length} proposition(s) rejetee(s) par le filtre de domaines`
        : "",
      rejetes,
    },
    dureeMs: r.dureeMs,
  };
}

// ---------------------------------------------------------------------------
// Recuperation du JSON
// ---------------------------------------------------------------------------

/**
 * Retrouve le premier tableau JSON balanced dans une reponse libre.
 *
 * Un LLM encadre souvent sa reponse d'un bloc ```json, ou l'accompagne d'une
 * phrase d'introduction. Partir de `JSON.parse(reponse)` echouerait sur les deux
 * cas, alors que l'information est la. On retire donc les fences, puis on
 * cherche le `[` dont le `]` correspondant existe en tenant compte des chaines
 * et des echappements - un `]` dans une instruction ne ferme pas le tableau.
 */
function extraireTableau(texte) {
  const sansFence = texte.replace(/```(?:json)?\s*([\s\S]*?)```/gi, "$1");

  for (const candidat of [sansFence, texte]) {
    const debut = candidat.indexOf("[");
    if (debut === -1) continue;

    const fin = crochetsBalance(candidat, debut);
    if (fin === -1) continue;

    try {
      const valeur = JSON.parse(candidat.slice(debut, fin + 1));
      if (Array.isArray(valeur)) return { ok: true, valeur };
    } catch (e) {
      // Le bloc trouve n'est pas du JSON valide : un autre `[` plus loin peut
      // l'etre. On continue plutot que d'abandonner.
    }
  }
  return { ok: false, raison: "aucun tableau JSON balanced et analysable dans la reponse" };
}

function crochetsBalance(texte, debut) {
  let profondeur = 0;
  let enChaine = false;
  let echappe = false;

  for (let i = debut; i < texte.length; i++) {
    const c = texte[i];

    if (echappe) { echappe = false; continue; }
    if (c === "\\") { echappe = true; continue; }
    if (c === '"') { enChaine = !enChaine; continue; }
    if (enChaine) continue;

    if (c === "[") profondeur++;
    else if (c === "]") {
      profondeur--;
      if (profondeur === 0) return i;
    }
  }
  return -1;
}

// ---------------------------------------------------------------------------
// Filtre de domaines
// ---------------------------------------------------------------------------

/**
 * Filtre les propositions contre la liste blanche.
 *
 * THE 100TRAL ecarte en silence ce qui ne correspond pas. Ici chaque rejet est
 * enregistre : un LLM qui invente un domaine signale soit une liste mal ecrite,
 * soit une mission qui sort du perimetre des domaines. Les deux meritent d'etre
 * vues, et les deux sont invisibles si le filtre est muet.
 */
function validerSousTaches(brut) {
  const sousTaches = [];
  const rejetes = [];
  const vues = new Set();

  for (const item of brut) {
    if (!item || typeof item !== "object") {
      rejetes.push({ proposition: JSON.stringify(item).slice(0, 120), raison: "pas un objet" });
      continue;
    }

    const domaine = normaliser(item.domaine);
    if (!domaine) {
      rejetes.push({
        proposition: String(item.domaine ?? "").slice(0, 80),
        raison: `domaine hors liste (${IDS_AFFICHAGE()})`,
      });
      continue;
    }

    const instruction = String(item.instruction ?? "").trim();
    if (!instruction) {
      rejetes.push({ proposition: domaine, raison: "instruction vide" });
      continue;
    }

    const cle = `${domaine}::${instruction.toLowerCase()}`;
    if (vues.has(cle)) continue;
    vues.add(cle);

    sousTaches.push({
      domaine,
      instruction: instruction.slice(0, 600),
      modele: DOMAINES[domaine].modele,
    });
  }

  return { sousTaches: sousTaches.slice(0, MAX_SOUS_TACHES), rejetes };
}

function IDS_AFFICHAGE() {
  return Object.keys(DOMAINES).join(", ");
}

function repli(mission, motif) {
  return {
    domaine: DOMAINE_REPLI,
    instruction: mission.slice(0, 600),
    modele: DOMAINES[DOMAINE_REPLI].modele,
    repli: motif,
  };
}