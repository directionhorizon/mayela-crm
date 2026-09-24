# Créer l'app Meta (Facebook) (App ID / App Secret) — Guide client

**À lire par** : la pharmacie (propriétaire de la Page Facebook et de l'infrastructure Meta).

**Objectif** : créer l'application développeur Meta qui permettra au CRM de **publier des
offres** sur la Page Facebook et d'afficher les **statistiques d'audience** (abonnés,
portée/impressions 28 j, villes, âge + genre), comme la connexion TikTok.

**Prérequis** :
- Une **Page Facebook** existante (celle de la pharmacie qui recevra les offres).
- Un **compte Facebook personnel** qui est admin de cette Page.
- (Conseillé) un **Meta Business Manager** (`business.facebook.com`) rattaché à la pharmacie.

---

## Étape 1 — Devenir développeur Meta

1. Ouvrir `https://developers.facebook.com`.
2. Cliquer sur **« Get Started »** (devenir développeur).
3. Se connecter avec le compte Facebook **admin de la Page**.
4. Accepter les conditions et valider le numéro de téléphone (code reçu par SMS),
   comme pour TikTok.

## Étape 2 — Créer une Business App

1. Ouvrir `https://developers.facebook.com/apps` → **« Create App »**.
2. Choisir le cas d'usage **« Other »** (autre) puis **« Business »** comme type
   (l'app est utilisée par l'entreprise elle-même, pas revendue).
3. Renseigner :
   - **App name** : proposé — `Mayela CRM — Pharmacie`
   - **App contact email** : l'e-mail métier de la pharmacie.
   - **Business Portfolio / Business Manager** : sélectionner celui de la pharmacie
     (créable au passage si absent).
4. Créer l'app, puis accepter la **Déclaration des données** (Data Use Checkup).

## Étape 3 — Ajouter le produit Facebook Login + les permissions

1. Dans l'app → **Add products** → **Facebook Login** → **Set up**.
2. Dans **Facebook Login → Configuration** (Settings), remplir :
   - **Valid OAuth Redirect URIs** : l'adresse affichée dans le CRM
     (écran **Réseaux sociaux → Connexion Facebook**) — à copier exactement.
     Normalement : `https://mayela-crm.vercel.app/mayela-crm.html`
3. **Enregistrer les modifications.**
4. Toujours dans l'app, ouvrir **App Review → Permissions and Features** et demander
   l'accès aux permissions suivantes (voir « App Review » à l'étape 5) :
   - `pages_show_list` — lister les Pages gérées par le compte.
   - `pages_manage_posts` — publier les offres sur la Page.
   - `pages_read_engagement` — lire abonnés et statistiques d'audience.
   - `read_insights` — lire les statistiques détaillées (villes, âge+genre, portée).

   > Ces permissions sont du **niveau « advanced access »** : pour un usage en production
   > hors des rôles de l'app, une revue est nécessaire (étape 5). En attendant la revue,
   > l'app fonctionne pour les personnes ajoutées en **rôles** (admin / développeur /
   > testeur) et pour les admins/tests de la Page.

## Étape 4 — Récupérer les identifiants

1. Dans l'app → **Settings → Basic**.
2. Relever :
   - **App ID**
   - **App Secret** (cliquer sur « Show », puis « Copy »)
3. Transmettre ces **deux valeurs** à l'équipe qui configure le CRM
   (champs *App ID* et *App Secret* dans Réglages Facebook).

## Étape 5 — Soumettre l'app à la revue (préparation Live)

À faire dès que possible pour que la publication et les statistiques ne dépendent plus
du mode « In Development » (réservé aux rôles de l'app) :

1. Onglet **App Review → Permissions and Features**, pour chaque permission de l'étape 3 :
   - **Request Advanced Access** (demander l'accès avancé).
   - Remplir le formulaire : justification d'usage + captures d'écran de l'écran
     **Réseaux sociaux / publication** du CRM.
2. S'assurer que l'app a une **Privacy Policy URL** et des **icons** (Settings → Basic).
3. **Submit for review** et suivre le statut (généralement quelques jours).

**Alternative sans revue** : tant que l'app reste « In Development », lier le compte du
propriétaire de la Page comme **admin/testeur** de l'app (Settings → Roles) : le flux
complet fonctionne déjà pour le CRM.

---

## Suggestion de description (pour les formulaires de revue)

> MAYELA CRM est un logiciel de gestion de la relation client utilisé par la pharmacie.
> L'application publie les offres promotionnelles de la pharmacie sur sa propre Page
> Facebook et affiche les statistiques d'audience de la Page (abonnés, portée, villes,
> âge et genre) dans son tableau de bord. Aucun contenu n'est publié sur d'autres Pages ;
> les connexions se font avec l'autorisation explicite d'un administrateur de la Page.

## Après la revue

- Le CRM lira les statistiques d'audience de la Page et pourra publier en continu.
- Les **App ID / App Secret** reçus à l'étape 4 restent les mêmes : seule l'autorisation
  des permissions change (In Development → Live).

## Étape 6 — Autoriser la Page dans le CRM

1. Dans le CRM, **Réseaux sociaux → Page Facebook → Connecter**.
2. Renseigner **App ID** et **App Secret** (étape 4) → **Se connecter à Facebook**.
3. Facebook demande l'autorisation : se connecter avec le compte **admin de la Page** et
   approuver les permissions demandées.
4. Retour automatique au CRM : la carte affiche **« Connecté »** avec le nom de la Page.
5. Publier une offre de test (écran **Publier du contenu**) : elle apparaît sur la Page.

> **Si la Page ne s'ajoute pas** : vérifier que le compte connecté est bien **admin** de la
> Page, puis re-cliquer « Autoriser » sur la carte Facebook du CRM.

---

*Document client — créé le 24/09/2026.*