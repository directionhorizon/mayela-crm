-- ============================================================
-- MAYELA CRM — Migration V5 (06 sept 2026) — ia_messages
-- Persistance des conversations du Conseiller IA (par utilisateur)
-- À exécuter dans : Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- Table si absente (l'app enregistre déjà role + content)
create table if not exists public.ia_messages (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  role       text not null check (role in ('user','assistant')),
  content    text not null,
  created_at timestamptz not null default now()
);

-- Si la table existait déjà sans la colonne user_id
alter table public.ia_messages add column if not exists user_id uuid;

alter table public.ia_messages enable row level security;

-- Chaque utilisateur voit et écrit uniquement ses propres messages
drop policy if exists "iam_own" on public.ia_messages;
create policy "iam_own" on public.ia_messages
for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

grant select, insert, update, delete on public.ia_messages to authenticated;