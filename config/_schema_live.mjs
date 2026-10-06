// Introspection du schema REEL via PostgREST : renvoie les colonnes effectivement
// exposes pour chaque table. Sert de reference pour la reecriture de la doc.
import fs from 'node:fs';
const env = Object.fromEntries(
  fs.readFileSync('.env.deploy', 'utf8')
    .split(/\r?\n/)
    .filter(l => l.trim() && !l.trim().startsWith('#') && l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const H = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` };

const tables = [
  'clients','achats','interactions','produits_services','tasks','devis','campaigns',
  'campaign_spend_daily','meta_adsets','leads_tiktok','tik_adgroups','tik_audiences',
  'social_accounts','social_posts','social_events_log','social_accounts_safe',
  'profiles','org_members','ia_messages','integrations_oauth',
];

for (const t of tables) {
  const r = await fetch(`${env.SUPABASE_URL}/rest/v1/${t}?select=*&limit=1`, { headers: H });
  if (!r.ok) { console.log(`${t.padEnd(22)} : INACCESSIBLE (${r.status})`); continue; }
  const rows = await r.json();
  if (!Array.isArray(rows) || !rows.length) { console.log(`${t.padEnd(22)} : (vide / aucune ligne)`); continue; }
  const cols = Object.keys(rows[0]);
  console.log(`${t}  (${cols.length} colonnes)`);
  console.log('   ' + cols.join(', ') + '\n');
}
