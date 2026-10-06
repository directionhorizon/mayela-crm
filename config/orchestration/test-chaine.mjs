// Test de fumee de la chaine d'orchestration : porte d'entree -> memoire ->
// decomposition. Verifie que le contrat tient sur une mission reelle.
//
//   node config/orchestration/test-chaine.mjs            seme 2 entrees de memoire
//   node config/orchestration/test-chaine.mjs --semer    n'en seme pas de nouvelle
//
// Le test appelle un modele reel : il verifie le pont, pas une chaine de
// simulation. C'est lent (une dezenas de secondes) et c'est deliber - une
// decomposition qui n'a jamais ete executee contre un modele n'est pas un
// contrat, c'est une intention.

import path from "node:path";
import { valider } from "./porte-entree.mjs";
import { decomposer } from "./decomposition.mjs";
import { retenir, blocMemoire, JOURNAL } from "./memoire.mjs";

const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..");

const MISSION =
  "Verifier que les migrations V14, V15 et V16, appliquees en base, sont decrites " +
  "dans config/SCHEMA_SUPABASE.md et versionnees dans git.";

const ETAT = "10 points | 30 actions ouvertes | 41 faites";

console.log("\n=== 1. porte d'entree : mission acceptee ===");
const v = valider(MISSION);
console.log(`  ok        : ${v.ok}`);
console.log(`  perimetre : ${v.perimetre?.id} (ecriture autorisee : ${v.perimetre?.ecriture})`);

console.log("\n=== 2. porte d'entree : refus structures ===");
for (const [cas, libelle] of [
  ["", "mission vide"],
  ["x".repeat(4100), "mission trop longue"],
  [
    "le service_role est eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjMifQ.abc",
    "secret JWT",
  ],
  ["la cle est sk-abcdefghijklmnopqrstuvwxyz012345", "cle sk-"],
]) {
  const r = valider(cas);
  const marque = r.ok ? "[ACCEPTE]" : "[REFUSE ]";
  console.log(`  ${marque} ${libelle.padEnd(20)} -> ${r.refus || "accepte"}`);
}

console.log("\n=== 3. memoire ===");
if (!process.argv.includes("--semer")) {
  retenir({
    type: "echec",
    domaine: "SCHEMA",
    titre: "Verifier la doc du schema apres une migration, jamais avant",
  });
  retenir({
    type: "decision",
    domaine: "DOCS",
    titre: "La doc du schema fait autorite, pas le SQL de la migration",
  });
  console.log("  2 entrees semees (relancer avec --semer pour ne pas en ajouter)");
} else {
  console.log("  entrees deja presentes, aucune semee");
}
console.log(`  journal : ${JOURNAL.replace(REPO_ROOT + path.sep, "")}`);

const bloc = blocMemoire({ etatChantier: ETAT });
console.log(`\n  bloc reinjecte dans le prompt (${bloc.length} caracteres) :`);
for (const l of bloc.split("\n")) console.log(`    ${l}`);

console.log("\n=== 4. decomposition (appel reel a un modele) ===");
const d = await decomposer({ mission: v.mission, perimetre: v.perimetre, etatChantier: ETAT });

console.log(`  ok         : ${d.ok}   duree : ${d.dureeMs}ms`);
console.log(`  diagnostic  : ${d.diagnostic.statut}${d.diagnostic.raison ? " - " + d.diagnostic.raison : ""}`);
if (d.diagnostic.rejetes?.length) {
  console.log("  rejetes par le filtre :");
  for (const r of d.diagnostic.rejetes) console.log(`    - "${r.proposition}" : ${r.raison}`);
}
console.log(`\n  ${d.sousTaches.length} sous-tache(s) retenue(s) :`);
for (const s of d.sousTaches) {
  console.log(`    [${s.domaine}] ${s.instruction}`);
  console.log(`        modele : ${s.modele}${s.repli ? `   (repli : ${s.repli})` : ""}`);
}

console.log("");