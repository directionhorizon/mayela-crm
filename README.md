# MAYELA CRM

CRM léger pour PME de Pointe-Noire, Congo. Backend Supabase, frontend HTML/JS autonome.

**Présentation cible : 25 juillet 2026**

## Structure du dépôt

```
/src      → mayela-crm.html (l'application, fichier unique)
/docs     → checklist de test E2E, guide de démonstration
/config   → schéma Supabase documenté, notes techniques
```

## Démarrage rapide

```bash
npx http-server src/mayela-crm.html --port 8080
# http://localhost:8080
```

⚠️ Ne jamais ouvrir `src/mayela-crm.html` directement en double-clic (`file://`) — le fetch vers Supabase sera bloqué par CORS. Toujours passer par un serveur local ou une URL déployée.

## Lancer via Pinokio

Le dossier étant reconnu comme web app statique (`index.html` à la racine qui redirige vers `src/mayela-crm.html`, + `pinokio.json`), l'app apparaît dans Pinokio et se lance en un clic. Le code source reste uniquement dans `src/` — ne pas éditer `index.html`.

## Déploiement

```bash
npx vercel deploy src --prod
```

⚠️ Déployer le dossier `src` entier (pas seulement le `.html`), sinon le manifest, le service worker et les icônes PWA ne seront pas servis.

## Android / PWA

L'app est installable comme une application Android native :

1. Déployer en HTTPS (Vercel ci-dessus)
2. Ouvrir l'URL dans Chrome sur le téléphone
3. Menu ⋮ → « Installer l'application » (ou bannière d'installation)

En mode installé : icône sur l'écran d'accueil, plein écran sans barre d'URL (manifest + `theme-color`), et l'app shell reste chargée hors-ligne grâce au service worker (`sw.js`). Les données Supabase, elles, nécessitent le réseau. Après modification de `sw.js`, incrémenter `CACHE` (`mayela-crm-v2`, etc.) pour invalider l'ancien cache.

## Branches

- `main` — version stable, celle qu'on montre en démo
- `dev` — travail en cours, corrections de bugs

## Documentation

- [`docs/CHECKLIST_TEST_E2E.md`](docs/CHECKLIST_TEST_E2E.md) — 5 scénarios de test avant présentation
- [`docs/GUIDE_DEMONSTRATION.md`](docs/GUIDE_DEMONSTRATION.md) — trame de démo, questions/réponses préparées
- [`config/SCHEMA_SUPABASE.md`](config/SCHEMA_SUPABASE.md) — schéma de données, RLS, RPC, Edge Functions
- [`config/DEPLOY_BACKEND.md`](config/DEPLOY_BACKEND.md) — déploiement backend, publication social, tracking TikTok Events API
- [`config/SUIVI_TIKTOK_INTEGRATIONS.md`](config/SUIVI_TIKTOK_INTEGRATIONS.md) — suivi des intégrations TikTok
- [`config/NOTES_TECHNIQUES.md`](config/NOTES_TECHNIQUES.md) — décisions techniques, points de vigilance

## Stack

Supabase (Postgres + Auth + Edge Functions) · HTML/CSS/JS vanilla · Vercel (hébergement statique)
