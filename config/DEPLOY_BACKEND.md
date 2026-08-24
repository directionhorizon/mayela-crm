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

---

## Étape 2 — Clé Gemini + secrets

1. Allez sur https://aistudio.google.com/apikey (compte Google)
2. **Create API key** → copiez la clé (commence par `AIza...`)
3. Dashboard Supabase → **Edge Functions** → onglet **Secrets** → **Add secret**
   - Name : `GEMINI_API_KEY` — Value : votre clé

Plan gratuit Gemini : suffisant pour un usage PME (~1500 requêtes/jour).

---

## Étape 3 — Déployer les 3 Edge Functions

Les codes sources sont dans `supabase/functions/ia-conseiller/index.ts`,
`supabase/functions/social-publish/index.ts` et
`supabase/functions/social-insights/index.ts`.

### Option A — Dashboard (sans CLI)
1. Dashboard Supabase → **Edge Functions** → **Create a new function** / **Create function**
2. Nom : `ia-conseiller` → coller le contenu de `supabase/functions/ia-conseiller/index.ts` → **Deploy**
3. Refaire : nom `social-publish` → contenu de `supabase/functions/social-publish/index.ts` → **Deploy**
4. Refaire : nom `social-insights` → contenu de `supabase/functions/social-insights/index.ts` → **Deploy**

### Option B — CLI (si installé)
```bash
supabase functions deploy ia-conseiller --project-ref ymqdmfsqtkmlmwffqskt
supabase functions deploy social-publish --project-ref ymqdmfsqtkmlmwffqskt
supabase functions deploy social-insights --project-ref ymqdmfsqtkmlmwffqskt
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

> Mode dev : les publications fonctionnent immédiatement sur VOTRE Page sans revue Meta.
> La revue (`pages_manage_posts`) n'est nécessaire que si d'autres personnes doivent utiliser l'app avec leurs propres Pages.

## WhatsApp & TikTok

- **WhatsApp** : les boutons WhatsApp des fiches clients restent le canal quotidien. L'envoi automatisé exige WhatsApp Cloud API (numéro dédié + vérification Meta). Carte affichée « à configurer » dans l'app.
- **TikTok** : la publication automatique exige l'approbation TikTok Content Posting API (revue séparée, plusieurs semaines). La carte est prête ; il suffira de compléter `social-publish` quand l'accès sera accordé.

---

## Dépannage

| Symptôme | Cause probable |
|---|---|
| Le chat IA dit « Impossible de joindre » | Fonction `ia-conseiller` non déployée, ou secret `GEMINI_API_KEY` absent |
| Upload photo produit échoue | Migration non exécutée (bucket/policy manquants), ou espace org non créé |
| Publication échoue « compte non connecté » | Carte Facebook non connectée |
| Publication échoue avec message Graph API | Token expiré (~60 jours) ou permissions manquantes → regénérer |
| Analyse d'audience vide ou en erreur | Fonction `social-insights` non déployée ; ou token sans `pages_read_engagement` / expiré → regénérer le token (étape « Connecter la Page Facebook ») |
