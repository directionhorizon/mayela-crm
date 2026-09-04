-- ============================================================
-- MAYELA CRM — Migration V4 : vue sécurisée social_accounts_safe
-- À exécuter dans : Supabase Dashboard → SQL Editor → New query → Run
-- Date : 4 septembre 2026
--
-- OBJECTIF :
--   Empêcher la fuite des secrets réseau sociaux (TikTok/Facebook) vers le
--   navigateur. La table `social_accounts.config` (jsonb) contient des secrets
--   (client_secret, access_token, refresh_token, open_id, page_id,
--   pixel_access_token, adjust_app_token, adjust_s2s_token).
--   La vue `social_accounts_safe` les retire du JSON renvoyé, en plus de
--   fournir un booléen `connected` et `has_pixel_token` pour l'interface.
--
-- La vue est `security_invoker = true` (PostgreSQL 15+) : les politiques RLS de
-- la table `social_accounts` (sa_all_org) s'appliquent donc aux lecteurs.
--
-- L'application (mayela-crm.html) lit désormais cette vue au lieu de la table.
-- ============================================================

-- ---------- Fonction de nettoyage du config (clés secrètes retirées) ----------
create or replace function public.sanitize_social_config(cfg jsonb)
returns jsonb
language sql
immutable
as $$
  select coalesce((
    select jsonb_object_agg(k, v) from jsonb_each(cfg) as t(k, v)
    where k not in (
      'client_secret','access_token','refresh_token','open_id','page_id',
      'pixel_access_token','adjust_app_token','adjust_s2s_token'
    )
  ), '{}'::jsonb)
$$;

-- ---------- Vue sécurisée ----------
drop view if exists public.social_accounts_safe;
create view public.social_accounts_safe
with (security_invoker = true)
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
  (config ? 'pixel_access_token') as has_pixel_token
from public.social_accounts;

-- ---------- GRANT d'accès à la vue ----------
grant select on public.social_accounts_safe to anon, authenticated, service_role;

-- ---------- FIN ----------
-- Vérification (optionnel) :
--   select platform, connected, has_pixel_token, config
--   from public.social_accounts_safe;
