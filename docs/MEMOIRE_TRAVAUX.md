# MÉMOIRE DES TRAVAUX — MAYELA CRM

> Fichier mémoire de suivi. Dernière mise à jour : 15/09/2026.

---

## TRAVAUX ACTUELS (en cours, à finaliser en premier)

### 1. E-mail OTP introuvable (création / bascule d'espace) — BLOQUANT

**Symptôme** : lors de la création d'un espace avec un gmail propriétaire différent du gmail
connecté (et idem bascule d'espace), l'app affiche « Code envoyé à … » mais **aucun e-mail** ne
parvient.

**Diagnostic (15/09/2026, tests API Supabase)**
- L'app est correcte : `signInWithOtp({ email, shouldCreateUser:true })` (mayela-crm.html l.1497,
  l.2778, l.2820) — le code passe bien.
- Supabase renvoie désormais **500 « Error sending confirmation email »** (direct sur
  `/auth/v1/otp`, avec et sans `shouldCreateUser`) → **échec SMTP côté serveur**.
- La config auth est saine côté Supabase : `email: true`, `mailer_autoconfirm: false`
  (validation par code requise).
- `mailer_autoconfirm:false` ⇒ bien un OTP requis (pas d'auto-confirm).

**Cause probable** : le SMTP custom Supabase (Gmail) n'envoie plus — le **Sender password
(mot de passe d'application Gmail) a été révoqué/expiré** chez Google.

**À faire (1 seule config Supabase pour tous les espaces — le SMTP envoie vers n'importe quel
destinataire, il n'a PAS besoin de correspondre à l'e-mail du nouvel espace)**
- [ ] Recréer un mot de passe d'application : `myaccount.google.com/apppasswords`
  (login `direction.horizon@gmail.com` si c'est le compte lié) → nom « Supabase » → **Créer** →
  copier le code jaune de 16 caractères.
- [ ] **Supabase Dashboard → Settings → Authentication → SMTP Settings → Sender password** :
  coller le nouveau code (espaces retirés) → **Save**.
- [ ] Re-tester la création d'espace bout-en-bout (code reçu → saisie → espace créé).
- [ ] Vérifier que le template de mail « Magic Link » contient `{{ .Token }}`
  (Dashboard → Authentication → Email Templates) pour afficher le code manuel.

> Note : le Sender password existant est **masqué et non récupérable** — il faut le remplacer,
> pas le « retrouver ».

---

### 2. TikTok Marketing API (pub) — item 8 du plan (ROADMAP en cours)

**Fait au 15/09/2026**
- Edge function `supabase/functions/social-tiktok`: actions `exchange_marketing`
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

---

## PROCHAINS TRAVAUX (selon plan prioritaire)

### A. Item 8 — APIs restantes (après TikTok Marketing)

- [ ] **WhatsApp Cloud API** (send + webhooks) — nouvel edge function dédiée.
- [ ] **Notifications push PWA** (service worker — message moins invasif que l'e-mail OTP ;
      pourrait contourner le problème d'e-mail sur la validation d'espace : repenser le flux
      pour valider par push + PIN).
- [ ] **Auto-sync Meta Ads** (campagnes/coûts comme TikTok Marketing mais pour Meta).
- [ ] **Auto-sync TikTok élargi** (au-delà des 30 j).
- [ ] **Sheets bidirectionnel** (export + import).

### B. Item 11 — Tests de validation (recette)

- [ ] 11a- Test manuel des Rapports : toutes les catégories + exports PDF/Google Sheets,
       y compris « Impact opérationnel (interne) ».
- [ ] 11b- Test login bout-en-bout : saisie e-mail → **réception du code OTP** (dépend du
       blocage SMTP n°1) → saisie code → entrée app.
- [ ] 11c- Config Google Sheets : connecter le compte + exporter un rapport ; vérifier le
       mode A (app Google `GS_DEFAULT_CLIENT_ID/SECRET`).

### C. Item 8 associé — TikTok Business / portail (suivi SUIVI_TIKTOK_INTEGRATIONS.md)

- [ ] Bascule app TikTok Sandbox → **Production** (App details → Status) + prérequis
       (Web, Login Kit, Content Posting API, Legal).
- [ ] Vérifier un domaine pour les images produit (meta tag TikTok sur mayela-crm.vercel.app).
- [ ] Recréer `tiktok-events` champs Pixel ID / Events API token déjà en UI (fait 09/09).
- [ ] Phase 3 MMP (Adjust/Branch) : bloqué par email pro — reste en attente.

### D. Nettoyage constaté (audit cohérence 13/09 — à traiter plus tard)

- [ ] Supprimer le projet Vercel redondant **`src`**
       (`https://src-3hvhv9op1-directionhorizoncg-7652s-projects.vercel.app`).
- [ ] Confirmer/supprimer 6 edge functions Supabase non référencées dans le repo :
       `notify-new-devis`, `task-expiry-alerts`, `check-password-pwned`,
       `horizon-leads-webhook`, `horizon-send-email`, `super-api-réseaux-sociaux-mayela`.

---

## POINTS DE VIGILANCE (rappel NOTES_TECHNIQUES.md)

- **Ne jamais ouvrir mayela-crm.html en `file://`** — toujours via serveur / Vercel.
- **RLS = vraie sécurité** — toute logique d'isolation vit dans Postgres, pas dans le JS.
- **`current_org_id()`** = pivot multi-tenant ; ne jamais filtrer côté client pour la sécurité.
- **Clé `anon` publique par design** ; clé `service_role` jamais exposée côté client
  (utilisée ici uniquement pour les tests/diagnostics via la CLI).
- Déploiement Vercel : `npx vercel deploy --prod` ; hash PWA via `node config/bump-sw.mjs`.

---

## ÉTAT GLOBAL (au 15/09/2026)

- Plan prioritaire RAPPORT 2 : items 1–7, 9, 10 **faits** ; item 8 en cours (TikTok Marketing
  fait côté code, reste App Review client + test réel) ; item 11 en attente de recette.
- Base : migrations V1→V10 appliquées.
- Frontend : `mayela-crm.html` (4488 lignes), déployé + poussé (33ab5cd).
- App déployée : https://mayela-crm.vercel.app