-- ============================================================
-- MAYELA CRM — Migration V10 : TikTok Marketing API (analyse publicitaire)
-- À exécuter dans : Supabase Dashboard → SQL Editor → New query → Run
-- Date : 15 septembre 2026
--
-- OBJECTIF :
--   La TikTok Marketing API (business-api.tiktok.com) exige un flux OAuth
--   distinct du Login Kit : autorisation côté ads.tiktok.com/marketing_api,
--   échange `auth_code` → access_token longue durée + liste d'advertiser
--   accounts. Le token et les advertiser_ids sont stockés dans la colonne
--   `config` de `social_accounts` (plateforme = 'tiktok'), exactement comme
--   le flux organique.
--
--   La vue `social_accounts_safe` (lue par le navigateur) ne doit JAMAIS
--   exposer ce token. On ajoute donc :
--     1) le champ `marketing_access_token` à la liste des secrets purgés
--        par `sanitize_social_config` ;
--     2) un booléen `has_marketing` dans la vue pour que l'interface puisse
--        afficher l'état « Analyse publicitaire » sans jamais voir le token.
--
-- La migration est ADDITIVE et IDEMPOTENTE : sans danger à (re)exécuter.
-- ============================================================

-- ---------- 1) Purgation du nouveau secret ----------
create or replace function public.sanitize_social_config(cfg jsonb)
returns jsonb
language sql
immutable
as $$
  select coalesce((
    select jsonb_object_agg(k, v) from jsonb_each(cfg) as t(k, v)
    where k not in (
      'client_secret','access_token','refresh_token','open_id','page_id',
      'pixel_access_token','adjust_app_token','adjust_s2s_token',
      'marketing_access_token'
    )
  ), '{}'::jsonb)
$$;

-- ---------- 2) Vue safe : exposé has_marketing ----------
-- IMPORTANT : la vue reste en security_invoker = false (réglage imposé par la
-- migration V7) : seuls les droits du propriétaire permettent à
-- sanitize_social_config de lire la colonne config malgré le revoke
-- SELECT(config) de V7. Le filtrage par espace est conservé par le
-- FORCE ROW LEVEL SECURITY posé sur social_accounts en V7 (persistant).
drop view if exists public.social_accounts_safe;
create view public.social_accounts_safe
with (security_invoker = false)
as
select
  id,
  org_id,
  platform,
  display_name,
  connected_by,
  created_at,
  public.sanitize_social_config(config) as config,
  (config ? 'access_token') as connected,
  (config ? 'pixel_access_token') as has_pixel_token,
  (config ? 'marketing_access_token') as has_marketing
from public.social_accounts;

-- ---------- 3) GRANT d'accès à la vue ----------
grant select on public.social_accounts_safe to anon, authenticated, service_role;

-- ---------- FIN ----------
-- Vérifications (optionnel) :
--   select platform, connected, has_pixel_token, has_marketing, config
--   from public.social_accounts_safe;