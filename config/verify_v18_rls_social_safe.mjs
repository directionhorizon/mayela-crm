import { readFileSync } from "node:fs";
const env = {};
for (const line of readFileSync(".env.deploy", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
const ref = env.SUPABASE_PROJECT_REF;
const url = `https://${ref}.supabase.co`;
const H = { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`, "Content-Type": "application/json" };
async function sql(query) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST", headers: H, body: JSON.stringify({ query }),
  });
  const txt = await r.text();
  if (!r.ok) throw new Error(`${r.status} ${txt}`);
  try { return JSON.parse(txt); } catch { return txt; }
}
const USER = "5ffe317b-bce8-45f7-9801-c535e588e2f6";

console.log("== 1) application de la migration V18 ==");
const ddl = readFileSync("config/MIGRATION_V18_RLS_SOCIAL_SAFE.sql", "utf8");
console.log(JSON.stringify(await sql(ddl)));

console.log("\n== 2) etat de la vue apres migration ==");
console.log(JSON.stringify(await sql(`select c.reloptions, pg_get_userbyid(c.relowner) as owner
from pg_class c where c.relname='social_accounts_safe'`)));

console.log("\n== 3) count vue vue par ANON (claims role=anon) ==");
console.log(JSON.stringify(await sql(`
begin;
select set_config('request.jwt.claims','{"role":"anon"}',true);
select count(*)::int as n_anon from public.social_accounts_safe;
rollback;`)));

console.log("\n== 4) count vue vue par MEMBRE authentifie ==");
console.log(JSON.stringify(await sql(`
begin;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"${USER}"}',true);
select count(*)::int as n_user from public.social_accounts_safe;
rollback;`)));

console.log("\n== 5) count vue vue par SERVICE_ROLE ==");
console.log(JSON.stringify(await sql(`
begin;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select count(*)::int as n_svc from public.social_accounts_safe;
rollback;`)));
