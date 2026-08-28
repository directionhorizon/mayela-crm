# Déploiement backend — MAYELA CRM V1.1

Trois étapes, dans l'ordre. Comptez ~20 minutes.

---

## Étape 1 — Migration base de données (obligatoire pour tout)

1. Ouvrez https://supabase.com/dashboard → projet `ymqdmfsqtkmlmwffqskt`
2. Menu gauche **SQL Editor** → **New query**
3. Copiez-collez TOUT le contenu du fichier `MIGRATION_V1_1.sql` (même dossier que ce guide)
4. Cliquez **Run** — doit se terminer par "Success. No rows returned"

Cela ajoute :
- les colonnes `description` et `image_url` aux produits
- le bucket Storage public `produits` + les règles d'upload par organisation
- les tables `social_accounts` et `social_posts` avec isolation par organisation
- la table `social_events_log` (journal des événements TikTok)

---

## Étape 2 — Clé Gemini + secrets

1. Allez sur https://aistudio.google.com/apikey (compte Google)
2. **Create API key** → copiez la clé (commence par `AIza...`)
3. Dashboard Supabase → **Edge Functions** → onglet **Secrets** → **Add secret**
   - Name : `GEMINI_API_KEY` — Value : votre clé

Plan gratuit Gemini : suffisant pour un usage PME (~1500 requêtes/jour).

---

## Étape 3 — Déployer les 4 Edge Functions

Les codes sources sont dans `supabase/functions/ia-conseiller/index.ts`,
`supabase/functions/social-publish/index.ts`,
`supabase/functions/social-tiktok/index.ts`,
`supabase/functions/social-insights/index.ts`,
`supabase/functions/tiktok-events/index.ts` et
`supabase/functions/adjust-events/index.ts` (coquille MMP, inactive).

### Option A — Dashboard (sans CLI)
1. Dashboard Supabase → **Edge Functions** → **Create a new function** / **Create function**
2. Nom : `ia-conseiller` → coller le contenu de `supabase/functions/ia-conseiller/index.ts` → **Deploy**
3. Refaire : nom `social-publish` → contenu de `supabase/functions/social-publish/index.ts` → **Deploy**
4. Refaire : nom `social-tiktok` → contenu de `supabase/functions/social-tiktok/index.ts` → **Deploy**
5. Refaire : nom `social-insights` → contenu de `supabase/functions/social-insights/index.ts` → **Deploy**
6. Refaire : nom `tiktok-events` → contenu de `supabase/functions/tiktok-events/index.ts` → **Deploy**
7. (Optionnel, plus tard) nom `adjust-events` → contenu de `supabase/functions/adjust-events/index.ts` → **Deploy**

### Option B — CLI (si installé)
```bash
supabase functions deploy ia-conseiller --project-ref ymqdmfsqtkmlmwffqskt
supabase functions deploy social-publish --project-ref ymqdmfsqtkmlmwffqskt
supabase functions deploy social-tiktok --project-ref ymqdmfsqtkmlmwffqskt
supabase functions deploy social-insights --project-ref ymqdmfsqtkmlmwffqskt
supabase functions deploy tiktok-events --project-ref ymqdmfsqtkmlmwffqskt
supabase functions deploy adjust-events --project-ref ymqdmfsqtkmlmwffqskt
```

Vérification immédiate : dans l'app, onglet **Conseils**, posez une question au conseiller.
Si l'IA répond → tout est branché.

---

## Connecter la Page Facebook (publication d'offres)

À faire une seule fois, depuis un compte admin de la Page :

1. https://developers.facebook.com → **My Apps** → **Create App** (type Business) — si vous en avez déjà une app, réutilisez-la.
2. **Graph API Explorer** (Outils → Graph API Explorer) :
   - Sélectionnez votre app
   - **Generate Access Token** avec les permissions : `pages_show_list`, `pages_manage_posts`, `pages_read_engagement`
   - **Page Access Token** : choisissez votre Page dans le sélecteur de token (le token devient un token de Page)
3. Échangez contre un token longue durée (60 jours) :
   `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=<APP_ID>&client_secret=<APP_SECRET>&fb_exchange_token=<TOKEN_COURT>`
4. Dans l'app MAYELA → onglet **Réseaux** → carte Facebook → **Connecter** :
   - collez l'ID de la Page (chiffres, visible via Graph API Explorer `/me/accounts`)
   - collez le token longue durée

Le token reste côté serveur (table `social_accounts`, jamais envoyée au navigateur des autres membres).
Pensez à le renouveler tous les ~60 jours.

Le même token alimente l'**analyse d'audience** (onglet Réseaux → « Analyse d'audience » : abonnés,
portée/impressions/engagements 28 jours, villes, âge et genre) via la fonction `social-insights`.
La permission `pages_read_engagement` déjà demandée ci-dessus suffit.
Si un compte TikTok est aussi connecté, la même analyse affiche en plus ses stats de base
(abonnés, j'aime cumulés, publications) — les deux sources sont indépendantes.

> Mode dev : les publications fonctionnent immédiatement sur VOTRE Page sans revue Meta.
> La revue (`pages_manage_posts`) n'est nécessaire que si d'autres personnes doivent utiliser l'app avec leurs propres Pages.

## Connecter TikTok (publication d'offres)

À faire une seule fois, avec le compte TikTok de l'entreprise :

1. https://developers.tiktok.com → créez une app (mode **Sandbox** : pas besoin de domaine vérifié ni de revue pour tester).
2. Dans l'app → **Add products** :
   - **Login Kit** → dans sa configuration, ajoutez le **Redirect URI** exact affiché par l'app MAYELA au moment de la connexion.
     - Contraintes TikTok : URI **https**, statique, sans paramètres. Pinokio sert l'app aussi en HTTPS : utilisez `https://<PORT>.localhost/src/mayela-crm.html` (le même port que l'URL http locale). Si l'app est hébergée en ligne, utilisez son URL https complète.
   - **Content Posting API** → activez **Direct Post**.
3. Copiez la **Client Key** et le **Client Secret** de l'app.
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
| App non auditée (Sandbox/dev) | Les publications sont **privées** (visibles seulement par le compte connecté) et limitées à quelques posts/24 h. L'API retente automatiquement en privé. |
| Images via URL | TikTok exige un **domaine vérifié** dans le portail développeur pour récupérer les photos produit (`url_ownership_unverified`). Sans domaine vérifié, la publication photo est refusée — l'erreur exacte s'affiche dans l'app. |
| Publication publique | Nécessite la **revue/audit** de l'app TikTok (Content Posting API) puis, pour les images, un domaine vérifié pointant vers vos visuels. |

En pratique : la connexion fonctionne immédiatement ; la publication devient pleinement
opérationnelle dès qu'un domaine possédé est vérifié dans le portail TikTok (ou après l'audit).

## Connecter le tracking TikTok Events API (server-side)

Le tracking suit les conversions (leads, devis, ventes, RDV) indépendamment de la publication.
La fonction `tiktok-events` les envoie côté serveur depuis Supabase — le Pixel ID et le token
ne transitent jamais par le navigateur.

1. https://business-api.tiktok.com → **Assets → Pixel** → **Create Pixel** (ou ouvrez un pixel existant).
2. Dans le pixel → onglet **Settings/Official Events** :
   - Activez **Server-side API** (Events API).
   - Générez / copiez l'**Access Token** (une seule fois, il n'est pas ré-affichable).
3. Dans l'app MAYELA → onglet **Réseaux** → section **Configuration Tracking** :
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
| TikTok : erreur à l'autorisation (redirect_uri) | Le Redirect URI collé dans le portail TikTok ne correspond pas exactement à celui affiché par l'app (https obligatoire, sans paramètres) |
| TikTok : « Session expirée, reconnectez » | Refresh_token révoqué ou app TikTok recréée → Déconnecter puis Connecter à nouveau |
| TikTok : publication refusée `url_ownership_unverified` / privée uniquement | Voir section « Limites actuelles de TikTok » ci-dessus |
| Analyse d'audience vide ou en erreur | Fonction `social-insights` non déployée ; ou token sans `pages_read_engagement` / expiré → regénérer le token (étape « Connecter la Page Facebook ») |
| Analyse d'audience : chiffres TikTok absents | Compte TikTok non connecté, ou fonction `social-insights` déployée avant sa mise à jour TikTok → redéployer |
| Événement TikTok non envoyé à la publication | Section Configuration Tracking vide (Pixel ID / token manquants), fonction `tiktok-events` non déployée, ou token Events API expiré → vérifier dans la table `social_events_log` le statut `failed` |
| Le bouton « Continuer avec Google » échoue | Fournisseur Google non activé dans Supabase (Authentication → Providers), ou URI de redirection absente chez Google |
