-- ============================================================
-- MAYELA CRM — Migration V2 (correction + actualisation du schéma)
-- À exécuter dans : Supabase Dashboard → SQL Editor → New query → Run
-- Date : 30 août 2026
--
-- OBJECTIF :
--   1) GRANT d'accès (SELECT/INSERT/UPDATE/DELETE) sur les tables métier
--      pour anon / authenticated / service_role.
--      => Corrige les erreurs "permission denied for table ..." (42501)
--         sur produits_services, creances, social_accounts, social_posts,
--         social_events_log (tables créées mais jamais autorisées).
--   2) Colonnes manquantes réellement utilisées par l'app.
--   3) Politiques RLS org-based pour les nouvelles tables.
--   4) Nouvelle table `integrations_oauth` (connexions OAuth Google Sheets / Notion par espace).
--
-- La migration est ADDITIVE et IDEMPOTENTE : sans danger à (re)exécuter.
-- ============================================================

-- ---------- 1) GRANT : débloque l'accès aux tables métier ----------
-- Les rôles Supabase (anon, authenticated, service_role) doivent être autorisés GRAPHIQUEMENT
-- sur chaque table, même pour les tables créées via "create table if not exists".
GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.clients, public.interactions, public.achats, public.devis, public.tasks,
  public.creances, public.organizations, public.profiles, public.produits_services,
  public.social_accounts, public.social_posts, public.social_events_log,
  public.audit_log
TO anon, authenticated, service_role;

-- ---------- 2) Colonnes manquantes (idempotent) ----------
alter table public.produits_services add column if not exists description text;
alter table public.produits_services add column if not exists image_url text;
alter table public.produits_services add column if not exists actif boolean not null default true;

alter table public.achats add column if not exists produit_id uuid references public.produits_services(id);
alter table public.devis add column if not exists produit_id uuid references public.produits_services(id);

alter table public.tasks add column if not exists libelle text;

alter table public.organizations add column if not exists members_can_rename boolean not null default false;

-- ---------- 3) Table CREANCES (créances clients) ----------
create table if not exists public.creances (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references public.clients(id) on delete cascade,
  montant       numeric not null,
  produit_id    uuid references public.produits_services(id),
  statut        text not null default 'due' check (statut in ('due','payee')),
  created_at    timestamptz not null default now()
);

-- Au cas où creances existerait déjà sans toutes les colonnes :
alter table public.creances add column if not exists montant numeric not null default 0;
alter table public.creances add column if not exists produit_id uuid references public.produits_services(id);
alter table public.creances add column if not exists statut text not null default 'due';

alter table public.creances enable row level security;
drop policy if exists "cr_all_org" on public.creances;
create policy "cr_all_org" on public.creances
  for all to authenticated
  using (exists (select 1 from public.clients c where c.id = creances.client_id and c.org_id = public.current_org_id()))
  with check (exists (select 1 from public.clients c where c.id = creances.client_id and c.org_id = public.current_org_id()));

-- ---------- 4) Tables réseaux sociaux : complète les policies RLS ----------
-- social_accounts
alter table public.social_accounts enable row level security;
drop policy if exists "sa_all_org" on public.social_accounts;
create policy "sa_all_org" on public.social_accounts
  for all to authenticated
  using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());

-- social_posts
alter table public.social_posts enable row level security;
drop policy if exists "sp_all_org" on public.social_posts;
create policy "sp_all_org" on public.social_posts
  for all to authenticated
  using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());

-- social_events_log
alter table public.social_events_log enable row level security;
drop policy if exists "sel_all_org" on public.social_events_log;
create policy "sel_all_org" on public.social_events_log
  for all to authenticated
  using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());

-- ---------- 5) Table INTEGRATIONS_OAUTH (Google Sheets / Notion par espace) ----------
-- Stocke les connexions OAuth du futur user vers ses propres comptes Google Sheets / Notion.
-- One row par (org_id, provider). Les tokens restent côté serveur (jamais envoyés au navigateur
-- des autres membres de l'espace).
create table if not exists public.integrations_oauth (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id) on delete cascade,
  provider      text not null check (provider in ('google_sheets','notion')),
  display_name  text,
  config        jsonb not null default '{}'::jsonb,
  connected_by  uuid references auth.users(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (org_id, provider)
);

alter table public.integrations_oauth enable row level security;
drop policy if exists "io_all_org" on public.integrations_oauth;
create policy "io_all_org" on public.integrations_oauth
  for all to authenticated
  using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.integrations_oauth
TO anon, authenticated, service_role;

-- ---------- 5bis) EXECUTE sur current_org_id() ----------
-- Les policies RLS org-based appellent current_org_id() (SECURITY DEFINER) :
-- sans GRANT EXECUTE, l'évaluation d'une policy pour un rôle sans permission
-- échoue avec "permission denied for function current_org_id" (42501).
GRANT EXECUTE ON FUNCTION public.current_org_id() TO anon, authenticated, service_role;

-- ---------- 6) BONUS : GRANT sur éventuelles séquences ----------
-- (Les IDs sont des uuid générés par défaut ; seules quelques tables legacy en serial
--  pourraient avoir des séquences. Ce bloc est inoffensif si aucune n'existe.)
DO $$
DECLARE s record;
BEGIN
  FOR s IN
    SELECT sequence_name FROM information_schema.sequences
    WHERE sequence_schema = 'public'
  LOOP
    EXECUTE format('GRANT USAGE, SELECT ON SEQUENCE public.%I TO anon, authenticated, service_role', s.sequence_name);
  END LOOP;
END $$;

-- ---------- FIN ----------
-- Vérifications possibles après exécution (optionnel) :
--   SELECT grantee, table_schema, table_name, privilege_type
--   FROM information_schema.role_table_grants
--   WHERE table_name IN ('creances','social_accounts','social_posts','social_events_log','integrations_oauth','produits_services')
--   ORDER BY table_name, grantee;
