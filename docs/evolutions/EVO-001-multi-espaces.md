# EVO-001 — Multi-espaces : un login pour plusieurs business

- Statut : 🚧 En cours (code + migration prêts, application en base à valider)
- Date : 2026-09-09
- Décision : Option 2 — multi-appartenance + espace actif

## Contexte / Besoin

Le directeur gère **plus de 5 business**, chacun ayant **son propre compte TikTok** (et potentiellement son propre Facebook/Google Sheets).

Aujourd'hui, `profiles.org_id` lie chaque compte à **un seul espace** (`organizations`) :

- 1 e-mail = 1 espace = 1 business.
- Pour gérer 5+ business, il faut autant d'e-mails et des reconnexions constantes.

Le besoin : pouvoir gérer **plusieurs espaces depuis un même login**, tout en conservant **1 compte TikTok par business, isolé de ses voisins**.

## Bilan de l'existant (vérifié en base le 2026-09-09)

- `social_accounts` : `unique (org_id, platform)` → **1 connexion TikTok/Facebook par espace** (config/SCHEMA_SUPABASE.md:143).
- RLS org-based partout (`current_org_id()`) : clients, creances, social_accounts, social_posts, social_events_log, integrations_oauth, produits_services.
- `integrations_oauth` : `unique (org_id, provider)` → déjà un Google Sheets par espace.
- `social_accounts` : 0 ligne en production → aucune connexion TikTok/Facebook n'est encore configurée (l'espace n'existe pas encore réellement en base par compte).
- Profils actuels : 3 (`Horizon`, `MFUMU NZAMB`, un perso). Aucune table de multi-appartenance (`org_members`, `org_invitations`, etc.) n'existe.
- `current_org_id()` : fonction utilisée par toutes les politiques RLS ; sa définition exacte reste à vérifier avant toute mise en œuvre (emplacement actuel inconnu — la base ne contient pas le script, CLI non liée au dossier migrations).

## Options envisagées

### Option 1 — Un login par business (état actuel, zéro développement)
- 1 e-mail = 1 espace = 1 compte TikTok.
- Garde-fou : chaque business a ses propres identifiants dans MAYELA.
- Inconvénient : 5+ e-mails à gérer, reconnexions permanentes, risque de se tromper de compte.

### Option 2 — Multi-appartenance + espace actif (recommandée)
- Nouvelle table `org_members (user_id, org_id, ...)` : un compte appartient à plusieurs espaces.
- `current_org_id()` retourne l'espace **actif sélectionné** (par ex. via `app.settings` ou table de session), sinon l'ancien `profiles.org_id` → aucune régression pour les comptes existants.
- À l'ouverture de l'app : si plusieurs espaces, écran de choix ; sinon, comportement actuel.
- Menu **Réglages → Changer d'espace** : bascule de l'espace actif ; clients, TikTok, Facebook, publications et exports suivent l'espace choisi.
- Le compte TikTok reste **par espace** (aucun changement de ce modèle).
- Un e-mail peut à la fois être dédié à un espace ET être gestionnaire sur plusieurs (cumul option 1 + option 2).

### Option 3 — Espace « groupe » père / fils
- Un espace gestionnaire engloberait les espaces business.
- Plus complexe (héritage RLS, agrégation des données, propriété et permissions) — écartée pour l'instant, peut être réétudiée plus tard si le besoin de vue consolidée apparaît.

## Décision

**Option 2** (à confirmer avec le client avant tout développement).

Justification : réponse directe au besoin (1 login pour 5+ business), additive (ne supprime pas les e-mails dédiés), sans remettre en cause l'isolation par espace ni le modèle 1 compte TikTok par business.

## Impact

### Base (automates / RLS)
- Nouvelle table `org_members` + policies RLS.
- Adaptation de `current_org_id()` pour lire l'espace actif (fallback `profiles.org_id`).
- Migration sécurisée : les 3 comptes existants ne changent pas de comportement.
- Vérifier la définition exacte de `current_org_id()` avant toute modification.
- Attention : toute politique RLS appelant `current_org_id()` doit continuer de fonctionner sans changement.

### App (`mayela-crm.html`)
- Écran de sélection d'espace au login quand plusieurs espaces.
- Menu Réglages → « Changer d'espace ».
- `profile.org_id` reste la valeur par défaut ; l'espace actif devient une donnée de session.

### Fonctions Edge
- `social-health`, `social-tiktok`, `social-publish`, `social-insights`, `google-sheets`, `ia-conseiller` : à vérifier pour qu'elles ciblent l'espace actif (le plus probable : elles s'appuient déjà sur RLS → aucune ou peu de modification).

### Données existantes
- `social_accounts` : 0 ligne → aucune donnée à migrer.
- `integrations_oauth`, `clients`, `creances` : déjà org-based → aucun déplacement.

### Sécurité
- Un espace ne doit jamais voir les données d'un autre espace — l'isolation reste entièrement portée par la RLS org-based sur l'espace actif.

## Plan de mise en œuvre (en cours)

1. ✔ Lire l'implémentation actuelle de `current_org_id()` en base-production
   → `select org_id from profiles where id = auth.uid()` (STABLE SECURITY DEFINER).
2. ✔ Migration `config/MIGRATION_V6_MULTI_ORG.sql` : `org_members` + `profiles.active_org_id`
   + `switch_org(uuid)` + `current_org_id()` actif + policies storage sur l'espace actif.
3. ✔ App (`mayela-crm.html`) : helper `activeOrgId()`, menus « Changer d'espace » dans Réglages,
   toutes les écritures basculent sur l'espace actif.
4. ✔ Fonctions Edge : `social-tiktok`, `google-sheets`, `ia-conseiller` lisent l'espace actif ;
   `social-publish` / `tiktok-events` / `adjust-events` suivent la RLS.
5. ⬜ Appliquer la migration V6 en base (SQL Editor) et vérifier.
6. ⬜ Bump SW + déploiement Vercel + tests E2E multi-espaces.

## Vérification

- [ ] Un compte peut rejoindre plusieurs espaces.
- [ ] La bascule d'espace change bien clients + TikTok + publications + exports.
- [ ] Chaque espace garde son propre compte TikTok (et son propre tracking).
- [ ] Les 3 comptes existants fonctionnent sans changement.
- [ ] Aucune fuite de données entre espaces (codes d'invitation, RLS).