-- ============================================================
-- MAYELA CRM - Migration V17 : purger user_access_token de la vue
-- À exécuter dans : Supabase Management API / Supabase Dashboard → SQL
-- Date : 6 octobre 2026
--
-- OBJECTIF :
--   MIGRATION_V4 retire de `config` les secrets lus par le navigateur via la vue
--   social_accounts_safe. Sa liste n'a jamais inclus `user_access_token`, clé
--   écrite par social-facebook (action "exchange") quand il échange le code
--   Meta contre un user token longue durée (~60 jours).
--
--   Conséquence : dès la première connexion Facebook réussie, ce token était
--   renvoyé en clair dans la réponse PostgREST de social_accounts_safe, donc
--   lisible par tout utilisateur authentifié de l'espace —independamment des
--   RLS, qui filtrent les LIGNES et non les COLONNES.
--
--   Le front ne fait que masquer la clé à l'affichage (SOCIAL_SECRET_KEYS) :
--   cela ne protège rien, la valeur est déjà partie dans la réponse réseau.
--
-- SÛRETÉ DE LA CORRECTION :
--   Les fonctions Edge lisent la table BRUTE social_accounts via le service_role
--   (cf. index.ts, client admin), jamais la vue. Les usages serveur de
--   cfg.user_access_token (re-connexion, republication, select_page, Ads) sont
--   donc intacts : ce sont eux, et eux seuls, qui doivent voir ce token.
--
--   Migration ADDITIVE et IDEMPOTENTE : CREATE OR REPLACE FUNCTION, aucune
--   donnée n'est supprimée, la colonne reste intacte dans la table.
-- ============================================================

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
      'marketing_access_token',
      -- V17 : user token Facebook longue durée. Ajouté après coup, d'où la fuite :
      -- il a été introduit dans la config bien après la V4, qui ne pouvait pas
      -- encore le prévoir. Sans lui, le token fuit dans la vue lue par le front.
      'user_access_token'
    )
  ), '{}'::jsonb)
$$;

-- ============================================================
-- FIN
-- Vérification (lecture seule, aucun secret affiché) :
--
--   1) La clé ne doit plus sortir :
--      select public.sanitize_social_config(
--        '{"client_id":"1","user_access_token":"FAUX","pages":[]}'::jsonb
--      ) ? 'user_access_token';
--      -- attendu : false
--
--   2) Ce que le front DOIT toujours recevoir (aucune régression) :
--      select platform, connected, has_app_secret, has_marketing,
--             public.sanitize_social_config(config)->>'client_id' as app_id
--      from public.social_accounts_safe;
--      -- attendu pour PHARMAZEN : connected = false, has_app_secret = true,
--      -- app_id = 28660855693581773
--
--   3) Le token serveur est intact (la table n'a pas bougé) :
--      select config ? 'user_access_token' from social_accounts
--      where platform = 'facebook';
--      -- attendu après connexion : true
-- ============================================================