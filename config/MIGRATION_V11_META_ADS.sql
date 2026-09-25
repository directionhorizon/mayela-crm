-- ============================================================
-- MAYELA CRM — Migration V11 : gestion Meta Ads (Ads Manager)
-- À exécuter dans : Supabase Dashboard → SQL Editor → New query → Run
--   (ou via une Edge Function temporaire `db-migrate` — cf. config/DEPLOY_BACKEND.md)
-- Date : 24 septembre 2026
--
-- OBJECTIF :
--   Étendre l'intégration Facebook/Meta de la lecture de la Page vers la
--   gestion réelle des campagnes publicitaires (parité avec TikTok V10.1) :
--     1) `campaigns` : marqueur source='meta' + champs Meta natifs
--        (compte publicitaire, campagne_id, devise, budget, statut, objectif)
--        pour les campagnes lues/gérées via le Marketing API (Graph API) ;
--     2) `meta_adsets` : ensembles de pubs (ad sets — budget / enchère / pause),
--        équivalent des `tik_adgroups` côté Meta.
--
-- La migration est ADDITIVE et IDEMPOTENTE : sans danger à (re)exécuter.
-- ============================================================

-- ---------- 0) Faire rentrer 'meta' dans la contrainte source ----------
-- (le champ source existe depuis V10.1 ; on élargit la contrainte de 'manuel'|'tik'
--  à 'manuel'|'tik'|'meta' — nom de contrainte Postgres par défaut : campaigns_source_check)
alter table public.campaigns drop constraint if exists campaigns_source_check;
alter table public.campaigns add constraint campaigns_source_check
  check (source in ('manuel','tik','meta'));

-- ---------- 1) campaigns : champs Meta Ads ----------
alter table public.campaigns add column if not exists source text not null default 'manuel';
alter table public.campaigns add column if not exists meta_ad_account_id text;   -- compte publicitaire propriétaire
alter table public.campaigns add column if not exists meta_campaign_id text;     -- id Meta natif
alter table public.campaigns add column if not exists meta_currency text;        -- devise du compte publicitaire
alter table public.campaigns add column if not exists meta_status text;          -- ACTIVE | PAUSED | … (effective_status)
alter table public.campaigns add column if not exists meta_objective text;       -- objective Meta
alter table public.campaigns add column if not exists meta_budget_mode text;     -- daily_budget | lifetime_budget
alter table public.campaigns add column if not exists meta_budget numeric;       -- budget natif (en unités, devise du compte pub)
alter table public.campaigns add column if not exists meta_synced_at timestamptz;

-- Une campagne Meta Ads = 1 ligne par espace (upsert par meta_campaign_id).
create unique index if not exists campaigns_meta_org_uidx
  on public.campaigns (org_id, meta_campaign_id)
  where source = 'meta' and meta_campaign_id is not null;

-- ---------- 2) meta_adsets (ensembles de pubs) ----------
create table if not exists public.meta_adsets (
  id                 uuid          primary key default gen_random_uuid(),
  org_id             uuid          not null references public.organizations(id) on delete cascade,
  meta_ad_account_id text          not null,
  meta_campaign_id   text,
  meta_adset_id      text          not null,
  nom                text          not null,
  budget_mode        text,                       -- daily_budget | lifetime_budget
  budget             numeric,                    -- budget natif (en unités)
  bid                numeric,                    -- enchère native (en unités)
  bid_strategy       text,
  status             text,                       -- ACTIVE | PAUSED | … (effective_status)
  currency           text,
  optimization_goal  text,
  synced_at          timestamptz   not null default now(),
  created_at         timestamptz   not null default now()
);
create unique index if not exists meta_adsets_org_uidx
  on public.meta_adsets (org_id, meta_adset_id);
create index if not exists meta_adsets_campaign_idx
  on public.meta_adsets (org_id, meta_campaign_id);

alter table public.meta_adsets enable row level security;
drop policy if exists "metaad_all_org" on public.meta_adsets;
create policy "metaad_all_org" on public.meta_adsets
  for all to authenticated
  using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());

-- ---------- 3) GRANTS ----------
grant select, insert, update, delete on public.meta_adsets to anon, authenticated, service_role;

-- ---------- FIN ----------
-- Vérifications (optionnel) :
--   select column_name from information_schema.columns
--   where table_schema='public' and table_name='campaigns'
--     and column_name in ('source','meta_ad_account_id','meta_campaign_id','meta_currency','meta_status','meta_objective','meta_budget_mode','meta_budget','meta_synced_at')
--     order by column_name;
--   select tablename from pg_tables where schemaname='public'
--     and tablename in ('meta_adsets') order by tablename;
--   select conname from pg_constraint where conrelid = 'public.campaigns'::regclass and contype='c';