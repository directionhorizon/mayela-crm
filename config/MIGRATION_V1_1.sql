-- ============================================================
-- MAYELA CRM — Migration V1.1 (22 août 2026)
-- À exécuter dans : Supabase Dashboard → SQL Editor → New query
-- Contenu :
--   1) Produits : colonnes description + image_url
--   2) Storage : bucket public "produits" + policies d'upload par org
--   3) Réseaux sociaux : tables social_accounts + social_posts + RLS
-- ============================================================

-- ---------- 1) PRODUITS : nouvelles colonnes ----------
alter table public.produits_services
  add column if not exists description text,
  add column if not exists image_url text;

-- ---------- 2) STORAGE : bucket produits ----------
insert into storage.buckets (id, name, public)
values ('produits', 'produits', true)
on conflict (id) do nothing;

-- Upload/remplacement réservé aux membres authentifiés de l'org
-- (le fichier DOIT être déposé sous le dossier "<org_id>/...")
drop policy if exists "prod_upload_org" on storage.objects;
create policy "prod_upload_org"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'produits'
  and (storage.foldername(name))[1] = (
    select org_id::text from public.profiles where id = auth.uid()
  )
);

drop policy if exists "prod_update_org" on storage.objects;
create policy "prod_update_org"
on storage.objects for update to authenticated
using (
  bucket_id = 'produits'
  and (storage.foldername(name))[1] = (
    select org_id::text from public.profiles where id = auth.uid()
  )
);

drop policy if exists "prod_delete_org" on storage.objects;
create policy "prod_delete_org"
on storage.objects for delete to authenticated
using (
  bucket_id = 'produits'
  and (storage.foldername(name))[1] = (
    select org_id::text from public.profiles where id = auth.uid()
  )
);

-- Lecture publique (bucket public) — rien à ajouter, mais policy explicite si bucket repassé privé :
drop policy if exists "prod_read_public" on storage.objects;
create policy "prod_read_public"
on storage.objects for select to anon, authenticated
using (bucket_id = 'produits');

-- ---------- 3) RÉSEAUX SOCIAUX : tables ----------
create table if not exists public.social_accounts (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id) on delete cascade,
  platform      text not null check (platform in ('facebook','whatsapp','tiktok')),
  display_name  text,
  config        jsonb not null default '{}'::jsonb,
  connected_by  uuid references auth.users(id),
  created_at    timestamptz not null default now(),
  unique (org_id, platform)
);

create table if not exists public.social_posts (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references public.organizations(id) on delete cascade,
  platform          text not null check (platform in ('facebook','whatsapp','tiktok')),
  content           text not null,
  image_url         text,
  status            text not null default 'sent' check (status in ('sent','failed')),
  error             text,
  external_post_id  text,
  posted_by         uuid references auth.users(id),
  created_at        timestamptz not null default now()
);

-- RLS : même modèle que le reste (deny-all puis policies org)
alter table public.social_accounts enable row level security;
alter table public.social_posts enable row level security;

drop policy if exists "sa_all_org" on public.social_accounts;
create policy "sa_all_org"
on public.social_accounts for all to authenticated
using (org_id = (select public.current_org_id()))
with check (org_id = (select public.current_org_id()));

drop policy if exists "sp_all_org" on public.social_posts;
create policy "sp_all_org"
on public.social_posts for all to authenticated
using (org_id = (select public.current_org_id()))
with check (org_id = (select public.current_org_id()));
