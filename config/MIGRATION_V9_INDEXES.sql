-- ============================================================
-- MAYELA CRM — Migration V9 : index de performances
-- À exécuter dans : Supabase Dashboard → SQL Editor → New query → Run
-- Date : 13 septembre 2026
--
-- OBJECTIF : accélérer les scans de l'application mobile quand le volume
-- grossit (tableau de bord, centre d'action, rapports, fiches client).
-- Chaque colonne ci-dessous est une colonne de filtrage / tri réellement
-- utilisée par les requêtes de mayela-crm.html :
--   - achats.achat_date        (KPIs 30 j, ventes du jour, rapports par période)
--   - achats.campagne_id       (CA attribuable / ROAS)
--   - achats.client_id         (fiche client, centre d'action, exports)
--   - clients.created_at       (tri de la liste + segments "nouveaux")
--   - clients.campagne_origine (coût par prospect, entonnoir)
--   - clients.updated_at       (segments "à risque" / "en cours")
--   - interactions.statut_traitement (demandes en attente)
--   - interactions.client_id   (fiche client)
--   - tasks.due_date           (tâches en retard)
--   - tasks.client_id          (fiche client)
--   - devis.devis_date         (KPIs devis 30 j, rapports par période)
--   - devis.client_id          (fiche client)
--   - creances.client_id       (fiche client)
--   - campaigns.org_id         (RLS + listes campagnes)
--   - social_posts.status      (impact opérationnel)
--
-- La migration est ADDITIVE et IDEMPOTENTE : sans danger à (re)exécuter.
-- ============================================================

create index if not exists idx_achats_achat_date    on public.achats (achat_date);
create index if not exists idx_achats_campagne_id   on public.achats (campagne_id);
create index if not exists idx_achats_client_id     on public.achats (client_id);

create index if not exists idx_clients_created_at   on public.clients (created_at);
create index if not exists idx_clients_campagne     on public.clients (campagne_origine);
create index if not exists idx_clients_updated_at   on public.clients (updated_at);

create index if not exists idx_interactions_pending on public.interactions (statut_traitement);
create index if not exists idx_interactions_client  on public.interactions (client_id);

create index if not exists idx_tasks_due_date       on public.tasks (due_date);
create index if not exists idx_tasks_client_id      on public.tasks (client_id);

create index if not exists idx_devis_devis_date     on public.devis (devis_date);
create index if not exists idx_devis_client_id      on public.devis (client_id);

create index if not exists idx_creances_client_id   on public.creances (client_id);

create index if not exists idx_campaigns_org_id     on public.campaigns (org_id);

create index if not exists idx_posts_status         on public.social_posts (status);