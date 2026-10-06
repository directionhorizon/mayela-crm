# Notes techniques — MAYELA CRM

## Infra
- **Projet Supabase** : `ymqdmfsqtkmlmwffqskt`, région `eu-central-1`, plan **Free**
- **Frontend** : fichier HTML unique (`mayela-crm.html` à la racine), pas de build, pas de framework
- **Auth** : Supabase Auth, OTP e-mail uniquement (pas de mot de passe) + verrouillage PIN local (RPC `set_pin`/`verify_pin`)
- **Déploiement cible** : Vercel (statique, pas de config serveur nécessaire)

## Pourquoi pas de framework / build step
Décision volontaire : présentation dans 9 jours, une seule personne dessus. Un fichier HTML autonome élimine toute la classe de bugs liée au build (dépendances, versions, config bundler). Le JS est vanilla, le CSS est en `:root` variables.

**Trade-off assumé** : pas idéal pour un vrai produit à long terme (pas de tests, pas de typage, un seul fichier de 700+ lignes). À migrer vers un vrai stack (Next.js ou Vite + React) une fois la V1 validée et le produit confirmé.

## Points de vigilance connus

1. **CORS / `file://`** : le fichier ne doit JAMAIS être ouvert directement en double-clic depuis l'explorateur de fichiers. Toujours via un serveur (local `http-server`/`serve`, ou déployé). Les navigateurs bloquent les fetch cross-origin depuis `file://`.

2. **Clé Supabase hardcodée** : la clé `anon` est publique par design (protégée par les RLS côté serveur), donc pas un souci de sécurité en soi. Mais si le projet Supabase change, il faut mettre à jour les 2 constantes en haut du `<script>`.

3. **RLS = la vraie sécurité, pas le frontend** : toute la logique d'isolation des données entre entreprises clientes vit dans les policies Postgres (`current_org_id()`), pas dans le JS. Ne jamais faire confiance à un filtre côté client pour la sécurité.

   **Deux pièges RLS à connaître (Voir aussi `config/MIGRATION_V13_ISOLATION_ESPACE.sql`)** :
   - **Deux politiques permissives sur la même commande se combinent par OU.** Elles s'annulent
     au lieu de se restreindre. Une politique « deny » *permissive* (`using (auth.role() <> 'anon')`)
     laisse passer toute ligne d'un compte connecté et neutralise toutes les autres → Plus aucune
     isolation. Correctif : bloquer le rôle par absence de politique, ou par un
     `to anon using (false)`. Règle : **une seule politique par table et par commande**, ciblée
     `TO authenticated`.
   - **`NULL = NULL` vaut `NULL`, pas `true`.** Une politique `org_id = current_org_id()` refuse
     donc silencieusement l'accès à toute ligne sans espace (`org_id IS NULL`) pour un compte
     lui-même sans espace (`current_org_id()` → `NULL`). Résultat : l'utilisateur voit une liste
     vide, ou reçoit un 403 sur ses propres écritures. Ajouter explicitement la branche
     `(org_id is null and owner_user_id = auth.uid())` — cf. V13 → V14.
   - Après **toute** migration RLS, rejouer `node config/verify_v13_isolation.mjs` (isolation
     entre espaces) **et** `node config/verify_v14_solo.mjs` (mode sans espace + non-régression
     inter-espace). Le second est indispensable : ouvrir le mode solo ne doit pas rouvrir la fuite.

4. **`profiles` peut ne pas exister au premier login** : normalement un trigger Supabase crée la ligne `profiles` à l'inscription. Le frontend a un filet de sécurité (insert si absent) — si ça se déclenche souvent, vérifier que le trigger `on_auth_user_created` est bien actif.

5. **`Schema privé`** : schéma Postgres séparé (nommé avec accent, à échapper en SQL : `"Schema privé"`), alimenté par un pipeline Make.com externe (sync Google Sheets → Supabase). Ne pas confondre avec le schéma `public`. Hors périmètre du produit MAYELA CRM — sert la prospection interne HORIZON.

6. **Tables `horizon_*`** : réservées à l'équipe HORIZON (`is_horizon_staff = true`), ne doivent jamais apparaître dans l'UI produit destinée aux clients CRM.

## Principe : compte / adresse e-mail / espace sont indissociables

**Règle (29/09/2026) :** un compte ne peut pas être dissocié de son adresse e-mail, et une adresse
e-mail ne peut pas être dissociée de son espace. Si l'espace lié à une adresse est supprimé, le
compte correspondant **n'a plus d'objet** : il ne reste qu'un accès vide affichant l'écran
d'onboarding, et il n'y a rien à migrer ni à rattacher ailleurs.

Conséquences pratiques :

- **Un compte sans espace n'est pas un bug** — c'est le résultat normal d'un espace supprimé.
  `afterPinOk()` masque le shell et affiche l'onboarding, ce qui est le comportement correct.
  Ne pas chercher à « réparer » ces comptes en rattachant leur profil à un autre espace.
- **Avant de migrer quoi que ce soit**, vérifier qu'il existe réellement des lignes dans
  `clients`, `achats`, `devis`, `tasks`, `interactions`, `creances`, `produits_services`,
  `ia_messages`, `org_members` et `social_accounts` pour le compte concerné. Sur les 4 comptes
  concernés au 29/09/2026, le compte était **zéro sur chaque table** : rien à récupérer.
- **Le mode solo existe quand même** (`clients`/`produits_services` avec `owner_user_id` et
  `org_id IS NULL`) : c'est le cas d'un client créé avant le rattachement à un espace, pas celui
  d'un compte sans espace. Voir §3 sur les politiques RLS.
- **Attention aux résidus de test** : mes scripts de vérification créent et suppriment des
  comptes via l'API admin. Si un script plante avant son bloc `finally`, les lignes métier
  peuvent survivre à la suppression du compte (ex. un « Produit solo » resté le 28/09/2026
  alors que son compte avait été supprimé). Les blocs `finally` doivent toujours être écrits,
  et il faut auditer `owner_user_id` orphelins après chaque exécution.

## Flux « Espace dédié = reconnexion gmail » (création & bascule)

La bascule d'espace se reconnecte avec le gmail propriétaire de l'espace (`my_spaces.owner_email`).

- **Bascule** (existant) : `pendingSwitchOrg` en session → déconnexion → OTP sur le gmail cible → `switch_org`.
- **Création** (ajout 14/09/2026) : les formulaires « Créer un espace » (Réglages) et « Créer mon espace » (onboarding) acceptent désormais un **e-mail propriétaire** optionnel. Si ce gmail diffère du gmail connecté : `pendingCreateOrg` (nom de l'espace) en session → déconnexion → OTP sur ce gmail → `create_organization` exécuté sous **ce** compte → espace activé. Si le champ est vide ou égale le gmail connecté : création immédiate (comportement antérieur).

## Email OTP sans code (template « Magic Link »)

`sendEmailChangeCode` et les flux OTP utilisent `signInWithOtp`. L'e-mail reçu doit afficher le **code numérique** `{{ .Token }}` :

- **Supabase Dashboard → Authentication → Email Templates → Magic Link** : vérifier que le corps contient `{{ .Token }}` (le code à saisir) en plus du lien de connexion. Sans `{{ .Token }}`, l'e-mail n'affiche aucun code et la saisie manuelle (écrans `authOtp`, `switchCode`, `changeCodeStep`) est impossible.

## Historique des décisions

| Date | Décision | Raison |
|---|---|---|
| Avant 03/07 | Prototype maquette statique (données codées en dur) | Valider le design avant tout branchement backend |
| 05/07 | Création des tables core + RLS | Fondation du schéma multi-tenant |
| 09/07 | Durcissement des fonctions (`SECURITY DEFINER`), policies restreintes à `authenticated` | Audit sécurité |
| 16/07 | Reconstruction du frontend avec vraie intégration Supabase (le fichier maquette n'avait aucun appel API) | Le fichier de démo initial ne parlait pas au backend construit — divergence découverte en session |
| 16/07 | Nettoyage tables orphelines `public.leads/api_configs/strategy_logs` | Reliquats vides d'avant renommage `horizon_*` |
| 14/09/2026 | Création d'espace avec gmail propriétaire (champ optionnel + reconnexion) | Cohérence TikTok : chaque espace piloté par son compte gmail (`pendingCreateOrg` calqué sur `pendingSwitchOrg`) |
| 15/09/2026 | TikTok Marketing API (pub) : `exchange_marketing` + `marketing_sync` dans `social-tiktok`, section « Analyse publicitaire » dans l'UI, migration V10 (`has_marketing` dans `social_accounts_safe`) | Lire automatiquement les campagnes publicitaires TikTok (item #8 du plan) sans exposer les tokens (`marketing_access_token` purgé de la vue) |
| 28/09/2026 | **V13 — cloisonnement strict par espace** : les politiques `*_deny_anonymous` étaient *permissives* et se combinaient par OU avec les autres, annulant l'isolation (transposition de données entre espaces). Remplacées par un blocage `TO anon using (false)` + une seule politique `TO authenticated` par table | La sécurité multi-tenant ne repose pas sur le nombre de politiques mais sur leur **forme** : une politique permissive est une porte ouverte, pas un verrou |
| 28/09/2026 | **V12 — `profiles.top_clients_limit`** (défaut 15) au lieu d'une valeur locale à l'appareil | Le réglage ne se réinitialisait plus selon le navigateur |
| 29/09/2026 | **V14 — mode « sans espace » (solo) étendu aux tables enfants + `ia_messages`** | V13 avait couvert `clients`/`produits_services` mais pas les 5 tables enfants : le propriétaire d'un client solo pouvait le créer et le lire, mais toute écriture renvoyait 403 (`NULL = NULL` n'est pas `true`) |

## TikTok Marketing API (pub) — rappel protocolaire

- Auth : `https://ads.tiktok.com/marketing_api/auth?app_id=<Client Key>&redirect_uri=<URI>&state=<random>`.
  Le callback renvoie `?auth_code=...&state=...` ; l'edge function accepte aussi `code`.
- Échange : `POST https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/`
  body `{app_id, secret, auth_code}` → `data.access_token` + `data.advertiser_ids`
  (token **longue durée**, pas de refresh — invalide si l'annonceur révoque).
- Requêtes suivantes : header **`Access-Token`** (pas `Authorization: Bearer`).
- Campagnes : `GET /open_api/v1.3/report/integrated/get/` avec
  `service_type=AUCTION&report_type=BASIC&data_level=AUCTION_CAMPAIGN` +
  `dimensions=["campaign_id","campaign_name"]` + `metrics=["spend","impressions","clicks","reach"]`.
- Les mêmes `client_key`/`client_secret` servent au Login Kit (organique) et au Marketing API (pub).
- Scopes Marketing = IDs numériques attribués à l'app (pas de paramètre `scope` dans l'URL d'auth).
- Le token marketing est stocké dans `social_accounts.config` (`marketing_access_token`), lu
  uniquement par `service_role` (vue `social_accounts_safe` ne l'expose pas).

## Commandes utiles

```bash
# Lancer en local
npx http-server mayela-crm.html --port 8080

# Déployer sur Vercel (production : projet mayela-crm → https://mayela-crm.vercel.app)
npx vercel deploy --prod
```

```sql
-- Vérifier les fonctions RPC actives
SELECT proname, pg_get_function_arguments(oid)
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
ORDER BY proname;
```
