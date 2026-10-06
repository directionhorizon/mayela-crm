// ============================================================================
// Memoire - ce que le harnais relit avant de planifier.
//
// THE 100TRAL replique l'experience passee dans les prompts de decomposition
// (`MemoryStorage.searchKnowledge("", "MANAGEMENT_OPTIMIZATION")`). C'est le
// mecanisme qui casse le cycle "on discover un probleme, on choisit une option,
// on decouvre un probleme plus fin" : si les echecs passes ne sont pas relus
// au moment de planifier, ils ne servent a rien.
//
// La difference d'adaptation porte sur le support. Firestore suppose un compte,
// un reseau et une cle : un tiers de dependances pour ce qui est de l'appel.
// Ici la memoire est un journal JSONL dans le depot :
//
//   - elle est lisible par un humain, donc relisable quand le harnais est muet ;
//   - elle est versionnee, donc on peut voir ce qui a change de decision ;
//   - elle n'a pas d'etat externe qui peut diverger de l'etat du depot.
//
// Une entree de trop fait echouer la lecture entiere, et le harnais perd alors
// toute memoire sans rien dire. Chaque ligne est donc validee isolement, et une
// ligne corrompue est comptee plutot que silencieusement consommee.
// ============================================================================

import { existsSync, mkdirSync, appendFileSync, readFileSync } from "node:fs";
import path from "node:path";

const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..");
export const DOSSIER = path.join(REPO_ROOT, "config", "orchestration", "memoire");
export const JOURNAL = path.join(DOSSIER, "journal.jsonl");

/**
 * Plafond de lecture, par type. Rien n'est efface : le fichier peut grossir,
 * seul le contexte reinjecte est borne. Un prompt sans borne finit par deborder
 * la fenetre du modele, et les instructions de tete sont les premieres oubliees.
 */
export const PLAFOND = { decision: 12, echec: 12 };

const TYPES = new Set(["decision", "echec"]);

/**
 * Ajoute une entree. Ne leve pas : un echec d'ecriture doit etre signale sans
 * interrompre une mission deja lancee.
 * @returns {{ok:boolean, raison?:string}}
 */
export function retenir({ type, domaine, titre, detail }) {
  if (!TYPES.has(type)) {
    return { ok: false, raison: `type "${type}" non declare (attendu : ${[...TYPES].join(", ")})` };
  }
  if (!titre || !String(titre).trim()) {
    return { ok: false, raison: "titre vide : une entree sans titre n'est pas relisible" };
  }

  const entree = {
    ts: new Date().toISOString(),
    type,
    domaine: domaine || null,
    titre: String(titre).trim().slice(0, 160),
    detail: detail ? String(detail).trim().slice(0, 1200) : "",
  };

  try {
    mkdirSync(DOSSIER, { recursive: true });
    appendFileSync(JOURNAL, JSON.stringify(entree) + "\n", "utf8");
    return { ok: true };
  } catch (e) {
    return { ok: false, raison: `ecriture impossible : ${e.message}` };
  }
}

/**
 * Relit le journal, du plus recent au plus ancien, borne par type.
 * @returns {{entrees:object[], corrompues:number, total:number}}
 */
export function relire() {
  if (!existsSync(JOURNAL)) return { entrees: [], corrompues: 0, total: 0 };

  let lignes;
  try {
    lignes = readFileSync(JOURNAL, "utf8").split(/\r?\n/).filter((l) => l.trim());
  } catch (e) {
    // Un journal illisible ne doit pas faire echouer une mission, mais il ne
    // doit pas non plus disparaitre sans trace : le rappel est vide, et l'appelant
    // voit qu'il n'a rien relu.
    return { entrees: [], corrompues: 0, total: 0, erreur: `lecture impossible : ${e.message}` };
  }

  const toutes = [];
  let corrompues = 0;

  for (const ligne of lignes) {
    try {
      const e = JSON.parse(ligne);
      if (e && typeof e.titre === "string" && TYPES.has(e.type)) toutes.push(e);
      else corrompues++;
    } catch {
      corrompues++;
    }
  }

  return { entrees: toutes, corrompues, total: lignes.length };
}

/**
 * Le bloc reinjecte dans le prompt de decomposition.
 *
 * Les echecs passent en premier, et explicitement : un modele qui lit une liste
 * de decisions prend connaissance de ce qui a ete arrete ; un modele qui lit une
 * liste d'echecs comprend ce qui ne doit pas etre repete. Melanger les deux
 * produirait un bruit dont personne ne tire de consequence.
 *
 * L'etat courant du chantier est injecte separement, depuis la source qui fait
 * deja autorite dans le depot (`docs/suivi/EN_ATTENTE.md`).
 *
 * @returns {string} bloc a inserer dans un prompt, vide si rien a dire
 */
export function blocMemoire({ etatChantier = "" } = {}) {
  const { entrees, corrompues, erreur } = relire();
  const morceaux = [];

  if (erreur) morceaux.push(`Memoire illisible : ${erreur}`);

  const echecs = entrees.filter((e) => e.type === "echec").slice(-PLAFOND.echec);
  const decisions = entrees.filter((e) => e.type === "decision").slice(-PLAFOND.decision);

  if (echecs.length) {
    morceaux.push(
      "Ce qui a deja echoue. Ne le reproduis pas :\n" +
        echecs.map((e) => `  - ${e.domaine ? `[${e.domaine}] ` : ""}${e.titre}`).join("\n"),
    );
  }
  if (decisions.length) {
    morceaux.push(
      "Ce qui a ete decide. Ne le rediscute pas sans raison :\n" +
        decisions.map((e) => `  - ${e.domaine ? `[${e.domaine}] ` : ""}${e.titre}`).join("\n"),
    );
  }
  if (etatChantier.trim()) {
    morceaux.push(`Etat du chantier :\n${etatChantier.trim()}`);
  }
  if (corrompues) {
    morceaux.push(
      `(${corrompues} ligne(s) du journal illisible(s), ignoree(s) - ${corrompues} sur ${corrompues + entrees.length}.)`,
    );
  }

  return morceaux.join("\n\n");
}