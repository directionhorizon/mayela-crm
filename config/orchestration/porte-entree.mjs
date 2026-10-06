// ============================================================================
// Porte d'entree unique - ou toute mission entre dans le harnais.
//
// THE 100TRAL concentre la reception dans `MainServer.handleUserRequest`, qui
// valide la requete puis la route. Ce n'est pas un detail de commodite : c'est
// la garantie qu'aucun appelant ne contourne la validation. Ici la garantie
// equivalente tient a deux points :
//
//   1. `valider()` est le seul chemin d'entree du harnais. La mission est
//      normalisee une fois, et tout ce qui est en aval recoit un objet valide.
//   2. Le perimetre d'ecriture est decide ici, une fois, et il est explicite.
//      THE 100TRAL filtre le PII et le prompt injection ; l'analogue utile ici
//      n'est pas le prompt injection - l'appelant est l'agent qui ecrit le
//      harnais - mais deux risques reels : une mission qui emporte un secret
//      vers un modele distant, et une mission qui pretend modifier le code de
//      l'application alors que ce harnais est externe et ne doit pas le faire.
//
// La longueur maximale reprend celle de THE 100TRAL (4000 caracteres) : au-dela,
// la mission n'est plus une mission, et le modele la tronque de toute facon.
// ============================================================================

/** Refus-structured : un refus a toujours une raison nommee, jamais un boolen nu. */
export const REFUS = {
  VIDE: "mission_vide",
  TROP_LONGUE: "mission_trop_longue",
  SECRET_PRESENT: "secret_dans_la_mission",
  HORS_PERIMETRE: "ecriture_hors_perimetre",
};

export const LONGUEUR_MAX = 4000;

/**
 * Perimetres d'ecriture.
 *
 * RELECTURE est le defaut et le seul qui ne touche pas au code de l'application.
 * C'est la position de THE 100TRAL : un orchestrateur observe et rend un rapport,
 * il n'ecrit pas dans le produit livre.
 */
export const PERIMETRES = {
  RELECTURE: {
    id: "relecture",
    ecriture: false,
    description: "Aucune ecriture. Analyse, rapport, gate. Le code de l'application est hors d'atteinte.",
  },
  OUTILLAGE: {
    id: "outillage",
    ecriture: true,
    description: "Ecriture dans config/ uniquement : scripts de verification, documentation de chantier.",
  },
};

/**
 * Motifs qui signalent un secret dans une mission.
 * Volontairement etroits : un faux positif bloque une mission legitime, un faux
 * negatif laisse partir une cle en clair vers un modele distant. En cas de doute
 * on prefere bloquer, parce que le secret est irrecuperable et la mission est
 * rejouable.
 */
const SECRET = [
  { re: /service_role/i, quoi: "cle service_role Supabase" },
  { re: /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\./, quoi: "jeton JWT" },
  { re: /\bsk-[A-Za-z0-9]{20,}/, quoi: "cle API prefixee sk-" },
  { re: /\bSUPABASE_ACCESS_TOKEN\s*=\s*\S{20,}/, quoi: "jeton d'acces Supabase" },
  { re: /\bpostgres(ql)?:\/\/[^:]+:[^@]+@/i, quoi: "identifiants dans une URL de connexion" },
];

/**
 * Valide et normalise une mission.
 *
 * Ne leve jamais : un refus est une valeur de retour. Le harnais doit pouvoir
 * distinguer la mission malformee de l'orchestrateur casse, qui appellent des
 *
 * @param {string} missionBrute
 * @param {object} [o]
 * @param {string} [o.perimetre]   identifiant de PERIMETRES
 * @param {boolean} [o.accepterEcriture]  eleve le perimetre a OUTILLAGE
 * @returns {{ok:boolean, mission?:string, perimetre?:object, refus?:string, raison?:string}}
 */
export function valider(missionBrute, { perimetre, accepterEcriture = false } = {}) {
  if (typeof missionBrute !== "string") {
    return { ok: false, refus: REFUS.VIDE, raison: "mission absente ou non textuelle" };
  }

  const mission = missionBrute.trim();
  if (!mission) return { ok: false, refus: REFUS.VIDE, raison: "mission vide apres trim" };

  if (mission.length > LONGUEUR_MAX) {
    return {
      ok: false,
      refus: REFUS.TROP_LONGUE,
      raison: `${mission.length} caracteres, maximum ${LONGUEUR_MAX}. Au-dela, ce n'est plus une mission.`,
    };
  }

  for (const s of SECRET) {
    if (s.re.test(mission)) {
      return {
        ok: false,
        refus: REFUS.SECRET_PRESENT,
        raison: `${s.quoi} detecte. Le harnais envoie la mission a un modele distant : un secret y partirait sans retour possible.`,
      };
    }
  }

  const choisi = choisirPerimetre(perimetre, accepterEcriture);
  if (!choisi) {
    return { ok: false, refus: "perimetre_inconnu", raison: `perimetre "${perimetre}" non declare` };
  }

  return { ok: true, mission, perimetre: choisi };
}

function choisirPerimetre(perimetre, accepterEcriture) {
  if (perimetre) return PERIMETRES[perimetre] || null;
  return accepterEcriture ? PERIMETRES.OUTILLAGE : PERIMETRES.RELECTURE;
}

/** Rend la mission injectee dans un prompt, avec son perimetre rappele au modele. */
export function blocMission(mission, perimetre) {
  const ecrit =
    perimetre.ecriture
      ? "Tu peux ecrire dans config/ uniquement. mayela-crm.html et supabase/functions/ sont hors d'atteinte."
      : "Tu ne dois ecrire aucun fichier. Tu rends une analyse et un rapport.";
  return `Mission :\n${mission}\n\n${ecrit}`;
}