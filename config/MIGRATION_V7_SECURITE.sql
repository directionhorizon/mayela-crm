-- ============================================================
-- MAYELA CRM — Migration V7 : durcissement sécurité
-- À exécuter dans : Supabase Dashboard → SQL Editor → New query → Run
-- Date : 10 septembre 2026
--
-- OBJECTIFS (correspondent aux 3 risques identifiés) :
--   1) Prise de contrôle de compte via confirm-email-change → table
--      email_change_requests : la demande de changement est enregistrée
--      côté serveur AVANT l'envoi du code OTP. La policy RLS
--      "ecr_insert_self" force user_id = auth.uid() : un client ne peut
--      JAMAIS cibler un autre compte. La fonction Edge lit le compte
--      original depuis cette table (plus aucun UUID fourni par le client).
--   2) Tokens OAuth/TikTok/Facebook lisibles par tout membre → on retire
--      le droit de SELECT sur les colonnes `config` de social_accounts et
--      integrations_oauth pour les rôles client (anon/authenticated).
--      Les Edge Functions lisent désormais ces secrets avec le rôle
--      service_role (instructions dans DEPLOY_BACKEND.md).
--   3) La vue social_accounts_safe doit continuer de fonctionner malgré le
--      revoke ci-dessus : on la passe en "security_invoker = false" (droits
--      du propriétaire) tout en forçant la RLS sur la table (FORCE ROW LEVEL
--      SECURITY) pour que le filtrage par espace soit conservé.
-- ============================================================

-- ---------- 1) Table email_change_requests ----------
create table if not exists public.email_change_requests (
  id          uuid        not null default gen_random_uuid() primary key,
  user_id     uuid        not null,
  new_email   text        not null,
  created_at  timestamptz not null default now()
);

create index if not exists email_change_requests_new_email_idx
  on public.email_change_requests (new_email, created_at desc);

alter table public.email_change_requests enable row level security;

-- Insertions : l'auteur de la demande est TOUJOURS l'utilisateur connecté.
-- Aucune demande ciblant un autre user_id ne peut être créée (anti détournement).
drop policy if exists "ecr_insert_self" on public.email_change_requests;
create policy "ecr_insert_self"
  on public.email_change_requests for insert to authenticated
  with check (user_id = auth.uid());

-- Lecture/annulation : uniquement par l'auteur de la demande.
drop policy if exists "ecr_select_self" on public.email_change_requests;
create policy "ecr_select_self"
  on public.email_change_requests for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "ecr_delete_self" on public.email_change_requests;
create policy "ecr_delete_self"
  on public.email_change_requests for delete to authenticated
  using (user_id = auth.uid());

grant insert, select, delete on public.email_change_requests to authenticated;

-- ---------- 2) Masquer les secrets (colonnes `config`) aux rôles client ----------
revoke select (config) on public.social_accounts from anon, authenticated;
revoke select (config) on public.integrations_oauth from anon, authenticated;

-- ---------- 3) Vue social_accounts_safe : lecture via le propriétaire,
--    le filtrage par espace restant assuré par la RLS forcée ----------
alter view public.social_accounts_safe set (security_invoker = false);
alter table public.social_accounts force row level security;

-- ---------- FIN ----------
-- Vérifications :
--   select platform, connected, has_pixel_token, config from public.social_accounts_safe;
--   -- attendu : config ne contient plus d'access_token etc. pour un membre.
--   select id from public.social_accounts;              -- OK (colonnes non secrètes)
--   select config from public.social_accounts;          -- doit échouer (permission denied)
--   insert into public.email_change_requests (user_id, new_email) values (auth.uid(), 'x@y.com');  -- OK
--   -- toute tentative avec un user_id différent doit échouer (policy ecr_insert_self).