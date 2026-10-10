-- ============================================================
-- MAYELA CRM - Migration V18 : fermer la fuite RLS de social_accounts_safe
-- A executer dans : Supabase Management API / Supabase Dashboard → SQL
-- Date : 9 octobre 2026
--
-- INCIDENT (confirme par test avec la cle anon publique) :
--   `GET /rest/v1/social_accounts_safe` avec la cle anon renvoyait les lignes
--   de social_accounts (org_id, connected_by, config, comptes pub...), alors
--   qu'anon ne doit RIEN voir.
--
-- CAUSE RACINE :
--   La vue est en `security_invoker = false` et appartient a `postgres`.
--   Or le role `postgres` a `rolbypassrls = true` : la RLS (meme `FORCE ROW
--   LEVEL SECURITY`) de la table social_accounts est integralement contournee.
--   L'hypothese de la MIGRATION_V7 (« FORCE RLS preserve le filtrage ») est
--   donc FAUSSE des que le proprietaire de la vue peut bypasser la RLS.
--   Resultat mesure : la vue renvoyait TOUTES les lignes a TOUS les appelants.
--
-- CORRECTION :
--   On garde `security_invoker = false` (indispensable : la colonne `config`
--   est revoquee aux roles client, cf. V7, et la vue doit la lire via le
--   proprietaire pour produire le JSON nettoye), MAIS on ajoute le filtre de
--   ligne explicite, identique a la politique RLS `sa_all_org` :
--       org_id = public.current_org_id()
--   `current_org_id()` est SECURITY DEFINER et derive de auth.uid() : elle
--   renvoie l'espace actif de l'appelant, ou NULL (=> aucune ligne) pour anon.
--   Le cas service_role (outils d'admin/diagnostic) est conserve explicitement.
--
-- SÛRETÉ :
--   - Le front lit la vue via la session authentifiee (mayela-crm.html,
--     loadSocial) : comportement inchange pour un membre legitime.
--   - Les Edge Functions lisent la TABLE BRUTE social_accounts via service_role,
--     jamais la vue : aucun impact.
--   - Migration idempotente (CREATE OR REPLACE VIEW), aucune donnee touchee.
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
  (config ? 'marketing_access_token') as has_marketing,
  (coalesce(config->>'client_secret', '') <> '') as has_app_secret
from public.social_accounts
where org_id = public.current_org_id()
   or (auth.jwt() ->> 'role') = 'service_role';

-- Le reglage de vue reste explicite (CREATE OR REPLACE peut le reinitialiser).
alter view public.social_accounts_safe set (security_invoker = false);

-- Defense en profondeur : anon n'a aucun besoin de lire cette vue.
grant select on public.social_accounts_safe to authenticated, service_role;
revoke select on public.social_accounts_safe from anon;

-- ============================================================
-- FIN
-- Vérifications (voir config/_verify_v18.mjs) :
--   1) anon (cle publique)  : 0 ligne  -> fuite fermee
--   2) membre authentifie    : 1 ligne  -> pas de regression
--   3) service_role          : 1 ligne  -> outils d'admin intacts
-- ============================================================
