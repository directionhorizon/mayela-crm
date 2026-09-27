-- ============================================================
-- MAYELA CRM — Migration V12 : sauvegarde serveur du réglage « top clients »
-- À exécuter dans : Supabase Dashboard → SQL Editor → New query → Run
--   (ou via une Edge Function temporaire `db-migrate` — cf. config/DEPLOY_BACKEND.md)
-- Date : 28 septembre 2026
--
-- OBJECTIF :
--   Le seul réglage de l'application qui vivait dans le stockage local de
--   l'appareil (localStorage 'mayela_topClientsCount' — nombre de clients
--   affichés dans « Top clients » / Réseaux sociaux, défaut 15, plage 3–50)
--   était perdu si l'appareil efface son propre stockage (iOS après ~7 jours
--   sans usage, réinstallation, onglet privé).
--
--   Il est donc stocké dans `profiles`, donc :
--     - restauré automatiquement après un effacement de l'appareil ;
--     - partagé entre les écrans (téléphone + version en ligne) ;
--     - synchronisé en direct : la table `profiles` est dans la publication
--       `supabase_realtime` (ajoutée le 28/09/2026 pour l'interconnexion).
--
-- SÉCURITÉ : aucune nouvelle politique RLS. `profiles_self_update` autorise
--   déjà chaque compte à mettre à jour SA propre ligne (`id = auth.uid()`).
--   La valeur est bornée par une contrainte CHECK côté base : impossible
--   d'y écrire une valeur hors plage, même en contournant l'application.
--
-- La migration est ADDITIVE et IDEMPOTENTE : sans danger à (re)exécuter.
-- ============================================================

-- ---------- 1) Colonne de préférence sur le profil ----------
alter table public.profiles
  add column if not exists top_clients_limit integer not null default 15;

-- ---------- 2) Garde-fou : plage 3–50 (valeur par défaut de l'app) ----------
-- `not valid` : les lignes existantes sont déjà à 15 (default), on évite un
-- verrou fort sur `profiles`. Les futures écritures sont contrôlées.
alter table public.profiles
  drop constraint if exists profiles_top_clients_limit_check;
alter table public.profiles
  add constraint profiles_top_clients_limit_check
  check (top_clients_limit between 3 and 50) not valid;

-- ---------- 3) Vérification ----------
-- Attendu : 0 ligne hors plage.
select count(*) as valeurs_hors_plage
  from public.profiles
 where top_clients_limit < 3 or top_clients_limit > 50;
