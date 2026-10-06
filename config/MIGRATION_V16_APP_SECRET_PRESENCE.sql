-- ============================================================
-- MAYELA CRM - Migration V16 : exposer la présence de l'App Secret Meta
-- À exécuter dans : Supabase Management API / Supabase Dashboard → SQL
-- Date : 29 septembre 2026
--
-- OBJECTIF :
--   La vue social_accounts_safe retire volontairement client_secret du JSON
--   renvoyé au navigateur (MIGRATION_V4). Conséquence : le front ne peut pas
--   distinguer « App Meta configuré » de « App ID seul, secret manquant ».
--
--   Résultat : le bouton « Autoriser » de la carte Page Facebook partait
--   directement sur la fenêtre Meta, sans jamais proposer la saisie du secret.
--   La connexion prenait alors toute la fenêtre Facebook pour finir sur
--   « App Meta non enregistrée ».
--
--   On expose ici un booléen, pas le secret : l'information ne quitte pas le
--   serveur sous une forme utile, et suffit au front pour router vers le panneau.
-- ============================================================

create or replace view public.social_accounts_safe
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
  -- Colonnes ajoutées après la V4 (Meta Ads V10/V11) : l'ordre et le nom sont
  -- conservés à l'identique, sinon CREATE OR REPLACE VIEW les supprimerait et
  -- casserait l'affichage de l'état Meta Ads.
  (config ? 'marketing_access_token') as has_marketing,
  -- V16 : le secret n'est pas renvoyé, seule sa présence l'est.
  (coalesce(config->>'client_secret', '') <> '') as has_app_secret
from public.social_accounts;

-- RLS inchangée : la lecture reste filtrée par espace (cf. MIGRATION_V7).
alter view public.social_accounts_safe set (security_invoker = false);
alter table public.social_accounts force row level security;

grant select on public.social_accounts_safe to anon, authenticated, service_role;

-- ============================================================
-- FIN
-- Vérification :
--   select platform, connected, has_app_secret
--   from social_accounts_safe;
--   -- attendu pour PHARMAZEN : connected = false, has_app_secret = false
--   -- attendu après saisie du secret dans le CRM : has_app_secret = true
-- ============================================================
