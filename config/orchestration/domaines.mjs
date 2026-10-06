// ============================================================================
// Domaines de travail - la liste blanche qui borne la decomposition.
//
// THE 100TRAL route les sous-taches par `domain`, une `String` libre, comparee
// a `availableDomains.contains(domain)`. Le filtre existe deja, mais comme le
// nom lui vient du LLM sous forme de texte libre, la comparaison se fait sur une
// chaine non normalisee. Un LLM qui repond "Schema" au lieu de "SCHEMA"
// declenche le repli, et un LLM qui invente "SECURITE" quand la liste contient
// "SECURITY" est rejete sans que personne ne sache qu'il a propose.
//
// Ici la liste est un enum, et l'instruction envoyee au LLM en reprend les
// identifiants exacts. Un domaine invente n'est donc pas improbable : il est
// rejete proprement, et le rejet est journalise plutot que silencieux.
//
// Les domaines sont des zones de travail sur le projet mayela-crm, pas des
// metier du CRM : c'est un support de developpement, pas un outil de gestion.
// ============================================================================

export const DOMAINES = {
  SCHEMA: {
    modele: "opencode/nemotron-3-ultra-free",
    portee: "Base Supabase : tables, colonnes, index, migrations SQL, Evolution de schema.",
  },
  SECURITE: {
    modele: "opencode/nemotron-3-ultra-free",
    portee: "RLS, cloisonnement entre espaces, mode solo, secrets, surface d'attaque.",
  },
  BACKEND: {
    modele: "opencode/mimo-v2.6-flash-free",
    portee: "Edge Functions Deno TypeScript de supabase/functions, appels API tiers.",
  },
  FRONTEND: {
    modele: "opencode/fledge-alpha-free",
    portee: "mayela-crm.html : HTML, CSS, JS vanilla, service worker, PWA, responsive.",
  },
  RECETTE: {
    modele: "opencode/space-bunny-free",
    portee: "Test de bout en bout, CHECKLIST_TEST_E2E.md, scenarios de demonstration.",
  },
  DOCS: {
    modele: "opencode/longcat-2.5-preview-free",
    portee: "Documentation, SCHEMA_SUPABASE.md, NOTES_TECHNIQUES.md, suivi de chantier.",
  },
  OPS: {
    modele: "opencode/mimo-v2.6-flash-free",
    portee: "Deploiement Vercel, versionnement du cache, hooks git, variables d'environnement.",
  },
  AUDIT: {
    modele: "opencode/nemotron-3.5-lightning-free",
    portee: "Revue de code, ecarts entre intention documentee et code reel, dette technique.",
  },
};

/** Identifiants acceptables, dans un ordre stable : l'ordre d'affichage du prompt. */
export const IDS = Object.keys(DOMAINES);

/**
 * Normalise une proposition de domaine venue du LLM.
 * Les LLM repondent tantot "FRONTEND", tantot "Frontend", tantot " front end ".
 * Sans normalisation, une reponse correcte sur le fond est rejettee sur la forme.
 * @param {string} brut
 * @returns {string|null} identifiant canonique, ou null si inconnu
 */
export function normaliser(brut) {
  if (typeof brut !== "string") return null;
  const compact = brut.trim().toUpperCase().replace(/[^A-Z]/g, "");
  return IDS.includes(compact) ? compact : null;
}

/**
 * Le bloc de domaines insere dans le prompt de decomposition.
 * Reproduit explicitement les identifiants : c'est la liste blanche qui est
 * donnee au modele, pas seulement celle contre laquelle on verifie ensuite.
 */
export function blocDomaines() {
  const lignes = IDS.map((id) => {
    const d = DOMAINES[id];
    const portee = d.portee.length > 90 ? `${d.portee.slice(0, 87)}...` : d.portee;
    return `  - ${id} : ${portee}`;
  });
  return (
    "Domaines autorises, a reprendre tels quels :\n" +
    lignes.join("\n") +
    "\n\nUn seul de ces identifiants, exactement. Aucun autre n'existe."
  );
}