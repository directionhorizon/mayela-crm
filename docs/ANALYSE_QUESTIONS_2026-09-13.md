# MAYELA CRM — Réponses aux 7 questions d'analyse
*Document d'analyse (13 septembre 2026) — aucune modification d'application n'accompagne ce document.*

Références : `mayela-crm.html` (les numéros de ligne désignent ce fichier), `supabase/functions/*` (Edge Functions). Numérotation re-numérotée proprement (la question « Conseiller » était numérotée 3 comme la barre de menu) :

| N° | Question |
|----|----------|
| 1 | Page de connexion au démarrage |
| 2 | Logique de classification des segments |
| 3 | Barre de menu au « deuxième allumage » |
| 4 | Conseiller : défilement bloqué |
| 5 | « Publier une offre » vs « Nouvelle campagne » |
| 6 | Place de l'analyse d'audience |
| 7 | Place de l'impact opérationnel |
| 8 | API / intégrations à implémenter |

---

## 1 — Pourquoi la page de connexion s'affiche toujours au début puis disparaît seule ?

**CORRIGÉ le 13/09/2026 — un splash logo est maintenant affiché par défaut.**

Ce qui est en place désormais :

- Dans le HTML, l'écran `#splash` (logo centré) porte **la classe `active` par défaut** (l.339) ; `#authEmail` (connexion) ne la porte plus (l.346). Le shell de l'app `#appShell` — qui contient tout le menu et les écrans — reste masqué par `hidden` (l.421).
- Au chargement, `boot()` (l.1150) appelle `sb.auth.getSession()` : si une session existe, il enchaîne `afterLogin()` (l.1258) puis `afterPinOk()` (l.1348) qui démasque `#appShell` et affiche le tableau de bord.
- L'utilisateur connecté voit donc **splash (logo) → app**, sans flash de login. La page de connexion n'apparaît que si aucune session n'est trouvée (`showScreen('authEmail')`).

## 2 — Logique de classification des segments (Centre d'action)

La classification vit dans `renderCentreAction()` (l.2564+). Elle est **recalculée à chaque ouverture de l'accueil** à partir de `clientsCache`, des achats (cache partagé) et des produits — elle n'est **pas persistée**.

Les seuils sont **fixes** : 30 jours et 45 jours.

| Segment | Règle exacte | Source |
|---|---|---|
| 🆕 **Nouveaux** | Client créé il y a **≤ 30 j** (`clients.created_at ≥ date−30 j`) | l.2608 |
| 🔁 **Réguliers** | **Au moins 2 achats** ET **dernier achat ≤ 45 j** | l.2611 |
| ⏳ **Inactifs** | A acheté mais **dernier achat > 45 j**, OU n'a **jamais acheté** et n'est pas « nouveau » (créé il y a > 30 j) | l.2612 |
| 🏷️ **Intérêt catégorie** | Catégorie de produit la plus achetée, classée par **nombre d'acheteurs distincts** | l.2613, 2620-21 |

Détails complémentaires :
- **Consentement** : compté uniquement pour le segment « Inactifs » (`x consentent / y`) ; le lien de relance WhatsApp n'est généré que si `consentement !== false` (l.2615, 2619).
- **Relances prioritaires** : les inactifs triés de la plus ancienne activité à la plus récente, **top 6**, avec lien `wa.me` pré-rempli (l.2623-2640).
- **« À traiter »** (liste du haut) : interactions dont `statut_traitement = 'en_attente'` (messages/clics/demandes prix non traités), triées de la plus ancienne à la plus récente (l.2565-2587).

**Ligne de conduite actuelle** : la classification est purement **descriptive** (cartes d'information). Rien n'est automatisé à partir d'elle (pas de création de tâche de relance, pas de rappel). C'est volontaire : c'est une brique d'aide à la décision.

---

## 3 — Pourquoi la barre de menu ne s'affiche qu'au « deuxième allumage » ?

**CORRIGÉ avec la question 1.** Le splash `#splash` (l.339) est affiché par défaut, puis la bascule se fait vers `#authEmail` (aucune session) **ou** `#appShell` (session présente). La barre de menu (`nav-btn`, l.1019-1024) n'est démasquée que lorsque `#appShell` sort de `hidden` — directement après le splash, sans flash de connexion.

Concrètement :
- **1er allumage après installation** : aucune session locale → après le splash, l'app **reste sur la page de connexion**. Dès que vous vous connectez, le shell s'affiche et le menu apparaît.
- **Allumages suivants** : session restaurée → **splash → shell directement**, le menu est disponible tout de suite.

Le code revendiquait déjà l'intention — « Accès direct à l'app : le verrou PIN est volontairement ignoré à l'ouverture pour entrer instantanément. La barre de navigation en bas est alors immédiatement disponible » (l.1305-1307). L'expérience réelle (splash neutre puis app) correspond maintenant à cette intention.

---

## 4 — Pourquoi la discussion du Conseiller défile mais la barre reste bloquée ?

L'app possède une **barre de défilement « custom »** (molette iOS, `#sbWrap`/`#sbThumb`, l.974-1033) car la barre native est masquée (`scrollbar-width:none`, l.278). C'est elle qui ne suit pas le mouvement.

- `updateSb()` (l.974-987) calcule la position du pouce à partir du `scrollTop` de `document.querySelector('.screen.active')` (l.977 et l.986) — c'est-à-dire **de l'écran entier**.
- Sur l'écran Conseiller, le conteneur qui défile réellement n'est **pas** `.screen`, mais **`#iaChatLog`** (CSS l.278 : `overflow-y:auto ; flex:1 ; min-height:0`). La conversation défile **à l'intérieur** de `#iaChatLog`, tandis que `.screen.active` garde `scrollTop = 0`.
- Résultat : la molette custom reste à zéro (« bloquée ») alors que le contenu se déplace ; et comme la barre native est masquée, l'utilisateur n'a **aucun** indicateur de position.

**Origine** : `updateSb()` suppose qu'il n'y a qu'un seul défileur possible (l'écran), or le Conseiller a un **sous-défileur** interne.

**Correctifs possibles (non faits)** :
1. Faire travailler `updateSb()` sur **l'élément qui a réellement défilé** (utiliser la cible de l'événement `scroll` en capture, l.988) au lieu de `.screen.active`.
2. Simplifier le CSS : laisser `#iaChatLog` s'étendre dans `.screen` (sans `overflow` interne) et **n'autoriser qu'un seul défileur** par écran.
3. Ré-afficher la barre native `#iaChatLog` (retirer `scrollbar-width:none`) — le plus simple.

Le défilement automatique vers le bas, lui, fonctionne (`iaScrollToBottom` cible bien `#iaChatLog` l.3049-3051) : c'est uniquement l'**indicateur visuel** (molette custom) qui est décarré.

---

## 5 — « Publier une offre » vs « Nouvelle campagne » : commentaire et recommandation

Ce sont **deux objets différents** qui semblent faire double emploi parce qu'ils vivent tous les deux dans l'écran Réseaux.

| | **Publier une offre** (l.665-687) | **NOUVELLE CAMPAGNE** (sous-page, l.714+) |
|---|---|---|
| Nature | **Création de contenu** à publier | **Enregistrement de la performance pub** |
| Ce qu'on saisit | Texte d'offre + produit + événement TikTok optionnel + image | Nom, plateforme, type, dates, budget, **dépense réelle, portée, impressions, clics** |
| Ce que ça fait | Envoie le post via `social-publish` (si TikTok connecté), sinon fallback manuel (copier texte / télécharger image, l.680-684) | Alimente les rapports Performance, Entonnoir, **CA attribué et ROAS** |
| Nature de la donnée | `social_posts` (publié) | `campaigns` (dépense) |

- « Publier une offre » = **communication organique** : poster une promo, suivre l'événement sur le pixel TikTok.
- « Nouvelle campagne » = **pilotage publicitaire** : ce qu'on lit dans Meta/TikTok Ads Manager, pour mesurer coût/prospect et rentabilité.

**Recommandation : garder les deux**, mais lever la confusion dans l'interface :
1. Renommer/regrouper visuellement : « Publier du contenu » (bâtir la marque) vs « Campagnes publicitaires » (dépenser + mesurer).
2. Ne pas fusionner : supprimer « Publier une offre » ferait perdre **toute capacité de publication** (le pont entre le CRM et les réseaux). En revanche, à votre échelle d'usage, **la campagne est la brique à valeur** (elle alimente ROAS/entonnoir) : la publication doit donc rester secondaire, pas prioritaire.
3. Connecter les deux là où c'est naturel : rattacher un post publié à une campagne (optionnel) facilitera plus tard les rapports « contenu → vente ».

---

## 6 — Analyse d'audience : Réseaux ou Rapports ?

**Aujourd'hui : Réseaux** (l.694-699). Le bouton « Analyser mon audience » appelle l'Edge Function `social-insights`, qui interroge **en direct** Meta Graph API (abonnés, portée/impressions 28 j, villes, âge+genre) et TikTok (compteur de base). **Prérequis : un compte connecté.**

Analyse :
- C'est une **télémesure du compte connecté**, pas un KPI métier de l'espace. Elle n'a de sens que là où l'on **gère les connexions** et voit leur état (sinon, elle affiche « Connectez votre Page… »).
- Les rapports, eux, sont pensés « période + dimension + exportable » (synthèse textuelle + tableaux + Google Sheets, l.3781+). Or l'audience live est **figée sur des fenêtres API** (28 j Meta) et ne se croise pas avec la période choisie → elle s'exporte mal.

**Recommandation : laisser en Réseaux.** La seule chose à prévoir dans Rapports est un bloc **« Portée / Impressions par campagne »** — mais issu de la saisie campagnes (ou de la future auto-sync V2), c'est-à-dire une donnée pilotable par période et exportable. C'est lui, pas l'audience API brute, qui a sa place dans Rapports.

---

## 7 — Impact opérationnel : Réseaux ou Rapports ?

**Aujourd'hui : Réseaux** (l.704-707). `loadOperationalImpact()` (l.1589+) calcule des **KPIs internes** dérivés du CRM : offres publiées (comptes `social_posts`), échanges enregistrés (interactions), clients suivis, achats 30 j, répartition par canal. Le code le dit lui-même : il « remplace les statistiques réseaux non disponibles ».

Analyse :
- C'est **par nature un rapport**, pas une fonctionnalité de réseau : il n'a **aucun prérequis de connexion**, se calcule sur vos propres données et se croise naturellement avec les autres catégories (achats, interactions, clients).
- Dans Réseaux, il est « caché » sous l'angle comptes/publier ; il exceptionne la logique de l'écran (qui est : comptes, santé, publications).

**Recommandation : le déplacer dans Rapports** comme nouvelle catégorie « Impact opérationnel » (avec le sélecteur de période et l'export, comme les autres). 

**Synthèse des deux questions** : *analyse d'audience* → reste en Réseaux (donnée externe liée aux comptes) ; *impact opérationnel* → part en Rapports (donnée interne, format rapport).

---

## 8 — API / intégrations à implémenter par rapport au calibre de l'app

**Déjà en place aujourd'hui :**
- **Auth** : e-mail + code à 6 chiffres (OTP) et Google OAuth (Supabase Auth) ; multi-espaces avec RLS.
- **Base** : Supabase PostgreSQL + RLS multi-org, stockage d'images.
- **Export** : Google Sheets (Edge Function `google-sheets`).
- **Réseaux** : TikTok (Login Kit → publication `social-publish` + événements serveur `tiktok-events`/pixel Purchase/Lead…), Facebook Page (insights `social-insights`), contrôle d'état `social-health`.
- **IA** : Conseiller conversationnel sur les données CRM (Edge Function `ia-conseiller`, moteur **Google Gemini**).
- **PWA** : service worker (offline + mise à jour).

**Recommandation (par ordre de ROI pour un CRM petite pharmacie/parapharmacie, mobile, plan Free) :**

| # | Intégration | Pourquoi | Effort | Priorité |
|---|------------|----------|--------|----------|
| 1 | **WhatsApp Business (Cloud API)** | Le cœur de votre centre d'action est la **relance WhatsApp** (aujourd'hui des liens `wa.me` sans suivi). Avec l'API : templates de relance certifiés, statut de livraison, réponses centralisées dans la fiche client. | Moyen (Meta Business + modération templates) | 🔥 Haute |
| 2 | **Meta Pages / Marketing API — auto-sync campagnes (V2)** | Supprime la saisie manuelle dépense/portée/impressions/clics et alimente Performance / Entonnoir / ROAS automatiquement. Déjà prévue comme V2 dans le plan. | Moyen | 🔥 Haute |
| 3 | **TikTok Marketing API (`report/integrated/get`)** | Comble le manque de remontée réelle des métriques TikTok (le point faible actuel, noté dans le plan). | Moyen | Haute |
| 4 | **Notifications push PWA (Notification API + VAPID)** | Relances dues, demandes en attente, tâches : rappelle l'équipe sans ouvrir l'app. Léger et gratuit. | Faible | Haute |
| 5 | **Google Sheets / Drive bidirectionnel** | Import de clients en masse (avec déduplication) pour faciliter la migration ; aujourd'hui seul l'export existe. | Faible-Moyen | Moyenne |
| 6 | **Mobile Money (MTN MoMo / Airtel MoMo)** | Clôturer la boucle « créance → payée » au moment de l'encaissement. Forte valeur si pertinente pour votre marché, mais lourde (approbation commerçant + intégration paiement). | Élevé | À planifier à part |
| 7 | **SMS (envoi transactionnel/relance)** | Uniquement si le canal WhatsApp est bloquant (clientèle sans smartphone). | Faible | Basse (optionnel) |

**À NE PAS faire maintenant** (au-delà du calibre) : CRM tiers, marketing automation lourd, tableaux analytics temps réel, à moins de croissance nette. Le trio qui maximise le rapport valeur/effort : **WhatsApp Cloud API + push PWA + auto-sync Meta Ads (V2)**.

---

*Fin du document. Questions posées par l'utilisateur ; réponses factuelles fondées sur le code. Les « correctifs possibles » cités sont des pistes, aucune modification n'a été appliquée.*