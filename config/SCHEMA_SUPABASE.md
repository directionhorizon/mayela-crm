# Schéma Supabase — MAYELA CRM
*Extrait le 16 juillet 2026, actualisé le 30 août 2026 — projet `ymqdmfsqtkmlmwffqskt` (région eu-central-1, plan Free)*

> Ceci est une documentation du schéma réel, pas un dump SQL exécutable.
> Toute modification de schéma passe par une migration (`config/MIGRATION_V1_1.sql`, `config/MIGRATION_V2.sql`), jamais par édition manuelle de ce fichier.
> ⚠️ V2 : certaines tables (creances, social_*) existaient en base mais SANS GRANT ni policies → erreurs 42501
> "permission denied". La migration V2 ajoute les GRANT + policies + colonnes manquantes.

## `organizations`
```
id            uuid NOT NULL
name          text NOT NULL
join_code     text NOT NULL      -- code d'invitation partagé à l'équipe
created_by    uuid
created_at    timestamptz NOT NULL
members_can_rename boolean NOT NULL DEFAULT false   -- autorise l'équipe à renommer l'espace
```

## `profiles` (1 ligne par utilisateur `auth.users`)
```
id                  uuid NOT NULL   -- = auth.users.id
full_name           text
phone               text
workspace_type      text NOT NULL  -- 'solo' | 'org'
org_id              uuid           -- FK organizations, NULL si pas encore rejoint/créé
role                text
created_at          timestamptz NOT NULL
pin_hash            text           -- NULL tant que le PIN n'est pas défini
pin_attempts        integer NOT NULL
pin_locked_until     timestamptz
is_horizon_staff    boolean NOT NULL  -- accès aux tables horizon_* si true
horizon_role        text
```

## `clients`
```
id                      uuid NOT NULL
owner_user_id           uuid
org_id                  uuid
name                    text NOT NULL
phone                   text
zone                    text
source                  text
score                   integer
stage_override          text   -- Prospect | Contacté | Négociation | Client | Fidèle
stage_override_reason   text
created_at              timestamptz NOT NULL
updated_at              timestamptz NOT NULL
```

## `interactions`
```
id            uuid NOT NULL
client_id     uuid NOT NULL  -- FK clients
user_id       uuid
type          text NOT NULL  -- appel | whatsapp | visite | autre | facebook | tiktok
note          text
occurred_at   timestamptz NOT NULL
created_at    timestamptz NOT NULL
```

## `produits_services` (catalogue)
```
id            uuid NOT NULL
nom           text NOT NULL
description   text
image_url     text          -- URL publique (bucket "produits")
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
produit_id    uuid          -- FK produits_services (optionnel)
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
Balayé quotidiennement (07h00) par le cron `task-expiry-alerts-daily` → Edge Function `task-expiry-alerts`.

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
| `set_pin(new_pin text)` | Hash et enregistre le PIN | Écran création/changement PIN |
| `verify_pin(candidate_pin text)` | Vérifie le PIN, gère le lockout (3 essais / 30 min) | Écran lock |
| `current_org_id()` | Utilisée en interne par les policies RLS (pas appelée côté frontend) | — |

## RLS — principe

- RESTRICTIVE deny-anonymous sur les 8 tables `public` sensibles
- Isolation via `owner_user_id = auth.uid()` OU `org_id = current_org_id()`
- `current_org_id()` lit `profiles.org_id` via `auth.uid()`
- Tables enfants (`interactions`, `achats`, `tasks`, `devis`, `creances`) : policy `ALL` vérifiant que le `client_id` référencé appartient bien à l'utilisateur/l'org

## Edge Functions déployées

| Fonction | JWT requis | Déclencheur / usage |
|---|---|---|
| `notify-new-devis` | oui | Trigger DB sur INSERT `devis` |
| `task-expiry-alerts` | oui | pg_cron quotidien 07h00 |
| `horizon-leads-webhook` | non | Webhook entrant Make.com |
| `horizon-send-email` | oui | Appel manuel (staff) |
| `check-password-pwned` | non | Legacy, non utilisée (auth 100% OTP) |
| `social-publish` | oui | Publie une offre (Facebook Graph / TikTok Content Posting) |
| `social-tiktok` | oui | Flux OAuth TikTok (échange du code / refresh) |
| `social-insights` | oui | Analyse d'audience (Facebook + TikTok) |
| `social-health` | oui | Diagnostic de l'état des intégrations (absent/incomplet/complete) |
| `tiktok-events` | oui | TikTok Events API (server-side, pixel) |
| `adjust-events` | oui | (inactive) Coquille MMP Adjust/Branch |

**Secrets non configurés à ce jour** (401 attendus tant que non fait) : `RESEND_API_KEY`, `ALERT_EMAIL_TO`, `ALERT_EMAIL_FROM`, clé Brevo.
