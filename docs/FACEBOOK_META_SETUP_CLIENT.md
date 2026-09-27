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

## Règle d'or à retenir avant de commencer

1. **Les permissions ne se cochent plus une à une** : elles sont **apportées par le use case**
   choisi à la création. Le type d'app découle du use case.
2. **Un use case ne peut pas être retiré** après création, et **le type d'app ne peut pas être
   changé**. Une app créée avec le mauvais use case est **définitivement inutilisable** → il faut
   la supprimer et en recréer une.
3. Une app peut **sans use case** (App ID seul), mais elle n'a **aucune permission, aucun
   produit** : inutile ici.
4. Dans l'assistant, les use cases **incompatibles avec votre sélection sont grisés** : c'est un
   contrôle de cohérence, pas un bug.

> **Conséquence directe** : l'app #1 créée le 26/09/2026 avec le use case « Facebook Login »
> est **inutilisable** (aucune permission `pages_*`, `ads_*`, `business_management`).
> Elle sera supprimée à l'**étape 12**, une fois l'app #2 opérationnelle.

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

### Plan B — si « Gérer tout sur votre Page » n'est pas proposé à la création

Le use case peut être **ajouté après la création** depuis l'app (*Use cases* dans le menu de
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

### Récapitulatif : les 7 scopes que le CRM demandera à l'utilisateur

`pages_show_list`, `pages_manage_posts`, `pages_read_engagement`, `read_insights`,
`ads_management`, `ads_read`, `business_management`
→ tous couverts par les 2 use cases + les 3 ajouts ci-dessus. **Ne rien demander d'autre.**

### Business Portfolio + comptes publicitaires (dans le même écran)

Sur le use case Marketing API → section **Business** : portfolio connecté + **ajouter au moins un
compte publicitaire** (identifiant `act_…`). Pour un test sans argent : créer un
**compte publicitaire sandbox** (bouton *Create* de la fenêtre popup) — aucune carte bancaire,
les pubs créées ne partent pas.

## Étape 5 — Enregistrer l'URI de redirection (le réglage le plus souvent raté)

1. Menu de gauche → **Facebook Login for Business** (le produit a été ajouté automatiquement)
   → **Settings**.
2. Champ **Valid OAuth Redirect URIs** → coller **exactement** :

```
https://mayela-crm.vercel.app/mayela-crm.html
```

3. **Save changes**.

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

## Étape 8 — Ajouter les rôles (indispensable pour ne pas attendre la revue)

**App settings → Roles → Add People** :

- le **compte Facebook de la pharmacie** (celui qui est admin de la Page et des comptes pub)
  → rôle **Administrator** (ou *Tester* pour un accès en lecture seule) ;
- les comptes de l'agence en **Developer** / **Tester**.

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

## Étape 12 — Supprimer l'app #1

Une fois l'app #2 **testée** (une Page connectée + une campagne lue) : supprimer l'app #1
(paramètres de l'app → **Delete App**). Elle est inutilisable et fausse la liste « My Apps ».

## Étape 13 — Brancher l'app dans le CRM (par espace client)

1. **Réseaux sociaux → Page Facebook → « Configurer la connexion »**.
2. Coller **App ID** + **App Secret** → **Se connecter à Facebook**.
3. Facebook demande l'autorisation : se connecter avec le compte **admin de la Page** et
   approuver les permissions.
4. Retour dans le CRM : la carte affiche **« Connecté »** avec le nom de la Page.
5. **Publier une offre de test** (écran *Publier du contenu*) → elle doit apparaître sur la Page.
6. **Analyse d'audience** → vérifier abonnés / portée / villes / âge+genre.
7. **Analyse publicitaire (Meta Ads Manager) → « Se connecter à l'analyse publicitaire »** →
   **« Relever les campagnes (30 j) »** → puis écran **🛠️ Gérer mes campagnes Meta Ads**
   (pause/reprise + budget).

> **Ré-autorisation obligatoire** si des permissions ont été ajoutées *après* une première
> connexion : le token existant ne les contient pas. Re-cliquer **« Se connecter à Facebook »**
> puis **« Se connecter à l'analyse publicitaire »** (le CRM gère le refresh, ~60 jours).
>
> Si aucun compte publicitaire n'apparaît : le compte connecté doit être
> **administrateur d'un compte Ads Manager** dans le Business Portfolio rattaché à l'app.

---

## Erreurs fréquentes → cause

| Symptôme | Cause | Correction |
|---|---|---|
| `redirect_uri` / *redirect_uri mismatch* | URI enregistrée ≠ celle du CRM (slash final, `index.html`, `http`) | recoller `https://mayela-crm.vercel.app/mayela-crm.html` à l'identique |
| « App In Development » sur l'écran Meta | le compte connecté n'est pas **rôle** de l'app | étape 8 (Add People) |
| Les permissions `pages_*` / `ads_*` n'existent pas dans le portail | mauvais use case à la création (irréversible) | supprimer l'app, recommencer à l'étape 2 |
| Aucune Page listée | le compte connecté n'est pas admin de la Page | utiliser le compte admin de la Page |
| Aucun compte publicitaire listé | compte pub non rattaché au portfolio de l'app, ou compte connecté sans droits dessus | étape 4 (portfolio + `act_…`) |
| `ads_*` refusées / 403 | app non publiée ou Standard Access non approuvé | étapes 10-11 |
| Budgets en USD/EUR et non en FCFA | devise du **compte publicitaire** | normal, non corrigeable côté CRM |

---

*Document mis à jour le 27/09/2026 — flow « use cases » Meta 2026, vérifié sur la doc Meta
(Create an App · Pages API Use Case · Marketing API Use Cases) et sur les scopes réellement
envoyés par l'app CRM.*
