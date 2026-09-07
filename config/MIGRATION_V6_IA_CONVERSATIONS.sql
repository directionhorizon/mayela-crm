-- MAYELA CRM — V6 : identifiant de conversation pour l'historique du conseiller IA
-- À exécuter dans Supabase Dashboard → SQL Editor → "New query" → Run

-- 1) Colonne conversation_id (uuid), optionnelle (vide = ancien format)
alter table public.ia_messages add column if not exists conversation_id uuid;

-- 2) Rattachement des discussions déjà existantes :
--    un lot = messages du même utilisateur espacés de moins de 30 minutes,
--    ordonnés chronologiquement. Chaque lot reçoit un conversation_id unique.
with flagged as (
  select id, user_id, created_at,
    case
      when lag(created_at) over (partition by user_id order by created_at, id) is null
        or (created_at - lag(created_at) over (partition by user_id order by created_at, id)) > interval '30 minutes'
      then 1 else 0
    end as is_start
  from public.ia_messages
  where conversation_id is null
),
segs as (
  select id, user_id,
    sum(is_start) over (partition by user_id order by created_at, id) as grp
  from flagged
),
groups as (
  select user_id, grp, gen_random_uuid() as conv_id
  from (select distinct user_id, grp from segs) d
)
update public.ia_messages m
set conversation_id = g.conv_id
from segs s
join groups g on g.user_id = s.user_id and g.grp = s.grp
where m.id = s.id;

-- 3) Index pour accélérer le regroupement et les requêtes d'historique
create index if not exists ia_messages_conv_idx on public.ia_messages(conversation_id);
create index if not exists ia_messages_created_idx on public.ia_messages(created_at);

-- Sécurité : la RLS existante (user_id = auth.uid()) couvre déjà cette colonne ;
-- aucune politique supplémentaire n'est nécessaire.