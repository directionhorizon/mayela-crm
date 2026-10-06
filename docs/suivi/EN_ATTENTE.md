# EN ATTENTE — MAYELA CRM

> Fichier UNIQUE de suivi des points en attente. Dernière mise à jour : 29/09/2026.
> À faire : chaque blocage = 1 entrée, cochée quand résolu ; rien d'autre à dupliquer.

## En clair

Ce fichier est **le seul registre des points ouverts** du projet. Toute question du type « est-ce
que c'est fait ? », « qu'est-ce qui bloque ? » se répond ici, pas dans une conversation.

Les entrées numérotées sont conservées même une fois résolues : elles disent **quand** et **comment**
un point a été réglé, ce qui évite de refaire un travail déjà fait.

---

## Où en est le projet au 29 septembre 2026

| # | Sujet | État | Ce qu'il reste |
|---|-------|------|----------------|
| 1 | Revue TikTok Marketing API | 🔴 **Rejetée, mise en pause** | La validation du numéro par code est bloquée côté TikTok. Ne pas resoumettre avant. |
| 2 | E-mail OTP introuvable | 🟢 **Résolu** le 23/09 | Un test utilisateur bout-en-bout reste à faire. |
| 3 | Bascule TikTok Sandbox → Production | 🟡 **Préparé** le 23/09 | Actions manuelles dans le portail TikTok. |
| 4 | MMP (Adjust / Branch) | 🟠 **Bloqué** | Dépend d'une adresse e-mail professionnelle. |
| 5 | Nettoyage (audit du 13/09) | 🟢 **Fait** le 23/09 | Rien. |
| 6 | Recette (tests de bout en bout) | 🟠 **Jamais passée** | Le principal chantier ouvert. Voir `docs/CHECKLIST_TEST_E2E.md`. |
| 7 | Connexion Page Facebook (Meta) | 🟡 **Prête — à tester maintenant** | Les 2 use cases sont ajoutés sur l'app existante `28660855693581773`. Reste : rôle de la pharmacie + URI de redirection, puis clic sur Connecter. Pas d'App Review requis. |
| 8 | Gestion Meta Ads (V11) | 🟡 **Code prêt, corrigé le 29/09** | Bloquée par l'App Review (`ads_read` / `ads_management`), puis Publish. |
| 9 | Durée de session | ⚪ **Sans limite** (décision du 28/09) | Réversible par configuration, sans code. |
| 10 | Cloisonnement par espace (V12–V14) | 🟢 **Fait** le 29/09 | Un point de données à trancher (valeur « top clients »). Cache d'audience corrigé. |
| 11 | Index de performance (V9) | 🟢 **Appliquée le 29/09** | Rien. Voir §10. |

### Les trois choses qui bloquent le plus

1. **Aucun test de bout en bout n'a été passé.** Tout le code est écrit et vérifié, mais rien n'a été
   confronté à des données réelles. L'espace PHARMAZEN est vide.
2. **TikTok** : la validation du numéro par code est bloquée par la plateforme. Rien à faire côté
   code — il faut attendre TikTok.
3. **Meta** : la procédure de création d'application est prête et détaillée, mais elle n'a pas été
   exécutée. C'est le seul chantier entièrement à la portée de l'utilisateur.

Deux points ouverts ont été **résolus le 29/09** et ne sont plus dans cette liste : la migration V9
(index de performance) est appliquée, et le cache d'analyse d'audience est cloisonné par espace.

---

## Points ouverts transverses

Ces points ne sont pas dans une section numérotée, car ils ne sont pas encore traités.

| Sujet | Où c'est détaillé |
|---|---|
| Aucun sélecteur de compte publicitaire : tous les comptes accessibles au profil autorisé sont importés | `CLASSE MARKETING/README.md` |
| Valeur par défaut « top clients » : 15 annoncé, 20 appliqué | §10 |
| Le ROAS du tableau de bord n'est pas borné par la période, contrairement à celui des rapports | `CLASSE MARKETING/README.md` |
| Aucune conversion de devise entre dépense publicitaire et ventes en FCFA | `CLASSE MARKETING/README.md` |
| Coût de l'application pour le client final | Non traité à ce jour |
| Jamais de test de bout en bout sur données réelles | §6 |

**Résolus le 29/09** et donc retirés de cette liste : migration V9 appliquée, cache d'analyse
d'audience cloisonné par espace. Détail en §10.

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

> **Recette élargie le 29/09** : la checklist `docs/CHECKLIST_TEST_E2E.md` a été réécrite et
> couvre désormais **7 scénarios**, dont trois qui n'étaient pas prévus : la rentabilité
> publicitaire (ROAS borné par la période), le cloisonnement multi-espaces et les rôles, et les
> réseaux sociaux.
>
> **Préalable bloquant** : il faut recréer un jeu de données de test. Les anciens comptes de test
> ont été supprimés, et l'espace PHARMAZEN ne contient aucune donnée. La checklist détaille les
> données à préparer — notamment des ventes **réparties sur 60 jours**, sans lesquelles les segments
> et la comparaison de périodes ne peuvent pas être vérifiés.

---

## 7. Connexion Page Facebook (Meta) — côté code PRET le 24/09/2026

Objectif : publier les offres sur la Page Facebook de chaque entreprise cliente et afficher
l'analyse d'audience (comme la connexion TikTok).

> **Multi-entreprises** : l'app Meta est partagée par tous les espaces. Le code est déjà
> multi-tenant (tokens par `org_id`, `ads_connect` liste `/me/adaccounts` du token de la personne
> qui autorise) : chaque entreprise branche sa propre Page et ses propres comptes pub.
> L'app doit donc appartenir au **développeur (agence)**, pas à un client.

### État Meta au 29/09/2026 — use cases ajoutés, l'app existante est la bonne

**Correction d'une erreur de suivi** : une note antérieure concluait qu'il fallait créer une
« app #2 » et supprimer l'app #1. **C'est faux.** Un use case ne peut pas être *retiré* et le type
d'app ne peut pas être *changé*, mais un use case **peut être ajouté** à une app existante — c'est
exactement ce qui a été fait.

| Élément | État |
|---|---|
| App Meta `28660855693581773` (créée le 26/09) | ✅ conservée — c'est la bonne |
| Use case « Gérer tout sur votre Page » | ✅ **ajouté** |
| Use case « Créer et gérer des publicités avec l'API Marketing » | ✅ **ajouté** |
| Use cases → *Customize* : `pages_manage_posts` + `pages_read_engagement` | ✅ fait |
| Portfolio de l'agence rattaché au use case Marketing | ✅ fait |
| Ready to test sur chaque use case | ⬜ à faire, avant la revue |
| App Review (`ads_read`, `ads_management`) puis **Publish** | ⬜ à faire |
| Connexion de la **Page** dans le CRM | ⬜ **possible dès maintenant** — pas d'App Review requis |
| Connexion du **compte publicitaire** | ⬜ bloquée par l'App Review |

**Aucune app à créer, aucune app à supprimer.**

**Rappel pour qui reprend le dossier** : si le portail affiche bien les 2 use cases et les
permissions `pages_*` / `ads_*`, il n'y a rien à refaire côté configuration. Le déblocage restant
est administratif : rôles, **Ready to test**, App Review, Publish.

<details>
<summary>Procédure de création d'app Meta, conservée pour référence</summary>

**Recommandation(originale, devenue sans objet) — `https://developers.facebook.com/apps/creation/` :**

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
8. **Rôles** (menu de gauche, hors *Paramètres de l'app*) → **Add People** : le compte de la personne qui administre la Page (admin de la Page et des
   comptes pub) en rôle Administrator. **Sans cela, l'app « In Development » bloque l'écran
   d'autorisation** — donc la recette complète est possible **immédiatement**, sans attendre la revue.
9. **Ready to test** sur chaque use case (obligatoire avant la revue) + contrôle dans le
   **Graph API Explorer** : `GET /me/accounts` (Pages) et `GET /me/adaccounts` (comptes pub).
10. **App Review** : Complete App Settings → reviewer instructions + screencast (connexion →
    publication → audience → pause/reprise campagne) → **Request Advanced Access** pour
    `pages_manage_posts`, `pages_read_engagement`, `read_insights`, `business_management` et
    **Standard Access** pour Ads Management → Business verification → **Submit**.
11. **Publish** → l'app passe en Live.
12. App ID/App Secret → **par espace** dans le CRM (identiques partout : une seule app).

> **À ne surtout pas demander** : les 12 permissions `user_*` (`user_friends`, `user_likes`,
> `user_location`, `user_posts`…) — le profilage individuel est interdit (RGPD) et les refus sont
> quasi garantis. L'analyse d'audience passe par les **insights agrégés** de la Page et des pubs
> (âge, genre, ville, centres d'intérêt), croisés avec les données du CRM. Seul `email` serait
> utile (identifier l'utilisateur qui se connecte) — non requis en l'état.

**Procédure détaillée, écran par écran** : `docs/FACEBOOK_META_SETUP_CLIENT.md`.

</details>

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
- [x] **App Meta `28660855693581773`** : les 2 use cases sont **ajoutés**, les permissions
      `pages_*` / `ads_*` sont disponibles, le portfolio est rattaché. *Ne pas créer d'app #2,
      ne rien supprimer.*
- [x] **Use cases → Customize** : `pages_manage_posts` + `pages_read_engagement` +
      `read_insights` ajoutés, `pages_manage_engagement` retiré.
- [ ] **URI de redirection** : menu **Facebook Login for Business → Settings**, ou
      **Cas d'utilisation → « Gérer tout sur votre Page » → Personnaliser → Go to Settings** →
      panneau *Client OAuth settings*. Interrupteurs **Client OAuth login** et **Web OAuth login**
      sur **Yes**, puis `https://mayela-crm.vercel.app/mayela-crm.html` → **Save changes**.
      *Le champ n'est pas dans Paramètres de l'app → Général / Avancé.*
- [ ] **Rôles → Add People** : menu de gauche → **Rôles** (entrée distincte de *Paramètres de
      l'app*), inviter **le compte Facebook de la personne qui administre la Page** — à identifier
      via *Page PHARMAZEN → Paramètres → Accès à la Page → Contrôle total*, pas « un compte
      pharmacie » qui n'existe pas — en rôle **Tester** (suffisant pour connecter, publier et lire
      l'audience ; **Administrator** n'est utile que pour gérer les réglages de l'app, type App
      Review / Publish), puis attendre l'acceptation de l'invitation. Sans rôle accepté, l'app
      reste « In Development » et l'écran d'autorisation est bloqué.
- [ ] **Ready to test** sur chaque use case + contrôle `GET /me/accounts` / `GET /me/adaccounts`
      dans le Graph API Explorer.
- [ ] **Connecter la Page** : **Réseaux sociaux → Page Facebook → Connecter** → App ID +
      App Secret → autoriser avec le compte identifié. *Si ce compte administre plusieurs
      Pages, un menu déroulant impose de choisir laquelle — vérifier que c'est bien
      **PHARMAZEN** (le nom s'affiche ensuite sur la carte).* *Possible dès maintenant, pas
      d'App Review requis pour les permissions `pages_*`.*
- [ ] Publier une offre de test + vérifier l'écran Analyse d'audience.
- [ ] Revue (Advanced Access `pages_manage_posts` / `pages_read_engagement` / `read_insights` /
      `business_management` + **Standard Access** Ads Management, screencast fourni) → **Publish**.
- [ ] **Connecter le compte publicitaire** après Publish : « 📊 Autoriser l'analyse publicitaire ».

---

## 8. Gestion Meta Ads (V11) — côté code PRET le 24/09/2026, corrigé le 29/09/2026

> **29/09/2026 — correctifs appliqués et déployés** (`mayela-crm-bea9bc628d`) :
> - La fenêtre d'autorisation demandait les 7 permissions d'un bloc. Meta rejetait
>   l'ensemble (les `ads_*` exigent un App Review) → le bouton « Autoriser » ne menait nulle part.
>   Les permissions Page et Ads sont désormais demandées **séparément**.
> - L'enregistrement App ID/Secret écrasait toute la config (pertes des jetons) → fusion
>   côté serveur (action `save_app`).
> - Le bouton « analyse publicitaire » était caché dans le repli « Préparation dans Meta »
>   → remonté sous les champs App ID / Secret.
> - **2 bugs runtime dans `ads_campaigns_get`** : variable `m` jamais définie et `await`
>   manquant sur l'historique journalier. La synchronisation Meta n'aurait rien produit.
> - Toujours **non testé sur données réelles** : le compte PHARMAZEN n'a jamais été autorisé.

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

## 9. Duree de session (code OTP) - SANS LIMITE, a reactiver plus tard si besoin

**Decision du 28/09/2026** : suppression de toute duree de validite du code de connexion.
Un code n'est plus redemande au fil du temps, sur aucun appareil. Le code n'est demande que
dans 3 cas reels : premiere connexion sur un appareil, **« Se deconnecter »** (bouton manuel
des Reglages), ou **changement d'e-mail de connexion** (preuve de propriete de la nouvelle
adresse). La purge automatique du stockage par l'appareil (iOS apres ~7 jours sans usage,
reinstallation, onglet prive) peut aussi reseter la session : c'est le systeme qui decide,
pas l'application.

**Configuration Supabase en place (verifiee) :**

| Reglage | Valeur | Effet |
|---|---|---|
| `sessions_timebox` | `0` | pas de duree maximale de session |
| `sessions_inactivity_timeout` | `0` | pas de fermeture pour inactivite |
| `jwt_exp` | `3600` | jeton technique 1 h, renouvele **silencieusement** (ce n'est pas une expiration) |
| `mailer_otp_exp` | `3600` | validite du code **quand il est envoye** (1 h pour le saisir) |

**Pour reacter une duree plus tard** (aucune ligne de code a ecrire, uniquement la config) :
`PATCH /v1/projects/<ref>/config/auth` avec `{"sessions_timebox": <secondes>}`
(2592000 = 30 jours) et/ou `{"sessions_inactivity_timeout": <secondes>}`.
Valeurs remises a 0 = retour immediat au comportement actuel.

**Point de vigilance** : `sessions_timebox` ne s'applique qu'aux sessions creees apres le
changement. Les sessions deja ouvertes avant le reglage restent valides jusqu'a leur echeance
(qui peut donc depasser la nouvelle duree). Pour appliquer retroactivement, il faut forcer
une reconnexion (deconnexion puis nouveau code sur chaque appareil).

---

## 10. Cloisonnement des données par espace (V12 / V13 / V14) — FAIT le 29/09/2026

### Origine
Signalement du 28/09 : **les données d'un espace apparaissaient dans un autre espace**
(« transposition »). Deux causes distinctes, pas une seule — voir l'en-tête de
`config/MIGRATION_V13_ISOLATION_ESPACE.sql`.

### V13 — cloisonnement strict entre espaces (appliquée le 28/09/2026)
Les politiques `*_deny_anonymous` étaient **permissives** (`using (auth.role() <> 'anon')`).
Plusieurs politiques permissives se combinant par **OU**, dès qu'un compte était connecté sa
ligne passait cette politique, ce qui **neutralisait toutes les autres** : chaque client connecté
pouvait lire — et écrire, `cmd = ALL` — l'intégralité de `clients`, `achats`, `devis`, `tasks`,
`interactions`, `organizations` et `profiles`. Les codes d'invitation de tous les espaces étaient
exposés, et `profiles` permettait de modifier le profil d'un autre compte.

- [x] Blocage explicite `TO anon using (false)` sur les 8 tables ; politiques réelles recentrées
      sur `TO authenticated` ; une seule politique par table et par commande.
- [x] `current_org_id()` (`STABLE SECURITY DEFINER`) : espace calculé **côté serveur**, non
      contrôlable par le client.
- [x] Backfill de `ia_messages.org_id` + trigger `ia_messages_set_org_trg` (l'espace est décidé
      par la base, jamais par le navigateur).
- [x] Non-régression : `node config/verify_v13_isolation.mjs` → **11/11 OK**, aucun résidu.

### V12 — préférence « top clients » persistée (appliquée le 28/09/2026)
- [x] `profiles.top_clients_limit` (défaut **15**, CHECK 3–50) au lieu d'une valeur locale à
      l'appareil : le réglage ne se réinitialisait plus selon le navigateur.

### V14 — mode « sans espace » (solo) — FAIT le 29/09/2026
**Trou laissé par V13** : la V13 avait couvert `clients` et `produits_services` avec la branche
`org_id IS NULL AND owner_user_id = auth.uid()`, mais **pas** les 5 tables enfants ni
`ia_messages`. Avec deux `NULL`, `org_id = current_org_id()` vaut `NULL` (et non `true`) : le
propriétaire d'un client sans espace pouvait le **créer et le lire**, mais **toute écriture
enfant échouait en 403** (`new row violates row-level security policy`) — achat, devis, tâche,
interaction, créance, conversation IA.

> L'app sait produire ce cas (`isSolo ? { owner_user_id } : { org_id }`), et un compte sans espace
> est renvoyé vers l'onboarding. Le chemin était donc peu atteignable en pratique, mais le contrat
> du code et celui de la base divergeaient.

- [x] `config/MIGRATION_V14_SOLO_CHILDREN.sql` — branche propriétaire ajoutée aux 5 tables
      enfants + tolérance `org_id IS NULL` sur `ia_messages` (toujours bornée par
      `user_id = auth.uid()`). **Appliquée en base le 29/09/2026**, idempotente.
- [x] Test de non-régression écrit **avant** la migration pour reproduire le 403, puis repassé
      après : `config/verify_v14_solo.mjs` → **11/11 OK** (écriture propriétaire, relecture,
      conversation IA, absence de fuite inter-espace, écriture concurrente refusée).
- [x] `node config/verify_v13_isolation.mjs` → **11/11 OK** après V14 (l'ouverture du mode solo
      n'a pas rouvert la fuite entre espaces).
- [x] `config/SCHEMA_SUPABASE.md` : section « RLS — principe » réécrite (les 3 affirmations
      « deny restrictif / `owner` OU `org` / `current_org_id` lit `profiles.org_id` » étaient
      devenues fausses), en-tête et tableau des fonctions RPC actualisés.

### Reste (données, à trancher)
- [x] **`top_clients_limit` vaut 20 sur les 5 profils** alors que l'interface annonce
      « défaut : 15 » : la valeur par défaut n'est donc jamais visible. → **À trancher** :
      remettre à 15, ou expliciter le 20 dans l'interface.
      *Précision (29/09) : `TOP_CLIENTS_DEFAULT = 20` est la seule valeur réellement
      appliquée. Le libellé de l'interface et le défaut de la colonne V12 disent 15.*
      *Portée réelle du réglage : `profiles.top_clients_limit` est porté par le **profil
      utilisateur**, pas par l'espace → la valeur est partagée entre tous les espaces de
      l'utilisateur. C'est cohérent avec le libellé « Même valeur pour tous vos espaces ».*
- [x] **Cache d'analyse d'audience non cloisonné par espace** — **CORRIGÉ le 29/09/2026.**
      Constat : `healthCache` est associé à un espace via `healthCacheOrg`, mais `insightsData`
      ne l'était pas. `loadSocialInsights(force)` réutilisait le cache dès que `force` était faux,
      et le rendu en fin de `loadSocial()` affichait le cache sans vérification. Après une bascule
      d'espace, les chiffres d'audience de l'espace précédent restaient donc affichés.
      Correctif appliqué : variable `insightsOrg` comparable à `healthCacheOrg`, renseignée au
      moment du chargement, comparée à `activeOrgId()` aux **deux** points de lecture, et vidée
      avec `insightsData` lors des trois invalidations (connexion, déconnexion, changement de
      réseau). Les tests `verify_v13_isolation.mjs` et `verify_v14_solo.mjs` repassent 11/11.
      Vérifié dans `CLASSE MARKETING/analyse-audience-et-insights.md` et
      `CLASSE MARKETING/espaces-et-acces.md`.

- [x] **Migration V9 (index de performances) jamais appliquée** — **APPLIQUÉE le 29/09/2026.**
      13 index créés ou confirmés en base via l'API Management Supabase. Au passage, deux lignes
      de la migration ont été retirées du fichier car elles dupliquaient des index déjà posés :
      `idx_interactions_client` (doublon exact de `idx_interactions_client_id`) et
      `idx_campaigns_org_id` (déjà couvert par `campaigns_org_id_idx(org_id, created_at DESC)`).
      `config/SCHEMA_SUPABASE.md` et `config/DEPLOY_BACKEND.md` sont à jour.

### Les 4 comptes sans espace —clos le 29/09/2026 (aucune action requise)

**Principe rappelé (décision utilisateur) :** un compte ne peut pas être dissocié de son adresse
e-mail, et une adresse e-mail ne peut pas être dissociée de son espace. Si l'espace lié à une
adresse est supprimé, le compte correspondant n'a plus d'objet.

Les 4 comptes (`sagessenlcd.determinee@`, `direction.horizon.cg@`, `pharmazen24@`,
`direction.horizon@`) ont été audités table par table :

| Table | Lignes rattachées à ces 4 comptes |
|---|---|
| `clients` / `achats` / `devis` / `tasks` / `interactions` / `creances` | **0** |
| `produits_services` (clients solo) | **0** |
| `ia_messages` | **0** |
| `org_members` (appartenance) | **0** |
| `social_accounts` / `social_posts` / `social_events_log` / `campaigns` / `leads_tiktok` | **0** |

- [x] **Aucune donnée à récupérer ni à rattacher** : la question est sans objet. Ces comptes
      n'affichent que l'écran d'onboarding, ce qui est le comportement correct pour un compte
      sans espace — **rien à corriger, rien à migrer**.
- [x] Le seul espace existant, **PHARMAZEN**, appartient à `contact@pharmazen.biz` (créé le
      28/09/2026 02:06, dernier compte connecté le 28/09). Il n'a **aucune** donnée métier
      (0 client, 0 campagne) : c'est un espace vide en cours de paramétrage.
- [x] **Résidu de test nettoyé** : un produit « Produit solo » (créé le 28/09 23:28 par mon
      propre test du mode solo) avait survécu à la suppression de son compte de test.
      Supprimé — `produits_services` ne contient plus que des lignes légitimes.

> `audit_log` conserve 2 168 lignes historiques, dont 2 156 à `user_id IS NULL` (comptes de test
> supprimés — 10/07, 22/08 et 28/09). C'est un **journal** : sa conservation est normale et
> sans effet sur le fonctionnement. Pas de purge.

---

## Rappel de vigilance

- **Ne jamais ouvrir `mayela-crm.html` en `file://`** — toujours via serveur / Vercel.
- **RLS = vraie sécurité** ; clé `service_role` jamais exposée côté client.
- **Deux politiques permissives sur une même commande se combinent par OU** : elles s'annulent
  au lieu de se restreindre. Une seule politique par table et par commande.
- Une branche `owner_user_id` doit être reportée sur **toutes** les tables qui dépendent
  du client, pas seulement sur `clients` (cf. V13 → V14).
- Après toute migration RLS : rejouer **les deux** scripts de vérification
  (`verify_v13_isolation.mjs` + `verify_v14_solo.mjs`) — le second prouve qu'on n'a pas rouvert
  la fuite entre espaces en ouvrant le mode solo.
- Déploiement : `node config/bump-sw.mjs` puis `vercel deploy --prod`.