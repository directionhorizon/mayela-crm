-- ============================================================
-- MAYELA CRM - Migration V15 : historique quotidien de depense pub (source API)
-- A executer dans : Supabase Dashboard -> SQL Editor -> New query -> Run
-- Date : 29 septembre 2026
--
-- Contexte : la synchronisation pub (social-facebook / social-tiktok) ecrase
-- campaigns.depense_reelle a chaque passage, et ne recupere qu'une fenetre
-- glissante de 30 jours (date_preset=last_30d). Consequence : le ROAS compare
-- un CA cumule (achats, sans borne de date) a une depense limitee a 30 jours.
-- Le ratio porte donc sur deux durees differentes et n'est pas fiable.
--
-- Objectif : historiser la depense jour par jour, issue des API, pour qu'un
-- ROAS soit calculable sur 7 / 30 / 90 jours comme sur l'historique complet.
-- Une ligne = une campagne x un jour. La colonne campaigns.depense_reelle
-- reste un cache "derniere valeur connue" pour l'affichage rapide.
--
-- Convention V8 : colonnes en anglais, commentaires en francais.
-- Migration ADDITIVE et IDEMPOTENTE : sans danger a (re)executer.
-- ============================================================

-- ---------- 1) Table historique quotidien ----------
create table if not exists public.campaign_spend_daily (
  id           uuid        primary key default gen_random_uuid(),
  org_id       uuid        not null references public.organizations(id) on delete cascade,
  campaign_id  uuid        not null references public.campaigns(id) on delete cascade,
  jour         date        not null,                       -- journee de depense
  depense      numeric     not null default 0,             -- depense du jour
  impressions  integer     not null default 0,
  clics        integer     not null default 0,
  portee       integer     not null default 0,             -- Meta Insights ne fournit pas le reach journalier : reste 0
  devise       text,                                       -- devise du compte publicitaire (XOF, USD...)
  source       text        not null default 'api' check (source in ('api','manuelle')),
  synced_at    timestamptz not null default now(),
  -- Un seul enregistrement par campagne et par jour : la synchronisation est
  -- rejouable sans dupliquer, l'upsert met a jour la valeur du jour.
  unique (campaign_id, jour)
);

create index if not exists campaign_spend_daily_org_jour_idx
  on public.campaign_spend_daily (org_id, jour desc);
create index if not exists campaign_spend_daily_camp_jour_idx
  on public.campaign_spend_daily (campaign_id, jour desc);

-- ---------- 2) RLS : meme cloisonnement que campaigns (V13) ----------
alter table public.campaign_spend_daily enable row level security;
drop policy if exists "cspd_all_org" on public.campaign_spend_daily;
create policy "cspd_all_org" on public.campaign_spend_daily
  for all to authenticated
  using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_spend_daily TO anon, authenticated, service_role;

-- ---------- 3) campaigns : tracer la source de la depense ----------
-- depense_source : 'api' = valeur automatiquement ecrite par la synchronisation
--                  'manuelle' = saisie du formulaire Campagnes (controle)
-- permet de ne plus perdre silencieusement une correction faite a la main
-- sans interdire la saisie : l'ecart reste visible.
alter table public.campaigns add column if not exists depense_source text
  check (depense_source in ('api','manuelle','mixte'));
alter table public.campaigns add column if not exists depense_devise text;
-- Periode reellement couverte par depense_reelle, pour que l'ecart avec la
-- fenetre 30 jours des API soit lisible au lieu d'etre silencieux.
alter table public.campaigns add column if not exists depense_periode_debut date;
alter table public.campaigns add column if not exists depense_periode_fin   date;

-- ---------- 4) Vue : depense agregee par campagne et fenetre ----------
-- Le ROAS se calcule desormais sur la meme fenetre que le CA : on additionne
-- l'historique jour par jour plutot que de lire une fenetre glissante.
create or replace view public.v_campaign_spend
with (security_invoker = true) as
select
  d.org_id,
  d.campaign_id,
  sum(d.depense)::numeric                                  as depense,
  sum(d.impressions)::bigint                              as impressions,
  sum(d.clics)::bigint                                    as clics,
  min(d.jour)                                             as jour_debut,
  max(d.jour)                                             as jour_fin,
  count(*)::int                                           as nb_jours,
  bool_or(d.source = 'manuelle')                         as contient_saisie,
  max(d.devise)                                           as devise
from public.campaign_spend_daily d
group by d.org_id, d.campaign_id;

-- Postgres n'accorde aucun droit sur une vue par defaut : sans ce GRANT,
-- l'appel REST de la vue echoue en 42501 meme pour service_role.
GRANT SELECT ON public.v_campaign_spend TO anon, authenticated, service_role;

-- ---------- FIN ----------
-- Verification apres execution :
--   select column_name, data_type from information_schema.columns
--    where table_schema='public' and table_name='campaign_spend_daily'
--    order by ordinal_position;
--   select column_name from information_schema.columns
--    where table_schema='public' and table_name='campaigns'
--      and column_name in ('depense_source','depense_devise',
--                          'depense_periode_debut','depense_periode_fin');
--   select * from public.v_campaign_spend;
