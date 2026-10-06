# MÉMOIRE DES TRAVAUX — MAYELA CRM

> ⚠️ **Fichier ARCHIVÉ — ne plus le mettre à jour.**
> Il conserve l'état du projet au **15 septembre 2026**. Plusieurs de ses constats sont périmés et
> contredisent `docs/suivi/EN_ATTENTE.md`. Il est conservé pour la trace, pas comme référence opérationnelle.

## En clair

Ce fichier est un **journal de bord ancien**. Le suivi réel n'est plus ici. Pour savoir où en est le projet au 29 septembre 2026, utilisez les fichiers de la table ci-dessous.

## Où trouver l'information aujourd'hui

| Sujet | Fichier de référence |
|---|---|
| Points en attente, blocages, recette, décisions | **`docs/suivi/EN_ATTENTE.md`** |
| Schéma base, modèle RLS, fonctions RPC, Edge Functions | **`config/SCHEMA_SUPABASE.md`** |
| Vigilance technique, CORS, flux OTP, commandes | **`config/NOTES_TECHNIQUES.md`** |
| Comportement marketing expliqué | **`CLASSE MARKETING/`** (13 fiches + README) |
| Procédures manuelles clients | `docs/FACEBOOK_META_SETUP_CLIENT.md`, `docs/TIKTOK_MARKETING_API_SETUP_CLIENT.md` |
| Historique des évolutions | `docs/evolutions/` |

## Comment les blocages d'alors ont été résolus

Ce tableau évite d'ouvrir un point déjà réglé en lisant l'archive.

| Blocage au 15/09 | État au 29/09 |
|---|---|
| **E-mail OTP introuvable** — présenté ici comme BLOQUANT (mot de passe d'application Gmail révoqué) | ✅ **Résolu le 23/09.** Nouveau mot de passe d'application, secret déplacé dans Bitwarden, fichier en clair supprimé. Les modèles de mail ont été réécrits en français avec un code à 8 chiffres. Reste un test utilisateur bout-en-bout. Détail : `EN_ATTENTE.md` §2. |
| **TikTok Marketing API** — application à créer et faire valider | ⚠️ **Code terminé, revue refusée.** Migration V10 et V10.1 appliquées, `social-tiktok` déployée, interface en place. Application **rejetée** puis mise en pause : la validation du numéro par code est bloquée côté TikTok. Détail : `EN_ATTENTE.md` §1. |
| **Auto-sync Meta Ads** — listé ici comme travail à faire | ✅ **Fait le 29/09.** Migration V11 appliquée, Edge Function `social-facebook` déployée, autorisations Page et Ads séparées. Reste la partie manuelle côté portail Meta. Détail : `EN_ATTENTE.md` §8. |
| **Supprimer le projet Vercel redondant `src`** | ✅ Fait le 23/09, l'URL obsolète ne répond plus. |
| **Session OTP sans limite de durée** | ✅ Décision du 28/09 : plus aucune durée de validité. Réversible par simple configuration, sans code. Détail : `EN_ATTENTE.md` §9. |
| **Cloisonnement des données par espace** | ✅ Fait les 28 et 29/09 (migrations V12, V13, V14). Le signalement de « transposition » entre espaces est résolu et vérifié par tests de non-régression. Détail : `EN_ATTENTE.md` §10. |
| **Base vide** — aucun test sur données réelles | ⚠️ **Toujours vrai.** L'espace PHARMAZEN ne contient aucune donnée métier. Aucun mécanisme n'a encore été exercé sur un cas réel. |

---

## TRAVAUX ACTUELS (en cours, à finaliser en premier)
*État au 15/09/2026 — conservé tel quel pour la trace.*

### 1. E-mail OTP introuvable (création / bascule d'espace) — BLOQUANT

**Symptôme** : lors de la création d'un espace avec un gmail propriétaire différent du gmail
connecté (et idem bascule d'espace), l'app affiche « Code envoyé à … » mais **aucun e-mail** ne
parvient.

**Diagnostic (15/09/2026, tests API Supabase)**
- L'app est correcte : l'appel `signInWithOtp({ email, shouldCreateUser: true })` dans
  `mayela-crm.html` passe bien.
- Supabase renvoie **500 « Error sending confirmation email »** (direct sur `/auth/v1/otp`, avec et
  sans `shouldCreateUser`) → **échec SMTP côté serveur**.
- La config auth est saine côté Supabase : `email: true`, `mailer_autoconfirm: false`
  (validation par code requise).
- `mailer_autoconfirm: false` ⇒ bien un OTP requis (pas d'auto-confirm).

**Cause probable** : le SMTP custom Supabase (Gmail) n'envoie plus — le **Sender password
(mot de passe d'application Gmail) a été révoqué/expiré** chez Google.

**À faire (1 seule config Supabase pour tous les espaces — le SMTP envoie vers n'importe quel
destinataire, il n'a PAS besoin de correspondre à l'e-mail du nouvel espace)**
- [x] Recréer un mot de passe d'application : `myaccount.google.com/apppasswords`
      (login `direction.horizon@gmail.com` si c'est le compte lié) → nom « Supabase » → **Créer** →
      copier le code jaune de 16 caractères.
- [x] **Supabase Dashboard → Settings → Authentication → SMTP Settings → Sender password** :
      coller le nouveau code (espaces retirés) → **Save**.
- [ ] Re-tester la création d'espace bout-en-bout (code reçu → saisie → espace créé).
- [x] Vérifier que le modèle de mail contient `{{ .Token }}` (Dashboard → Authentication →
      Email Templates) pour afficher le code manuel.

> Note : le Sender password existant est **masqué et non récupérable** — il faut le remplacer,
> pas le « retrouver ».
> *Résolu le 23/09/2026. Le secret est désormais conservé dans Bitwarden, pas dans le dépôt.*

---

### 2. TikTok Marketing API (pub) — item 8 du plan (ROADMAP en cours)
*État au 15/09/2026.*

**Fait au 15/09/2026**
- Edge function `supabase/functions/social-tiktok` : actions `exchange_marketing`
  (OAuth `ads.tiktok.com/marketing_api/auth` → token longue durée + advertiser IDs) et
  `marketing_sync` (`report/integrated/get` 30 j → table `campaigns` plateforme='tiktok').
- Migration `config/MIGRATION_V10_TIKTOK_MARKETING.sql` **appliquée** en base (via edge
  function temporaire `db-migrate`, supprimée ensuite). `social_accounts_safe` expose
  `has_marketing` et purge `marketing_access_token`.
- UI : section « Analyse publicitaire (TikTok Marketing API) » dans Réseaux → panneau TikTok
  (`ttMarketingStatus`, `ttMarketingConnectBtn`, `ttMarketingSyncBtn`). JS câblé
  (`startMarketingAuth`, `completeMarketingAuth`, `syncMarketingCampaigns`, callback IIFE
  distinguant `tt_marketing_state` vs `tt_state`).
- Déployé Vercel (hash prod == local), commit `33ab5cd`, PWA bump `mayela-crm-6f2d9a18ab`.

**Bloquant (côté client TikTok Developer)**
- [ ] Créer l'app TikTok Developer avec le produit **Marketing API** (App ID/Secret serveur).
      Voir `docs/TIKTOK_MARKETING_API_SETUP_CLIENT.md`.
- [ ] Configurer la redirection `redirect_uri` = URL de l'app (mayela-crm.vercel.app).
- [ ] **App Review / autorisation** du produit Marketing API (scopes = IDs numériques).
- [ ] Autoriser le CRM dans le portail TikTok (l'espace publicitaire).
- [ ] Test réel complet : connexion Marketing → « Relever les campagnes (30 j) » → données
      dans l'écran Campagnes.

> *Suite donnée : la revue a été refusée, l'application a été mise en pause. Voir `EN_ATTENTE.md` §1.*

---

## PROCHAINS TRAVAUX (selon plan prioritaire)
*Liste telle qu'elle était formulée le 15/09/2026. L'état à jour est dans `EN_ATTENTE.md`.*

### A. Item 8 — APIs restantes (après TikTok Marketing)

- [ ] **WhatsApp Cloud API** (send + webhooks) — nouvel edge function dédiée.
- [ ] **Notifications push PWA** (service worker — message moins invasif que l'e-mail OTP ;
      pourrait contourner le problème d'e-mail sur la validation d'espace : repenser le flux
      pour valider par push + PIN).
- [x] **Auto-sync Meta Ads** (campagnes/coûts comme TikTok Marketing mais pour Meta). *Fait le 29/09.*
- [ ] **Auto-sync TikTok élargi** (au-delà des 30 j).
- [ ] **Sheets bidirectionnel** (export + import).

### B. Item 11 — Tests de validation (recette)

- [ ] 11a- Test manuel des Rapports : toutes les catégories + exports PDF/Google Sheets,
       y compris « Impact opérationnel (interne) ».
- [ ] 11b- Test login bout-en-bout : saisie e-mail → **réception du code OTP** → saisie code →
       entrée app. *L'obstacle SMTP est levé ; le test reste à faire par l'utilisateur.*
- [ ] 11c- Config Google Sheets : connecter le compte + exporter un rapport ; vérifier le
       mode A (app Google `GS_DEFAULT_CLIENT_ID/SECRET`).

### C. Item 8 associé — TikTok Business / portail (suivi SUIVI_TIKTOK_INTEGRATIONS.md)

- [ ] Bascule app TikTok Sandbox → **Production** (App details → Status) + prérequis
       (Web, Login Kit, Content Posting API, Legal).
- [x] Vérifier un domaine pour les images produit (meta tag TikTok sur mayela-crm.vercel.app).
- [x] Recréer `tiktok-events` champs Pixel ID / Events API token déjà en UI (fait 09/09).
- [ ] Phase 3 MMP (Adjust/Branch) : bloqué par email pro — reste en attente.

### D. Nettoyage constaté (audit cohérence 13/09 — à traiter plus tard)

- [x] Supprimer le projet Vercel redondant **`src`**
       (`https://src-3hvhv9op1-directionhorizoncg-7652s-projects.vercel.app`).
- [ ] Confirmer/supprimer 6 edge functions Supabase non référencées dans le repo :
       `notify-new-devis`, `task-expiry-alerts`, `check-password-pwned`,
       `horizon-leads-webhook`, `horizon-send-email`, `super-api-reseaux-sociaux-mayela`.

---

## POINTS DE VIGILANCE (rappel NOTES_TECHNIQUES.md)

- **Ne jamais ouvrir mayela-crm.html en `file://`** — toujours via serveur / Vercel.
- **RLS = vraie sécurité** — toute logique d'isolation vit dans Postgres, pas dans le JS.
- **`current_org_id()`** = pivot multi-tenant ; ne jamais filtrer côté client pour la sécurité.
- **Clé `anon` publique par design** ; clé `service_role` jamais exposée côté client
  (utilisée ici uniquement pour les tests/diagnostics via la CLI).
- Déploiement Vercel : `npx vercel deploy --prod` ; hash PWA via `node config/bump-sw.mjs`.

---

## ÉTAT GLOBAL (consigné au 25/09/2026 — dépassé)

*Ce paragraphe reflétait l'état au 25/09. Il est conservé pour la trace ; l'état courant est dans
`EN_ATTENTE.md`.*

- Plan prioritaire RAPPORT 2 : items 1–7, 9, 10 **faits** ; item 8 en cours ; item 11 en
  attente de recette. TikTok Ads (V10.1) **en pause** (app rejetée, validation téléphone
  bloquée — voir `EN_ATTENTE.md` §1). **Meta Ads (V11) prêt côté code** :
  migration appliquée en base, `social-facebook` déployée (version 4), front déployé
  (sw.js `8b1a814ef0`) — reste uniquement le côté manuel (app Meta, ré-autorisation,
  test réel — voir `EN_ATTENTE.md` §8).
- Base : migrations V1→V11 appliquées.
- Frontend : `mayela-crm.html`, déployé et versionné (sw.js `8b1a814ef0`).
- App déployée : https://mayela-crm.vercel.app

*Depuis : migrations appliquées jusqu'à **V15**, cloisonnement multi-espaces finalisé (V12→V14),
historique de dépense quotidien (V15), production en `mayela-crm-bea9bc628d`.*
