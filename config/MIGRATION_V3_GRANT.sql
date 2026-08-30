-- ============================================================
-- MAYELA CRM — Migration V3 (SECOURS) : uniquement les GRANT
-- À exécuter dans : Supabase Dashboard → SQL Editor → New query → Run
--
-- Ce script minimal corrige les erreurs "permission denied" (42501).
-- Aucun bloc DO, aucune table nouvelle : le plus sûr possible.
-- À lancer AVANT la migration V2 complète, pour isoler une erreur back-end.
-- ============================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.clients, public.interactions, public.achats, public.devis, public.tasks,
  public.creances, public.organizations, public.profiles, public.produits_services,
  public.social_accounts, public.social_posts, public.social_events_log,
  public.audit_log
TO anon, authenticated, service_role;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
