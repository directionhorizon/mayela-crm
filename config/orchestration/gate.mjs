// ============================================================================
// Gate - le seul point qui decide si un travail est accompli.
//
// C'est le mecanisme qui manque le plus a ce projet, et la raison du cycle qui
// dure : on decouvre un probleme, on presente des options, on choisit, on
// decouvre un probleme plus fin, et rien ne tranche jamais. THE 100TRAL, lui, a
// un point unique qui peut dire "conforme" comme "non conforme", dans les deux
// sens.
//
// Son `QualityControlAgent` judge avec `evaluation.contains("NON", ignoreCase =
// true)`. Le test est cassable dans les deux directions :
//
//   - "il n'y a aucune non-conformite" contient "NON" -> travail rejete a tort ;
//   - une reponse qui n'evoque pas NON mais ne dit pas OUI non plus tombe dans
//     le `else`, qui est_APPROBATION. Un verdict illisible vaut donc acceptation.
//
// Deux corrections, et ce sont les seules choses qui comptent ici.
//
//   1. Le verdict doit etre ANCRE. On exige une derniere ligne litterale, et on
//      ne lit que celle-la. "NON" au milieu d'une phrase ne peut plus rien
//      decider, et "NON" dans un raisonnement ne contredit plus la conclusion.
//
//   2. ILLISIBLE ne vaut jamais approbation. Un gate qui doit contexte reste
//      muet quand la reponse ne porte pas de verdict. Ici l'absence de verdict
//      rend `conforme: null`, que l'orchestrateur traite comme un echec - mais
//      comme un echec distinct d'un rejet, parce que les deux appellent des
//      corrections differentes.
//
// Le gate a aussi des criteres. Un gate sans criteres est du theatre : il ne
// peut que dire "c'est bien" ou "c'est mal" sans jamais dire pourquoi, donc
// l'agent rejette ne sait pas quoi corriger. Les criteres sont donc nommes et
// restitues, et ils sont ceux des echecs reels de ce projet : une affirmation
// sans reference, une verification annoncee sans avoir ete faite, un chiffre
// lu dans un etat different de celui d'aujourd'hui.
// ============================================================================

import { interroger, REPLI } from "./pont-llm.mjs";
import path from "node:path";

const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..");

export const VERDICTS = {
  CONFORME: "conforme",
  NON_CONFORME: "non_conforme",
  ILLISIBLE: "illisible",
  APPEL_ECHEC: "appel_echoue",
};

const ANCRE = /^(?:VERDICT|DECISION)\s*:\s*(CONFORME|NON_CONFORME)\s*$/i;

/**
 * Criteres appliques a tout rapport de ce projet.
 * Volontairement peu nombreux et tous verifiables sur le texte du rapport.
 */
const CRITERES = [
  {
    id: "reference",
    exigence: "Chaque affirmation porte une reference : fichier, ou ligne, ou commande et sa sortie.",
    test: /\.(mjs|ts|html|sql|md|json)\b|:\d+|ligne\s+\d+/i,
  },
  {
    id: "distinction",
    exigence:
      "Ce qui a ete observe est distingue de ce qui est suppose. Un rapport qui ne peut " +
      "nommer ce qu'il a reellement lu ne vaut pas verification.",
    test: null, //juges par le modele, voir plus bas
  },
  {
    id: "franchise",
    exigence:
      "Aucune verification n'est annoncee comme faite si elle ne l'a pas ete. Declarer " +
      "un controle passe sans l'avoir execute est le defaut principal a eviter.",
    test: null,
  },
];

/**
 * Fait juger un rapport par le gate.
 *
 * @param {object} o
 * @param {object} o.sousTache  sous-tache issue de la decomposition
 * @param {string} o.rapport    texte rendu par l'agent
 * @param {string} [o.modele]   modele du juge, distinct de celui de l'agent
 * @returns {Promise<object>} verdict structure, jamais une exception
 */
export async function juger({ sousTache, rapport, modele = REPLI } = {}) {
  const { DELAI_GATE } = await import("./pont-llm.mjs");
  if (!rapport || !String(rapport).trim()) {
    return {
      verdict: VERDICTS.ILLISIBLE,
      conforme: null,
      motifs: [],
      raison: "rapport vide : rien a juger",
      dureeMs: 0,
    };
  }

  // Un rapport sans aucune reference est rejete sans interroger le modele. C'est
  // le seul cas decidable localement, et c'est le plus frequent : une affirmation
  // sourdee est rejetee par construction, quel que soit le modele qui juge.
  const sansReference = !CRITERES[0].test.test(rapport);
  if (sansReference) {
    return {
      verdict: VERDICTS.NON_CONFORME,
      conforme: false,
      motifs: [
        {
          id: "reference",
          exigence: CRITERES[0].exigence,
          constant: "Aucune reference de fichier, de ligne ou de commande dans le rapport.",
        },
      ],
      raison: "rejete sans appel au modele : le rapport ne cite rien",
      dureeMs: 0,
    };
  }

  const prompt = [
    "Tu es le gate. Tu juge un rapport sur des criteres, tu ne le refais pas.",
    "",
    `Sous-tache : [${sousTache.domaine}] ${sousTache.instruction}`,
    "",
    "Criteres :",
    ...CRITERES.map((c, i) => `${i + 1}. (${c.id}) ${c.exigence}`),
    "",
    "Rapport a juger :",
    "---",
    String(rapport).slice(0, 4000),
    "---",
    "",
    "Reponds en deux temps, et rien d'autre.",
    "1. Une ligne par critere non satisfait, au format `MOTIF <id> : <phrase>`. Rien si tous sont satisfaits.",
    `2. Une derniere ligne, litteralement \`VERDICT: ${"CONFORME"}\` ou \`VERDICT: ${"NON_CONFORME"}\`.`,
    "",
    "La derniere ligne est lue verbatim. Elle doit etre ecrite telle quelle, sans ponctuation ni reformulation.",
  ].join("\n");

  const r = await interroger({ modele, prompt, cwd: REPO_ROOT });

  if (!r.ok) {
    return {
      verdict: VERDICTS.APPEL_ECHEC,
      conforme: null,
      motifs: [],
      raison: `gate impossible : ${r.erreur}`,
      dureeMs: r.dureeMs,
    };
  }

  return interpreter(r.texte, r.dureeMs);
}

/**
 * Lit le verdict. La derniere ligne non vide qui ressemble a une ancre decide,
 * et rien d'autre. Les motifs sont lus ligne a ligne, mais un motif sans
 * identifiant connu est ignore : on ne retient pas un motif invente par le juge.
 */
function interpreter(texte, dureeMs) {
  const lignes = String(texte).split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  let ancre = null;
  for (let i = lignes.length - 1; i >= 0; i--) {
    const m = lignes[i].match(ANCRE);
    if (m) {
      ancre = { verdict: m[1].toUpperCase() === "CONFORME" ? "CONFORME" : "NON_CONFORME", ligne: lignes[i] };
      break;
    }
  }

  const motifs = [];
  for (const l of lignes) {
    const m = l.match(/^MOTIF\s+([a-z_]+)\s*:\s*(.+)$/i);
    if (!m) continue;
    const id = m[1].toLowerCase();
    const connu = CRITERES.find((c) => c.id === id);
    if (!connu) continue; // motif invente par le juge : ignore, pas recite
    motifs.push({ id, exigence: connu.exigence, constant: m[2].trim() });
  }

  // Aucun verdict porte : le gate n'a pas tranche. Ce n'est pas une approbation.
  if (!ancre) {
    return {
      verdict: VERDICTS.ILLISIBLE,
      conforme: null,
      motifs,
      raison: `aucune ligne VERDICT: CONFORME|NON_CONFORME en ${lignes.length} ligne(s) de reponse`,
      dureeMs,
    };
  }

  // Un rejet sans motif ne peut pas etre corrige : l'agent ne saurait pas quoi
  // refaire. On le signale plutot que de laisser croire a un rejet motive.
  if (ancre.verdict === "NON_CONFORME" && motifs.length === 0) {
    return {
      verdict: VERDICTS.NON_CONFORME,
      conforme: false,
      motifs: [],
      raison: "rejet sans motif nomme : le gate a tranche mais n'a pas dit quoi corriger",
      dureeMs,
    };
  }

  return {
    verdict: ancre.verdict === "CONFORME" ? VERDICTS.CONFORME : VERDICTS.NON_CONFORME,
    conforme: ancre.verdict === "CONFORME",
    motifs,
    raison: "",
    dureeMs,
  };
}