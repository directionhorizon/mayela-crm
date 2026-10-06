# Créer l'application Meta sur developers.facebook.com/apps — Guide pas à pas

> **Version de référence** : flow « use cases » (2026). Remplace la procédure « Business app +
> produits + permissions à cocher une à une », qui n'existe plus.
>
> **Qui fait quoi**
> - **L'agence** (compte développeur propriétaire du Business Portfolio) : crée l'app, la
>   configure, la soumet à la revue. L'app est **partagée par tous les espaces clients** —
>   elle appartient à l'agence, **pas** à la pharmacie.
> - **La pharmacie** (propriétaire de la Page et des comptes publicitaires) : n'intervient
>   qu'à l'**étape 8** (être ajoutée comme rôle de l'app) et à l'**étape 13** (autoriser sa
>   Page / ses comptes pub dans le CRM).
>
> **Objectif** : publier les offres sur la Page Facebook, afficher l'analyse d'audience
> (abonnés, portée, villes, âge + genre) et gérer les campagnes (Meta Ads Manager : lecture
> 30 j, pause/reprise, budget).

---

> ## État d'avancement — 29 septembre 2026
>
> **L'application existe et porte les deux use cases.** Il n'y a **rien à recréer**.
>
> | Ce qui est fait | État |
> |---|---|
> | App Meta créée le 26/09/2026 — App ID `28660855693581773` | ✅ fait |
> | Use case « Gérer tout sur votre Page » ajouté | ✅ fait |
> | Use case « Créer et gérer des publicités avec l'API Marketing » ajouté | ✅ fait |
> | Use cases → *Customize* : `pages_manage_posts` + `pages_read_engagement` | ✅ fait |
> | Portfolio de l'agence rattaché au use case Marketing | ✅ fait |
>
> | Ce qui reste | État |
> |---|---|
> | Étape 8 — ajouter les rôles (agence + pharmacie) | ⬜ À faire |
> | Bouton **Ready to test** sur chaque use case | ⬜ À faire, avant la revue |
> | Étape 10-11 — App Review (permissions `ads_*`) puis **Publish** | ⬜ À faire |
> | Étape 13.1 — branchement de la **Page** dans le CRM | ⬜ ** Faisable dès maintenant** : pas d'App Review requis |
> | Étape 13.2 — branchement du **compte publicitaire** | ⬜ Bloqué par l'App Review |
>
> **Ce qui est déjà prêt côté code** : la séparation des autorisations Page et Ads, l'Edge Function
> `social-facebook`, l'interface de connexion, le diagnostic des jetons. Rien n'est attendu du
> développement pour terminer cette procédure.
>
> **Deux points à connaître avant de continuer :**
>
> - **Le code de l'application doit appartenir à l'agence, pas à la pharmacie.** C'est ce qui permet
>   à plusieurs espaces clients d'utiliser la même app.
> - **L'autorisation « analyse publicitaire » peut être refusée sans rien casser.** Si Meta refuse la
>   revue, la connexion à la Page, la publication et l'analyse d'audience continuent de fonctionner.
>
> Suivi détaillé : `docs/suivi/EN_ATTENTE.md` §7 et §8.

---

## Règle d'or à retenir avant de commencer

1. **Les permissions ne se cochent plus une à une** : elles sont **apportées par le use case**
   choisi à la création. Le type d'app découle du use case.
2. **Un use case ne peut pas être retiré** après création, et **le type d'app ne peut pas être
   changé**. En revanche, **un use case peut être ajouté** à une app déjà créée.
3. Une app peut **sans use case** (App ID seul), mais elle n'a **aucune permission, aucun
   produit** : inutile ici.
4. Dans l'assistant, les use cases **incompatibles avec votre sélection sont grisés** : c'est un
   contrôle de cohérence, pas un bug.

> **Ce que ça implique pour l'app existante** : le use case « Facebook Login » choisi le 26/09
> n'apportait aucune permission `pages_*` / `ads_*`. Les deux use cases nécessaires ont ensuite été
> **ajoutés** à cette même app, ce qui est la seule opération corrective possible. **Il n'y a pas
> d'app #2 à créer, et l'app existante ne doit pas être supprimée** — c'est elle qui porte
> `pages_show_list`, `business_management`, `ads_read` et `ads_management`.

---

## Étape 1 — Ouvrir l'assistant de création

1. Se connecter à `https://developers.facebook.com/apps/creation/` **avec le compte développeur
   de l'agence** (⚠️ pas le compte de la pharmacie : sinon les clients futurs n'auront aucun
   accès, et l'app ne pourra pas servir plusieurs espaces).
2. Remplir **App details** :
   - **App name** : `Mayela CRM` — ⚠️ Meta **refuse** les noms contenant FB, Face, Book,
     Insta, Gram. `Mayela CRM` passe.
   - **App contact email** : e-mail de l'agence (celui du compte développeur).
3. **Next**.

## Étape 2 — Cocher les DEUX use cases (le point crucial)

### Gestes, dans l'ordre (filtre sur « Toutes »)

1. **Cliquer sur « Toutes »** dans le filtre à gauche → la liste complète s'affiche.
2. **Repérer la ligne de la Page** : la liste **scrolle** (barre verticale à droite du bloc
   central) et il n'y a **pas de pagination** — atteindre le bas de la liste.
   Libellé FR relevé dans le portail (27/09/2026) : **« Tout gérer sur votre Page »**
   (= *Manage everything on your Page*). Si le libellé diffère, le chercher avec les mots-clés
   `Page` / `Pages` / `contenu` / `publier`.
   *Astuce : cocher le use case Page **en premier**.*
3. **Cliquer sur la ligne (ou sa case à cocher)** pour la sélectionner. La ligne se met en
   évidence / la case se remplit.
4. **Contrôler l'effet** : *« Authentifier et demander les données des utilisateur·rice·s avec
   Facebook Login »* doit devenir **grisé** (incompatible). C'est normal et c'est bon signe.
   S'il ne devient **pas** gris, c'est que le use case Page n'a **pas** été coché.
5. **Défiler** jusqu'à « Créer et gérer des publicités avec l'API Marketing » (cat.
   `Publicités`) et cliquer dessus pour la cocher.
6. **Relire la liste entière** : il doit y avoir **exactement 2 lignes cochées**, celle de la Page
   et celle de l'API Marketing. Ni plus (Threads, WhatsApp, Messenger, Facebook Login, dons,
   Catalog, leads doivent rester **décochés**), ni moins.
7. **Vérifier le récapitulatif** affiché par Meta sous la liste ou en bas d'écran
   (« *n cas d'utilisation sélectionnés* ») : le chiffre doit être **2**, et le détail doit
   mentionner les permissions `pages_*` et `ads_*`.
8. **Cliquer sur `Next`** → étape `Entreprise`.

> ⚠️ **Si la ligne « Gérer tout sur votre Page » n'apparaît pas** (ni dans « Toutes », ni au bas
> de la liste, ni dans `Gestion du contenu`) : **se replier sur le plan B** ci-dessous — ne pas
> bloquer la création.
>
> ⚠️ **Si un use case est grisé sans qu'on l'ait sélectionné** : ne pas forcer le clic, c'est un
> contrôle de cohérence de Meta. Seules les combinaisons compatibles sont possibles.

### Plan B — « Gérer tout sur votre Page » n'est pas proposé à la création

> **C'est le chemin qui a été suivi pour l'application `28660855693581773`.** La section est
> conservée comme procédure de référence.

Un use case peut être **ajouté après la création** depuis l'app (*Use cases* dans le menu de
gauche → `+ Add use case` → *Manage everything on your Page*) : c'est l'**ajout** qui est
possible, pas la suppression. Donc :

1. Cocher **seulement** « Créer et gérer des publicités avec l'API Marketing » → `Next` →
   `Entreprise` → `Create app`.
2. Tout de suite après, dans l'app : menu **Use cases** → **+ Add use case** →
   **Gérer tout sur votre Page** → le **créer** également.
3. Vérifier que l'app affiche bien **2 use cases** et que `pages_show_list` /
   `business_management` apparaissent dans les permissions.
4. Reprendre ensuite à l'**étape 4** du présent guide.

**Fil d'étapes en haut de l'écran** (dans l'ordre) :
`Détails de l'application` → **`Cas d'utilisation`** → `Entreprise` → `Conditions requises` →
`Vue d'ensemble`. On est sur la 2ᵉ, celle qui décide des permissions.

**Le filtre à gauche** ne fait que trier la liste par catégorie (`Toutes`, `Publicités`,
`Gestion du contenu`, `Messagerie professionnelle`…). Il ne change pas ce que l'app aura comme
permissions. Les deux use cases nécessaires ne sont **pas dans la même catégorie** :

| Use case à cocher | Où le chercher dans le filtre |
|---|---|
| **« Créer et gérer des publicités avec l'API Marketing »** (*Create & manage ads with Marketing API*) | `Publicités` |
| **« Gérer tout sur votre Page »** (*Manage everything on your Page*) | `Gestion du contenu` (libellé exact variable selon la langue du portail) |

Puis, dans le récapitulatif, voici ce que ces deux cases apportent :

| | Use case (nom affiché FR / EN) | Ce qu'il apporte automatiquement |
|---|---|---|
| ✅ **1** | **Gérer tout sur votre Page** / *Manage everything on your Page* | `business_management`, `pages_show_list`, `public_profile` (requis, non retirables) + `pages_manage_engagement` (par défaut, retirable) + produit **Facebook Login for Business** |
| ✅ **2** | **Créer et gérer des publicités avec l'API Marketing** / *Create & manage ads with Marketing API* | `ads_read`, `ads_management`, `business_management` (requis, non retirables) + feature **Ads Management Standard Access** + produits **Facebook Login for Business** et **Webhooks** |

Pourquoi ces deux-là, et pas d'autres :

| Use case à **ne pas** cocher | Raison |
|---|---|
| ❌ « Créer et gérer des publicités d'**application** avec Meta Ads Manager » | promotions d'applications mobiles (installs). La doc Meta précise : **« Does not include access to Marketing API »** → aucune permission `ads_*`. C'est le piège le plus fréquent : même catégorie `Publicités`, libellé presque identique. |
| ❌ « Authentifier et demander les données des utilisateur·rice·s avec Facebook Login » | **incompatible** avec « Gérer tout sur votre Page » (sera grisé) et n'apporte ni `pages_*` ni `ads_*`. C'est l'erreur de l'app #1. |
| ❌ « Accéder à l'API Threads », « Tisser des liens avec votre clientèle via WhatsApp », « Messagerie professionnelle » | hors périmètre du CRM (aucun envoi de message, aucun Thread). |
| ❌ « Mesurer les performances publicitaires avec l'API Marketing » | lecture/rapports seulement. Notre besoin inclut **pause/reprise + budget** (écriture) → c'est « Créer et gérer… » qu'il faut. (Ce use case pourra être ajouté plus tard si un besoin de reporting extensions apparaît.) |
| ❌ « Gérer les produits avec l'API Catalog », « Collecter des leads pub », « dons », « IDFA »… | hors périmètre du CRM. |
| ❌ Les 12 permissions `user_*` (`user_friends`, `user_likes`, `user_location`, `user_posts`…) | **ne se demandent plus du tout** : le profilage individuel est interdit (RGPD) et les refus sont quasi garantis. L'analyse d'audience passe par les **insights agrégés** de la Page et des pubs (âge, genre, ville, centres d'intérêt), croisés avec les données du CRM. |

Puis **Next** → étape `Entreprise` (portfolio) → `Conditions requises` → `Vue d'ensemble` → **Create app**.

## Étape 3 — Rattacher le Business Portfolio

1. Onglet **Business** de l'assistant : sélectionner le **Business Portfolio de l'agence**
   (bouton *Create new account* s'il n'existe pas encore).
2. **Créer l'app**.

> Le portfolio est obligatoire : il porte les Pages, comptes publicitaires et apps de l'agence.
> Sans lui, `business_management` ne sert à rien et l'app ne peut pas être publiée.

---

## Étape 4 — Ajouter les permissions optionnelles (bouton « Add »)

Dans l'app → menu de gauche **Use cases** (icône crayon) → **Customize** sur chaque use case →
écran **Permissions and features** → bouton **Add**.

### Use case « Gérer tout sur votre Page » → ajouter

| Permission | Nécessaire pour | Statut |
|---|---|---|
| `pages_manage_posts` | **publier les offres** sur la Page | à ajouter (puis revue) |
| `pages_read_engagement` | lire abonnés/engagement — **dépendance** de `ads_management` et `business_management` | à ajouter (puis revue) |
| `read_insights` | **analyse d'audience** (villes, âge + genre, portée) | à ajouter (puis revue) |
| `pages_manage_engagement` | ajoutée par défaut, **retirable** | **à retirer** — le CRM ne modère aucun commentaire ; une permission de moins = une justification de moins à la revue |

### Use case « Créer et gérer des annonces avec l'API Marketing »

Rien à ajouter : `ads_read`, `ads_management`, `business_management` sont déjà là.
**Ne pas** ajouter `catalog_management`, `leads_retrieval`, `page_manage_ads`,
`threads_business_basic` (hors périmètre). `email` non plus : le CRM n'en a pas besoin.

### Récapitulatif : les scopes, demandés en DEUX fois

Le CRM ne demande plus tout d'un coup. Une seule fenêtre d'autorisation contenant les
permissions `ads_*` fait **refuser l'ensemble par Meta** (elles exigent un App Review), et la
connexion de la Page échoue avec. Les deux groupes sont donc demandés séparément :

| Étape | Scopes demandés | Condition Meta |
|---|---|---|
| 1. Page | `pages_show_list`, `pages_manage_posts`, `pages_read_engagement`, `read_insights` | fonctionne en mode **In Development** |
| 2. Compte publicitaire | `ads_read`, `ads_management`, `business_management` | exige **App Review** (étape 10) |

→ tous couverts par les 2 use cases + les 3 ajouts ci-dessus. **Ne rien demander d'autre.**

> Conséquence pratique : l'étape 1 aboutit même sans App Review. L'étape 2 échoue proprement
> avec un message explicite tant que la revue n'est pas passée. Le compte publicitaire reste
> facultatif.

### Business Portfolio + comptes publicitaires (dans le même écran)

Sur le use case Marketing API → section **Business** : portfolio connecté + **ajouter au moins un
compte publicitaire** (identifiant `act_…`). Pour un test sans argent : créer un
**compte publicitaire sandbox** (bouton *Create* de la fenêtre popup) — aucune carte bancaire,
les pubs créées ne partent pas.

## Étape 5 — Enregistrer l'URI de redirection (le réglage le plus souvent raté)

> **Ce champ n'est pas dans « Paramètres de l'app »** (ni *Général*, ni *Avancé*). Ces onglets ne
> contiennent que l'App ID / App Secret, les domaines, la politique de confidentialité et la
> catégorie. Deux chemins mènent au bon écran, selon la version du portail.

**Chemin A — le plus direct** : menu de gauche → **Facebook Login for Business** → **Settings**.

**Chemin B — si l'entrée n'existe pas dans le menu** (portail « use cases ») :
menu de gauche → **Cas d'utilisation** → le use case **« Gérer tout sur votre Page »** →
**Personnaliser / Customize** → **Go to Settings**.

Dans les deux cas, on arrive au panneau **Client OAuth settings**, qui contient le champ
**Valid OAuth Redirect URIs** → coller **exactement** :

```
https://mayela-crm.vercel.app/mayela-crm.html
```

Puis **Save changes**.

> ⚠️ **Les interrupteurs du panneau doivent être sur Yes**, sinon l'URI enregistrée est ignorée et
> l'erreur « redirect_uri mismatch » revient au clic suivant. Le CRM fait une authentification
> **depuis un navigateur** (Web OAuth) :
>
> | Interrupteur | Valeur |
> |---|---|
> | **Client OAuth login** | **Yes** |
> | **Web OAuth login** | **Yes** |
> | Enforce HTTPS | Yes (l'URI est en `https`) |
> | Strict Mode for redirect URIs | Yes (recommendé) |
>
> `Embedded Browser OAuth Login` et `Login with the JavaScript SDK` : **Non** — le CRM n'utilise ni
> la WebView ni le SDK.

> ⚠️ Règles : **pas de slash final**, **pas de `?` ni de `#`**, pas d'espace, `https://` en minuscules.
> L'URI doit être **caractère pour caractère** identique à celle qu'envoie le CRM, sinon
> l'écran d'autorisation échoue sur une erreur de type *redirect_uri*.
> Le CRM affiche la valeur exacte qu'il utilise : **Réseaux sociaux → Connexion Facebook →
> « Afficher l'URI »** (bouton de copie).

## Étape 6 — Relever l'App ID et l'App Secret

1. Menu de gauche → **App settings → Basic** (ancienne « Settings → Basic »).
2. **App ID** : la copier.
3. **App Secret** → **Show** → **Copy**.

> 🔒 **L'App Secret ne transite pas par un e-mail, un PDF ou un message.** Elle est saisie
> directement dans le CRM (champs *App ID* / *App Secret*, écran **Réseaux → Connexion
> Facebook**), stockée en base avec RLS, et ne ressort jamais dans l'interface.
> Elle est **identique pour tous les espaces clients** (une seule app, plusieurs espaces).

## Étape 7 — Déclarer les informations légales et l'icône

Dans **App settings → Basic** (à faire **avant** la revue, sinon soumission bloquée) :

- **Privacy Policy URL** : `https://mayela-crm.vercel.app/politique-confidentialite.html`
- **Terms of Service URL** : `https://mayela-crm.vercel.app/terms.html`
- **App icon** : `1024 × 1024` (le `icon.png` du projet convient)
- **App category** : *Business*
- **App domains** : `mayela-crm.vercel.app`
- **Contact email** : e-mail de l'agence
- Compléter le **Data Use Checkup** (déclaration des données) si proposé.

## Qui se connecte — ce n'est pas la Page, c'est une personne

Une **Page ne peut pas se connecter** et **ne peut pas recevoir un rôle d'app**. Le rôle se donne à
un *compte Facebook*, et c'est ce compte qui appuie sur « Se connecter » puis qui approuve. La Page
n'apparaît dans la liste que parce qu'elle est **administrée** par ce compte.

Il n'existe donc pas « un compte pharmacie » à inviter. Il faut identifier **la personne qui a le
contrôle total sur la Page** :

**Page PHARMAZEN → Paramètres → Accès à la Page** → onglet « Personnes ayant un accès » (ou
*Accounts*) → le compte qui porte **Contrôle total** (*Full control*).

| Ce que doit pouvoir faire ce compte | Tâche Meta | Indispensable pour |
|---|---|---|
| Publier une offre | `CREATE_CONTENT` | publication sur la Page |
| Lire l'analyse d'audience | `ANALYZE` | abonnés, portée, villes, âge + genre |
| Autoriser l'app | `MODERATE` | exiger une Page Access Token |
| Gérer la Page | `MANAGE` | modifier les paramètres |

**Le contrôle total (`PROFILE_PLUS_FULL_CONTROL`) couvre les quatre.** Un accès limité type
« Contenu » suffit à publier mais **pas** à lire l'analyse d'audience, et Meta ne renvoie pas de
Page Access Token à un compte sans rôle sur la Page.

> Si le seul compte en contrôle total est celui de l'**agence** (vous), c'est vous qui vous
> connectez — et c'est **préférable** : le jeton est rattaché à la personne, donc s'il est détenu par
> un employé de la pharmacie, la publication s'arrête le jour où celui-ci part.

## Étape 8 — Ajouter les rôles (indispensable pour ne pas attendre la revue)

> **« Rôles » n'est pas dans « Paramètres de l'app »** (ni *Général*, ni *Avancé*). C'est une
> **entrée du menu de gauche**, à côté de « Cas d'utilisation » et « Paramètres », entre autres.

**Menu de gauche → Rôles** → bouton **Add People** :

- le **compte Facebook de la personne qui administre la Page** (contrôle total, identifiée
  ci-dessus) → rôle **Tester** : c'est ce qu'il faut pour se connecter, publier et lire l'audience
  tant que l'app est en développement. **Administrator** est réservé à quelqu'un qui doit gérer les
  réglages de l'app (App Review, Publish, ajout d'autres rôles) — inutile ici, à ne pas distribuer
  par réflexe ;
- les autres comptes de l'agence en **Developer** / **Tester**.

> ⚠️ C'est une **invitation**, pas une attribution immédiate : la personne doit accepter
> l'invitation dans son propre compte Facebook. Tant qu'elle n'est pas acceptée, le compte connecté
> n'a pas de rôle sur l'app et l'écran d'autorisation affiche « App In Development ». L'invitation
> doit donc être **acceptée avant de tester**.
>
> Un rôle *Administrator* peut accorder n'importe quelle permission **pendant que l'app est en
> développement** : c'est ce qui rend possible la recette complète sans attendre la revue.
> Les rôles *Administrator* / *Developer* / *Analytics* sont réservés aux comptes Meta developers
> enregistrés ; le rôle *Tester* peut aller à un compte ordinaire.

> Tant que l'app est **« In Development »**, seuls ces rôles peuvent s'autoriser. C'est
> volontaire : **la recette complète (publication + audience + Meta Ads) est donc possible
> immédiatement**, sans attendre la revue. Sans cette étape, l'écran d'autorisation
> afficherait « App In Development ».

## Étape 9 — Tester l'app

1. **App Dashboard** : pour **chaque** use case, bouton **Ready to test** — obligatoire avant
   toute soumission à la revue.
2. Contrôle rapide dans le **Graph API Explorer** (`developers.facebook.com/tools/explorer`) :
   - *Get Token* avec l'app → `GET /me/accounts?fields=id,name,access_token,followers_count`
     → les Pages administrées doivent apparaître ;
   - `GET /me/adaccounts?fields=id,name,currency` → les comptes publicitaires doivent apparaître.

## Étape 10 — Soumettre à la revue (passage en Live)

Menu de gauche → **App Review** → **Edit** :

1. **Complete App Settings** (étape 7) — étape bloquante.
2. **Provide reviewer instructions** : explaining en français le parcours de test
   (connexion → publication d'une offre → tableau d'audience → pause/reprise d'une campagne),
   avec le compte de test et les accès.
3. Pour chaque permission/feature, cliquer dessus :
   - `pages_manage_posts`, `pages_read_engagement`, `read_insights`, `business_management`
     → **Request Advanced Access** (justification + capture d'écran de l'écran CRM concerné) ;
   - **Ads Management Standard Access** → demander le niveau **Standard Access**
     (c'est le palier Marketing API requis par le use case ; les paliers supérieurs sont
     sur demande commerciale).
4. **Supprimer** toute permission non utilisée (icône poubelle) avant de cocher la case
   d'acceptation d'usage.
5. Compléter la **Business verification** si demandée (identité de l'agence).
6. **Submit for Review**. Délai habituel : quelques jours ouvrés (screencast → parfois 1 semaine).

> **En attendant la revue** : le flux complet fonctionne déjà pour les rôles de l'app
> (étape 8) et pour les administrateurs des Pages/comptes pub. La revue sert à faire
> fonctionner l'app **pour des tiers hors de ces rôles** (ex. unzanimateur de l'agence).

### Texte de justification (à copier dans les formulaires)

> MAYELA CRM est un logiciel de gestion de la relation client (CRM) utilisé par les
> entreprises pour piloter leurs clients, leurs campagnes et leurs publications.
> 1. **Publication** — l'application publie les offres promotionnelles de l'entreprise sur
>    **sa propre Page Facebook**, à partir d'un écran dédié (« Publier du contenu »).
> 2. **Analyse d'audience** — l'application affiche les statistiques **agrégées** de la Page
>    (abonnés, portée/impressions sur 28 jours, villes, répartition par âge et genre) et les
>    résultats des campagnes (dépense, impressions, clics, portée) dans son tableau de bord,
>    en lecture seule sur l'API d'insights.
> 3. **Campagnes** — l'application permet de consulter, mettre en pause / reprendre et ajuster
>    le budget journalier ou total des campagnes et des ensembles de pubs de l'entreprise,
>    depuis un écran « Gérer mes campagnes ».
>
> L'accès est accordé par l'administrateur de la Page et du compte publicitaire au moment de la
> connexion (OAuth), l'application n'ayant accès **qu'aux assets** de l'entreprise dont un
> administrateur a explicitement autorisé la connexion. Aucune donnée personnelle
> d'utilisateurs Facebook n'est collectée, lue ni profilée : l'analyse repose exclusivement
> sur des statistiques agrégées. Aucun contenu n'est publié sur des Pages tierces.


## Étape 11 — Publier l'app

Menu de gauche → **Publish** → vérifier les use cases et exigences → **Publish** (en bas à
droite). L'app passe de **In Development** à **Live** ; les permissions approuvées deviennent
utilisables par les comptes autorisés.

## Étape 12 — Point de contrôle (ne rien supprimer)

**Ne pas supprimer l'application.** C'est elle qui porte les deux use cases et l'App ID enregistré
dans le CRM (`28660855693581773`). Une éventuelle suppression ferait perdre les permissions
ajoutées, qui sont elles-mêmes irréversibles.

Contrôler à la place, dans l'onglet **App Review** de l'app :

| Contrôle | Attendu |
|---|---|
| Permissions listées | `pages_show_list`, `pages_manage_posts`, `pages_read_engagement`, `business_management` |
| Permissions pub | `ads_read`, `ads_management` marquées *Pending review* ou *Live* |
| Use cases | 2 use cases, chacun avec le bouton **Ready to test** activé |

## Étape 13 — Brancher l'app dans le CRM (par espace client)

### 13.1 — La Page (autorisation 1, sans App Review)

1. **Réseaux sociaux** → carte **Page Facebook** → **Connecter**.
2. Coller **App ID** + **App Secret** (bouton *Show* pour le secret) →
   **📘 Se connecter à Facebook**.
3. Facebook demande l'autorisation : se connecter avec le **compte identifié à l'étape 8**
   (contrôle total sur la Page) et approuver les permissions. Seules les permissions Page sont
   demandées ici. La Page **n'apparaît dans la liste que si ce compte a bien une tâche dessus** —
   d'où l'importance du contrôle total.
4. **Si le compte gère plusieurs Pages**, un menu déroulant **« Quelle Page connecter ? »**
   s'affiche dans le panneau. C'est obligatoire : sans ce choix, aucune Page n'est connectée
   (choisir la première réponse de Meta reviendrait à publier sur une Page arbitraire). Choisir
   **PHARMAZEN** puis **Valider cette Page**.
5. Retour dans le CRM : la carte affiche **« Connecté »** avec le nom de la Page.
6. **Publier une offre de test** (écran *Publier du contenu*) → elle doit apparaître sur la Page.
7. **Analyse d'audience** → vérifier abonnés / portée / villes / âge+genre.

> **Vérifier le nom affiché sur la carte.** Le nom de la Page connectée est affiché à côté de
> « Page Facebook » ; c'est le contrôle le plus direct après la connexion.
>
> **Changer de Page plus tard** : panneau Meta → **🔄 Changer de Page** → même menu déroulant.
> Utile si le compte connecté administre plusieurs Pages, ou si le contrôle était sur la mauvaise.
> Le rafraîchissement automatique conserve la Page choisie, elle ne dérive pas toute seule.

### 13.2 — Le compte publicitaire PHARMAZEN (autorisation 2, App Review requis)

7. Toujours dans le panneau, bloc **« Analyse publicitaire (compte Meta Ads) »** — visible
   directement, sans déplier quoi que ce soit — cliquer
   **📊 Autoriser l'analyse publicitaire**.
8. Se connecter avec un profil Facebook ayant un rôle dans **Ads Manager sur PHARMAZEN**.
9. **Vérifier le nom affiché : il doit lire `PHARMAZEN`.** Si d'autres comptes apparaissent,
   tous seront importés : c'est normal, le CRM récupère tous les comptes accessibles au profil.
10. **🔄 Relever les campagnes (30 j)** → puis écran **🛠️ Gérer mes campagnes Meta Ads**
    (pause/reprise + budget).

> Si l'étape 7 affiche un refus de permissions, ce n'est pas un bug : l'app n'a pas encore
> l'App Review pour `ads_management` / `ads_read`. Finir les étapes 10-11 puis réessayer.
> La Page reste connectée et fonctionnelle entre-temps.

> **Ré-autorisation obligatoire** si des permissions ont été ajoutées *après* une première
> connexion : le token existant ne les contient pas. Revalider **📘 Se connecter à Facebook**
> (Page) puis **📊 Autoriser l'analyse publicitaire** (Ads) — ce sont deux fenêtres distinctes.
> Le CRM gère le refresh, ~60 jours.
>
> Si aucun compte publicitaire n'apparaît : le compte connecté doit être
> **administrateur d'un compte Ads Manager** dans le Business Portfolio rattaché à l'app.

---

## Erreurs fréquentes → cause

| Symptôme | Cause | Correction |
|---|---|---|
| **« Autoriser » ne fait rien** | Meta reçoit les 7 permissions d'un bloc ; les `ads_*` exigent un App Review, donc **toute** la fenêtre est rejetée et la Page ne se connecte pas | **corrigé le 29/09/2026** : les permissions sont désormais demandées en deux fois. Si le symptôme persiste, vérifier que le CRM est à jour (bandeau du navigateur) |
| Bouton « Se connecter à l'analyse publicitaire » introuvable | il était caché dans le repli « Préparation dans Meta » | **corrigé le 29/09/2026** : le bloc est désormais visible sous les champs App ID / Secret |
| `redirect_uri` / *redirect_uri mismatch* | URI enregistrée ≠ celle du CRM (slash final, `index.html`, `http`) **ou** interrupteurs *Client OAuth login* / *Web OAuth login* sur **No** | recoller `https://mayela-crm.vercel.app/mayela-crm.html` à l'identique **et** mettre les 2 interrupteurs sur Yes |
| « App In Development » sur l'écran Meta | le compte connecté n'a pas de **rôle** sur l'app, ou l'invitation n'a pas été acceptée | étape 8 (menu de gauche → **Rôles** → Add People), puis faire accepter l'invitation |
| Les permissions `pages_*` / `ads_*` n'existent pas dans le portail | le use case correspondant n'a pas été **ajouté** à l'app | menu **Use cases** → `+ Add use case`. C'est un ajout, pas une correction : la suppression d'un use case est impossible, mais l'ajout est permis. **Ne pas supprimer l'app.** |
| Publication sur la mauvaise Page | compte connecté qui administre plusieurs Pages, choix fait à l'aveugle | corrigé le 29/09/2026 : menu déroulant obligatoire, plus de choix automatique. En cas de doute : **🔄 Changer de Page** |
| Aucune Page listée | le compte connecté n'a **aucune tâche** sur la Page (page non dans son *Accès à la Page*, ou accès limité à « Contenu ») | vérifier Page → Paramètres → Accès à la Page → **Contrôle total** |
| Aucun compte publicitaire listé | compte pub non rattaché au portfolio de l'app, ou compte connecté sans droits dessus | étape 4 (portfolio + `act_…`) |
| `ads_*` refusées / 403 | app non publiée ou Standard Access non approuvé | étapes 10-11 |
| D'autres comptes que PHARMAZEN sont importés | le profil connecté a accès à plusieurs comptes pub, et le CRM les récupère tous | autoriser avec un profil ne donnant accès qu'à PHARMAZEN |
| Budgets en USD/EUR et non en FCFA | devise du **compte publicitaire** | normal, non corrigeable côté CRM |

---

*Document mis à jour le 29/09/2026 — flow « use cases » Meta 2026, vérifié sur la doc Meta
(Create an App · Pages API Use Case · Marketing API Use Cases) et sur les scopes réellement
envoyés par l'app CRM. Autorisations Page et Ads désormais séparées (voir étape 13).*
