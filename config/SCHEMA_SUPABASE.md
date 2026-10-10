# Schéma Supabase — MAYELA CRM
*Extrait le 16 juillet 2026, actualisé le 1 octobre 2026 — projet `ymqdmfsqtkmlmwffqskt` (région eu-central-1, plan Free)*

> Ceci est une documentation du schéma réel, pas un dump SQL exécutable.
> Toute modification de schéma passe par une migration (`config/MIGRATION_V1_1.sql`, `config/MIGRATION_V2.sql`), jamais par édition manuelle de ce fichier.
>
> ✔️ **Statut à jour (01/10/2026)** — migrations **appliquées en base** :
> - **V15** (`config/MIGRATION_V15_DEPENSE_HISTORIQUE.sql`) : table `campaign_spend_daily`
>   (historique quotidien de dépense) + les 4 colonnes de traçabilité sur `campaigns`
>   (`depense_source`, `depense_devise`, `depense_periode_debut`, `depense_periode_fin`).
>   Corrige un ROAS qui comparait un CA cumulé à une dépense limitée à 30 jours.
> - **V14** (`config/MIGRATION_V14_SOLO_CHILDREN.sql`) : extension du cloisonnement au
>   mode « sans espace » (solo) sur les 5 tables enfants + `ia_messages`.
> - **V13** (`config/MIGRATION_V13_ISOLATION_ESPACE.sql`) : cloisonnement strict par espace.
>   Corrige la transposition de données entre espaces (les politiques `*_deny_anonymous`
>   étaient *permissives*, donc neutralisées par OU avec les autres).
> - **V12** (`config/MIGRATION_V12_TOP_CLIENTS_PREF.sql`) : `profiles.top_clients_limit`
>   (défaut 15, CHECK 3–50), preference persistee en base.
> - **V10** (`config/MIGRATION_V10_TIKTOK_MARKETING.sql`) : `has_marketing` dans
>   `social_accounts_safe` + purge de `marketing_access_token` de la vue.
> - **V9** (`config/MIGRATION_V9_INDEXES.sql`) : index de performances — 13 index appliqués
>   le 29/09/2026. Deux lignes du fichier original ont été retirées à cette occasion car elles
>   dupliquaient `idx_interactions_client_id` et `campaigns_org_id_idx`.
> - **V8** (`config/MIGRATION_V8_CAMPAGNES.sql`) : modèle campagnes + reporting.
>
> ✔️ **V16** (`config/MIGRATION_V16_APP_SECRET_PRESENCE.sql`) : ajoute `has_app_secret` à la
> vue `social_accounts_safe` (le secret lui-même reste côté serveur, seul sa présence est
> renvoyée). **Vérifiée en base le 01/10/2026** — colonne présente, à la position attendue
> (dernière colonne de la vue, après `has_marketing`).
>
> Contrôles de non-régression (jetons réels, RLS réellement évaluée par PostgreSQL) :
> `node config/scripts/orchestrator.mjs postmigrate` — enchaîne audit de documentation,
> syntaxe JS, cloisonnement entre espaces, mode solo et présence des migrations en base.
>
> **Audit de cohérence** (migrations ↔ cette doc ↔ code) :
> `python config/scripts/audit_docs.py` — voir `docs/AUDIT_DOCUMENTAIRE.md`.
> À exécuter après chaque migration appliquée.

## `organizations`
```
id            uuid NOT NULL
name          text NOT NULL
join_code     text NOT NULL      -- code d'invitation partagé à l'équipe
created_by    uuid
created_at    timestamptz NOT NULL
members_can_rename boolean NOT NULL DEFAULT false   -- autorise l'équipe à renommer l'espace
```

## `campaigns` (campagnes publicitaires — V8)
```
id                 uuid NOT NULL
org_id             uuid NOT NULL        -- FK organizations
nom                text NOT NULL        -- ex : META_SOINS_VISAGE_OCT_2026
plateforme         text NOT NULL        -- facebook | instagram | tiktok
type               text                 -- visibilite | messages | leads | promotion_produit
categorie_promue   text                 -- ex : Soins visage (libre)
date_debut         date
date_fin           date
budget_prevu       numeric
depense_reelle     numeric NOT NULL DEFAULT 0
portee             integer NOT NULL DEFAULT 0
impressions        integer NOT NULL DEFAULT 0
clics              integer NOT NULL DEFAULT 0       -- "clics / messages"
created_by         uuid
created_at         timestamptz NOT NULL
-- V10.1 (Gestion TikTok Ads) : lignes source='tik' = campagnes gérées via Marketing API
source              text NOT NULL DEFAULT 'manuel'  -- 'manuel' | 'tik'
tik_campaign_id     text           -- id TikTok native
tik_advertiser_id   text           -- compte publicitaire propriétaire
tik_budget_mode     text           -- BUDGET_MODE_DAY | BUDGET_MODE_TOTAL
tik_budget          numeric        -- budget natif (devise du compte publicitaire)
tik_currency        text           -- devise du compte publicitaire
tik_status          text           -- ACTIVE | PAUSED | DELETED | …
tik_objective       text           -- objective_type TikTok
tik_synced_at       timestamptz
-- index unique partiel : (org_id, tik_campaign_id) où source='tik'
-- V11 (Gestion Meta Ads) : lignes source='meta' = campagnes gérées via Meta Ads Manager
meta_ad_account_id   text           -- AdAccount id (act_<num>)
meta_campaign_id     text           -- id campagne Meta native
meta_currency        text           -- devise du compte publicitaire (USD, EUR…)
meta_status          text           -- ACTIVE | PAUSED | … (effective_status)
meta_objective       text           -- objective Meta (OUTCOME_*)
meta_budget_mode     text           -- daily_budget | lifetime_budget
meta_budget          numeric        -- budget en unités (major), devise du compte pub
meta_synced_at       timestamptz
-- index unique partiel : (org_id, meta_campaign_id) où source='meta'
-- V15 : dépense issue de l'API, historisée dans campaign_spend_daily
depense_source        text           -- 'api' | 'manuelle' | NULL si saisie à la main
depense_devise        text           -- devise de la depense (XOF, USD…)
depense_periode_debut date           -- début de la fenêtre interrogée sur l'API
depense_periode_fin   date           -- fin de la fenêtre interrogée sur l'API
```
- RLS `cam_all_org` : `org_id = current_org_id()`.
- Alimente les rapports « Performance des campagnes », « Entonnoir », « CA attribuable » et « Rentabilité (ROAS) ».

## `campaign_spend_daily` (historique quotidien de dépense — V15)
```
id           uuid NOT NULL            -- default gen_random_uuid()
org_id       uuid NOT NULL            -- FK organizations, on delete cascade
campaign_id  uuid NOT NULL            -- FK campaigns, on delete cascade
jour         date NOT NULL            -- journée de dépense
depense      numeric NOT NULL DEFAULT 0
impressions  integer NOT NULL DEFAULT 0
clics        integer NOT NULL DEFAULT 0
portee       integer NOT NULL DEFAULT 0  -- Meta Insights ne fournit pas le reach journalier : reste 0
devise       text                     -- XOF, USD...
source       text NOT NULL DEFAULT 'api'  -- check source in ('api','manuelle')
synced_at    timestamptz NOT NULL
-- unique (campaign_id, jour) : un enregistrement par campagne et par jour.
-- La synchronisation est rejouable sans dupliquer, l'upsert met à jour la valeur du jour.
```
- Index : `campaign_spend_daily_org_jour_idx (org_id, jour desc)` et
  `campaign_spend_daily_camp_jour_idx (campaign_id, jour desc)`.
- RLS `csd_all_org` : `org_id = current_org_id()` (même cloisonnement que `campaigns`, V13).
- Rôle : la synchronisation pub écrase `campaigns.depense_reelle` à chaque passage et ne
  récupérait qu'une fenêtre glissante de 30 jours (`date_preset=last_30d`). Le ROAS comparait
  donc un CA cumulé (achats, sans borne de date) à une dépense limitée à 30 jours — deux durées
  différentes. Cette table rend le ROAS calculable sur 7 / 30 / 90 jours comme sur l'historique
  complet. `campaigns.depense_reelle` reste un cache « dernière valeur connue » pour l'affichage
  rapide.
- Écriture : `service_role` uniquement (Edge Functions `social-facebook` / `social-tiktok`).

## `org_members` (appartenances multi-espaces, EVO-001)
```
user_id     uuid NOT NULL  -- FK profiles (= auth.users.id)
org_id      uuid NOT NULL  -- FK organizations
role        text NOT NULL  -- 'admin' | 'membre'
created_at  timestamptz NOT NULL
-- primary key (user_id, org_id) : un compte appartient à N espaces.
-- Insertions UNIQUEMENT via create_organization / join_organization (SECURITY DEFINER).
```
Un même utilisateur peut appartenir à plusieurs espaces et basculer avec `switch_org(uuid)`
(espace actif = `profiles.active_org_id`, sinon `profiles.org_id`).

## `profiles` (1 ligne par utilisateur `auth.users`)
```
id                  uuid NOT NULL   -- = auth.users.id
full_name           text
phone               text
workspace_type      text NOT NULL  -- 'solo' | 'org'
org_id              uuid           -- FK organizations, NULL si pas encore rejoint/créé
active_org_id       uuid           -- FK organizations, espace ACTIVELLEMENT sélectionné (EVO-001) ; NULL = org_id
role                text
created_at          timestamptz NOT NULL
pin_hash            text           -- NULL tant que le PIN n'est pas défini
pin_attempts        integer NOT NULL
pin_locked_until     timestamptz
is_horizon_staff    boolean NOT NULL  -- accès aux tables horizon_* si true
horizon_role        text
-- V12 : préférence persistée côté serveur (remplace le localStorage 'mayela_topClientsCount')
top_clients_limit   integer NOT NULL  -- défaut 15, CHECK entre 3 et 50 (non valid : voir V12)
```
RLS : `profiles_self_update` — chaque compte ne met à jour que sa propre ligne
(`id = auth.uid()`). La plage de `top_clients_limit` est garantie en base par une
contrainte CHECK, pas seulement par l'application.

## `clients`
```
id                      uuid NOT NULL
owner_user_id           uuid
org_id                  uuid
name                    text NOT NULL
phone                   text
zone                    text
source                  text
campagne_origine        uuid           -- FK campaigns (V8) : campagne qui a amené le prospect
consentement            boolean        -- consentement promotionnel Oui/Non (nil = non renseigné)
score                   integer
stage_override          text   -- Prospect | Contacté | Négociation | Client | Fidèle
stage_override_reason   text
created_at              timestamptz NOT NULL
updated_at              timestamptz NOT NULL
```

## `interactions`
```
id                  uuid NOT NULL
client_id           uuid NOT NULL  -- FK clients
user_id             uuid
type                text NOT NULL  -- CANAL : appel | whatsapp | visite | autre | facebook | tiktok
type_interaction    text           -- V8 : message | commentaire | clic | demande_prix | autre
statut_traitement   text NOT NULL  -- V8 : en_attente | traite (défaut 'traite')
note                text
occurred_at         timestamptz NOT NULL
created_at          timestamptz NOT NULL
```

## `produits_services` (catalogue)
```
id            uuid NOT NULL
nom           text NOT NULL
description   text
categorie     text            -- V8 : catégorie (ex : Dermocosmétique, Hygiène) pour segmentation
image_url     text            -- URL publique (bucket "produits")
prix_defaut   numeric
actif         boolean NOT NULL DEFAULT true
owner_user_id uuid
org_id        uuid
created_at    timestamptz NOT NULL
```

## `achats`
```
id            uuid NOT NULL
client_id     uuid NOT NULL
montant       numeric NOT NULL
produit_id    uuid       -- FK produits_services (optionnel)
campagne_id   uuid       -- FK campaigns (V8) : vente attribuée à une campagne (CA attribuable)
quantite      integer NOT NULL DEFAULT 1   -- V8 : quantité vendue
achat_date    date NOT NULL
created_at    timestamptz NOT NULL
```

## `devis`
```
id            uuid NOT NULL
client_id     uuid NOT NULL
montant       numeric
produit_id    uuid          -- FK produits_services (optionnel)
devis_date    date NOT NULL
created_by    uuid
created_at    timestamptz NOT NULL
```

## `creances` (dettes clients)
```
id            uuid NOT NULL
client_id     uuid NOT NULL  -- FK clients
montant       numeric NOT NULL
produit_id    uuid           -- FK produits_services (optionnel)
statut        text NOT NULL  -- due | payee
created_at    timestamptz NOT NULL
```

## `tasks`
```
id            uuid NOT NULL
client_id     uuid NOT NULL
due_date      date NOT NULL
status        text NOT NULL  -- a_faire | fait | reporte
libelle       text           -- libellé de la tâche (optionnel)
created_by    uuid
created_at    timestamptz NOT NULL
```
Les tâches en échéance sont suivies côté app (tableau de bord / relances manuelles) ; aucune tâche planifiée (pg_cron) n'est requise.

## `audit_log`
```
id           uuid NOT NULL
table_name   text NOT NULL
row_id       uuid NOT NULL
action       text NOT NULL
old_data     jsonb
new_data     jsonb
user_id      uuid
created_at   timestamptz NOT NULL
```
Rempli automatiquement par un trigger générique (`log_change`) sur les tables sensibles.

## `email_change_requests` (demandes de changement d'e-mail, anti détournement — V7)
```
id          uuid NOT NULL
user_id     uuid NOT NULL           -- l'utilisateur qui initie le changement
new_email   text NOT NULL
created_at  timestamptz NOT NULL
```
- RLS `ecr_insert_self` : une demande ne peut être créée QUE pour `user_id = auth.uid()`
  → le compte cible d'un changement d'e-mail ne peut jamais être un autre utilisateur.
- RLS `ecr_select_self` / `ecr_delete_self` : lecture et annulation réservées à l'auteur.
- Consommée par la fonction Edge `confirm-email-change` (service_role), qui en lit le
  `user_id` (compte original) — le client ne fournit plus d'UUID arbitraire.

## `social_accounts` (comptes réseaux connectés, 1 par espace/plateforme)
```
id            uuid NOT NULL
org_id        uuid NOT NULL  -- FK organizations
platform      text NOT NULL  -- facebook | whatsapp | tiktok
display_name  text
config        jsonb NOT NULL -- tokens & identifiants (jamais envoyés au navigateur des autres membres)
connected_by  uuid
created_at    timestamptz NOT NULL
-- unique (org_id, platform)
```

## `social_posts` (journal des publications)
```
id                uuid NOT NULL
org_id            uuid NOT NULL
platform          text NOT NULL  -- facebook | whatsapp | tiktok
content           text NOT NULL
image_url         text
status            text NOT NULL  -- sent | failed
error             text
external_post_id  text
posted_by         uuid
created_at        timestamptz NOT NULL
```

## `social_events_log` (audit des événements TikTok Events API / MMP)
```
id            uuid NOT NULL
org_id        uuid NOT NULL
platform      text NOT NULL  -- tiktok | adjust | branch
event         text NOT NULL
pixel_id      text
event_id      text
external_id   text
status        text NOT NULL  -- sent | failed
error         text
payload       jsonb NOT NULL
sent_by       uuid
created_at    timestamptz NOT NULL
```

## `ia_messages` (historique des conversations du Conseiller IA — V5, V6)
```
id               uuid NOT NULL   -- default gen_random_uuid()
user_id          uuid NOT NULL   -- FK auth.users, default auth.uid(), on delete cascade
role             text NOT NULL   -- check role in ('user','assistant')
content          text NOT NULL
conversation_id  uuid            -- V6 : regroupe les messages d'une même conversation
created_at       timestamptz NOT NULL
```
- RLS : double cloisonnement — `user_id = auth.uid()` **et** filtre par espace
  (`ia_messages_space`, V13), complété par le mode sans espace (V14).
- Un trigger `BEFORE INSERT` (`ia_messages_set_org_trg`) remplit `org_id` côté serveur à partir
  de `current_org_id()` : le client ne choisit jamais lui-même l'espace d'un message.
- `conversation_id` n'est pas contraint par une clé étrangère : la réinitialisation d'une
  conversation consiste à generer un nouvel identifiant côté navigateur.

## `tik_adgroups` (ad groups TikTok Ads — V10.1)
```
id                uuid NOT NULL
org_id            uuid NOT NULL  -- FK organizations
advertiser_id     text NOT NULL  -- compte publicitaire
tik_campaign_id   text           -- FK logique campaigns.tik_campaign_id
tik_adgroup_id    text NOT NULL  -- id native TikTok
nom               text NOT NULL
budget_mode       text           -- BUDGET_MODE_DAY | BUDGET_MODE_TOTAL
budget            numeric        -- budget natif (devise compte)
bid               numeric        -- enchère native
bid_strategy      text
operation_status  text           -- ACTIVE | PAUSED | DELETED
status            text
currency          text
optimize_goal     text
synced_at         timestamptz NOT NULL
created_at        timestamptz NOT NULL
-- unique (org_id, tik_adgroup_id)
```

## `meta_adsets` (ensembles de pubs Meta Ads — V11)
```
id                  uuid NOT NULL
org_id              uuid NOT NULL       -- FK organizations
meta_ad_account_id  text NOT NULL       -- AdAccount id (act_<num>)
meta_campaign_id    text                -- FK logique campaigns.meta_campaign_id
meta_adset_id       text NOT NULL       -- id native Meta
nom                 text NOT NULL
budget_mode         text                -- daily_budget | lifetime_budget
budget              numeric             -- budget en unités (major), devise compte pub
bid                 numeric             -- enchère (unités)
bid_strategy        text                -- LOWEST_COST_WITHOUT_CAP | LOWEST_COST_WITH_BID_CAP
status              text                -- ACTIVE | PAUSED (effective_status)
currency            text                -- devise du compte publicitaire
optimization_goal   text                -- REACH | LINK_CLICKS | …
synced_at           timestamptz NOT NULL
created_at          timestamptz NOT NULL
-- unique (org_id, meta_adset_id)  +  index (org_id, meta_campaign_id)
```

## `tik_audiences` (audiences custom TikTok — V10.1)
```
id                uuid NOT NULL
org_id            uuid NOT NULL  -- FK organizations
advertiser_id     text NOT NULL
tik_audience_id   text NOT NULL  -- id native
nom               text NOT NULL
calculate_type    text NOT NULL  -- PHONE_SHA256 | EMAIL_SHA256
member_count      integer NOT NULL DEFAULT 0
status            text           -- TRAITEMENT | statut TikTok
synced_at         timestamptz NOT NULL
created_at        timestamptz NOT NULL
-- unique (org_id, tik_audience_id)
```

## `leads_tiktok` (leads Instant Forms importés — V10.1)
```
id            uuid NOT NULL
org_id        uuid NOT NULL  -- FK organizations
advertiser_id text
page_id       text           -- Instant Form (page TikTok)
page_name     text
lead_key      text NOT NULL  -- dédup : page|phone/email/nom|date
client_id     uuid           -- FK clients (fiche CRM créée/liée)
nom           text
phone         text
email         text
raw_data      jsonb          -- réponse brute TikTok
imported_by   uuid
imported_at   timestamptz NOT NULL
created_at    timestamptz NOT NULL
-- unique (org_id, lead_key)
```

## `integrations_oauth` (connexions OAuth Google Sheets / Notion, par espace)
```
id            uuid NOT NULL
org_id        uuid NOT NULL  -- FK organizations
provider      text NOT NULL  -- google_sheets | notion
display_name  text
config        jsonb NOT NULL -- tokens d'accès/refresh (côté serveur)
connected_by  uuid
created_at    timestamptz NOT NULL
updated_at    timestamptz NOT NULL
-- unique (org_id, provider)
```

## `horizon_leads` (interne HORIZON, hors périmètre produit)
```
id                     uuid NOT NULL
full_name              text
company                text
email                  text
phone                  text
source                 text
external_id            text    -- clé stable MD5, dédup cross-import
status                 text NOT NULL
assigned_to            uuid
created_at             timestamptz NOT NULL
updated_at             timestamptz NOT NULL
source_channel         text
raw_data               jsonb
offer_segment          text    -- digitalisation_locale | croissance_digitale
qualification_score    integer
qualification_notes    text
```
Accès réservé : `profiles.is_horizon_staff = true`. Ne pas exposer côté produit MAYELA CRM.

---

## Fonctions RPC utilisées par le frontend

| Fonction | Rôle | Appelée depuis |
|---|---|---|
| `create_organization(org_name text)` | Crée une org + rattache le profil courant | Écran onboarding |
| `join_organization(code text)` | Rejoint une org via `join_code` | Écran onboarding |
| `switch_org(org_id uuid)` | Change l'espace actif (revérifie l'appartenance en base) | Bascule d'espace |
| `my_spaces()` | Liste les espaces du compte + rôle + code d'invitation | Bascule d'espace |
| `leave_organization()` | Quitte l'espace : remet `org_id`, `role` et `workspace_type` à `perso` | Paramètres |
| `set_pin(new_pin text)` | Hash et enregistre le PIN | Écran création/changement PIN |
| `verify_pin(candidate_pin text)` | Vérifie le PIN, gère le lockout (3 essais / 30 min) | Écran lock |
| `current_org_id()` | `STABLE SECURITY DEFINER` : espace actif, calculé **côté serveur** depuis `org_members` + `profiles.active_org_id` (repli `profiles.org_id`). Utilisée en interne par les politiques RLS et par le trigger `ia_messages_set_org_trg`, jamais appelée côté frontend | — |

## RLS — principe

Modèle appliqué par **V13 + V14**. Règle générale, valable sur toutes les tables
sécurisées :

- **Rôle `anon` : blocage explicite.** Chaque table porte une politique
  `for all to anon using (false) with check (false)`. Un rôle sans politique
  applicable se voit tout refuser de PostgreSQL : c'est plus sûr que de compter
  sur une politique « deny » — surtout qu'une politique *permissive* combinée par
  OU avec d'autres **neutralise** les autres, au lieu de les restreindre. C'est
  exactement le défaut corrigé en V13 (`*_deny_anonymous` étaient permissives :
  chaque client connecté lisait **et écrivait** l'intégralité de `clients`,
  `achats`, `devis`, `tasks`, `interactions`, `organizations` et `profiles`).
- **Rôle `authenticated` : une seule politique par table et par commande**, cible
  `TO authenticated` (et non `to public`). Deux politiques permissives se
  combinant en OU, la redondance est un risque, pas une marge de sécurité.
- **`current_org_id()`** (`STABLE SECURITY DEFINER`) calcule l'espace côté serveur
  depuis `org_members` + `profiles.active_org_id`, avec repli sur
  `profiles.org_id`. Le client ne contrôle donc que le *choix* de son espace
  actif ; l'appartenance est revérifiée en base et ne peut pas être élargie.
- **Deux cibles de cloisonnement, selon la nature de la ligne :**
  - une ligne **rattachée à un espace** (`org_id` renseigné) n'est visible que
    depuis cet espace ;
  - une ligne **rattachée à une personne** (`org_id IS NULL AND
    owner_user_id = auth.uid()`) n'est visible que par son propriétaire. C'est le
    mode « sans espace » / solo, que l'app sait produire
    (`isSolo ? { owner_user_id } : { org_id }`).
  - La contrainte `clients.owner_xor_org` interdit de renseigner les deux
    colonnes à la fois : une ligne est soit d'un espace, soit d'une personne.
- **Tables enfants** (`achats`, `devis`, `tasks`, `interactions`, `creances`) :
  politique `ALL` qui exige que le `client_id` référencé soit visible selon les
  deux cibles ci-dessus. **V14 a ajouté la branche « sans espace »**, absente
  en V13 : sans elle, le propriétaire d'un client solo pouvait lire mais pas
  écrire (403 sur les 6 tables).
- **`ia_messages`** : cloisonnée par `user_id = auth.uid()` **et** par l'espace
  (`org_id = current_org_id()`), avec tolérance `org_id IS NULL` pour le mode
  solo. Un trigger `BEFORE INSERT` (`ia_messages_set_org_trg`) remplit `org_id`
  depuis `current_org_id()` quand le navigateur ne le fournit pas : le client ne
  peut pas choisir librement l'espace d'un message, et un cache local en retard
  sur `profiles.active_org_id` ne fait pas échouer l'enregistrement.
- **Hors périmètre (assumé)** : `horizon_leads`, `horizon_strategy_logs`,
  `horizon_api_configs` et `audit_log` n'ont pas de colonne d'espace — ce sont
  des bases globales de l'agence. `horizon_leads` n'est lisible que par le staff
  Horizon ; `audit_log` reste lisible par son auteur et n'est modifiable que par
  `service_role`.
- **Secrets** (V7) : la colonne `config` de `social_accounts` et `integrations_oauth` n'est
  plus `SELECT`able par `anon`/`authenticated` (`revoke`). Seules les Edge Functions la
  lisent, via `service_role`. La vue `social_accounts_safe` (lue par le navigateur) est en
  `security_invoker = false` (indispensable pour lire `config` en tant que propriétaire) et
  filtre désormais explicitement `org_id = current_org_id()` (V18).
- **Incident sécurité / résolution (V18, 09/10/2026)** : `social_accounts_safe` appartient à
  `postgres`, qui a `rolbypassrls = true`. En `security_invoker = false`, la vue s'exécutait
  donc en tant que `postgres` et contournait **intégralement** la RLS de `social_accounts`
  (`FORCE ROW LEVEL SECURITY` inopérant face à un rôle BYPASSRLS) : elle exposait toutes les
  lignes à **`anon`** (clé publique). Corrigé par un filtre de ligne explicite
  (`org_id = current_org_id() OR service_role`) + `revoke ... from anon`. Vérifié : anon → 401,
  membre → 1 ligne, service_role → 1 ligne.
- **Vue `social_accounts_safe`** : expose les champs publics (client_key, pixel_id, etc.) +
  les booléens `has_marketing` (Marketing API TikTok connecté) et `connected`/`has_pixel_token`,
  sans jamais exposer `marketing_access_token` ni les autres secrets (ajouté en V10).

## Edge Functions déployées

Les sources de toutes les fonctions vivent dans `supabase/functions/`. Celles réellement utilisées par l'app :

| Fonction | JWT requis | Déclencheur / usage |
|---|---|---|
| `ia-conseiller` | oui | Chat & rapport personnalisé IA (Gemini, flux SSE) |
| `social-publish` | oui | Publie une offre (Facebook Graph / TikTok Content Posting) |
| `social-tiktok` | oui | Flux OAuth TikTok (échange du code / refresh) + Marketing API pub (exchange_marketing / marketing_sync) |
| `social-facebook` | oui | OAuth Facebook (exchange / refresh des tokens Page) + **Gestion Meta Ads (V11)** : actions `ads_connect`, `ads_campaigns_get`, `ads_campaign_status`, `ads_campaign_update`, `ads_adgroups_get`, `ads_adgroup_update`, `ads_adgroup_status` |
| `social-insights` | oui | Analyse d'audience (Facebook + TikTok) |
| `social-health` | oui | Diagnostic de l'état des intégrations (absent/incomplet/complete) |
| `tiktok-events` | oui | TikTok Events API (server-side, pixel) |
| `adjust-events` | oui | (inactive) Coquille MMP Adjust/Branch |
| `google-sheets` | oui | Google Sheets export par espace : exchange/refresh (OAuth), status, export |
| `confirm-email-change` | oui | Finalise le changement d'e-mail : lit la demande (`email_change_requests`), supprime le user temporaire OTP + met à jour l'e-mail via Admin API |

**Secrets requis** (à configurer Dashboard Supabase → Edge Functions → Secrets) : `GEMINI_API_KEY` (conseiller IA), `GS_DEFAULT_CLIENT_ID` + `GS_DEFAULT_CLIENT_SECRET` (export Google Sheets par défaut).

> **Note sécurité (V7)** : depuis la migration V7, les colonnes `config` de
> `social_accounts` / `integrations_oauth` ne sont plus lisibles par la session
> utilisateur. Les fonctions qui lisent ces secrets (`ia-conseiller` non concernée ;
> `social-publish`, `social-tiktok`, `social-facebook`, `social-insights`,
> `social-health`, `tiktok-events`, `adjust-events`, `google-sheets`,
> `confirm-email-change`) utilisent
> un client `service_role` et filtrent `org_id` depuis le profil de l'appelant
> (équivalent de `current_org_id()`). Toutes ont été **redéployées** dans ce mode
> (voir `config/DEPLOY_BACKEND.md` → Étape 3).

---

## Flux de changement d'e-mail (validation par code OTP)

Le changement d'adresse e-mail de connexion passe par une validation en 2 étapes, sans lien
de confirmation ni service e-mail tiers. Depuis V7, le compte cible n'est plus fourni par
le client mais lu côté serveur depuis `email_change_requests` (anti détournement) :

```
1. User saisit le nouvel e-mail dans Réglages → clique "Envoyer le code"
2. Frontend ENREGISTRE une demande côte serveur :
     insert into email_change_requests (user_id, new_email)
     values (auth.uid(), new_email)          -- RLS force user_id = auth.uid()
   puis appelle  signInWithOtp({ email })  → Supabase envoie un code à 6-8 chiffres
3. User saisit le code → clique "Confirmer le changement"
4. Frontend appelle  verifyOtp({ email, token, type:'email' })  → Supabase vérifie le code
   et crée/se connecte sur un user TEMPORAIRE (user B) portant le nouvel e-mail
5. Frontend appelle  confirm-email-change  avec { new_email } (sans UUID)
6. confirm-email-change (service_role) :
   - Vérifie que la session appelante (user B) porte bien le nouvel e-mail
   - Lit la demande côte serveur (table email_change_requests) → user A (aucun UUID client)
   - Vérifie la fraîcheur de la demande (< 15 min) ET qu'elle est plus ancienne que user B
   - Supprime le user temporaire (créé il y a < 15 min) + son profil orphelin
   - Met à jour l'e-mail de user A via  admin.updateUserById(request.user_id, { email })
   - Purge la demande consommée
7. Frontend se déconnecte → l'utilisateur se reconnecte avec le nouvel e-mail
```

Sécurité :
- Une session non conforme (= un autre compte) est rejetée (`403`)
- **Anti détournement** : aucune demande ne peut cibler un autre compte (RLS
  `ecr_insert_self` : `user_id = auth.uid()`). Une demande du user temporaire vers
  lui-même est ignorée (`request.user_id !== caller.id`).
- Un user temporaire de plus de 15 minutes, ou antérieur à la demande, n'est jamais
  supprimé (`409`)
- Une demande expirée (> 15 min) est rejetée (`409`), le compte réel n'est jamais touché
- Le code OTP expire selon la configuration Supabase (10 min par défaut)
- Rate limit client : bouton "Renvoyer" désactivé 60 s après l'envoi
