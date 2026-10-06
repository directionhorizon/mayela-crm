// ============================================================================
// Rapport type - la forme qui rend deux rapports d'agents comparables.
//
// THE 100TRAL modelise `Command` et `Report` dans `Models.kt`, et fait
// reecrire un rapport conforme pour trois audiences : technique, executive,
// strategique. Les deux idees sont justes.
//
// La premiere manque ici. Un rapport en texte libre n'est pas comparable a un
// autre : deux agents qui ont travaille sur deux domaines rendent des formes
// differentes, donc on ne peut pas lesamentsager mecaniquement, ni les
// recompter en series. On ne peut dire "3 domaines sur 4 conformes" que si les
// quatre rapports ont les memes cles.
//
// La seconde est reprise, avec les audiences reformulees pour un support de
// developpement : un rapport de recette n'a pas les memes lecteurs qu'un rapport
// d'avancement de projet.
//
// L'echec est une valeur, pas une absence. Un rapport porte toujours les memes
// cles, y compris quand l'agent n'a pas repondu : c'est ce qui permet de compter
// les echecs sans les distinguer des rapports disparus.
// ============================================================================

import { VERDICTS } from "./gate.mjs";
import { interroger, REPLI } from "./pont-llm.mjs";

/** Statuts d'un rapport. Un seul de ces valeurs, toujours. */
export const STATUTS = {
  CONFORME: "conforme",
  NON_CONFORME: "non_conforme",
  ILLISIBLE: "illisible",
  ECHEC_APPEL: "echec_appel",
};

const LIBELLES = {
  [STATUTS.CONFORME]: "CONFORME    ",
  [STATUTS.NON_CONFORME]: "NON CONFORME",
  [STATUTS.ILLISIBLE]: "GATE ILLISIBLE",
  [STATUTS.ECHEC_APPEL]: "ECHEC APPEL  ",
};

/**
 * Construit un rapport type. Meme cle, meme type, quel que soit le deroulement.
 * @returns {object} rapport toujours evaluable, jamais `undefined`
 */
export function construire({
  mission,
  sousTache,
  texte = "",
  verdict = null,
  statut = STATUTS.ECHEC_APPEL,
  modele = null,
  dureeMs = 0,
  erreur = null,
} = {}) {
  return {
    ts: new Date().toISOString(),
    mission: mission || "",
    domaine: sousTache?.domaine || null,
    instruction: sousTache?.instruction || "",
    repli: sousTache?.repli || null,
    modele,
    statut,
    rapport: String(texte).trim(),
    motifs: verdict?.motifs || [],
    raison: verdict?.raison || erreur || "",
    dureeMs,
  };
}

/**
 * Statut a partir d'un verdict de gate.
 * Les trois cas non conformes se distinguent : illisible et echec d'appel ne sont
 * pas des rejets de fond, et les traiter comme tels ferait croire a un travail
 * refuse alors que personne n'a repondu.
 */
export function statutDepuisVerdict(verdict) {
  switch (verdict?.verdict) {
    case VERDICTS.CONFORME:
      return STATUTS.CONFORME;
    case VERDICTS.NON_CONFORME:
      return STATUTS.NON_CONFORME;
    case VERDICTS.ILLISIBLE:
      return STATUTS.ILLISIBLE;
    default:
      return STATUTS.ECHEC_APPEL;
  }
}

/** Une ligne par rapport. Utilise par la sortie console et par le triage. */
export function ligne(r) {
  const d = (r.domaine || "?").padEnd(8);
  const s = (LIBELLES[r.statut] || r.statut).padEnd(14);
  const motifs = r.motifs.length ? `  (${r.motifs.length} motif(s))` : "";
  return `  ${d} ${s} ${r.dureeMs}ms  ${r.raison || premierePhrase(r.rapport)}${motifs}`;
}

function premierePhrase(t) {
  const t2 = String(t || "").replace(/\s+/g, " ").trim();
  if (t2.length <= 88) return t2;
  const coupe = t2.slice(0, 88);
  const dernierEspace = coupe.lastIndexOf(" ");
  return `${coupe.slice(0, dernierEspace > 60 ? dernierEspace : 88)}...`;
}

/**
 * Restitue un rapport pour une audience donnee.
 *
 * Ce sont les trois lectures reellement possibles du meme rapport. La redaction
 * ne va pas plus loin : on ne reformule pas le fond, on ne l'abrege pas, on ne le
 * complete pas. Un rapport qui change selon l'audience jusqu'a dire autre chose
 * n'est plus le meme rapport.
 */
export async function pourAudience(rapport, audience, { modele } = {}) {
  const consignes = {
    technique:
      "Pour la personne qui va corriger. Donne les references de fichier et de ligne, " +
      "et l'ordre de correction. Aucun contexte general.",
    decisionnel:
      "Pour la personne qui decide. Donne ce qu'il faut arreter, ce qu'il faut faire, " +
      "et ce qui ne change pas. Pas de detail d'implementation.",
    chantier:
      "Pour le suivi. Donne quel point de docs/suivi/EN_ATTENTE.md bouge, lequel reste " +
      "ouvert, et ce qui est bloque. Deux phrases au plus.",
  };

  const consigne = consignes[audience];
  if (!consigne) {
    return { ok: false, texte: "", raison: `audience inconnue : ${audience}` };
  }

  const r = await interroger({
    modele: modele || REPLI,
    prompt:
      `Reformule ce rapport pour une audience precise, sans changer le fond.\n\n` +
      `Audience : ${audience}\nConsigne : ${consigne}\n\n` +
      `Rapport :\n---\n${rapport.rapport.slice(0, 3000)}\n---`,
  });

  return r.ok
    ? { ok: true, texte: r.texte.trim(), dureeMs: r.dureeMs }
    : { ok: false, texte: "", raison: r.erreur };
}

/**
 * Agregat. Rend la question qu'on se pose toujours : combien de domaines ont
 * ete traites, combien ont ete conformes, et lesquels ne le sont pas.
 */
export function agreger(rapports) {
  const total = rapports.length;
  const parStatut = {};
  for (const r of rapports) parStatut[r.statut] = (parStatut[r.statut] || 0) + 1;

  const conformes = parStatut[STATUTS.CONFORME] || 0;
  const sansVerdict =
    (parStatut[STATUTS.ILLISIBLE] || 0) + (parStatut[STATUTS.ECHEC_APPEL] || 0);

  return {
    total,
    conformes,
    non_conformes: parStatut[STATUTS.NON_CONFORME] || 0,
    sans_verdict: sansVerdict,
    // Un travail n'est accompli que si TOUT est conforme. "Au moins un" ferait
    // passer une mission pour reussie alors que la partie difficile a echoue.
    accompli: total > 0 && conformes === total,
    domaines: rapports.map((r) => ({ domaine: r.domaine, statut: r.statut, motifs: r.motifs.length })),
  };
}