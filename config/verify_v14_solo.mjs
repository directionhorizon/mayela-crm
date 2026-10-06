// ============================================================================
// Verification fonctionnelle du mode « sans espace » (solo) — migration V14.
//
// Complémentaire à verify_v13_isolation.mjs, qui contrôle le cloisonnement
// ENTRE espaces. Ce script contrôle l'autre moitié du contrat : un compte sans
// espace doit pouvoir Working comme l'app le prévoit (mayela-crm.html, branche
// `isSolo`), c'est-à-dire créer un client rattaché à une personne puis
// enregistrer achats, devis, tâches, interactions, créances et une
// conversation IA.
//
// La V13 avait laissé ces 6 tables sur la seule branche `org_id =
// current_org_id()`. Avec deux NULL, la comparaison vaut NULL (et non true) :
// toute écriture était refusée en 403, y compris par le propriétaire du client.
//
// Méthode : mêmes jetons réels que V13, via PostgREST, pour que les politiques
// soient réellement évaluées par PostgreSQL.
//
// Lancement : node config/verify_v14_solo.mjs
// Code de sortie 0 si conforme, 1 sinon.
// ============================================================================
import { readFileSync } from "node:fs";

const env = {};
for (const line of readFileSync(".env.deploy", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
const ref = env.SUPABASE_PROJECT_REF;
const url = `https://${ref}.supabase.co`;
const svc = env.SUPABASE_SERVICE_ROLE_KEY;
const mgmt = {
  Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`,
  Accept: "application/json",
  "Content-Type": "application/json",
};

async function sql(query) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST", headers: mgmt, body: JSON.stringify({ query }),
  });
  const txt = await r.text();
  if (!r.ok) throw new Error(`SQL: ${r.status} ${txt}`);
  return txt.trim() ? JSON.parse(txt) : [];
}

const REST_H = { apikey: svc, Authorization: `Bearer ${svc}`, "Content-Type": "application/json" };
const U = () => crypto.randomUUID();

async function mkUser(email) {
  const r = await fetch(`${url}/auth/v1/admin/users`, {
    method: "POST", headers: REST_H,
    body: JSON.stringify({ email, password: "SoloTest!2026", email_confirm: true }),
  });
  if (!r.ok) throw new Error(`create ${email}: ${r.status} ${await r.text()}`);
  return (await r.json()).id;
}
async function tokenFor(email) {
  const r = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST", headers: { apikey: svc, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "SoloTest!2026" }),
  });
  if (!r.ok) throw new Error(`token ${email}: ${r.status} ${await r.text()}`);
  return (await r.json()).access_token;
}
// ECRITURE avec le jeton de l'utilisateur : c'est ici que RLS s'applique.
async function write(tok, table, row) {
  const r = await fetch(`${url}/rest/v1/${table}`, {
    method: "POST",
    headers: { apikey: svc, Authorization: `Bearer ${tok}`, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify([row]),
  });
  return { status: r.status, ok: r.ok, err: r.ok ? "" : ((await r.json().catch(() => ({}))).message ?? (await Promise.resolve(""))) };
}
// Lecture avec le jeton de l'utilisateur.
async function as(tok, table) {
  const r = await fetch(`${url}/rest/v1/${table}?select=*`, {
    headers: { apikey: svc, Authorization: `Bearer ${tok}` },
  });
  const d = await r.json().catch(() => null);
  if (!Array.isArray(d)) throw new Error(`lecture ${table}: ${JSON.stringify(d)}`);
  return d;
}

// ---------- jeu de donnees ----------
// S = compte solo, aucun espace. A = compte d'un espace, temoin pour prouver
// qu'ouvrir la branche « sans espace » n'ouvre PAS de fuite inter-espace.
const stamp = Date.now();
const mailS = `test.solo.s.${stamp}@gmail.com`;
const mailA = `test.solo.a.${stamp}@gmail.com`;
const uidS = await mkUser(mailS);
const uidA = await mkUser(mailA);
const orgA = U();
const cliSolo = U();
const ids = { achats: U(), devis: U(), tasks: U(), interactions: U(), creances: U() };
const conv = U();

try {
  // Le trigger sur auth.users cree deja les profils. Seul A recoit un espace.
  await sql(`
    insert into public.organizations (id, name, join_code, created_by)
      values ('${orgA}', 'SOLO-A-${stamp}', 'SA${U().slice(0, 4).toUpperCase()}', '${uidA}');
    update public.profiles set org_id = '${orgA}', active_org_id = '${orgA}' where id = '${uidA}';
    update public.profiles set org_id = null, active_org_id = null, workspace_type = 'perso' where id = '${uidS}';
    insert into public.org_members (user_id, org_id, role) values ('${uidA}','${orgA}','owner');
  `);

  const tS = await tokenFor(mailS);
  const tA = await tokenFor(mailA);

  // --- 1) S cree son client sans espace, exactement comme le fait l'app ---
  const cli = await write(tS, "clients", { id: cliSolo, name: "Client solo", owner_user_id: uidS });
  console.log("=== Client sans espace (comme l'app) ===");
  console.log(`  HTTP ${cli.status} ${cli.err}`);

  // --- 2) S ecrit sur les 5 tables enfants, comme le fait l'app ---
  console.log("=== Ecriture du proprietaire sur son client sans espace ===");
  const ecrits = [
    ["achats", { id: ids.achats, client_id: cliSolo, montant: 12.5, quantite: 2 }],
    ["devis", { id: ids.devis, client_id: cliSolo }],
    ["tasks", { id: ids.tasks, client_id: cliSolo, due_date: "2026-12-31" }],
    ["interactions", { id: ids.interactions, client_id: cliSolo, type: "note" }],
    ["creances", { id: ids.creances, client_id: cliSolo, montant: 50 }],
  ];
  const rEcrits = {};
  for (const [t, row] of ecrits) {
    const r = await write(tS, t, row);
    rEcrits[t] = r;
    console.log(`  ${r.ok ? "OK   " : "ECHEC"} ${t} : HTTP ${r.status} ${r.err}`);
  }

  // --- 3) S utilise le conseiller IA, sans envoyer d'espace ---
  const ia = await write(tS, "ia_messages", { user_id: uidS, role: "user", content: "msg IA solo", conversation_id: conv });
  const iaRow = (await sql(`select org_id is null as sans_espace from public.ia_messages where conversation_id = '${conv}'`))[0];
  console.log("=== Conversation IA en mode solo ===");
  console.log(`  ${ia.ok ? "OK   " : "ECHEC"} HTTP ${ia.status} ${ia.err}`);
  console.log(`  org_id reste NULL comme attendu : ${iaRow?.sans_espace === true}`);

  // --- 4) non-regression : A ne doit rien voir du solo, et ne rien y ecrire ---
  const fuite = [];
  for (const t of ["clients", "achats", "devis", "tasks", "interactions", "creances", "ia_messages"]) {
    const vus = await as(tA, t);
    if (vus.length) fuite.push(`${t}(${vus.length})`);
  }
  const intrusion = await write(tA, "achats", { client_id: cliSolo, montant: 999, quantite: 1 });
  const vueParA = (await as(tA, "clients")).length === 0;
  console.log("=== Non-regression inter-espace ===");
  console.log(`  ${fuite.length === 0 ? "OK   " : "ECHEC"} A ne voit rien du mode solo : ${fuite.length ? fuite.join(", ") : "(aucune fuite)"}`);
  console.log(`  ${!vueParA ? "ECHEC" : "OK   "} A ne voit pas le client solo dans clients`);
  console.log(`  ${!intrusion.ok ? "OK   " : "ECHEC"} A ne peut pas ecrire sur le client solo : HTTP ${intrusion.status}`);

  // S relit bien ses propres donnees
  const relu = {};
  for (const t of ["clients", "achats", "devis", "tasks", "interactions", "creances"]) relu[t] = (await as(tS, t)).length;

  const checks = [
    ["le client sans espace se cree", cli.ok],
    ["achat ecrit par le proprietaire", rEcrits.achats.ok],
    ["devis ecrit par le proprietaire", rEcrits.devis.ok],
    ["tache ecrite par le proprietaire", rEcrits.tasks.ok],
    ["interaction ecrite par le proprietaire", rEcrits.interactions.ok],
    ["creance ecrite par le proprietaire", rEcrits.creances.ok],
    ["conversation IA enregistrable en solo", ia.ok],
    ["la conversation IA reste sans espace", iaRow?.sans_espace === true],
    ["le proprietaire relit ses 6 tables", Object.values(relu).every((n) => n === 1)],
    ["aucune fuite vers l'espace voisin", fuite.length === 0],
    ["l'espace voisin ne peut pas ecrire sur le client solo", !intrusion.ok],
  ];
  console.log("=== Controles ===");
  let ok = true;
  for (const [label, pass] of checks) {
    console.log(`  ${pass ? "OK   " : "ECHEC"} ${label}`);
    if (!pass) ok = false;
  }
  console.log(ok ? "\nRESULTAT : mode sans espace conforme." : "\nRESULTAT : ECHEC du mode sans espace.");
  process.exitCode = ok ? 0 : 1;
} finally {
  await sql(`
    create temporary table _t as select id from auth.users where id in ('${uidS}','${uidA}');
    create temporary table _c as select id from public.clients where id = '${cliSolo}';
    delete from public.achats where client_id in (select id from _c);
    delete from public.devis where client_id in (select id from _c);
    delete from public.tasks where client_id in (select id from _c);
    delete from public.interactions where client_id in (select id from _c);
    delete from public.creances where client_id in (select id from _c);
    delete from public.clients where id in (select id from _c);
    delete from public.ia_messages where user_id in (select id from _t);
    delete from public.audit_log where user_id in (select id from _t);
    delete from public.org_members where user_id in (select id from _t) or org_id = '${orgA}';
    delete from public.profiles where id in (select id from _t);
    update public.organizations set created_by = null where id = '${orgA}';
    delete from public.organizations where id = '${orgA}';
  `).catch((e) => console.error("  (nettoyage SQL incomplet :", e.message, ")"));
  for (const uid of [uidS, uidA]) {
    await fetch(`${url}/auth/v1/admin/users/${uid}`, { method: "DELETE", headers: REST_H }).catch(() => {});
  }
}
