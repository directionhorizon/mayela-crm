// Verification ponctuelle : la vue social_accounts_safe expose-t-elle
// has_app_secret (migration V16) ? Lecture seule, aucune ecriture.
import { readFileSync } from "node:fs";

const env = {};
for (const line of readFileSync(".env.deploy", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}

const ref = env.SUPABASE_PROJECT_REF;
const token = env.SUPABASE_ACCESS_TOKEN;

async function sql(query) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`${r.status} ${t.slice(0, 300)}`);
  return t.trim() ? JSON.parse(t) : [];
}

const rows = await sql(
  `select column_name, data_type from information_schema.columns
   where table_schema = 'public' and table_name = 'social_accounts_safe'
   order by ordinal_position`,
);

console.log("Vue social_accounts_safe :");
for (const r of rows) console.log(`  - ${r.column_name} (${r.data_type})`);

const names = rows.map((r) => r.column_name);
console.log("");
console.log(`has_app_secret (V16) : ${names.includes("has_app_secret") ? "PRESENT" : "ABSENT"}`);

// Le trigger de V16 doit aussi exister.
const trg = await sql(
  `select tgname from pg_trigger t
   join pg_class c on c.oid = t.tgrelid
   where c.relname = 'campaign_spend_daily' and not t.tgisinternal`,
);
console.log(`Triggers sur campaign_spend_daily : ${trg.length ? trg.map((t) => t.tgname).join(", ") : "aucun"}`);

// Les colonnes de V15 sur campaigns, en lecture directe.
const cam = await sql(
  `select column_name from information_schema.columns
   where table_schema = 'public' and table_name = 'campaigns'
     and column_name like 'depense%' order by column_name`,
);
console.log("");
console.log("Colonnes depense* de campaigns (V15) :");
for (const r of cam) console.log(`  - ${r.column_name}`);

// Lignes historiques presentes ? Indique si la V15 a ete exercee.
const cnt = await sql(
  `select count(*)::int as n from public.campaign_spend_daily`,
);
console.log("");
console.log(`Lignes dans campaign_spend_daily : ${cnt[0]?.n ?? 0}`);
