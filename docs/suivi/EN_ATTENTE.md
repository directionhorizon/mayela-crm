# EN ATTENTE — MAYELA CRM

> Fichier UNIQUE de suivi des points en attente. Dernière mise à jour : 27/09/2026.
> À faire : chaque blocage = 1 entrée, cochée quand résolu ; rien d'autre à dupliquer.

---

## 1. Revue TikTok Marketing API (app TikTok for Business) — REJETEE + MIS EN PAUSE le 24/09/2026

**Statut : `Rejected`** (précédemment `Pending`) et **mis en pause** (décision utilisateur) :
ne pas relancer la resoumission tant que la **validation du numéro par code** ne repasse pas.

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
- [x] **Cause « e-mail SANS code » (25/09/2026)** : les templates **Confirm signup** et
      **Email change** ne contenaient que `{{ .ConfirmationURL }}`, sans `{{ .Token }}`
      (réservé au Magic Link des users existants). Or la création/bascule d'espace et le
      changement d'e-mail passent par `signInWithOtp shouldCreateUser` → e-mail envoyé avec
      le template Confirm signup → **aucun code affiché**. 
- [x] **Correctif appliqué en prod (25/09/2026)** via API Management (`PATCH .../config/auth`) :
      template **Confirm signup**, **Email change** et **Magic Link** réécrits en français,
      tous à **8 chiffres** (`mailer_otp_length = 8`) avec `{{ .Token }}` en gros.
      Sujets : « Votre code de confirmation MAYELA CRM » / « Code de changement d'e-mail MAYELA CRM ».
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

Objectif : publier les offres sur la Page Facebook de chaque entreprise cliente et afficher
l'analyse d'audience (comme la connexion TikTok).

> **Multi-entreprises** : l'app Meta est partagée par tous les espaces. Le code est déjà
> multi-tenant (tokens par `org_id`, `ads_connect` liste `/me/adaccounts` du token de la personne
> qui autorise) : chaque entreprise branche sa propre Page et ses propres comptes pub.
> L'app doit donc appartenir au **développeur (agence)**, pas à un client.

### Reprise du 27/09/2026 — app Meta à recréer (nouveau modèle « use cases ») — PROCÉDURE CLAIRE

**Constat** : une 1re app a été créée le 26/09 avec le **compte de la pharmacie** et le use case
« Authentifier et demander les données d'utilisateurs avec Facebook Login ». Elle est **inutilisable** :
les permissions `pages_*`, `ads_*` et `business_management` n'y sont pas disponibles. Le type d'app
ne peut pas être changé et un use case ne peut pas être retiré après création (doc Meta
« App Types » : *app types cannot be changed*, *use cases cannot be removed*).
→ **App #1 : à supprimer** une fois l'app #2 opérationnelle.

**Règles 2026 (vérifiées sur la doc Meta)** : les permissions ne se cochent plus une à une — elles
sont **apportées par les use cases** choisis à la création, et le type d'app en découle. La
catégorie « Autres » ne propose que des use cases consumer (Login, dons, Thread Exchange, IDFA,
App Events). Les use cases **incompatibles avec la sélection sont grisés** dans l'assistant.

**Recommandation(app #2) — `https://developers.facebook.com/apps/creation/` :**

1. Se connecter avec le **compte développeur de l'agence** (pas celui de la pharmacie : l'app est
   partagée par tous les espaces clients).
2. **App details** : nom `Mayela CRM` (⚠️ Meta refuse les noms contenant FB/Face/Book/Insta/Gram)
   + e-mail de contact de l'agence → **Next**.
3. **Use cases — cocher EXACTEMENT ces deux lignes** (filtre à gauche : les deux ne sont pas
   dans la même catégorie ; repasser sur « Toutes » avant de valider) :
   - ✅ **« Tout gérer sur votre Page »** (*Manage everything on your Page*, cat. **Gestion du
     contenu**) → apporte `business_management`, `pages_show_list`, `public_profile`
     (non retirables) + le produit **Facebook Login for Business** ;
   - ✅ **« Créer et gérer des publicités avec l'API Marketing »** (*Create & manage ads with
     Marketing API*, cat. **Publicités**) → apporte `ads_read`, `ads_management`,
     `business_management` (non retirables) + la feature **Ads Management Standard Access** ;
   - ❌ **ne pas** prendre « Créer et gérer des publicités d'**application** avec Meta Ads
     Manager » (= promotions d'app mobiles ; la doc Meta précise *« Does not include access to
     Marketing API »* → zéro permission `ads_*`) — même catégorie, libellé presque identique :
     c'est le piège principal ;
   - ❌ « Authentifier et demander les données des utilisateur·rice·s avec Facebook Login » =
     l'erreur de l'app #1 (incompatible avec le use case Page, n'apporte rien d'utile) ;
   - ❌ « Accéder à l'API Threads », « Tisser des liens avec votre clientèle via WhatsApp »,
     « Messagerie professionnelle » (hors périmètre) ;
   - ❌ « Mesurer les performances publicitaires avec l'API Marketing » (lecture seule ; la
     pause/reprise + budget exigent l'écriture de « Créer et gérer… »).
   - ⚠️ Si « Gérer tout sur votre Page » est **absent** de la liste → ne pas créer l'app sans
     lui (aucune permission `pages_*` ne peut exister) ; il est ajoutable après coup
     (*Use cases → + Add use case*), l'inverse étant impossible.
4. **Business** : rattacher le **Business Portfolio de l'agence** → **Créer l'app**.
5. **Use cases → Customize** : bouton **Add** sur le use case Page pour
   `pages_manage_posts` (publication), `pages_read_engagement` (dépendance de `ads_management`/
   `business_management`), `read_insights` (analyse d'audience) ; **retirer** `pages_manage_engagement`
   (ajoutée par défaut, inutile). Ne rien demander d'autre (ni `catalog_management`, ni
   `leads_retrieval`, ni `page_manage_ads`, ni `email`). Sur le use case Marketing API : attacher
   le portfolio + au moins un compte publicitaire `act_…` (sandbox pour un test sans argent).
6. **Facebook Login for Business → Settings → Valid OAuth Redirect URIs** =
   `https://mayela-crm.vercel.app/mayela-crm.html` (identique, sans slash final).
7. **App settings → Basic** → App ID + App Secret ; icône 1024², Privacy Policy
   `https://mayela-crm.vercel.app/politique-confidentialite.html`, Terms `…/terms.html`,
   catégorie Business, domaine `mayela-crm.vercel.app`.
8. **App settings → Roles → Add People** : le compte FB de la pharmacie (admin de la Page et des
   comptes pub) en rôle Administrator. **Sans cela, l'app « In Development » bloque l'écran
   d'autorisation** — donc la recette complète est possible **immédiatement**, sans attendre la revue.
9. **Ready to test** sur chaque use case (obligatoire avant la revue) + contrôle dans le
   **Graph API Explorer** : `GET /me/accounts` (Pages) et `GET /me/adaccounts` (comptes pub).
10. **App Review** : Complete App Settings → reviewer instructions + screencast (connexion →
    publication → audience → pause/reprise campagne) → **Request Advanced Access** pour
    `pages_manage_posts`, `pages_read_engagement`, `read_insights`, `business_management` et
    **Standard Access** pour Ads Management → Business verification → **Submit**.
11. **Publish** → l'app passe en Live. Puis **supprimer l'app #1**.
12. App ID/App Secret → **par espace** dans le CRM (identiques partout : une seule app).

> **À ne surtout pas demander** : les 12 permissions `user_*` (`user_friends`, `user_likes`,
> `user_location`, `user_posts`…) — le profilage individuel est interdit (RGPD) et les refus sont
> quasi garantis. L'analyse d'audience passe par les **insights agrégés** de la Page et des pubs
> (âge, genre, ville, centres d'intérêt), croisés avec les données du CRM. Seul `email` serait
> utile (identifier l'utilisateur qui se connecte) — non requis en l'état.

**Procédure détaillée, écran par écran** : `docs/FACEBOOK_META_SETUP_CLIENT.md` (réécrit le
27/09/2026, flow « use cases » + tableau d'erreurs fréquentes).

### Déjà prêt (ne pas refaire)
- [x] Guide **`docs/FACEBOOK_META_SETUP_CLIENT.md`** — procédure de création de l'app Meta
      **écran par écran (flow « use cases »)** + tableau d'erreurs fréquentes ; **réécrit le
      27/09/2026** (l'ancienne version décrivait l'ancien flow « Business app + produits »).
- [x] Edge function **`social-facebook`** (OAuth : échange du code → user token longue durée →
      Page Access Token, stocké dans `social_accounts.config` comme `page_id`/`access_token`).
      **Déployée** sur le projet.
- [x] UI **Connexion Facebook** en OAuth (panneau App ID/App Secret + redirect URI), le
      prompt manuel page_id/token est supprimé. Publication et analyse réutilisent les
      fonctions existantes (`social-publish` / `social-insights` / `social-health`).

### Reste (manuel, portail developers.facebook.com + CRM)
- [ ] **Créer l'app #2** selon la procédure « Reprise du 27/09/2026 » ci-dessus (2 use cases :
      *Gérer tout sur votre Page* + *Créer et gérer des annonces avec l'API Marketing*, compte +
      portfolio de l'agence), puis supprimer l'app #1.
- [ ] **Use cases → Customize** : ajouter `pages_manage_posts` + `pages_read_engagement` +
      `read_insights`, retirer `pages_manage_engagement`, attacher le portfolio + un compte
      publicitaire `act_…`.
- [ ] URI de redirection dans **Facebook Login for Business** :
      `https://mayela-crm.vercel.app/mayela-crm.html`.
- [ ] **Roles → Add People** : compte FB de la pharmacie en Administrator (sinon « App In
      Development » bloque l'autorisation) → recette possible sans attendre la revue.
- [ ] **Ready to test** sur chaque use case + contrôle `GET /me/accounts` / `GET /me/adaccounts`
      dans le Graph API Explorer.
- [ ] Renseigner **App ID** + **App Secret** dans le CRM → **Connexion Facebook** → autoriser
      la Page avec le compte admin → carte « Connecté ».
- [ ] Publier une offre de test + vérifier l'écran Analyse d'audience.
- [ ] Revue (Advanced Access `pages_manage_posts` / `pages_read_engagement` / `read_insights` /
      `business_management` + **Standard Access** Ads Management, screencast fourni) → **Publish**.

---

## 8. Gestion Meta Ads (V11) — côté code PRET le 24/09/2026

Objectif : relire les **campagnes + ensembles de pubs** Meta (dépense, impressions, clics,
portée — 30 j) et les **gérer** (pause/reprise, budget), comme TikTok Ads V10.1.
La connexion des comptes se fera plus tard (app Meta à compléter par la pharmacie).

### Déjà prêt (ne pas refaire)
- [x] Migration **`config/MIGRATION_V11_META_ADS.sql`** écrite (source='meta', colonnes
      `meta_*` dans `campaigns`, table `meta_adsets`, RLS + grants) — **appliquée en base**
      le 25/09/2026 (colonnes + table vérifiées en 200 via REST).
- [x] Edge function **`social-facebook`** : actions `ads_connect`, `ads_campaigns_get`,
      `ads_campaign_status`, `ads_campaign_update`, `ads_adgroups_get`, `ads_adgroup_update`,
      `ads_adgroup_status` + helpers conversions minor/major — **déployée** (version 4,
      JWT rétabli après un déploiement `--no-verify-jwt` corrigé).
- [x] UI V11 : panneau « Analyse publicitaire (Meta Ads Manager) » (étape 5 Réseaux), écran
      **🛠️ Gérer mes campagnes Meta Ads** (pause/reprise + budget campagne + ad sets),
      badge source Meta dans Campagnes. **Déployée sur Vercel** (sw.js `8b1a814ef0`).
- [x] Edge function temporaire `db-inspect` **supprimée** après usage (aucune porte SQL ouverte).

### Reste (manuel, portail developers.facebook.com + CRM)
- [ ] Créer/compléter la **Business App** Meta (guide `docs/FACEBOOK_META_SETUP_CLIENT.md`) :
      permissions `ads_management`, `ads_read`, `business_management` (en plus des 4 existantes).
- [ ] Ré-autoriser : **Réseaux → Page Facebook → Se connecter à Facebook** puis
      **« Se connecter à l'analyse publicitaire »** (compte admin du compte Ads Manager).
- [ ] **Relever les campagnes (30 j)** → écran Gérer mes campagnes Meta Ads.
- [ ] Tester pause/reprise + budget campagne et ad set (devise du compte publicitaire).

### Note TikTok
- [x] TikTok Ads (V10.1) reste **mis en pause** — voir section 1 (app rejetée, validation
      téléphone bloquée). Le code V10.1 reste fonctionnel et déployé.

---

## Rappel de vigilance

- **Ne jamais ouvrir `mayela-crm.html` en `file://`** — toujours via serveur / Vercel.
- **RLS = vraie sécurité** ; clé `service_role` jamais exposée côté client.
- Déploiement : `node config/bump-sw.mjs` puis `vercel deploy --prod`.