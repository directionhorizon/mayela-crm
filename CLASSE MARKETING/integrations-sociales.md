# Intégrations sociales

**Vérifié le 29 septembre 2026.** Code : `startFbAuth`, `startFbAdsAuth`, `completeFbAuth`, `completeFbAdsAuth`, `startTiktokAuth`, Edge Functions `social-facebook` et `social-tiktok`.

---

## En clair

MAYELA CRM peut se connecter à **Facebook** et **TikTok** pour publier du contenu et récupérer vos campagnes publicitaires.

**Le point le plus important à comprendre** : Facebook demande **deux autorisations séparées**, et ce ne sont pas les mêmes.

| Autorisation | Ce qu'elle permet | Statut Meta |
|---|---|---|
| **📄 Page Facebook** | publier des offres sur votre page | accessible immédiatement |
| **📊 Analyse publicitaire** | lire vos campagnes et vos dépenses | **nécessite une validation par Meta** |

**Conséquence pratique** : si Meta refuse ou retarde la validation publicitaire, **tout le reste fonctionne** — la page, les publications, les rapports, le suivi des ventes. L'analyse publicitaire est un plus, pas un prérequis.

**La même logique s'applique à TikTok**, qui distingue lui aussi l'autorisation de publication de l'autorisation publicitaire.

---

## Où trouver ces boutons

**Dans l'écran Réseaux sociaux**, pas dans les réglages.

1. Ouvrez **Réseaux sociaux** dans le menu.
2. Faites défiler jusqu'à la carte Facebook.
3. Vous voyez votre App ID et votre App Secret à saisir.
4. En dessous, deux boutons distincts :
   - **🔗 Connecter la page** (autorisation Page) ;
   - **📊 Autoriser l'analyse publicitaire** (autorisation Ads).

Les deux sont visibles séparément. Si l'un réussit et l'autre échoue, c'est normal : **ils sont indépendants**.

---

## Pourquoi Facebook demande deux autorisations

Meta classe les permissions par niveau de risque :

- **Lire et publier sur une page** : risque faible, autorisé immédiatement à un compte qui possède la page.
- **Lire les comptes publicitaires, les dépenses, les audiences** : risque élevé, car ces données touchent aux finances. Meta exige que l'application soit examinée avant d'accorder ces permissions.

C'est pour cette raison que les deux flux sont séparés dans le code. Avant cette séparation, une seule demande regroupait tout, et **le refus d'une seule permission faisait échouer l'autorisation entière** — vous perdiez l'accès à la page à cause d'une demande publicitaire.

---

## Ce que chaque autorisation donne accès

### Autorisation Page (Facebook)

| Accessible | Non accessible |
|---|---|
| Voir vos pages | Vos comptes publicitaires |
| Publier des offres | Vos dépenses |
| Lire les statistiques de base | Vos audiences publicitaires |

### Autorisation publicitaire (Facebook)

| Accessible |
|---|
| Liste de vos comptes publicitaires |
| Campagnes, ensembles de pubs, dépenses, impressions, clics |
| Synchronisation quotidienne vers l'historique |

### Autorisation de publication (TikTok)

| Accessible |
|---|
| Informations de base du compte |
| Publication de vidéos |

### Autorisation publicitaire (TikTok)

| Accessible |
|---|
| Liste de vos comptes publicitaires |
| Campagnes, groupes d'annonces, dépenses |
| Leads et audiences |

---

## ⚠️ Deux limites à connaître

**1. Tous les comptes accessibles sont importés.**
Lors d'une autorisation publicitaire, l'application récupère **tous** les comptes publicitaires accessibles depuis le profil Facebook ou TikTok qui a autorisé. Il n'existe **pas encore de sélecteur** pour choisir lequel importer.

→ Si votre profil donne accès à plusieurs comptes, ils seront tous ajoutés. Pour l'instant, la seule façon de contrôler ce que vous importez est donc de **choisir avec quel profil vous autorisez l'application**. C'est un point connu, non résolu.

**2. Les autorisations sont liées à un espace.**
Chaque espace a ses propres comptes connectés. Si vous changez d'espace, vous devez reconnecter les comptes dans cet espace : rien n'est partagé automatiquement.

---

## Les identifiants de l'application

Pour que la connexion fonctionne, deux valeurs doivent être saisies dans l'écran Réseaux sociaux :

| Champ | Ce que c'est |
|---|---|
| **App ID** | l'identifiant public de votre application Meta |
| **App Secret** | la clé secrète de l'application |

Ces valeurs viennent de votre compte développeur Meta ou TikTok. **Elles ne sont jamais partagées avec un espace** : elles sont stockées par espace et ne sont jamais renvoyées au navigateur une fois enregistrées.

---

## Détail technique

### Les permissions demandées

**Facebook — Page :**
```
pages_show_list
pages_manage_posts
pages_read_engagement
read_insights
```

**Facebook — Ads :**
```
ads_read
ads_management
business_management
```

**TikTok — Publication :**
```
user.info.basic
video.publish
```

**TikTok — Publicité :**
Les permissions Marketing API demandées sont listées dans le guide client `docs/TIKTOK_MARKETING_API_SETUP_CLIENT.md`.

### Les actions de l'Edge Function `social-facebook`

| Action | Rôle |
|---|---|
| `save_app` | enregistre l'App ID et l'App Secret |
| `exchange` | échange le code renvoyé par Meta et récupère la liste des pages |
| `refresh` | rafraîchit les informations de la page connectée |
| `exchange_ads` | échange le code renvoyé par Meta et récupère la liste des comptes publicitaires |
| `ads_connect` | enregistre le compte publicitaire retenu et lance la première synchronisation |
| `ads_campaigns_get` | liste les campagnes du compte |
| `ads_campaign_status` | met en pause ou reprend une campagne |
| `ads_campaign_update` | modifie le budget d'une campagne |
| `ads_adgroups_get` | ensembles de pubs d'une campagne |
| `ads_adgroup_update` | modifie le budget d'un ensemble |
| `ads_adgroup_status` | met en pause ou reprend un ensemble |

**L'URL d'autorisation n'est pas une action de la fonction.** Elle est construite par le navigateur
(`startFbAuth` pour la Page, `startFbAdsAuth` pour la publicité), qui ouvre une fenêtre Meta avec
l'App ID et les permissions voulues. Le code de retour est ensuite envoyé à `exchange` ou
`exchange_ads`. C'est ce qui permet de séparer les deux fenêtres : la Page et la publicité ne sont
jamais demandées dans la même autorisation.

`save_app` **fusionne** avec la configuration existante : enregistrer l'App ID ne supprime pas les comptes déjà connectés.

### Le stockage

Les jetons sont stockés dans la table `social_accounts`, colonne `config`, qui est un objet JSON. Une liste de clés sensibles est **retirée** de tout objet renvoyé au navigateur : `client_secret`, `access_token`, `refresh_token`, `open_id`, `page_id`, `pixel_access_token`, et les tokens Adjust.

Le navigateur ne reçoit jamais ces valeurs : il reçoit uniquement un indicateur de connexion.

### Le callback

Le retour d'autorisation est géré par `completeFbAuth` (Page) et `completeFbAdsAuth` (Ads). Le second utilise un état `fbm_state` pour retrouver le contexte pendant l'échange — ce qui évite qu'un retour d'autorisation Ads soit interprété comme une autorisation de Page.

### La synchronisation publicitaire

Lors d'une synchronisation, l'application récupère l'historique de dépense jour par jour et l'écrit dans `campaign_spend_daily` (voir [Campagnes publicitaires](campagnes-publicitaires.md)). C'est ce qui permet un ROAS calculé sur la bonne période.

---

## Pour aller plus loin

| Je veux… | Je lis |
|---|---|
| Connecter Facebook | `docs/FACEBOOK_META_SETUP_CLIENT.md` |
| Connecter TikTok | `docs/TIKTOK_MARKETING_API_SETUP_CLIENT.md` |
| Comprendre ce que récupère la synchronisation | [Suivi de la publicité](suivi-publicite-meta-tiktok.md) |
| Comprendre le cloisonnement par espace | [Espaces et accès](espaces-et-acces.md) |
