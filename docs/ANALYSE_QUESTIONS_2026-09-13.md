# MAYELA CRM — Réponses aux 8 questions d'analyse

> **Questions posées le 13 septembre 2026. Réponses vérifiées et mises à jour le 29 septembre 2026.**
> Les références pointent vers des **noms de fonctions**, pas vers des numéros de ligne : le fichier principal dépasse 5 800 lignes et les positions changent à chaque évolution.

## En clair

Ce document garde les 8 questions qui ont été posées sur l'application, et y répond **en l'état du 29 septembre 2026**. Plusieurs réponses ont changé depuis : c'est signalé explicitement dans chaque section.

| N° | Question | État de la réponse |
|----|----------|--------------------|
| 1 | Page de connexion au démarrage |inchangée |
| 2 | Logique de classification des segments | inchangée |
| 3 | Barre de menu au « deuxième allumage » | inchangée |
| 4 | Conseiller : défilement bloqué | inchangée |
| 5 | « Publier une offre » vs « Nouvelle campagne » | clarifiée dans l'interface |
| 6 | Place de l'analyse d'audience | tranchée : reste dans Réseaux |
| 7 | Place de l'impact opérationnel | **appliquée** : déplacé dans Rapports |
| 8 | API / intégrations à implémenter | **fortement avancé** : 2 des 3 principales sont faites |

---

## 1 — Pourquoi la page de connexion s'affiche au début, puis disparaît seule ?

**En clair** : c'est un écran d'accueil (splash) qui cède la place. Ce n'est pas un bug.

**Détail technique.** L'écran `#splash` — le logo centré — porte la classe `active` par défaut dans le balisage, tandis que l'écran de connexion `#authEmail` ne la porte pas. Le conteneur principal `#appShell`, qui contient le menu et tous les écrans, reste masqué.

`boot()` appelle `sb.auth.getSession()` :
- **session existante** → `afterLogin()`, puis `afterPinOk()` démasquent `#appShell` et affichent le tableau de bord ;
- **aucune session** → `showScreen('authEmail')` affiche la page de connexion.

Un utilisateur déjà connecté voit donc **logo → application**, sans apparition fugace du formulaire de connexion.

---

## 2 — Logique de classification des segments (Centre d'action)

**En clair** : les segments sont des **cartes d'information**, recalculées à chaque ouverture de l'accueil. Rien n'est déclenché automatiquement à partir d'eux — c'est un choix délibéré : c'est une aide à la décision, pas une machine à envoyer des messages.

**Détail technique.** La classification vit dans `renderCentreAction()`. Elle est recalculée à partir du cache des clients, des achats et des produits. **Elle n'est pas persistée** en base.

Les seuils sont **fixes** : 30 jours et 45 jours.

| Segment | Règle exacte |
|---|---|
| 🆕 **Nouveaux** | client créé il y a 30 jours ou moins |
| 🔁 **Réguliers** | au moins 2 achats **et** dernier achat il y a 45 jours ou moins |
| ⏳ **Inactifs** | a acheté mais dernier achat > 45 jours, **ou** n'a jamais acheté et n'est pas nouveau |
| 🏷️ **Intérêt catégorie** | catégorie de produit la plus achetée, classée par nombre d'acheteurs distincts |

Précisions :
- **Consentement** : compté uniquement pour le segment « Inactifs ». Le lien de relance WhatsApp n'est généré que si le consentement n'est pas explicitement refusé.
- **Relances prioritaires** : les inactifs, de la plus ancienne à la plus récente activité, **limités à 6**, avec lien `wa.me` pré-rempli.
- **« À traiter »** : interactions dont `statut_traitement` vaut `en_attente` (messages, clics, demandes de prix non traités), de la plus ancienne à la plus récente.

---

## 3 — Pourquoi la barre de menu ne s'affiche-t qu'au « deuxième allumage » ?

**En clair** : c'est le comportement attendu, et il est voulu. Le premier allumage sert à vous connecter ; les suivants vont directement à l'application.

**Détail technique.** La barre de menu n'est démasquée qu'au moment où `#appShell` sort de l'état `hidden`, c'est-à-dire après le splash.

`boot()` démasque le shell dès qu'une **session locale** est présente, **avant** toute requête réseau (`getUser`, `profiles`). Le menu ne dépend donc plus du temps de chargement : le shell s'affiche, puis les données se chargent en arrière-plan via `afterLogin()`.

Deux cas sont protégés :
- **compte sans espace** → `afterPinOk()` remasque le shell et dirige vers l'onboarding ;
- **session locale invalide** → retour à l'écran de connexion.

Concrètement :
- **1er allumage après installation** : aucune session → splash, puis page de connexion. Le menu apparaît dès que vous êtes connecté.
- **allumages suivants** : session restaurée → splash, puis application, menu disponible immédiatement.

Le code revendique cette intention : « Accès direct à l'app : le verrou PIN est volontairement ignoré à l'ouverture pour entrer instantanément. La barre de navigation en bas est alors immédiatement disponible. »

---

## 4 — Pourquoi la discussion du Conseiller défile, mais la barre reste bloquée ?

**En clair** : c'était un bug de ciblage, corrigé. La zone défilante à piloter n'était pas toujours la même selon l'écran.

**Détail technique.** La barre de défilement custom (`#sbWrap` / `#sbThumb`) suivait `.screen.active`. Or, sur l'écran Conseiller, le défilement réel se produit dans un **sous-conteneur** — `#iaChatLog`, `#iaEmpty` ou `#iaHistoryList` — et non dans l'écran. Le pouce restait donc figé pendant que le contenu bougeait.

Le correctif introduit `sbScroller()`, qui renvoie l'élément qui défile réellement :
- écran normal → `.screen.active`, comportement inchangé ;
- écran Conseiller → `#iaChatLog` si une conversation est affichée et défilable, sinon `#iaEmpty`, sinon `#iaHistoryList` si le panneau historique est ouvert.

`updateSb()`, le glisser au pointeur et les `ResizeObserver` utilisent désormais `sbScroller()`. Aucun changement CSS : un seul conteneur défilant reste présent par vue.

---

## 5 — « Publier une offre » vs « Nouvelle campagne » : que faire ?

**En clair** : ce sont deux objets différents qui semblaient faire double emploi parce qu'ils vivaient au même endroit. L'interface a été clarifiée, **et les deux sont conservés**.

| | **Publier du contenu** | **Campagnes publicitaires** |
|---|---|---|
| Nature | création de contenu | enregistrement de la performance publicitaire |
| Ce qu'on saisit | texte, produit, événement TikTok optionnel, image | nom, plateforme, type, dates, budget, dépense, portée, impressions, clics |
| Ce que ça fait | envoie le post, ou prépare le post à copier manuellement | alimente Performance, Entonnoir, CA attribué et ROAS |
| Table | `social_posts` | `campaigns` |

- **Publier du contenu** = communication organique : poster une promotion, mesurer l'événement sur le pixel.
- **Campagnes publicitaires** = pilotage publicitaire : ce qu'on lit dans Meta ou TikTok Ads Manager, pour mesurer coût, prospect et rentabilité.

**Décision appliquée le 13/09/2026** : les deux sont conservés, l'interface est clarifiée.
- Le bloc s'appelle **« Publier du contenu »**, avec un sous-titre explicite.
- Les campagnes sont accessibles par un bouton dédié **« 📊 Campagnes publicitaires — saisir & mesurer »**, qui ouvre une sous-page titrée « Enregistrer une campagne », avec un rappel « ≠ Publier du contenu ».
- **Non fait, pour plus tard** : rattacher une publication à une campagne, pour mesurer l'effet « contenu → vente ».

**Depuis le 13/09** : la saisie manuelle n'est plus la seule voie. Les campagnes sont désormais **synchronisées automatiquement** depuis Meta Ads et TikTok Marketing API. Voir `CLASSE MARKETING/suivi-publicite-meta-tiktok.md`.

---

## 6 — Analyse d'audience : dans Réseaux ou dans Rapports ?

**En clair** : la décision a été de la **laisser dans Réseaux**.

**Détail technique.** Le bouton « Analyser mon audience » appelle l'Edge Function `social-insights`, qui interroge en direct la Meta Graph API (abonnés, portée et impressions sur 28 jours, villes, âge et genre) ainsi que TikTok (compteurs de base). Un compte connecté est obligatoire.

Raisons de ce choix :
- c'est une **télémesure du compte connecté**, pas un indicateur métier de l'espace ; elle n'a de sens que là où sont gérées les connexions et où l'on voit leur état ;
- les rapports sont conçus « période + dimension + exportable », alors que l'audience en direct est **figée sur des fenêtres imposées par les API** (28 jours côté Meta) et ne se croise pas avec la période choisie. Elle s'exporte mal.

**Ce qu'il faudrait prévoir dans Rapports**, ce n'est pas l'audience brute, mais un bloc « Portée / Impressions par campagne », issu de la synchronisation des campagnes : une donnée pilotable par période et exportable. C'est lui qui aurait sa place dans les rapports, pas les chiffres bruts des plateformes.

---

## 7 — Impact opérationnel : dans Réseaux ou dans Rapports ?

**En clair** : la décision a été **appliquée** — il est passé dans les Rapports.

**Détail technique.** `loadOperationalImpact()` calculait des indicateurs internes au CRM : offres publiées, échanges enregistrés, clients suivis, achats sur 30 jours, répartition par canal. Le code précisait lui-même qu'il « remplace les statistiques réseaux non disponibles ».

Le raisonnement : c'est **par nature un rapport**, pas une fonctionnalité de réseau. Il n'a aucun prérequis de connexion, se calcule sur vos propres données, et se croise naturellement avec les autres catégories.

**Décision appliquée le 13/09/2026** : la catégorie `impact` a été ajoutée aux Rapports (option de sélection, lignes de tableau, synthèse textuelle, libellé). La section « Impact opérationnel » a été retirée de l'écran Réseaux, et `loadOperationalImpact()` supprimée. Les indicateurs sont désormais calculés **sur la période choisie** et s'exportent en Google Sheets et PDF comme les autres catégories.

**Synthèse des questions 6 et 7** : l'analyse d'audience reste dans Réseaux, car c'est une donnée externe liée aux comptes ; l'impact opérationnel est parti dans Rapports, car c'est une donnée interne, au format rapport.

---

## 8 — API et intégrations : où en est-on ?

### Déjà en place

| Domaine | État |
|---|---|
| **Authentification** | e-mail + code à **8 chiffres**, Google OAuth, multi-espaces avec RLS |
| **Session** | **sans limite de durée** (décision du 28/09) |
| **Base** | Supabase PostgreSQL, RLS multi-espaces, stockage d'images |
| **Export** | Google Sheets (Edge Function `google-sheets`) |
| **Facebook** | Login + Page (publication) et **Meta Ads** (campagnes, dépenses), insights via `social-insights`, diagnostic via `social-health` |
| **TikTok** | Login Kit (publication `social-publish`), **Marketing API** (campagnes, dépenses, leads, audiences), événements serveur `tiktok-events` |
| **IA** | Conseiller conversationnel sur les données du CRM (Edge Function `ia-conceiller`, moteur **Google Gemini**) |
| **PWA** | service worker : hors-ligne et mise à jour |

### Ce qui a avancé depuis le 13/09

Les trois recommandations principales du document d'origine ont été traitées :

| Recommandation du 13/09 | État au 29/09 |
|---|---|
| **Meta Marketing API — synchronisation auto des campagnes** | ✅ **Fait** (migration V11, fonction `social-facebook`) |
| **TikTok Marketing API** — remontée des métriques | ✅ **Fait côté code** (migrations V10 et V10.1). ⚠️ **bloqué côté TikTok** : application rejetée à la revue, mise en pause |
| **Séparation des autorisations Meta** | ✅ **Fait** : les permissions Page et Ads sont demandées séparément, pour que le refus de la revue publicitaire ne bloque plus l'accès à la page |

### Ce qui reste à faire

| Intégration | Pourquoi | Effort | Priorité |
|---|---|---|---|
| **WhatsApp Business (Cloud API)** | Le centre d'action repose sur la relance WhatsApp, aujourd'hui par simple lien `wa.me` sans suivi. L'API apporterait des modèles de message certifiés, un statut de livraison et des réponses centralisées dans la fiche client. | Moyen (Meta Business + modération des modèles) | 🔥 Haute |
| **Sélecteur de compte publicitaire** | La synchronisation importe **tous** les comptes accessibles au profil qui a autorisé. Aucun écran ne permet d'en choisir un. | Faible | 🔥 Haute |
| **Notifications push PWA** | Relances dues, demandes en attente, tâches : prévenir l'équipe sans ouvrir l'application. Le service worker existe déjà, seule la couche notification manque. | Faible | Haute |
| **Google Sheets / Drive bidirectionnel** | L'export existe, pas l'import. Un import avec déduplication faciliterait la migration de clients. | Faible-Moyen | Moyenne |
| **Conversion de devises** | Les dépenses publicitaires sont enregistrées dans la devise du compte, les ventes en FCFA, sans conversion. Les ratios sont faussés si les devises diffèrent. | Moyen | Moyenne |
| **Mobile Money (MTN MoMo / Airtel MoMo)** | Clôturer la boucle « créance → payée » au moment de l'encaissement. Forte valeur si le marché s'y prête, mais intégration lourde. | Élevé | À planifier à part |
| **SMS transactionnel** | Uniquement si WhatsApp devient bloquant (clientèle sans smartphone). | Faible | Basse, optionnel |

### À ne pas faire maintenant

Au-delà du calibre de l'application : CRM tiers, automatisation marketing lourde, tableaux analytiques temps réel — sauf si la croissance le justifie clairement.

Le trio qui maximise le rapport valeur/effort reste : **WhatsApp Cloud API + sélecteur de compte publicitaire + notifications push**.

---

## Détail technique — comment ce document est maintenu

- Vérifié contre `mayela-crm.html` et les Edge Functions de `supabase/functions/`.
- Schéma de base défini par les migrations de `config/`, de V1_1 à V15.
- Aucune modification d'application n'est décrite ici comme acquise : lorsqu'une proposition est appliquée, la section indique la décision **et** sa date.
- La documentation marketing correspondante vit dans `CLASSE MARKETING/` ; ce document y renvoie plutôt que de la dupliquer.
