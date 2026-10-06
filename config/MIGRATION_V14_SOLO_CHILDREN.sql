-- ============================================================
-- MAYELA CRM - Migration V14 : etendre l isolation au mode sans espace (solo)
-- A executer dans : Supabase Dashboard ? SQL Editor ? New query ? Run
-- Date : 29 septembre 2026
--
-- Contexte : V13 a couvert clients/produits_services avec la branche
-- (org_id IS NULL AND owner_user_id = auth.uid()), mais pas les tables enfants
-- ni ia_messages. Resultat : ecriture impossible sur achats/devis/tasks/
-- interactions/creances/ia_messages quand le client est orphelin (solo).
--
-- Idempotente.
-- ============================================================

-- ---------- 1) Tables enfants : achats, devis, tasks, interactions, creances
drop policy if exists achats_all on public.achats;
create policy achats_all on public.achats for all to authenticated
  using ( exists (select 1 from public.clients c
                   where c.id = achats.client_id
                     and (
                       c.org_id = current_org_id()
                       or (c.org_id is null and c.owner_user_id = auth.uid())
                     )) )
  with check ( exists (select 1 from public.clients c
                        where c.id = achats.client_id
                          and (
                            c.org_id = current_org_id()
                            or (c.org_id is null and c.owner_user_id = auth.uid())
                          )) );

drop policy if exists devis_all on public.devis;
create policy devis_all on public.devis for all to authenticated
  using ( exists (select 1 from public.clients c
                   where c.id = devis.client_id
                     and (
                       c.org_id = current_org_id()
                       or (c.org_id is null and c.owner_user_id = auth.uid())
                     )) )
  with check ( exists (select 1 from public.clients c
                        where c.id = devis.client_id
                          and (
                            c.org_id = current_org_id()
                            or (c.org_id is null and c.owner_user_id = auth.uid())
                          )) );

drop policy if exists tasks_all on public.tasks;
create policy tasks_all on public.tasks for all to authenticated
  using ( exists (select 1 from public.clients c
                   where c.id = tasks.client_id
                     and (
                       c.org_id = current_org_id()
                       or (c.org_id is null and c.owner_user_id = auth.uid())
                     )) )
  with check ( exists (select 1 from public.clients c
                        where c.id = tasks.client_id
                          and (
                            c.org_id = current_org_id()
                            or (c.org_id is null and c.owner_user_id = auth.uid())
                          )) );

drop policy if exists interactions_all on public.interactions;
create policy interactions_all on public.interactions for all to authenticated
  using ( exists (select 1 from public.clients c
                   where c.id = interactions.client_id
                     and (
                       c.org_id = current_org_id()
                       or (c.org_id is null and c.owner_user_id = auth.uid())
                     )) )
  with check ( exists (select 1 from public.clients c
                        where c.id = interactions.client_id
                          and (
                            c.org_id = current_org_id()
                            or (c.org_id is null and c.owner_user_id = auth.uid())
                          )) );

drop policy if exists creances_all on public.creances;
create policy creances_all on public.creances for all to authenticated
  using ( exists (select 1 from public.clients c
                   where c.id = creances.client_id
                     and (
                       c.org_id = current_org_id()
                       or (c.org_id is null and c.owner_user_id = auth.uid())
                     )) )
  with check ( exists (select 1 from public.clients c
                        where c.id = creances.client_id
                          and (
                            c.org_id = current_org_id()
                            or (c.org_id is null and c.owner_user_id = auth.uid())
                          )) );

-- ---------- 2) ia_messages : autoriser le mode solo (org_id NULL, proprietaire)
drop policy if exists ia_messages_space on public.ia_messages;
create policy ia_messages_space on public.ia_messages for all to authenticated
  using (
    user_id = auth.uid()
    and (
      org_id = current_org_id()
      or org_id is null
    )
  )
  with check (
    user_id = auth.uid()
    and (
      org_id = current_org_id()
      or org_id is null
    )
  );
