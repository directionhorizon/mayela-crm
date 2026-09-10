# Déploiement backend — MAYELA CRM

Trois étapes, dans l'ordre. Comptez ~30 minutes.

---

## Étape 0 — Déploiement du front (Vercel) — OBLIGATOIRE à chaque mise à jour

L'application n'est PAS servie par Supabase, mais par Vercel. Déployer les Edge Functions ne met
jamais à jour le front.

1. Vérifier la syntaxe du HTML (extrait les blocs `<script>` et les teste) :
   ```powershell
   $c = Get-Content -Raw mayela-crm.html
   $m = [regex]::Matches($c, '<script>(.*?)</script>', 'Singleline')
   $i = 0; foreach($x in $m){ $i++; $f = "$env:TEMP\inline_$i.js"; Set-Content $f $x.Groups[1].Value -Encoding UTF8; node --check $f }
   ```
2. **Re-versiomer le service worker** (étape indispensable) :
   ```powershell
   node config/bump-sw.mjs
   ```
   → re-calcule `CACHE = 'mayela-crm-<hash>'` dans `sw.js` d'après le contenu de l'app. Sans ce pas,
   les appareils installés gardent l'ancien service worker et le cache obsolète.
3. Déployer :
   ```powershell
   npx --yes vercel --prod --yes --force
   ```
4. Vérifier en production (le téléphone doit recevoir ce contenu) :
   ```powershell
   $h = (Invoke-WebRequest 'https://mayela-crm.vercel.app/mayela-crm.html').Content
   $h -match 'currentSheetDetail'   # → True = nouveau code servi
   ```

### Pourquoi la version Android installée ne voyait pas les nouvelles fonctions
- L'icône Android pointe vers l'URL d'un **ancien déploiement Vercel** (`mayela-<hash>-…vercel.app`,
  immuable) : il sert pour toujours l'ancien code. **Solution** : une redirection canonique intégrée
  au début de `mayela-crm.html` renvoie tous les hôtes non canoniques vers `mayela-crm.vercel.app`
  (seule exception : localhost / LAN / `*.localhost` pour le développement Pinokio). L'utilisateur
  peut devoir se reconnecter UNE fois après le premier redémarrage (changement d'origine).
- Le service worker avait une version figée (`v3`) : le cache n'était jamais invalidé. **Solution** :
  version calculée à partir du contenu déployé à chaque mise à jour (étape 2, `config/bump-sw.mjs` —
  re-hash de `mayela-crm.html`, `index.html` et `manifest.webmanifest`).
- Aucune vérification de mise à jour au retour dans l'app : sur Android, rouvrir l'app depuis le
  sélecteur de tâches (warm resume) ne déclenche pas de navigation → chrome ne re-téléchargeait pas
  `sw.js` → l'ancien écran restait affiché. **Solution** (bloc service worker en fin de
  `mayela-crm.html`) :
  1. `register('./sw.js', { updateViaCache:'none' })` → le navigateur re-télécharge toujours `sw.js`
     (jamais servi par le cache HTTP) ;
  2. `reg.update()` forcé au **chargement**, à chaque **retour au premier plan**
     (`visibilitychange` visible, couvre le warm resume) et au **rétablissement depuis le bfcache**
     (`pageshow.persisted`) ;
  3. dès qu'une version plus récente s'installe ✦ `skipWaiting()` dans `sw.js` ✦ l'app installe la
     nouvelle version et affiche un bandeau **« Nouvelle version disponible — Recharger »** qui
     recharge immédiatement (au clic). Sans ce bandeau, la nouvelle version est prête mais l'écran
     affiché reste l'ancien tant qu'on ne recharge pas.

> Aucune action supplémentaire pour l'utilisateur Android : il suffit d'ouvrir l'app une fois en
> ligne après un déploiement. Le bandeau apparaît, on tape « Recharger », et la nouvelle version
> s'affiche.

**Contrôle de la version sur un appareil installé** : **Réglages → À propos** affiche la version
exécutée sur l'appareil (cache local du service worker) et la dernière version publiée (lue depuis
`sw.js` servi par Vercel). Si elles diffèrent, une ligne « Mise à jour disponible — Recharger »
apparaît et recharge l'app. C'est l'outil le plus simple pour vérifier qu'un téléphone a bien reçu
le dernier déploiement (comparez avec le hash `mayela-crm-<hash>` de l'étape 2).

---

## Étape 1 — Migration base de données (obligatoire pour tout)

### 1a — Migration V1.1 (produits + réseaux sociaux)
1. Ouvrez https://supabase.com/dashboard → projet `ymqdmfsqtkmlmwffqskt`
2. Menu gauche **SQL Editor** → **New query**
3. Copiez-collez TOUT le contenu du fichier `MIGRATION_V1_1.sql`
4. Cliquez **Run** — doit se terminer par "Success. No rows returned"

Cela ajoute : colonnes `description`/`image_url` aux produits, bucket Storage `produits`, tables
`social_accounts`, `social_posts`, `social_events_log`.

### 1b — Migration V2 (corrections + actualisation du schéma) — IMPORTANT
> ✔️ **Statut : déjà appliquée en base le 31/08/2026.** Toutes les tables métier répondent en
> HTTP 200 via REST, y compris `creances`, `social_*` et `integrations_oauth` (auparavant en
> `42501 permission denied`). Cette section est conservée pour référence / nouvelles installations.

> ⚠️ **Contexte** : sur ce projet, le **SQL Editor Supabase renvoie « Backend error »** (cause
> côté serveur), même sur un simple GRANT. La migration V2 a donc été exécutée via une **Edge
> Function temporaire** `db-migrate` (clé service requise), puis **supprimée** une fois l'opération
> terminée (aucune porte SQL laissée ouverte).

1. (Recommandé si le SQL Editor fonctionne sur votre projet) Dashboard Supabase → **SQL Editor** → **New query**
2. Copiez-collez TOUT le contenu du fichier `MIGRATION_V2.sql`
3. Cliquez **Run**

Cela ajoute :
- les **GRANT** SELECT/INSERT/UPDATE/DELETE sur toutes les tables métier (débloque les 42501)
- colonnes manquantes : `produits_services.actif`, `achats.produit_id`, `devis.produit_id`,
  `tasks.libelle`, `organizations.members_can_rename`
- la table **`creances`** (dettes clients) + RLS
- les **policies RLS** org-based de `social_accounts`, `social_posts`, `social_events_log`
- la table **`integrations_oauth`** (connexions Google Sheets / Notion par espace) + RLS

Vérification : relancez la requête `GET /rest/v1/social_accounts?select=id&limit=1` → doit répondre
200 (et non plus 403).

### 1c — Migration V7 (durcissement sécurité) — À APPLIQUER AVANT de redéployer les fonctions
1. Dashboard Supabase → **SQL Editor** → **New query**
2. Copiez-collez TOUT le contenu du fichier `MIGRATION_V7_SECURITE.sql`
3. Cliquez **Run**

Cela ajoute :
- la table **`email_change_requests`** + RLS (`user_id = auth.uid()` forcé) — le changement
  d'e-mail ne peut plus cibler qu'un autre compte (anti prise de contrôle) ;
- le retrait du droit `SELECT(config)` sur `social_accounts` et `integrations_oauth` aux rôles
  client : les secrets ne sont plus extractibles via l'API REST par un membre ;
- la vue `social_accounts_safe` bascule en lecture propriétaire + `FORCE ROW LEVEL SECURITY`
  (le filtrage par espace est conservé, les secrets restent purgés).

⚠️ **Après cette migration, les Edge Functions `social-publish`, `social-tiktok`,
`social-insights`, `social-health`, `tiktok-events`, `adjust-events`, `google-sheets` et
`confirm-email-change` doivent être REDÉPLOYÉES** (elles lisent désormais les secrets via
`service_role`, avec un filtre `org_id` explicite — voir Étape 3). Le front n'est pas touché
par ce changement (il lit déjà la vue `social_accounts_safe`).

Vérification :
- `select config from public.social_accounts;` en tant que membre → **permission denied** (attendu)
- `select platform, connected, has_pixel_token, config from public.social_accounts_safe;` → OK,
  `config` sans secrets
- `insert into public.email_change_requests (user_id, new_email)
   values (auth.uid(), 'x@y.com');` → OK ; avec un `user_id` d'un autre compte → **rejeté**

---

## Étape 2 — Clé Gemini + secrets

1. Allez sur https://aistudio.google.com/apikey (compte Google)
2. **Create API key** → copiez la clé (commence par `AIza...`)
3. Dashboard Supabase → **Edge Functions** → onglet **Secrets** → **Add secret**
   - Name : `GEMINI_API_KEY` — Value : votre clé
   - (Optionnel, mode A Google Sheets) Name : `GS_DEFAULT_CLIENT_ID` / `GS_DEFAULT_CLIENT_SECRET`

Plan gratuit Gemini : suffisant pour un usage PME (~1500 requêtes/jour).

> **Note** : la fonction `confirm-email-change` n'exige **aucun secret supplémentaire** :
> `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL` et `SUPABASE_ANON_KEY`
> sont fournis automatiquement aux Edge Functions par l'environnement Supabase.
> La clé `service_role` sert uniquement côté serveur (refusée par les policies RLS côté client)
> pour finaliser le changement d'e-mail.

---

## Étape 3 — Déployer les Edge Functions

> ℹ️ **Depuis la migration V7** : les fonctions qui lisent des secrets
> (`social-publish`, `social-tiktok`, `social-insights`, `social-health`,
> `tiktok-events`, `adjust-events`, `google-sheets`, `confirm-email-change`) utilisent un
> client `service_role` et filtrent `org_id` depuis le profil de l'appelant. Elles doivent
> être redéployées APRÈS avoir appliqué `MIGRATION_V7_SECURITE.sql` (étape 1c). Les secrets
> `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_URL` / `SUPABASE_ANON_KEY` sont fournis
> automatiquement aux Edge Functions par l'environnement Supabase.

Les codes sources sont dans `supabase/functions/ia-conseiller/index.ts`,
`supabase/functions/social-publish/index.ts`,
`supabase/functions/social-tiktok/index.ts`,
`supabase/functions/social-insights/index.ts`,
`supabase/functions/tiktok-events/index.ts`,
`supabase/functions/google-sheets/index.ts` (export Google Sheets OAuth),
`supabase/functions/confirm-email-change/index.ts` (changement d'e-mail : finalisation)
et `supabase/functions/adjust-events/index.ts` (coquille MMP, inactive).

### Option A — Dashboard (sans CLI)
1. Dashboard Supabase → **Edge Functions** → **Create a new function** / **Create function**
2. Nom : `ia-conseiller` → coller le contenu de `supabase/functions/ia-conseiller/index.ts` → **Deploy**
3. Refaire : nom `social-publish` → contenu de `supabase/functions/social-publish/index.ts` → **Deploy**
4. Refaire : nom `social-tiktok` → contenu de `supabase/functions/social-tiktok/index.ts` → **Deploy**
5. Refaire : nom `social-insights` → contenu de `supabase/functions/social-insights/index.ts` → **Deploy**
6. Refaire : nom `social-health` → contenu de `supabase/functions/social-health/index.ts` → **Deploy**
7. Refaire : nom `tiktok-events` → contenu de `supabase/functions/tiktok-events/index.ts` → **Deploy**
8. Refaire : nom `google-sheets` → contenu de `supabase/functions/google-sheets/index.ts` → **Deploy**
9. Refaire : nom `confirm-email-change` → contenu de `supabase/functions/confirm-email-change/index.ts` → **Deploy**
10. (Optionnel, plus tard) nom `adjust-events` → contenu de `supabase/functions/adjust-events/index.ts` → **Deploy**

### Option B — CLI (si installé)
```bash
supabase functions deploy ia-conseiller --project-ref ymqdmfsqtkmlmwffqskt
supabase functions deploy social-publish --project-ref ymqdmfsqtkmlmwffqskt
supabase functions deploy social-tiktok --project-ref ymqdmfsqtkmlmwffqskt
supabase functions deploy social-insights --project-ref ymqdmfsqtkmlmwffqskt
supabase functions deploy social-health --project-ref ymqdmfsqtkmlmwffqskt
supabase functions deploy tiktok-events --project-ref ymqdmfsqtkmlmwffqskt
supabase functions deploy google-sheets --project-ref ymqdmfsqtkmlmwffqskt
supabase functions deploy confirm-email-change --project-ref ymqdmfsqtkmlmwffqskt
supabase functions deploy adjust-events --project-ref ymqdmfsqtkmlmwffqskt
```

Vérification immédiate : dans l'app, onglet **Conseils**, posez une question au conseiller.
Si l'IA répond → tout est branché.

---

## Connecter la Page Facebook (publication d'offres)

À faire **une seule fois**, depuis un compte **admin** de la Page Facebook.

### Ce que fournit le branchement
- **Publication d'offres** : texte + photo, directement sur votre Page (fonction `social-publish`).
- **Analyse d'audience** : abonnés, portée/impressions/engagements 28 j, villes, âge + genre
  (fonction `social-insights`).

Dans MAYELA, la connexion est manuelle : il faut lui fournir **2 valeurs** —
l'**ID de la Page** et l'**Access Token de la Page** (longue durée). Voici comment les obtenir.

### Étape 1 — Créer/configurer l'app Facebook
1. https://developers.facebook.com → **My Apps** → **Create App** (type **Business**).
   - Si vous avez déjà une app, réutilisez-la.
2. Ajoutez les produits nécessaires si demandé (Page API / Graph API).

### Étape 2 — Ouvrir Graph API Explorer
1. **Outils → Graph API Explorer** (dans le menu App).
2. En haut à droite, **sélectionnez votre app**.
3. Activez la **Graph API v21.0** (version utilisée par MAYELA).

### Étape 3 — Générer le token avec les bonnes permissions
1. Dans le selecteur de permissions, ajoutez :
   - `pages_show_list` — lister les Pages du compte
   - `pages_manage_posts` — publier des offres
   - `pages_read_engagement` — lire l'analyse d'audience
   - (recommandé) `pages_read_user_content`, `pages_show_list`
2. Cliquez **Generate Access Token** → autorisez.

### Étape 4 — Choisir la Page (token de Page)
1. Dans le sélecteur de token : choisissez votre **Page**, pas votre profil
   (le token devient alors un **Page Access Token**).
2. Vérifiez l'**ID de la Page** : dans l'Explorer, requêtez `GET /me/accounts`
   → copiez le champ `id` de votre Page (série de chiffres, ~15-17).

### Étape 5 — Échanger contre un token longue durée (60 jours)
Le token court expire en ~1 h. Échangez-le dans le navigateur
(remplacez les valeurs entre `<>`) :

```
https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=<APP_ID>&client_secret=<APP_SECRET>&fb_exchange_token=<TOKEN_COURT>
```

- `<APP_ID>` et `<APP_SECRET>` : onglet **App settings → Basic** de votre app.
- `<TOKEN_COURT>` : le token de Page généré à l'étape 4.
- Réponse : un nouveau `access_token` valable **~60 jours**. Copiez-le.

### Étape 6 — Renseigner dans MAYELA
1. App MAYELA → onglet **Réseaux** → carte **Page Facebook** → **Connecter**.
2. Collez l'**ID de la Page** (chiffres).
3. Collez le **token longue durée** → enregistrer.

> Le token reste côté serveur (table `social_accounts`), jamais envoyé aux autres membres.
> **Pensez à le renouveler tous les ~60 jours** (refaire les étapes 3-5 puis reconnecter).

### Permissions et usage
| Permission | Utilisée par |
|---|---|
| `pages_show_list` | Lister/récupérer l'ID de la Page |
| `pages_manage_posts` | Publication de l'offre (`social-publish`) |
| `pages_read_engagement` | Analyse d'audience (`social-insights`) |

> **Mode dev** : la publication fonctionne immédiatement sur VOTRE Page, sans revue Meta.
> La **revue** de `pages_manage_posts` n'est nécessaire que si **d'autres personnes** doivent utiliser l'app avec leurs propres Pages.

### Dépannage Facebook
| Symptôme | Cause probable → solution |
|---|---|
| « Page Facebook non connectée » | Carte non connectée → faire les étapes 1-6 |
| Publication refuse avec erreur Graph | Token expiré (~60 j) ou permissions manquantes → regénérer le token |
| Analyse d'audience vide/erreur | Token sans `pages_read_engagement`, ou fonction `social-insights` non déployée → redéployer + regénérer le token |
| `(#200) Permission` | Permission non octroyée → regénérer le token avec le bon scope |

## Connecter TikTok (publication d'offres)

À faire une seule fois, avec le compte TikTok de l'entreprise :

1. https://developers.tiktok.com → connectez-vous → icône de profil (en haut à droite) → **Manage apps** → **Connect an app** pour créer votre app, puis basculez en mode **Sandbox** (en haut de page) pour tester sans revue.
2. Page de l'app, deux prérequis avant les produits :
   - **App details → Platforms** → cochez **Web** et renseignez l'URL de votre site. **Sans la plateforme Web, aucun champ Redirect URI n'apparaît dans Login Kit — c'est la cause la plus fréquente du blocage.**
   - **Products → Add products** :
     - **Login Kit** → dans la section **Web**, collez le **Redirect URI** exact affiché par l'app MAYELA au moment de la connexion → **+ Add a URI** → **Save** (bouton en haut de page).
       - Contraintes TikTok : URI **https**, statique, sans paramètres. Pinokio sert l'app aussi en HTTPS : utilisez `https://<PORT>.localhost/mayela-crm.html` (le même port que l'URL http locale ; le fichier `mayela-crm.html` vit à la racine). Si l'app est hébergée en ligne, utilisez son URL https complète (ex. `https://mayela-crm.vercel.app/mayela-crm.html`).
     - **Content Posting API** → ajoutez-le aussi (il dépend de Login Kit ; inutile en mode Sandbox, voir « Limites »).
3. **App details → Credentials** → copiez la **Client Key** et le **Client Secret** (cliquez sur l'icône œil pour les afficher).
4. Dans l'app MAYELA → onglet **Réseaux** → carte **TikTok Business** → **Connecter** :
   - confirmez le Redirect URI affiché,
   - collez la Client Key, puis le Client Secret → redirection vers TikTok → autorisez l'accès.

Le flux OAuth échange automatiquement le code contre les tokens (fonction `social-tiktok`),
les stocke côté serveur (`social_accounts.config`) et les rafraîchit tout seul avant chaque publication
(access_token ~24 h, refresh_token ~1 an).

Le compte connecté alimente aussi l'**analyse d'audience** : `social-insights` renvoie ses stats de base
via le scope `user.info.basic` déjà demandé à la connexion (abonnés, j'aime cumulés, nombre de publications).
Les statistiques par publication précise ne sont pas exposées par l'API TikTok publique.

### Limites actuelles de TikTok (à connaître)

| Situation | Effet |
|---|---|
| Mode Sandbox | La publication **publique** via Content Posting API n'est pas disponible en Sandbox (seule la publication via Login Kit + ciblages test marche). Il faut passer en **Production** (app **Live** ou en **Draft** avec revue) pour publier publiquement. |
| App non auditée (Draft/revue en cours) | Publications limitées à quelques posts/24 h et visibles surtout par le compte connecté. |
| Images via URL | TikTok exige un **domaine vérifié** dans le portail développeur pour récupérer les photos produit (`url_ownership_unverified`). Sans domaine vérifié, la publication photo est refusée — l'erreur exacte s'affiche dans l'app. |
| Publication publique | Nécessite la **revue/audit** de l'app TikTok (Content Posting API) puis, pour les images, un domaine vérifié pointant vers vos visuels. |

En pratique : la connexion fonctionne immédiatement ; la publication devient pleinement
opérationnelle dès qu'un domaine possédé est vérifié dans le portail TikTok (ou après l'audit).

### Champs d'application à renseigner dans le portail TikTok

Quand l'app TikTok est **déployée en ligne** (domaine de production ci-dessous), les URL à
saisir dans **App details** / **Products** sont les suivantes (base = `https://mayela-crm.vercel.app`) :

| Champ (portail TikTok) | Valeur à saisir | Où |
|---|---|---|
| **Web / Desktop URL** (plateforme Web) | `https://mayela-crm.vercel.app/` | **App details → Platforms → Web** |
| **Terms of Service URL** | `https://mayela-crm.vercel.app/terms.html` | **App details → Legal** |
| **Privacy Policy URL** | `https://mayela-crm.vercel.app/politique-confidentialite.html` | **App details → Legal** |
| **Redirect URI** (Login Kit) | `https://mayela-crm.vercel.app/mayela-crm.html` (ou l'URL https affichée par l'app au moment de la connexion) | **Products → Login Kit → Web** |
| **WebhooksCallback URL** | Non requis pour cette intégration (voir note ci-dessous) | **Products → Webhooks** |
| **Content Posting API** | Produit **activé** (pas une URL) | **Products → Add products** |

**Notes :**
- En local via Pinokio, l'URL https est `https://<PORT>.localhost/…` (même port que l'URL http) —
  voir la ligne 102. En production, utiliser systématiquement le domaine ci-dessus.
- **WebhooksCallback URL** : l'intégration MAYELA n'utilise **pas** les webhooks TikTok (pas de
  suivi de status vidéo/commentaire). Le tracking des conversions passe par l'**Events API
  server-side** (`tiktok-events`), qui ne requiert aucun callback. Ce champ peut donc rester vide ;
  il ne servirait que si on activait plus tard les webhooks (ex. statut de publication vidéo).

## Passer l'app TikTok en Production (publication publique)

Une seule fois, dans le portail développeur TikTok, pour débloquer la **publication publique**.

**Objectif** : passer l'app du mode **Sandbox** (publications en test, visibles surtout par le
compte connecté) au mode **Production** pour publier réellement sur l'audience.

### Résumé rapide
1. Vérifier que tous les champs obligatoires sont renseignés (voir « Champs d'application » ci-dessus).
2. Activer **Content Posting API** (déjà fait si suivi) + renseigner la **plateforme Web**.
3. Remplir **App details → Legal** : Terms of Service URL, Privacy Policy URL (déjà dispo).
4. **App details → Status** : passer l'app de **Sandbox** à **Production**.
5. Selon l'état, soumettre l'app à **revue/audit** si demandé.
6. Vérifier un **domaine** (pour les photos produit) et/ou finaliser si requis.
7. Dans l'app MAYELA → onglet **Réseaux** → déconnecter puis **reconnecter** le compte TikTok
   pour rafraîchir le flux OAuth avec les nouveaux statuts.

### Détail des étapes (portail développeur TikTok)

**Étape A — Vérifier les prérequis de l'app** (`developers.tiktok.com` → profil → **Manage apps** → votre app)
| Vérification | Détail |
|---|---|
| Plateforme **Web** | Renseignée et valide (voir « Champs d'application ») |
| **Login Kit** | Redirect URI correct (`https://mayela-crm.vercel.app/mayela-crm.html`) |
| **Content Posting API** | Produit **activé** (il est le pilier de la publication publique) |
| **Legal** (Terms + Privacy) | Deux URLs renseignées et accessibles en ligne |

**Étape B — Bascule Sandbox → Production**
1. Dans la page de l'app → section **App details → Status** (ou bouton **Management** selon l'interface).
2. Choisissez **Production** (certaines interfaces proposent « Sandbox » / « Production » ; d'autres
   « Draft » / « Live »).
3. Si TikTok demande des justificatifs (description d'usage, captures, etc.), fournissez-les.

**Étape C — Revue/audit (le cas échéant)**
- Pour **Content Posting API**, TikTok peut exiger une **revue** avant publication publique.
- L'app passe alors en **Draft** (revue en cours) : les publications restent limitées
  (quelques posts/24 h, visibles surtout par le compte connecté) jusqu'à l'approbation.
- Suivez l'état dans le portail ; li est possible de soumettre à l'audit via **Submission**.

**Étape D — Domaine vérifié (images produit)**
- Pour publier des **photos produit** via URL, TikTok exige un **domaine vérifié** dans le portail
  (`url_ownership_unverified` sinon).
- Le domaine à vérifier est celui qui héberge les visuels : `mayela-crm.vercel.app`.
- Méthode de vérification : ajouter le **meta tag** ou le **fichier** exigé par TikTok sur ce domaine
  (fichier statique servi à la racine ou dans `/.well-known/`).

**Étape E — Reconnecter le compte dans MAYELA**
1. App MAYELA → onglet **Réseaux** → carte TikTok → **Déconnecter**.
2. **Connecter** à nouveau (coller Client Key + Client Secret, autoriser) — le refresh token est
   révoqué si l'app a été recréée, d'où la reconnexion.

### Après le passage en Production
- La publication d'offres (texte + photo) devient **publique** : visible par l'audience TikTok.
- Le tracking **Events API** continue de fonctionner sans changement.
- Le **réglage** `social_posts` existe déjà : le statut de chaque envoi est journalisé dans
  `social_events_log` (audit).

### Tableau de bord de contrôle rapide
| Élément | À vérifier |
|---|---|
| Statut de l'app | **Production** (et non Sandbox) |
| Produits actifs | **Content Posting API** + **Login Kit** |
| Plateforme | **Web** renseignée |
| Legal | **Terms** + **Privacy** renseignées |
| Domaine (photos) | **vérifié** (si publication d'images) |

> En cas de doute sur l'état (Live vs Draft), vérifiez le bandeau de statut en haut de la page de
> l'app dans le portail. La publication reste opérationnelle en Draft pour les tests.

## Connecter le tracking TikTok Events API (server-side)

Le tracking suit les conversions (leads, devis, ventes, RDV) indépendamment de la publication.
La fonction `tiktok-events` les envoie côté serveur depuis Supabase — le Pixel ID et le token
ne transitent jamais par le navigateur.

1. https://business-api.tiktok.com → **Assets → Pixel** → **Create Pixel** (ou ouvrez un pixel existant).
2. Dans le pixel → onglet **Settings/Official Events** :
   - Activez **Server-side API** (Events API).
   - Générez / copiez l'**Access Token** (une seule fois, il n'est pas ré-affichable).
3. Dans l'app MAYELA → onglet **Réglages** → section **Configuration Tracking** :
   - collez le **Pixel ID** (23 chiffres),
   - collez le **Events API Access Token** → **Enregistrer le tracking**.
4. Lors de la publication d'une offre, choisissez l'**événement TikTok** à associer
   (Nouveau lead / Inscription / Devis / Vente / RDV). L'événement est envoyé après publication.

Les événements et leurs statuts sont journalisés dans la table `social_events_log` (audit).

### Table de correspondance des événements

| Événement CRM | Événement TikTok | Déclencheur |
|---|---|---|
| Nouveau lead | `SubmitForm` | Ajout client |
| Inscription | `CompleteRegistration` | Création compte |
| Demande de devis | `Contact` | Interaction social |
| Vente | `Purchase` | Offre vendue |
| RDV pris | `Schedule` | Interaction appel/visite |

> Les champs **Adjust App Token / S2S Token** de la section Configuration Tracking sont des
> emplacements pour le futur MMP (Branch/Adjust). Ils sont conservés mais sans effet tant que
> le compte pro Branch/Adjust n'est pas activé.

## Activer « Continuer avec Google » (connexion en 1 clic)

Le bouton existe déjà dans l'app ; il ne reste qu'à déclarer l'app chez Google puis Supabase.
~10 minutes, à faire une seule fois :

1. https://console.cloud.google.com → créez un projet (ou réutilisez-en un).
2. Menu **API et services → Écran de consentement OAuth** :
   - Type **Externe**, nom de l'app + e-mail de support → Enregistrer.
   - Pendant les tests, ajoutez votre adresse dans **Utilisateurs test**.
3. **API et services → Identifiants → Créer des identifiants → ID client OAuth** :
   - Type : **Application Web**
   - **URI de redirection autorisée** : `https://ymqdmfsqtkmlmwffqskt.supabase.co/auth/v1/callback`
   - Notez le **Client ID** (finissant par `apps.googleusercontent.com`) et le **Client Secret**.
4. Dashboard Supabase → **Authentication → Sign In / Providers → Google** :
   - Activez le fournisseur, collez Client ID + Client Secret → **Save**.

C'est tout. Dans l'app, « Continuer avec Google » crée automatiquement le compte et le profil
(nom repris de Google, sans formulaire). Les utilisateurs sans Google gardent le parcours
e-mail + code à 6 chiffres.

## Connecter Google Sheets (export des rapports)

À faire une seule fois, avec le compte Google qui doit héberger les feuilles exportées.

### Fonctionnement
- L'export (bouton « Exporter vers Google Sheets » dans l'onglet **Rapports**) crée une **nouvelle
  feuille de calcul** sur votre Google Drive, puis y écrit les lignes (entêtes + données).
- La connexion est **par espace** : chaque espace connecte son propre compte Google. Les tokens OAuth
  restent côté serveur (table `integrations_oauth`), jamais exposés au navigateur.
- **App Google par défaut (optionnel)** : l'équipe HORIZON peut fournir des identifiants communs à tous
  les espaces via les secrets de la fonction `GS_DEFAULT_CLIENT_ID` / `GS_DEFAULT_CLIENT_SECRET`.
  L'app ne demande alors plus que la **connexion Google** (plus de saisie Client ID/Secret par espace),
  chaque espace gardant son propre jeton. Voir « App Google par défaut » plus bas.
- Fonction backend : `google-sheets` (actions `exchange`, `refresh`, `status`, `export`).

### Étape 1 — Créer l'app OAuth chez Google
1. https://console.cloud.google.com → créez un projet (ou réutilisez-en un).
2. **API et services → Écran de consentement OAuth** → type **Externe** → nom de l'app
   + e-mail support → Enregistrer. Ajoutez votre adresse dans **Utilisateurs test** pour tester.
3. **API et services → Bibliothèque** → activez **Google Sheets API**.
4. **API et services → Identifiants → Créer des identifiants → ID client OAuth** :
   - Type : **Application Web** (Web application)
   - **Authorized redirect URIs (URIs de redirection autorisées)** → **+ Add URI** :
     `https://mayela-crm.vercel.app/mayela-crm.html`
   - Notez le **Client ID** et le **Client Secret**.

### Étape 2 — App Google par défaut (recommandé) ou par espace

Deux modes possibles :

**Mode A — App par défaut fournie par HORIZON (recommandé)** :
1. Créer une fois l'app OAuth Google (Étape 1). Son Client ID / Secret sont partagés par tous les espaces.
2. Dashboard Supabase → **Edge Functions** → onglet **Secrets** → ajouter :
   - `GS_DEFAULT_CLIENT_ID` = le Client ID
   - `GS_DEFAULT_CLIENT_SECRET` = le Client Secret
3. Redéployer la fonction `google-sheets` (voir Étape 3).
4. Côté app, dans Réglages → Intégrations → **Google Sheets**, le formulaire Client ID/Secret est
   masqué (remplacé par « connectez le compte Google »). Chaque espace clique simplement
   **Connecter** et autorise son propre compte Google.

**Mode B — Par espace** (chaque espace a sa propre app Google) :
1. App MAYELA → Réglages → Intégrations → carte **Google Sheets**.
2. Collez le **Client ID** puis le **Client Secret** → Enregistrer.
3. Pour un espace : cliquez **Connecter** → autorisez l'accès Google.
4. Onglet **Rapports** → sélectionnez une période → **Exporter vers Google Sheets** :
   une nouvelle feuille est créée dans votre Drive et ouverte.

> **Scopes** demandés à l'autorisation : `https://www.googleapis.com/auth/spreadsheets`
> (créer/écrire des feuilles). Si Google n'affiche pas ces écrans, vérifiez que le type
> d'app est **Application Web** et que l'`api_scope` de l'UI est cohérent.

### Dépannage Google Sheets
| Symptôme | Cause probable → solution |
|---|---|
| « App Google non configurée » | Client ID/Secret absents dans l'onglet Réseaux → Google Sheets → renseigner |
| « Google a refusé le code » | Type d'app non « Application Web », redirect_uri non autorisée, ou code OAuth réutilisé → reconnexion |
| « Session expirée » | Refresh token révoqué → **Déconnecter** puis **Connecter** à nouveau |
| L'export échoue | Fonction `google-sheets` non déployée → redéployer (voir Étape 3) |

## WhatsApp

- **WhatsApp** : les boutons WhatsApp des fiches clients restent le canal quotidien. L'envoi automatisé exige WhatsApp Cloud API (numéro dédié + vérification Meta). Carte affichée « à configurer » dans l'app.

---

## Dépannage

| Symptôme | Cause probable |
|---|---|
| Le chat IA dit « Impossible de joindre » | Fonction `ia-conseiller` non déployée, ou secret `GEMINI_API_KEY` absent |
| Upload photo produit échoue | Migration non exécutée (bucket/policy manquants), ou espace org non créé |
| Publication échoue « compte non connecté » | Carte Facebook non connectée |
| Publication échoue avec message Graph API | Token expiré (~60 jours) ou permissions manquantes → regénérer |
| TikTok : erreur à l'autorisation (redirect_uri) | Le Redirect URI collé dans le portail TikTok ne correspond pas exactement à celui affiché par l'app (https obligatoire, sans paramètres), ou la plateforme **Web** n'a pas été cochée dans **App details → Platforms** (le champ Redirect URI n'existe alors pas — cochez Web puis ouvrez **Products → Login Kit → Web**) |
| TikTok : « Session expirée, reconnectez » | Refresh_token révoqué ou app TikTok recréée → Déconnecter puis Connecter à nouveau |
| TikTok : publication refusée `url_ownership_unverified` / privée uniquement | Voir section « Limites actuelles de TikTok » ci-dessus |
| Analyse d'audience vide ou en erreur | Fonction `social-insights` non déployée ; ou token sans `pages_read_engagement` / expiré → regénérer le token (étape « Connecter la Page Facebook ») |
| Analyse d'audience : chiffres TikTok absents | Compte TikTok non connecté, ou fonction `social-insights` déployée avant sa mise à jour TikTok → redéployer |
| Événement TikTok non envoyé à la publication | Section Configuration Tracking vide (Pixel ID / token manquants), fonction `tiktok-events` non déployée, ou token Events API expiré → vérifier dans la table `social_events_log` le statut `failed` |
| Le bouton « Continuer avec Google » échoue | Fournisseur Google non activé dans Supabase (Authentication → Providers), ou URI de redirection absente chez Google |
| Changer l'e-mail : « Fonction non déployée » ou erreur réseau | Fonction `confirm-email-change` non déployée → voir Étape 3 ci-dessus |
| Changer l'e-mail : « Code incorrect ou expiré » | Le code OTP a une validité limitée (~10 min) et est à usage unique ; renvoyer un nouveau code avec le bouton « Renvoyer le code » |
| Changer l'e-mail : « cette adresse e-mail est déjà utilisée par un compte existant » | L'adresse cible appartient à un autre compte confirmé (plus de 15 min) → choisir une autre adresse |
