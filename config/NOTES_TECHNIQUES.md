# Notes techniques — MAYELA CRM

## Infra
- **Projet Supabase** : `ymqdmfsqtkmlmwffqskt`, région `eu-central-1`, plan **Free**
- **Frontend** : fichier HTML unique (`src/mayela-crm.html`), pas de build, pas de framework
- **Auth** : Supabase Auth, OTP e-mail uniquement (pas de mot de passe) + verrouillage PIN local (RPC `set_pin`/`verify_pin`)
- **Déploiement cible** : Vercel (statique, pas de config serveur nécessaire)

## Pourquoi pas de framework / build step
Décision volontaire : présentation dans 9 jours, une seule personne dessus. Un fichier HTML autonome élimine toute la classe de bugs liée au build (dépendances, versions, config bundler). Le JS est vanilla, le CSS est en `:root` variables.

**Trade-off assumé** : pas idéal pour un vrai produit à long terme (pas de tests, pas de typage, un seul fichier de 700+ lignes). À migrer vers un vrai stack (Next.js ou Vite + React) une fois la V1 validée et le produit confirmé.

## Points de vigilance connus

1. **CORS / `file://`** : le fichier ne doit JAMAIS être ouvert directement en double-clic depuis l'explorateur de fichiers. Toujours via un serveur (local `http-server`/`serve`, ou déployé). Les navigateurs bloquent les fetch cross-origin depuis `file://`.

2. **Clé Supabase hardcodée** : la clé `anon` est publique par design (protégée par les RLS côté serveur), donc pas un souci de sécurité en soi. Mais si le projet Supabase change, il faut mettre à jour les 2 constantes en haut du `<script>`.

3. **RLS = la vraie sécurité, pas le frontend** : toute la logique d'isolation des données entre entreprises clientes vit dans les policies Postgres (`current_org_id()`), pas dans le JS. Ne jamais faire confiance à un filtre côté client pour la sécurité.

4. **`profiles` peut ne pas exister au premier login** : normalement un trigger Supabase crée la ligne `profiles` à l'inscription. Le frontend a un filet de sécurité (insert si absent) — si ça se déclenche souvent, vérifier que le trigger `on_auth_user_created` est bien actif.

5. **`Schema privé`** : schéma Postgres séparé (nommé avec accent, à échapper en SQL : `"Schema privé"`), alimenté par un pipeline Make.com externe (sync Google Sheets → Supabase). Ne pas confondre avec le schéma `public`. Hors périmètre du produit MAYELA CRM — sert la prospection interne HORIZON.

6. **Tables `horizon_*`** : réservées à l'équipe HORIZON (`is_horizon_staff = true`), ne doivent jamais apparaître dans l'UI produit destinée aux clients CRM.

## Historique des décisions

| Date | Décision | Raison |
|---|---|---|
| Avant 03/07 | Prototype maquette statique (données codées en dur) | Valider le design avant tout branchement backend |
| 05/07 | Création des tables core + RLS | Fondation du schéma multi-tenant |
| 09/07 | Durcissement des fonctions (`SECURITY DEFINER`), policies restreintes à `authenticated` | Audit sécurité |
| 16/07 | Reconstruction du frontend avec vraie intégration Supabase (le fichier maquette n'avait aucun appel API) | Le fichier de démo initial ne parlait pas au backend construit — divergence découverte en session |
| 16/07 | Nettoyage tables orphelines `public.leads/api_configs/strategy_logs` | Reliquats vides d'avant renommage `horizon_*` |

## Commandes utiles

```bash
# Lancer en local
npx http-server src/mayela-crm.html --port 8080

# Déployer sur Vercel
npx vercel deploy src/mayela-crm.html --prod
```

```sql
-- Vérifier les fonctions RPC actives
SELECT proname, pg_get_function_arguments(oid)
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
ORDER BY proname;
```
