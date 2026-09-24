# EN ATTENTE — MAYELA CRM

> Fichier UNIQUE de suivi des points en attente. Dernière mise à jour : 24/09/2026.
> À faire : chaque blocage = 1 entrée, cochée quand résolu ; rien d'autre à dupliquer.

---

## 1. Revue TikTok Marketing API (app TikTok for Business) — REJETEE le 24/09/2026

**Statut : `Rejected`** (précédemment `Pending`). Dossier soumis à la création de l'app
(description d'usage + redirect URI + prérequis : Web, Login Kit, Content Posting API, Legal).

### Effet
- TikTok ne délivre toujours **ni Client Key ni Secret** sur la page Basic Info.
- Impossible de configurer les credentials dans le CRM ni de tester « Analyse publicitaire ».
- Les comptes publicitaires de production ne peuvent pas autoriser l'app avant approbation.

### Action (rejet)
- [ ] **Lire la raison exacte du rejet** dans le portail business.tiktok.com
      (page de l'app → app review → message/motif du rejet).
- [ ] **Validation du numéro par code temporairement bloquée** (24/09/2026) → reprendre
      la resoumission quand la validation passe.
- [ ] Corriger le(s) motif(s) : description, use case, captures d'écran, URL légales, etc.
- [ ] **Resoumettre** la revue.
- [ ] Suivre le statut (2–3 jours ouvrés).

### Action à l'approbation
- [ ] Récupérer **Client Key (App ID)** + **Client Secret** (portail business.tiktok.com → Basic Info).
- [ ] Renseigner les credentials dans le CRM : **Réseaux → TikTok** (Login Kit déjà connecté).
- [ ] Vérifier le **Redirect URI** enregistré = `https://mayela-crm.vercel.app/mayela-crm.html`.
- [ ] **Se connecter à l'analyse publicitaire** (OAuth ads.tiktok.com) → autoriser le compte pub.
- [ ] **Relever les campagnes (30 j)** → données dans l'écran Campagnes (source='tik').

### Déjà prêt (ne pas refaire)
- [x] Edge function `social-tiktok` : actions Ads (campagnes, adgroups, audiences, leads) — **déployée**.
- [x] Migration **V10.1 appliquée** en base (tables `tik_adgroups`, `tik_audiences`,
      `leads_tiktok` + colonnes `tik_*` dans `campaigns`, RLS + grants).
- [x] UI V10.1 déployée sur Vercel (sw.js `da3a2e8ff6` — 3 écrans TikTok Ads + boutons Réseaux).
- [x] Domaine `mayela-crm.vercel.app` vérifié (meta tag + fichier racine, URLs 200).

---

## 2. E-mail OTP introuvable (création / bascule d'espace) — RESOLU le 23/09/2026

**Symptôme** : « Code envoyé à … » mais **aucun e-mail** ne parvient
(500 « Error sending confirmation email » côté Supabase `/auth/v1/otp`, log réel Gmail :
`535 Username and Password not accepted`).

**Cause (confirmée)** : le **mot de passe d'application Gmail** (Sender password SMTP Supabase,
compte `direction.horizon.cg@gmail.com`) date de l'ancien mot de passe principal du compte ;
le changement de mot de passe Google **révoque tous les app passwords** → mort → rejet `535` à
chaque essai (masqué, non récupérable → remplacé).

- [x] Nouveau **app password** créé sur `myaccount.google.com/apppasswords`
      (compte `direction.horizon.cg@gmail.com` — celui de `SMTP Settings`, PAS `@gmail.com`).
- [x] **Sender password** remplacé dans Supabase Dashboard → Authentication → SMTP Settings → Save.
- [x] Test d'envoi OTP relancé via `/auth/v1/otp` → **200 OK** (plus aucune erreur `535` dans les logs).
- [x] Template « Magic Link » contient `{{ .Token }}` (vérifié, sujet personnalisé OK).
- [x] **Secret sécurisé** : enregistré dans le coffre **Bitwarden** (item
      « MAYELA CRM - Gmail App Password (smtp supabase) », user `direction.horizon.cg@gmail.com`,
      daté 23/09/2026). Accessible via `config\bw-get.ps1`. Fichier en clair
      `supabase/Password appgoogle.txt` supprimé + `.gitignore` renforcé
      (`supabase/.bw-session`, `supabase/Password*.txt`).
- [ ] Re-test utilisateur : création / bascule d'espace bout-en-bout (réception du code).

---

## 3. Bascule Sandbox → Production (publication d'offres TikTok) — PREPAREE le 23/09/2026

**Côté code/préparation (fait) :**
- [x] Meta tag `tiktok-developers-site-verification` ajouté dans `index.html`
      (en plus du fichier `tiktok0OBaVnw93QgZvZL3IjMOty1RGq5KaxWo.txt` déjà servi à la racine)
      → domaine `mayela-crm.vercel.app` prêt pour la vérification images produit.
- [x] URLs exigées vérifiées en ligne (200) : `/`, `terms.html`, `politique-confidentialite.html`,
      `mayela-crm.html`, `sw.js`.

**Reste (manuel, portail TikTok developers) :**
- [ ] **App details → Status** : Sandbox → Production.
- [ ] Prérequis revue : Web, Login Kit, Content Posting API, Legal (URLs toutes dispo).
- [ ] Vérifier le **domaine** (images produit) dans le portail.
- [ ] Reconnecter le compte dans le CRM après bascule.

---

## 4. MMP (Adjust/Branch) — bloqué par email pro

- [ ] Créer un email professionnel du projet → inscrire le compte MMP → configurer postbacks.

---

## 5. Nettoyage (audit 13/09) — FAIT le 23/09/2026

- [x] Projet Vercel redondant **`src`** supprimé
      (l'URL obsolète `src-five-chi-49.vercel.app` ne répond plus).
- [x] Les 6 edge functions Supabase non référencées supprimées :
      `notify-new-devis`, `task-expiry-alerts`, `check-password-pwned`,
      `horizon-leads-webhook`, `horizon-send-email`, `super-api-réseaux-sociaux-mayela`.
      (Code des 5 premières archivé en backup local avant suppression.)
- [x] Projet Vercel **`google-sheet-id`** conservé (décision utilisateur).

---

## 6. En attente de recette (item 11)

- [ ] 11a · Test manuel Rapports (toutes catégories + exports PDF / Google Sheets).
- [ ] 11b · Test login bout-en-bout : saisie e-mail → **réception du code OTP** (SMTP réparé 23/09) → saisie code → entrée app.
- [ ] 11c · Config Google Sheets + vérifier mode A (`GS_DEFAULT_CLIENT_ID/SECRET`).

---

## 7. Connexion Page Facebook (Meta) — côté code PRET le 24/09/2026

Objectif : publier les offres sur la Page Facebook de la pharmacie et afficher
l'analyse d'audience (comme la connexion TikTok). La connexion du compte se fera plus tard
(app Meta à créer par la pharmacie).

### Déjà prêt (ne pas refaire)
- [x] Guide client **`docs/FACEBOOK_META_SETUP_CLIENT.md`** (créer l'app Meta, permissions,
      revue, autoriser la Page dans le CRM).
- [x] Edge function **`social-facebook`** (OAuth : échange du code → user token longue durée →
      Page Access Token, stocké dans `social_accounts.config` comme `page_id`/`access_token`).
      **Déployée** sur le projet.
- [x] UI **Connexion Facebook** en OAuth (panneau App ID/App Secret + redirect URI), le
      prompt manuel page_id/token est supprimé. Publication et analyse réutilisent les
      fonctions existantes (`social-publish` / `social-insights` / `social-health`).

### Reste (manuel, portail developers.facebook.com + CRM)
- [ ] Créer la **Business App** Meta (voir guide) + produit **Facebook Login** + URI de
      redirection = `https://mayela-crm.vercel.app/mayela-crm.html`.
- [ ] Permissions : `pages_show_list`, `pages_manage_posts`, `pages_read_engagement`,
      `read_insights` (niveau advanced access / revue, ou rôles Admin/Tester en attendant).
- [ ] Renseigner **App ID** + **App Secret** dans le CRM → **Connexion Facebook** → autoriser
      la Page avec le compte admin → carte « Connecté ».
- [ ] Publier une offre de test + vérifier l'écran Analyse d'audience.

---

## Rappel de vigilance

- **Ne jamais ouvrir `mayela-crm.html` en `file://`** — toujours via serveur / Vercel.
- **RLS = vraie sécurité** ; clé `service_role` jamais exposée côté client.
- Déploiement : `node config/bump-sw.mjs` puis `vercel deploy --prod`.