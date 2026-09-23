# Suivi intégrations TikTok — MAYELA CRM

Dernière mise à jour : 2026-09-22

---

## Décisions validées

| Décision | Statut |
|---|---|
| Conserver le mode Sandbox (fallback SELF_ONLY) | ✅ Validé — à basculer en Production (voir Phase 6) |
| Ajouter TikTok Events API (server-side) | ✅ Validé |
| Passage en Production (publication publique) | ✅ Décidé — doc ajoutée, à exécuter côté portail |
| Ajouter MMP : Branch (deep linking > Adjust) | ✅ Validé, en attente email pro |
| Ajouter MMP : Branch (deep linking > Adjust) | ✅ Validé, en attente email pro |
| Sélecteur d'événements TikTok par offre dans l'UI | ✅ Validé |
| Config tracking dans l'onglet Réseaux | ✅ Validé |
| L'app sera déployée comme app mobile (pas SPA) | ✅ Noté |

---

## Phase 1 — Sandbox cleanup

| Tâche | Fichier | Statut |
|---|---|---|
| Corriger bug `OPEN` → `OPEN_API` | `social-publish/index.ts` | ✅ Fait (2026-08-27) |
| Supprimer fallback sandbox | — | ❌ Annulé (on conserve) |
| Mettre à jour docs DEPLOY_BACKEND | `config/DEPLOY_BACKEND.md` | ✅ Fait (2026-08-27) |

---

## Phase 2 — TikTok Events API

| Tâche | Fichier | Statut |
|---|---|---|
| Créer Edge Function `tiktok-events` | `supabase/functions/tiktok-events/index.ts` | ✅ Fait (2026-08-27) |
| Endpoint : POST `https://business-api.tiktok.com/open_api/v1.3/event/track/` | — | — |
| Auth : Access-Token header | — | — |
| Événements : SubmitForm, CompleteRegistration, Contact, Purchase, Schedule | — | — |
| User data : SHA-256 hash email/phone/external_id | — | — |
| Dedup : event_id unique par conversion | — | — |
| Ajouter champs Pixel ID + Events API token dans config UI | `mayela-crm.html` | ⏳ À faire |

---

## Phase 3 — Adjust/Branch MMP

| Tâche | Fichier | Statut |
|---|---|---|
| Créer Edge Function `adjust-events` (vide, prêt à brancher) | `supabase/functions/adjust-events/index.ts` | ✅ Fait (2026-08-27), coquille inactive |
| Endpoint : POST `https://s2s.adjust.com/event` | — | — |
| Inscription Adjust/Branch : en attente email pro | — | 🔒 Bloqué |
| SDK mobile : à intégrer lors du build app mobile | — | ⏳ Futur |
| Postbacks TikTok : à configurer dans dashboard Adjust/Branch | — | ⏳ Futur |

---

## Phase 4 — UI

| Tâche | Fichier | Statut |
|---|---|---|
| Section "Configuration Tracking" dans onglet Réglages | `mayela-crm.html` | ✅ Fait (2026-09-09) |
| Champs : Pixel ID, Events API Token | — | ✅ Fait |
| Champs : Adjust App Token, S2S Token (placeholder) | — | ✅ Fait |
| Sélecteur d'événement TikTok dans formulaire Offre | `mayela-crm.html` | ✅ Fait |
| Options : Aucun, SubmitForm, Purchase, Contact, Schedule | — | ✅ Fait |
| Envoyer événement lors de la publication | — | ✅ Fait |

---

## Phase 5 — Migration + docs

| Tâche | Fichier | Statut |
|---|---|---|
| Table `social_events_log` (audit trail) | `config/MIGRATION_V1_1.sql` | ✅ Fait (2026-08-27) |
| Policies RLS pour `social_events_log` | — | ✅ Fait |
| Mettre à jour DEPLOY_BACKEND.md (setup Events API TikTok) | `config/DEPLOY_BACKEND.md` | ✅ Fait |

## Phase 7 — Gestion Ads Marketing API v1.3 (V10.1)

Le CRM passe de la **lecture seule** (analyse publicitaire) à la **gestion réelle** des comptes publicitaires.

| Fonctionnalité | Fichier | Statut |
|---|---|---|
| Migration V10.1 : `campaigns.source/tik_*`, `tik_adgroups`, `tik_audiences`, `leads_tiktok` + RLS + grants | `config/MIGRATION_V10_1_TIKTOK_MANAGE.sql` | ✅ Écrit — ⏳ À exécuter dans Supabase SQL Editor |
| Fonction Edge : helpers `busReq` (Access-Token), `sha256Hex`, `md5Hex`, `marketingCtx` | `supabase/functions/social-tiktok/index.ts` | ✅ Écrit — ⏳ À redéployer |
| Actions Ads : `ads_campaigns_get/create/update/status` (campagnes) | — | ✅ Écrit |
| Actions Ads : `ads_adgroups_get/update/status` (ad groups) | — | ✅ Écrit |
| Actions Ads : `ads_audiences_get/create` (DMP file upload + create, SHA-256) | — | ✅ Écrit |
| Actions Leads : `leads_forms`, `leads_get` (→ fiches clients + interactions) | — | ✅ Écrit |
| Écrans UI : « Gérer mes campagnes TikTok Ads », « Audiences TikTok », « Leads TikTok » | `mayela-crm.html` (3 nouveaux écrans + boutons dans Réseaux) | ✅ Écrit — ⏳ À déployer (Vercel) |
| Navigation + événements (pause/reprendre, budget, enchère, import leads) | `mayela-crm.html` | ✅ Écrit |

### Reste à faire (manuel)

- Exécuter `config/MIGRATION_V10_1_TIKTOK_MANAGE.sql` dans Supabase → SQL Editor.
- Redéployer la fonction `social-tiktok` (Vercel dashboard ou CLI) car elle référence les nouvelles tables.
- Sur le portail **TikTok for Business Developers** : activer les scopes en écriture
  (Audience Management, Bidding & Budget, Lead Management) puis re-autoriser le compte publicitaire dans l'app (Réseaux → connexion analyse publicitaire) pour que le token accepte `campaign/create`, `adgroup/update`, `dmp/*`, `lead/*`.

### Notes API
- Devise : budgets/enchères en **devise du compte publicitaire** (pas en FCFA). Le CRM stocke `tik_currency` avec chaque montant.
- Audiences : téléphones normalisés (chiffres) puis hachés **SHA-256** côté serveur, upload CSV multipart (MD5 = `file_signature`), création via `/dmp/custom_audience/file/upload/` puis `/dmp/custom_audience/create/`.
- Leads : `/page/get/` (Instant Forms) → `/lead/get/` (+ `/lead/field/get/`), header `x-lead-region: us` (non-EEA). Lead sans lead_id → déduplication par clé composite `page|phone/email/nom|date`.
- Statuts : l'état CRM mappe ENABLE/ACTIVE → ACTIVE, DISABLE/PAUSED → PAUSED.

---

## Phase 6 — Passage en Production (publication publique TikTok)

| Tâche | Fichier / Lieu | Statut |
|---|---|---|
| Documenter les étapes Production | `config/DEPLOY_BACKEND.md` (section « Passer l'app TikTok en Production ») | ✅ Fait (2026-08-29) |
| Vérifier prérequis app (Web, Login Kit, Content Posting API, Legal) | Portail TikTok | ⏳ À faire (manuel) |
| Bascule Sandbox → Production | Portail TikTok → App details → Status | ⏳ À faire (manuel) |
| Revue/audit Content Posting API (si demandée) | Portail TikTok → Submission | ⏳ À faire (manuel) |
| Vérifier un domaine pour les images produit | `mayela-crm.vercel.app` (fichier/meta tag TikTok) | ⏳ À faire (manuel) |
| Reconnecter le compte TikTok dans l'app | Onglet Réseaux | ⏳ Après bascule |

---

## Bloqueurs

| Bloqueur | Impact | Résolution |
|---|---|---|
| Email pro non disponible | Inscription Adjust/Branch impossible | Attendre email pro |
| App mobile non encore buildée | SDK MMP non intégrable | Préparer le code, intégrer plus tard |

---

## Notes techniques

### TikTok Events API
- Endpoint : `POST https://business-api.tiktok.com/open_api/v1.3/event/track/`
- Auth : `Access-Token: {pixel_access_token}`
- Payload : `{ event_source: "web", event_source_id: "{pixel_id}", data: [...] }`
- Batch : max 1000 événements/request
- Dedup : même event_id = même event (fenêtre 48h)
- Coût : gratuit

### Branch MMP (vs Adjust)
- Meilleur deep linking web-to-app
- Meilleur pour B2B CRM (email/SMS → app → bonne fiche)
- Free tier : 10K MAU
- SDK : ~2.5MB
- S2S API disponible pour événements backend

### Événements TikTok standard applicables

| Événement CRM | TikTok Event | Déclencheur |
|---|---|---|
| Nouveau lead | SubmitForm | Ajout client |
| Inscription | CompleteRegistration | Création compte |
| Demande de devis | Contact | Interaction social |
| Vente | Purchase | Enregistrement d'un achat (addAchatBtn) |
| RDV pris | Schedule | Interaction appel/visite |

### Purchase : paramètres funnel envoyés (à l'enregistrement d'une vente)

Envoi automatique via `tiktok-events` si l'espace a un `pixel_id` configuré (opt-in), avec les paramètres du funnel TikTok :

| Paramètre TikTok | Clé API | Source dans le CRM |
|---|---|---|
| id_contenu | content_id | produits_services.id |
| type_de_contenu | content_type | "product" |
| description | description | produits_services.description |
| prix | price | produits_services.prix_defaut |
| valeur | value | montant de l'achat |
| nom_du_contenu | content_name | produits_services.nom |
| devise | currency | "XAF" |

Match utilisateur : `external_id` = client.id et `phone` (hash SHA-256 côté serveur). Le helper client `sendServerTikTokEvent` est aussi réutilisé par la publication d'offre (`offerTrackEvent`).
