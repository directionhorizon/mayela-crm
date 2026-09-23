-- ============================================================
-- MAYELA CRM — Migration V10.1 : gestion TikTok Ads (Manager)
-- À exécuter dans : Supabase Dashboard → SQL Editor → New query → Run
-- Date : 22 septembre 2026
--
-- OBJECTIF :
--   Étendre l'intégration TikTok Marketing API du mode « lecture seule »
--   vers la gestion réelle des campagnes :
--     1) `campaigns` : marqueur source='tik' + champs TikTok natifs
--        (campagne_id, budget_mode, budget, devise, statut) pour les
--        campagnes lues/créées via l'API Ads ;
--     2) `tik_adgroups`  : ad groups Ads (gérer budget / enchère / pause) ;
--     3) `tik_audiences` : audiences custom créées depuis la liste clients ;
--     4) `leads_tiktok`  : leads importés depuis les Instant Forms TikTok
--        (→ fiches clients CRM), avec déduplication.
--
-- La migration est ADDITIVE et IDEMPOTENTE : sans danger à (re)exécuter.
-- ============================================================

-- ---------- 1) campaigns : champs TikTok Ads ----------
alter table public.campaigns add column if not exists source text not null default 'manuel'
  check (source in ('manuel','tik'));
alter table public.campaigns add column if not exists tik_campaign_id text;
alter table public.campaigns add column if not exists tik_advertiser_id text;
alter table public.campaigns add column if not exists tik_budget_mode text;   -- BUDGET_MODE_DAY | BUDGET_MODE_TOTAL
alter table public.campaigns add column if not exists tik_budget numeric;     -- montant natif (devise du compte pub)
alter table public.campaigns add column if not exists tik_currency text;      -- devise du compte publicitaire
alter table public.campaigns add column if not exists tik_status text;        -- ACTIVE | PAUSED | DELETED | ...
alter table public.campaigns add column if not exists tik_objective text;     -- objective_type TikTok
alter table public.campaigns add column if not exists tik_synced_at timestamptz;

-- Une campagne TikTok Ads = 1 ligne par espace (upsert par tik_campaign_id).
create unique index if not exists campaigns_tik_org_uidx
  on public.campaigns (org_id, tik_campaign_id)
  where source = 'tik' and tik_campaign_id is not null;

-- ---------- 2) tik_adgroups ----------
create table if not exists public.tik_adgroups (
  id               uuid          primary key default gen_random_uuid(),
  org_id           uuid          not null references public.organizations(id) on delete cascade,
  advertiser_id    text          not null,
  tik_campaign_id  text,
  tik_adgroup_id   text          not null,
  nom              text          not null,
  budget_mode      text,                       -- BUDGET_MODE_DAY | BUDGET_MODE_TOTAL
  budget           numeric,                    -- montant natif
  bid              numeric,                    -- enchère native
  bid_strategy     text,
  operation_status text,                       -- ACTIVE | PAUSED | DELETED | ...
  status           text,
  currency         text,
  optimize_goal    text,
  synced_at        timestamptz   not null default now(),
  created_at       timestamptz   not null default now()
);
create unique index if not exists tik_adgroups_org_uidx
  on public.tik_adgroups (org_id, tik_adgroup_id);
create index if not exists tik_adgroups_campaign_idx
  on public.tik_adgroups (org_id, tik_campaign_id);

alter table public.tik_adgroups enable row level security;
drop policy if exists "tikag_all_org" on public.tik_adgroups;
create policy "tikag_all_org" on public.tik_adgroups
  for all to authenticated
  using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());

-- ---------- 3) tik_audiences ----------
create table if not exists public.tik_audiences (
  id                uuid          primary key default gen_random_uuid(),
  org_id            uuid          not null references public.organizations(id) on delete cascade,
  advertiser_id     text          not null,
  tik_audience_id   text          not null,
  nom               text          not null,
  calculate_type    text          not null,    -- EMAIL_SHA256 | PHONE_SHA256 | MULTIPLE_TYPES
  member_count      integer       not null default 0,
  status            text,                      -- statut de traitement TikTok
  synced_at         timestamptz   not null default now(),
  created_at        timestamptz   not null default now()
);
create unique index if not exists tik_audiences_org_uidx
  on public.tik_audiences (org_id, tik_audience_id);

alter table public.tik_audiences enable row level security;
drop policy if exists "tika_all_org" on public.tik_audiences;
create policy "tika_all_org" on public.tik_audiences
  for all to authenticated
  using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());

-- ---------- 4) leads_tiktok (leads importés) ----------
create table if not exists public.leads_tiktok (
  id            uuid          primary key default gen_random_uuid(),
  org_id        uuid          not null references public.organizations(id) on delete cascade,
  advertiser_id text,
  page_id       text,
  page_name     text,
  lead_key      text          not null,        -- clé de dédup (org + lead)
  client_id     uuid          references public.clients(id) on delete set null,
  nom           text,
  phone         text,
  email         text,
  raw_data      jsonb,
  imported_by   uuid,
  imported_at   timestamptz   not null default now(),
  created_at    timestamptz   not null default now()
);
create unique index if not exists leads_tiktok_org_uidx
  on public.leads_tiktok (org_id, lead_key);

alter table public.leads_tiktok enable row level security;
drop policy if exists "lt_all_org" on public.leads_tiktok;
create policy "lt_all_org" on public.leads_tiktok
  for all to authenticated
  using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());

-- ---------- 5) GRANTS ----------
grant select, insert, update, delete on public.tik_adgroups to anon, authenticated, service_role;
grant select, insert, update, delete on public.tik_audiences to anon, authenticated, service_role;
grant select, insert, update, delete on public.leads_tiktok to anon, authenticated, service_role;

-- ---------- FIN ----------
-- Vérifications (optionnel) :
--   select column_name from information_schema.columns
--   where table_schema='public' and table_name='campaigns'
--     and column_name in ('source','tik_campaign_id','tik_budget_mode','tik_budget','tik_currency','tik_status','tik_objective','tik_synced_at')
--     order by column_name;
--   select tablename from pg_tables where schemaname='public'
--     and tablename in ('tik_adgroups','tik_audiences','leads_tiktok') order by tablename;