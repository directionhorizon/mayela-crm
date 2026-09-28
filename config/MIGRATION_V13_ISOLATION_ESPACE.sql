-- ============================================================
-- MAYELA CRM — Migration V13 : cloisonnement strict des données par espace
-- À exécuter dans : Supabase Dashboard → SQL Editor → New query → Run
-- Date : 28 septembre 2026
--
-- ── CE QUE LA VÉRIFICATION A RÉVÉLÉ ───────────────────────────
-- Deux failles distinctes, et non une seule :
--
-- 1) LES POLITIQUE « *_deny_anonymous » NE DENYAIENT RIEN.
--    Elles étaient créées PERMISSIVE (et non restrictive) avec
--        USING (auth.role() <> 'anon')
--    Or plusieurs politiques permissives sur une même commande sont
--    combinées par OU. Résultat : dès qu'un compte est connecté, la ligne
--    passe cette politique, qui neutralise TOUTES les autres. Concrètement,
--    chaque client connecté pouvait lire — et écrire, puisque cmd = ALL —
--    l'intégralité de clients, achats, devis, tasks, interactions,
--    organizations et profiles. C'est la cause de la transposition observée :
--    les données de l'ancien espace apparaissaient dans l'espace actuel.
--    organizations était notamment lisible en écriture, donc les codes
--    d'invitation de tous les espaces étaient exposés, et profiles permitait
--    de modifier le profil d'un autre compte.
--
-- 2) L'ÉCHAPPATOIRE `owner_user_id = auth.uid()` sur clients et
--    produits_services, qui laissait fuiter vers les autres espaces tout ce
--    qui était rattaché à une personne plutôt qu'à un espace.
--
-- ── LE CORRECTIF ──────────────────────────────────────────────
-- A) Suppression des 8 politiques `*_deny_anonymous`, remplacées par un
--    blocage explicite `TO anon USING (false)`. Le rôle qui n'a aucune
--    politique applicable se voit tout refuser par PostgreSQL : c'est bien
--    plus sûr que de compter sur un « deny » permissif.
-- B) Toutes les politiques réelles sont désormais ciblées `TO authenticated`
--    au lieu de `public`, et ne portent plus de branche `owner_user_id`
--    lorsqu'un espace est renseigné.
-- C) Une seule politique par table et par commande : deux politiques
--    permissives se combinant en OU, la redondance est un risque, pas une
--    marge de sécurité.
--
-- ── SÉCURITÉ ─────────────────────────────────────────────────
-- `current_org_id()` est calculée CÔTÉ SERVEUR depuis org_members et
-- profiles.active_org_id. Un client ne peut donc pas élargir sa visibilité en
-- modifiant sa requête : il ne contrôle que le choix de son espace actif, et
-- l'appartenance est revérifiée en base.
--
-- ── HORS PÉRIMÈTRE (assumé) ──────────────────────────────────
-- horizon_leads (205 lignes), horizon_strategy_logs, horizon_api_configs et
-- audit_log n'ont pas de colonne d'espace : ce sont des bases globales de
-- l'agence. horizon_leads n'est de plus lisible que par le staff Horizon.
-- audit_log reste lisible par son auteur uniquement, et n'est plus modifiable
-- que par le service_role.
--
-- La migration est IDEMPOTENTE : sans danger à (re)exécuter.
-- Contrôle de non-régression : node config/verify_v13_isolation.mjs
-- ============================================================

-- ---------- 0) Contrôle préalable : aucune donnée orpheline ----------
-- Si un compteur n'est pas à 0, resserrer les politiques fermerait l'accès à
-- des données existantes. Dans ce cas, NE PAS poursuivre.
select
  (select count(*) from public.clients where org_id is null and owner_user_id is null) as clients_sans_cible,
  (select count(*) from public.achats      where client_id is null)                       as achats_sans_client,
  (select count(*) from public.devis       where client_id is null)                       as devis_sans_client,
  (select count(*) from public.tasks       where client_id is null)                       as taches_sans_client,
  (select count(*) from public.interactions where client_id is null)                      as interactions_sans_client,
  (select count(*) from public.creances    where client_id is null)                       as creances_sans_client;

-- ---------- 1) Fermeture du rôle anonyme ----------
-- On retire les « deny » permissifs (inopérants) et on pose un blocage net.
drop policy if exists clients_deny_anonymous        on public.clients;
drop policy if exists achats_deny_anonymous         on public.achats;
drop policy if exists devis_deny_anonymous          on public.devis;
drop policy if exists tasks_deny_anonymous          on public.tasks;
drop policy if exists interactions_deny_anonymous   on public.interactions;
drop policy if exists organizations_deny_anonymous on public.organizations;
drop policy if exists profiles_deny_anonymous       on public.profiles;
drop policy if exists audit_log_deny_anonymous      on public.audit_log;

drop policy if exists clients_block_anon on public.clients;
create policy clients_block_anon        on public.clients        for all to anon using (false) with check (false);
drop policy if exists achats_block_anon on public.achats;
create policy achats_block_anon         on public.achats         for all to anon using (false) with check (false);
drop policy if exists devis_block_anon on public.devis;
create policy devis_block_anon          on public.devis          for all to anon using (false) with check (false);
drop policy if exists tasks_block_anon on public.tasks;
create policy tasks_block_anon          on public.tasks          for all to anon using (false) with check (false);
drop policy if exists interactions_block_anon on public.interactions;
create policy interactions_block_anon   on public.interactions   for all to anon using (false) with check (false);
drop policy if exists organizations_block_anon on public.organizations;
create policy organizations_block_anon on public.organizations for all to anon using (false) with check (false);
drop policy if exists profiles_block_anon on public.profiles;
create policy profiles_block_anon       on public.profiles       for all to anon using (false) with check (false);
drop policy if exists audit_log_block_anon on public.audit_log;
create policy audit_log_block_anon      on public.audit_log      for all to anon using (false) with check (false);

-- ---------- 2) clients : isolation stricte par espace ----------
drop policy if exists clients_select on public.clients;
drop policy if exists clients_update on public.clients;
drop policy if exists clients_delete on public.clients;
drop policy if exists clients_insert on public.clients;
alter table public.clients enable row level security;

-- La contrainte owner_xor_org interdit de renseigner owner_user_id ET org_id :
-- une ligne est soit rattachée à un espace, soit à une personne. La branche
-- « sans espace » couvre donc ce second cas, pour le seul propriétaire.
drop policy if exists clients_select on public.clients;
create policy clients_select on public.clients for select to authenticated
  using ( org_id = current_org_id()
          or (org_id is null and owner_user_id = auth.uid()) );
drop policy if exists clients_insert on public.clients;
create policy clients_insert on public.clients for insert to authenticated
  with check ( org_id = current_org_id()
          or (org_id is null and owner_user_id = auth.uid()) );
drop policy if exists clients_update on public.clients;
create policy clients_update on public.clients for update to authenticated
  using ( org_id = current_org_id()
          or (org_id is null and owner_user_id = auth.uid()) )
  with check ( org_id = current_org_id()
          or (org_id is null and owner_user_id = auth.uid()) );
drop policy if exists clients_delete on public.clients;
create policy clients_delete on public.clients for delete to authenticated
  using ( org_id = current_org_id()
          or (org_id is null and owner_user_id = auth.uid()) );

-- ---------- 3) Tables dépendantes du client : une seule politique, stricte ----------
drop policy if exists achats_all on public.achats;
create policy achats_all on public.achats for all to authenticated
  using ( exists (select 1 from public.clients c
                   where c.id = achats.client_id and c.org_id = current_org_id()) )
  with check ( exists (select 1 from public.clients c
                   where c.id = achats.client_id and c.org_id = current_org_id()) );

drop policy if exists devis_all on public.devis;
create policy devis_all on public.devis for all to authenticated
  using ( exists (select 1 from public.clients c
                   where c.id = devis.client_id and c.org_id = current_org_id()) )
  with check ( exists (select 1 from public.clients c
                   where c.id = devis.client_id and c.org_id = current_org_id()) );

drop policy if exists tasks_all on public.tasks;
create policy tasks_all on public.tasks for all to authenticated
  using ( exists (select 1 from public.clients c
                   where c.id = tasks.client_id and c.org_id = current_org_id()) )
  with check ( exists (select 1 from public.clients c
                   where c.id = tasks.client_id and c.org_id = current_org_id()) );

drop policy if exists interactions_all on public.interactions;
create policy interactions_all on public.interactions for all to authenticated
  using ( exists (select 1 from public.clients c
                   where c.id = interactions.client_id and c.org_id = current_org_id()) )
  with check ( exists (select 1 from public.clients c
                   where c.id = interactions.client_id and c.org_id = current_org_id()) );

-- `cr_all_org` était déjà stricte, mais les deux politiques larges
-- la neutralisaient : policies permissives combinees par OU.
drop policy if exists creances_strict on public.creances;
drop policy if exists creances_all on public.creances;
drop policy if exists creances_all_via_client_ownership on public.creances;
drop policy if exists creances_all on public.creances;
create policy creances_all on public.creances for all to authenticated
  using ( exists (select 1 from public.clients c
                   where c.id = creances.client_id and c.org_id = current_org_id()) )
  with check ( exists (select 1 from public.clients c
                   where c.id = creances.client_id and c.org_id = current_org_id()) );

-- ---------- 4) produits_services : même resserrement ----------
-- Deux politiques identiques et larges se combinaient : même effet qu'aucune.
drop policy if exists produits_services_all on public.produits_services;
drop policy if exists produits_services_all_own_scope on public.produits_services;
drop policy if exists produits_services_all on public.produits_services;
create policy produits_services_all on public.produits_services for all to authenticated
  using ( org_id = current_org_id()
          or (org_id is null and owner_user_id = auth.uid()) )
  with check ( org_id = current_org_id()
          or (org_id is null and owner_user_id = auth.uid()) );

-- ---------- 5) Conversation IA : espace renseigné puis cloisonné ----------
-- Backfill : chaque message historique est rattaché à l'espace actif de son
-- auteur. Choix assumé : une conversation appartient à l'espace où elle a eu
-- lieu et n'est pas lisible depuis un autre espace.
update public.ia_messages m
   set org_id = coalesce(
         (select m2.org_id from public.org_members m2
           where m2.user_id = m.user_id
           order by (select p.active_org_id from public.profiles p where p.id = m.user_id) = m2.org_id desc,
                    m2.org_id
           limit 1),
         (select p.org_id from public.profiles p where p.id = m.user_id))
  from public.profiles p
 where p.id = m.user_id
   and m.org_id is null;

drop policy if exists ia_messages_space on public.ia_messages;
drop policy if exists ia_messages_own on public.ia_messages;
drop policy if exists ia_messages_own_only on public.ia_messages;
drop policy if exists iam_own on public.ia_messages;
drop policy if exists ia_messages_space on public.ia_messages;
create policy ia_messages_space on public.ia_messages for all to authenticated
  using ( user_id = auth.uid() and org_id = current_org_id() )
  with check ( user_id = auth.uid() and org_id = current_org_id() );

-- L'espace est determine par le SERVEUR, jamais par le navigateur.
-- Le trigger remplit org_id depuis current_org_id() quand le client ne le
-- fournit pas. Deux raisons :
--   * le client ne peut pas choisir librement l'espace d'un message ;
--   * si le cache local de l'app est en retard sur profiles.active_org_id,
--     envoyer un org_id erronne ferait echouer l'insertion (403) et la
--     conversation ne serait pas enregistree. Avec le trigger, la base tranche.
create or replace function public.ia_messages_set_org() returns trigger
  language plpgsql security definer set search_path = public, pg_temp as $fn$
begin
  if new.org_id is null then
    new.org_id := public.current_org_id();
  end if;
  return new;
end;
$fn$;

drop trigger if exists ia_messages_set_org_trg on public.ia_messages;
create trigger ia_messages_set_org_trg
  before insert on public.ia_messages
  for each row execute function public.ia_messages_set_org();

-- ---------- 6) Vérification ----------
-- Attendu : plus aucune politique `*_deny_anonymous`, plus aucune politique
-- énoncée pour le rôle `public` sur ces tables, et une seule politique par
-- table (hors blocages `to anon`).
select tablename, policyname, cmd, roles::text, permissive,
       left(coalesce(qual, ''), 60) as using_gauche
  from pg_policies
 where schemaname = 'public'
   and tablename in ('clients','achats','devis','tasks','interactions','creances',
                     'ia_messages','produits_services','organizations','profiles','audit_log')
 order by tablename, cmd, policyname;
