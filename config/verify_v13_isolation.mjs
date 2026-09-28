// ============================================================================
// Verification fonctionnelle du cloisonnement par espace (migration V13).
//
// Les lectures sont faites avec le VRAI jeton de chaque utilisateur de test, via
// PostgREST : les politiques RLS sont donc reellement evaluees par PostgreSQL et
// pas simulees. L'ecriture des donnees de preparation passe par SQL d'admin,
// car org_members est volontairement non accessible en ecriture au navigateur
// (l'app utilise les fonctions RPC create_organization / join_organization).
//
// Ce que le script prouve :
//   1. chaque compte voit les clients de son espace actif ;
//   2. un client cree par A mais rattache a l'espace A est INVISIBLE depuis
//      l'espace B (c'etait precisement la fuite signalee) ;
//   3. les achats suivent la meme regle que leur client ;
//   4. la conversation du conseiller IA est cloisonnee par espace et non par
//      simple compte.
//
// Lancement : node config/verify_v13_isolation.mjs
// Code de sortie 0 si tout est conforme, 1 sinon.
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

// ---------- utilitaires ----------
async function sql(query) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST", headers: mgmt, body: JSON.stringify({ query }),
  });
  const txt = await r.text();
  if (!r.ok) throw new Error(`SQL: ${r.status} ${txt}`);
  return txt.trim() ? JSON.parse(txt) : [];
}

const REST_H = { apikey: svc, Authorization: `Bearer ${svc}`, "Content-Type": "application/json" };
const restIns = (t, rows) =>
  fetch(`${url}/rest/v1/${t}`, { method: "POST", headers: REST_H, body: JSON.stringify(rows) });
const restDel = (t, filter) =>
  fetch(`${url}/rest/v1/${t}`, { method: "DELETE", headers: REST_H, body: JSON.stringify(filter) });

async function mkUser(email) {
  const r = await fetch(`${url}/auth/v1/admin/users`, {
    method: "POST", headers: REST_H,
    body: JSON.stringify({ email, password: "IsoTest!2026", email_confirm: true }),
  });
  if (!r.ok) throw new Error(`create ${email}: ${r.status} ${await r.text()}`);
  return (await r.json()).id;
}
async function tokenFor(email) {
  const r = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST", headers: { apikey: svc, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "IsoTest!2026" }),
  });
  if (!r.ok) throw new Error(`token ${email}: ${r.status} ${await r.text()}`);
  return (await r.json()).access_token;
}
// Lecture avec le jeton de l'utilisateur : c'est ici que RLS s'applique.
async function as(tok, table) {
  const r = await fetch(`${url}/rest/v1/${table}?select=*`, {
    headers: { apikey: svc, Authorization: `Bearer ${tok}` },
  });
  const d = await r.json().catch(() => null);
  if (!Array.isArray(d)) throw new Error(`lecture ${table}: ${JSON.stringify(d)}`);
  return d;
}
const U = () => crypto.randomUUID();

// ---------- jeu de donnees ----------
// Les comptes de test sont crees AVANT le bloc try pour disposer de leurs id
// dans le finally, qui nettoie toujours (c'est ce qui a laisse des comptes
// residuels lors des premiers essai).
const stamp = Date.now();
const mailA = `test.iso.a.${stamp}@gmail.com`;
const mailB = `test.iso.b.${stamp}@gmail.com`;
const uidA = await mkUser(mailA);
const uidB = await mkUser(mailB);
const orgA = U(), orgB = U();
const cliA = U(), cliB = U(), cliOfA = U(), cliOrphan = U();
const achOfA = U(), achOfB = U();

try {
  // Les profils sont crees par un trigger sur auth.users : on les complete en SQL.
  // Ordre impose par les clees etrangeres : organizations -> profiles -> org_members.
  await sql(`
    insert into public.organizations (id, name, join_code, created_by) values
      ('${orgA}', 'ISO-A-${stamp}', 'JC${U().slice(0, 4).toUpperCase()}', '${uidA}'),
      ('${orgB}', 'ISO-B-${stamp}', 'JD${U().slice(0, 4).toUpperCase()}', '${uidB}');
    insert into public.profiles (id, org_id, active_org_id) values
      ('${uidA}','${orgA}','${orgA}'), ('${uidB}','${orgB}','${orgB}')
    on conflict (id) do update set org_id = excluded.org_id, active_org_id = excluded.active_org_id;
    insert into public.org_members (user_id, org_id, role) values
      ('${uidA}','${orgA}','owner'), ('${uidB}','${orgB}','owner');
  `);

  const ins = async (t, rows) => {
    const r = await restIns(t, rows);
    if (!r.ok) throw new Error(`insert ${t}: ${r.status} ${await r.text()}`);
  };
  await ins("clients", [
    { id: cliA, name: "Client A", org_id: orgA },
    { id: cliB, name: "Client B", org_id: orgB },
    // rattache a l'espace A : c'est la ligne qui fuitait vers l'espace B avant
    // la migration (owner_user_id n'est pas renseigne, la contrainte
    // owner_xor_org interdit de renseigner les deux a la fois).
    { id: cliOfA, name: "Client A vu de B", org_id: orgA },
  ]);
  // Cas inverse : un client sans espace, rattache a une personne. Il doit
  // rester visible a son proprietaire uniquement. PostgREST exige des cles
  // identiques dans un insert groupé, d'où un second appel.
  await ins("clients", [
    { id: cliOrphan, name: "Client orphelin de A", owner_user_id: uidA },
  ]);
  await ins("achats", [
    { id: achOfA, client_id: cliOfA, montant: 99, quantite: 1 },
    { id: achOfB, client_id: cliB, montant: 10, quantite: 1 },
  ]);
  // service_role n'a pas le droit d'ecrire dans ia_messages (seul le compte
  // connecte peut, via sa cle) : on passe par SQL. On renseigne l'espace a la
  // main pour representer l'historique existant, deja backfille.
  await sql(`
    insert into public.ia_messages (user_id, org_id, role, content, conversation_id) values
      ('${uidA}', '${orgA}', 'user', 'msg IA A', '00000000-0000-4000-8000-000000000001'),
      ('${uidB}', '${orgB}', 'user', 'msg IA B', '00000000-0000-4000-8000-000000000001');
  `);

  const tA = await tokenFor(mailA);
  const tB = await tokenFor(mailB);

  // Le trigger BEFORE INSERT doit renseigner l'espace tout seul : on ecrit
  // comme le fait l'app, avec le jeton du compte et SANS org_id.
  const insA = await fetch(`${url}/rest/v1/ia_messages`, {
    method: "POST",
    headers: { apikey: svc, Authorization: `Bearer ${tA}`, "Content-Type": "application/json" },
    body: JSON.stringify([{ user_id: uidA, role: "user", content: "msg IA A ecrit par A", conversation_id: "00000000-0000-4000-8000-000000000002" }]),
  });
  const insAErr = insA.ok ? "" : await insA.text();
  const written = await sql(`
    select o.name as espace from public.ia_messages m
      left join public.organizations o on o.id = m.org_id
     where m.conversation_id = '00000000-0000-4000-8000-000000000002';
  `);
  console.log("=== Ecriture par le compte connecte, sans org_id ===");
  console.log(`  HTTP ${insA.status} ${insAErr}`);
  console.log(`  espace attribue par la base : ${written[0]?.espace ?? "(aucun)"}`);

  const cliForA = await as(tA, "clients");
  const achForA = await as(tA, "achats");
  const iaForA = await as(tA, "ia_messages");
  const cliForB = await as(tB, "clients");
  const achForB = await as(tB, "achats");
  const iaForB = await as(tB, "ia_messages");

  console.log("=== Compte A, espace A actif ===");
  console.log("  clients :", cliForA.map((r) => r.name).sort().join(" | ") || "(aucun)");
  console.log("  achats  :", achForA.length, "ligne(s)");
  console.log("  IA      :", iaForA.map((r) => r.content).join(" | ") || "(aucun)");
  console.log("=== Compte B, espace B actif ===");
  console.log("  clients :", cliForB.map((r) => r.name).sort().join(" | ") || "(aucun)");
  console.log("  achats  :", achForB.length, "ligne(s)");
  console.log("  IA      :", iaForB.map((r) => r.content).join(" | ") || "(aucun)");

  const checks = [
    ["A voit ses 3 clients (2 en espace A + 1 sans espace)", cliForA.length === 3],
    ["B voit son 1 client de l'espace B", cliForB.length === 1],
    ["B ne voit plus le client de A (fuite corrigee)", !cliForB.some((r) => r.name === "Client A vu de B")],
    ["B ne voit pas le client sans espace de A", !cliForB.some((r) => r.name === "Client orphelin de A")],
    ["A voit son client sans espace", cliForA.some((r) => r.name === "Client orphelin de A")],
    ["B ne voit pas les achats du client de A", !achForB.some((r) => r.client_id === cliOfA)],
    ["A ne voit pas les achats de B", !achForA.some((r) => r.client_id === cliB)],
    ["A ne voit que ses propres messages IA", iaForA.length === 2 && iaForA.every((r) => r.user_id === uidA)],
    ["B ne voit que ses propres messages IA", iaForB.length === 1 && iaForB.every((r) => r.user_id === uidB)],
    ["l'app peut ecrire dans la conversation IA sans envoyer d'espace", insA.ok],
    ["la base attribue l'espace a l'ecriture", written[0]?.espace === `ISO-A-${stamp}`],
  ];
  console.log("=== Controles ===");
  let ok = true;
  for (const [label, pass] of checks) {
    console.log(`  ${pass ? "OK   " : "ECHEC"} ${label}`);
    if (!pass) ok = false;
  }
  console.log(ok ? "\nRESULTAT : cloisonnement conforme." : "\nRESULTAT : ECHEC de cloisonnement.");
  process.exitCode = ok ? 0 : 1;
} finally {
  // Nettoyage complet et ordonne : dependants, puis clients, puis appartenance,
  // puis profil, puis espace, puis comptes. Dans cet ordre, aucune cle etrangere
  // ne bloque la suppression et aucun residu ne subsiste en base.
  await sql(`
    create temporary table _t as select id from auth.users where id in ('${uidA}','${uidB}');
    create temporary table _c as select id from public.clients
      where id in ('${cliA}','${cliB}','${cliOfA}','${cliOrphan}');
    delete from public.achats where id in ('${achOfA}','${achOfB}') or client_id in (select id from _c);
    delete from public.devis where client_id in (select id from _c);
    delete from public.tasks where client_id in (select id from _c);
    delete from public.interactions where client_id in (select id from _c);
    delete from public.creances where client_id in (select id from _c);
    delete from public.clients where id in (select id from _c);
    delete from public.ia_messages where user_id in (select id from _t);
    delete from public.audit_log where user_id in (select id from _t);
    delete from public.org_members
      where user_id in (select id from _t) or org_id in ('${orgA}','${orgB}');
    delete from public.profiles where id in (select id from _t);
    update public.organizations set created_by = null where id in ('${orgA}','${orgB}');
    delete from public.organizations where id in ('${orgA}','${orgB}');
  `).catch((e) => console.error("  (nettoyage SQL incomplet :", e.message, ")"));
  for (const uid of [uidA, uidB]) {
    await fetch(`${url}/auth/v1/admin/users/${uid}`, { method: "DELETE", headers: REST_H }).catch(() => {});
  }
}



