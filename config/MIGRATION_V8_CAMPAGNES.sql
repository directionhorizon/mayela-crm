-- ============================================================
-- MAYELA CRM — Migration V8 : modèle campagnes + champs reporting
-- À exécuter dans : Supabase Dashboard → SQL Editor → New query → Run
-- Date : 12 septembre 2026
--
-- OBJECTIF (fondation du moteur de reporting opérationnel) :
--   1) Table `campaigns` : le modèle campagne du mémoire (plateforme, type,
--      période, catégorie promue, budget, dépense réelle, portée, impressions,
--      clics/messages). Une campagne = une ligne ; l'écosystème ASsocié ne
--      se calcule qu'à partir de cette table.
--   2) `clients.campagne_origine` : campagne qui a amené le prospect.
--   3) `clients.consentement` : consentement promotionnel Oui/Non (relances).
--   4) `achats.campagne_id` : vente associée à une campagne (CA attribuable).
--   5) `achats.quantite` : quantité vendue (panier, stocks, export).
--   6) `produits_services.categorie` : catégorie de produit (segmentation).
--   7) `interactions.type_interaction` (message/clic/demande prix) et
--      `interactions.statut_traitement` (traité/en attente) : réactivité.
--
-- La migration est ADDITIVE et IDEMPOTENTE : sans danger à (re)exécuter.
-- ============================================================

-- ---------- 1) Table CAMPAIGNS ----------
create table if not exists public.campaigns (
  id                uuid          primary key default gen_random_uuid(),
  org_id            uuid          not null references public.organizations(id) on delete cascade,
  nom               text          not null,                 -- ex : META_SOINS_VISAGE_OCT_2026
  plateforme        text          not null check (plateforme in ('facebook','instagram','tiktok')),
  type              text          check (type in ('visibilite','messages','leads','promotion_produit')),
  categorie_promue  text,                                   -- ex : Soins visage (libre)
  date_debut        date,
  date_fin          date,
  budget_prevu      numeric,
  depense_reelle    numeric       not null default 0,
  portee            integer       not null default 0,
  impressions       integer       not null default 0,
  clics             integer       not null default 0,       -- "clics / messages"
  created_by        uuid          references auth.users(id),
  created_at        timestamptz   not null default now()
);

create index if not exists campaigns_org_id_idx
  on public.campaigns (org_id, created_at desc);

alter table public.campaigns enable row level security;
drop policy if exists "cam_all_org" on public.campaigns;
create policy "cam_all_org" on public.campaigns
  for all to authenticated
  using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaigns TO anon, authenticated, service_role;

-- ---------- 2) clients : campagne d'origine + consentement ----------
alter table public.clients add column if not exists campagne_origine uuid
  references public.campaigns(id) on delete set null;
alter table public.clients add column if not exists consentement boolean;

-- ---------- 3) achats : campagne associée + quantité ----------
alter table public.achats add column if not exists campagne_id uuid
  references public.campaigns(id) on delete set null;
alter table public.achats add column if not exists quantite integer not null default 1;

-- ---------- 4) produits_services : catégorie ----------
alter table public.produits_services add column if not exists categorie text;

-- ---------- 5) interactions : type + statut de traitement ----------
alter table public.interactions add column if not exists type_interaction text;
alter table public.interactions add column if not exists statut_traitement text not null default 'traite'
  check (statut_traitement in ('en_attente','traite'));

-- ---------- 6) GRANT sur éventuelles séquences (inoffensif) ----------
DO $$
DECLARE s record;
BEGIN
  FOR s IN
    SELECT sequence_name FROM information_schema.sequences
    WHERE sequence_schema = 'public'
  LOOP
    EXECUTE format('GRANT USAGE, SELECT ON SEQUENCE public.%I TO anon, authenticated, service_role', s.sequence_name);
  END LOOP;
END $$;

-- ---------- FIN ----------
-- Vérifications après exécution :
--   select column_name, data_type from information_schema.columns
--   where table_schema='public' and table_name='campaigns' order by ordinal_position;
--   select column_name from information_schema.columns
--   where table_schema='public' and table_name in ('clients','achats','produits_services','interactions')
--     and column_name in ('campagne_origine','consentement','campagne_id','quantite','categorie','type_interaction','statut_traitement')
--   order by table_name;
-- Données de test (optionnel) :
--   insert into public.campaigns (org_id, nom, plateforme, type, categorie_promue)
--   select org_id, 'META_SOINS_VISAGE_OCT_2026', 'facebook', 'leads', 'Soins visage'
--   from public.organizations limit 1;