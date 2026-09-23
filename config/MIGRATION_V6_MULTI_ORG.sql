-- ============================================================
-- MAYELA CRM — Migration V6 : multi-espaces (EVO-001)
-- À exécuter dans : Supabase Dashboard → SQL Editor → New query → Run
-- Date : 9 septembre 2026
--
-- OBJECTIF :
--   Permettre à un même compte (login) d'appartenir à plusieurs
--   espaces (business) et de basculer entre eux, tout en conservant
--   1 connexion TikTok/Facebook/Google Sheets PAR espace (inchangé).
--
-- PRINCIPE :
--   - profiles.org_id     : espace "maison" (1er créé/rejoint), valeur par défaut.
--   - profiles.active_org_id : espace actuellement actif (NULL = org_id).
--   - org_members         : appartenances d'un utilisateur à des espaces.
--   - current_org_id()    : retourne active_org_id si le membre y appartient,
--     sinon org_id. Toutes les politiques RLS org-based suivent donc l'espace
--     actif automatiquement.
--
-- AUCUNE données existante n'est déplacée : les comptes actuels gardent leur
-- comportement (active_org_id NULL → fallback org_id).
-- ============================================================

-- ---------- 1) Table org_members (appartenance aux espaces) ----------
create table if not exists public.org_members (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  org_id     uuid not null references public.organizations(id) on delete cascade,
  role       text not null default 'membre',   -- 'admin' | 'membre'
  created_at timestamptz not null default now(),
  primary key (user_id, org_id)
);

alter table public.org_members enable row level security;

-- Un membre voit ses propres appartenances.
drop policy if exists "om_self_select" on public.org_members;
create policy "om_self_select"
  on public.org_members for select to authenticated
  using (user_id = auth.uid());

-- Les insertions passent UNIQUEMENT par les fonctions SECURITY DEFINER
-- (create_organization, join_organization). Aucun insert direct côté client.
drop policy if exists "om_no_insert" on public.org_members;
create policy "om_no_insert"
  on public.org_members for insert to authenticated
  with check (false);

-- ---------- 2) Colonne active_org_id sur profiles ----------
alter table public.profiles add column if not exists active_org_id uuid
  references public.organizations(id) on delete set null;

-- ---------- 3) current_org_id() : espace actif, sinon espace maison ----------
create or replace function public.current_org_id()
returns uuid
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select coalesce(
    (select m.org_id from public.org_members m
      where m.user_id = p.id and m.org_id = p.active_org_id limit 1),
    p.org_id
  )
  from public.profiles p
  where p.id = auth.uid();
$$;

-- ---------- 4) create_organization : crée l'org + l'appartenance admin ----------
create or replace function public.create_organization(org_name text)
returns table (id uuid, name text, join_code text)
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  new_org_id uuid;
  new_code text;
begin
  new_code := upper(substr(md5(random()::text), 1, 6));
  insert into public.organizations (name, join_code, created_by)
  values (org_name, new_code, auth.uid())
  returning organizations.id into new_org_id;

  -- Nouvelle appartenance (admin)
  insert into public.org_members (user_id, org_id, role)
  values (auth.uid(), new_org_id, 'admin')
  on conflict (user_id, org_id) do update set role = 'admin';

  -- Profil : org_id maison si vide, active_org_id = nouvel espace
  update public.profiles
  set org_id          = coalesce(public.profiles.org_id, new_org_id),
      active_org_id   = new_org_id,
      role            = 'admin',
      workspace_type  = 'entreprise'
  where profiles.id = auth.uid();

  return query select organizations.id, organizations.name, organizations.join_code
    from public.organizations where organizations.id = new_org_id;
end;
$function$;

-- ---------- 5) join_organization : AJOUTE l'appartenance (ne ré-assigne plus org_id maison) ----------
create or replace function public.join_organization(code text)
returns table (id uuid, name text)
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  found_org_id uuid;
  found_org_name text;
  home_org uuid;
begin
  select organizations.id, organizations.name into found_org_id, found_org_name
    from public.organizations where organizations.join_code = upper(code);

  if found_org_id is null then
    raise exception 'Code entreprise invalide';
  end if;

  -- Appartenance ajoutée (ne casse pas une appartenance existante)
  insert into public.org_members (user_id, org_id, role)
  values (auth.uid(), found_org_id, 'membre')
  on conflict (user_id, org_id) do nothing;

  -- active_org_id = espace rejoint ; org_id maison inchangé si déjà posé
  select p.org_id into home_org from public.profiles p where p.id = auth.uid();
  update public.profiles
  set active_org_id  = found_org_id,
      role           = case when home_org is null then 'membre' else role end,
      workspace_type = 'entreprise'
  where profiles.id = auth.uid();

  return query select found_org_id, found_org_name;
end;
$function$;

-- ---------- 6) switch_org : bascule de l'espace actif ----------
create or replace function public.switch_org(org_id uuid)
returns table (id uuid, name text)
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  -- L'utilisateur doit être membre de la cible
  if not exists (
    select 1 from public.org_members m
    where m.user_id = auth.uid() and m.org_id = switch_org.org_id
  ) then
    raise exception 'Vous n''appartenez pas à cet espace';
  end if;

  update public.profiles set active_org_id = switch_org.org_id where id = auth.uid();

  return query select organizations.id, organizations.name
    from public.organizations where organizations.id = switch_org.org_id;
end;
$function$;

-- ---------- 7) Organizations : la SELECT autorise tout espace dont on est membre ----------
drop policy if exists "org_member_select" on public.organizations;
create policy "org_member_select"
  on public.organizations for select to authenticated
  using (id in (select org_id from public.org_members where user_id = auth.uid()));

-- ---------- 8) Storage produits : dossier de l'espace ACTIF ----------
drop policy if exists "prod_upload_org" on storage.objects;
create policy "prod_upload_org"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'produits' and
    (storage.foldername(name))[1] = (
      select coalesce(active_org_id, org_id)::text from public.profiles where id = auth.uid()
    )
  );

drop policy if exists "prod_update_org" on storage.objects;
create policy "prod_update_org"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'produits' and
    (storage.foldername(name))[1] = (
      select coalesce(active_org_id, org_id)::text from public.profiles where id = auth.uid()
    )
  );

drop policy if exists "prod_delete_org" on storage.objects;
create policy "prod_delete_org"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'produits' and
    (storage.foldername(name))[1] = (
      select coalesce(active_org_id, org_id)::text from public.profiles where id = auth.uid()
    )
  );

-- ---------- 9) Alimentation initiale : appartenance "maison" pour chaque profil existant ----------
insert into public.org_members (user_id, org_id, role)
select id, org_id, coalesce(role, 'admin')
from public.profiles
where org_id is not null
on conflict (user_id, org_id) do nothing;

-- ---------- 10) GRANTS ----------
grant select on public.org_members to authenticated;
grant execute on function public.switch_org(uuid) to authenticated;
grant execute on function public.current_org_id() to anon, authenticated, service_role;
grant execute on function public.create_organization(text) to authenticated;
grant execute on function public.join_organization(text) to authenticated;

-- ---------- FIN ----------
-- Vérifications :
--   select platform, connected from public.social_accounts_safe;
--   select user_id, org_id, role from public.org_members;
--   select id, org_id, active_org_id from public.profiles;