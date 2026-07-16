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

## Déploiement

```bash
npx vercel deploy src/mayela-crm.html --prod
```

## Branches

- `main` — version stable, celle qu'on montre en démo
- `dev` — travail en cours, corrections de bugs

## Documentation

- [`docs/CHECKLIST_TEST_E2E.md`](docs/CHECKLIST_TEST_E2E.md) — 5 scénarios de test avant présentation
- [`docs/GUIDE_DEMONSTRATION.md`](docs/GUIDE_DEMONSTRATION.md) — trame de démo, questions/réponses préparées
- [`config/SCHEMA_SUPABASE.md`](config/SCHEMA_SUPABASE.md) — schéma de données, RLS, RPC, Edge Functions
- [`config/NOTES_TECHNIQUES.md`](config/NOTES_TECHNIQUES.md) — décisions techniques, points de vigilance

## Stack

Supabase (Postgres + Auth + Edge Functions) · HTML/CSS/JS vanilla · Vercel (hébergement statique)
