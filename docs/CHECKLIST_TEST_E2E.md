# MAYELA CRM — Checklist de test de bout en bout

> **Réécrite le 29 septembre 2026.** La version précédente datait de juillet et décrivait un état
> de l'application qui n'existe plus : jeu de données de démonstration supprimé, code de connexion
> passé de 6 à 8 chiffres, segments recalculés sur 45 jours au lieu de 15, cloisonnement multi-espaces
> ajouté, intégrations Facebook et TikTok livrées.

## En clair

Cette checklist sert à **vérifier que l'application fonctionne réellement**, avec de vraies données.

**Elle n'a encore jamais été passée intégralement.** C'est le principal chantier ouvert : tous les
mécanismes sont écrits et vérifiés dans le code, mais aucun n'a été confronté à une situation réelle.
L'espace PHARMAZEN ne contient aujourd'hui aucune donnée métier.

**Ordre d'exécution recommandé** : les scénarios 1 à 3 d'abord (sans eux, rien n'est testable), puis
le marketing (4 et 5), puis la sécurité multi-espaces (6), puis les intégrations externes (7).

---

## Préparation

### Ce qu'il faut avant de commencer

| Prérequis | Commentaire |
|---|---|
| Base à jour | Migrations appliquées jusqu'à **V15** |
| Edge Functions déployées | `social-facebook`, `social-tiktok`, `social-publish`, `social-insights`, `social-health`, `tiktok-events`, `google-sheets`, `ia-conseiller` |
| Application servie par HTTP | ❌ **jamais** en `file://` — utiliser Vercel ou un serveur local |
| Un jeu de données de test | ⚠️ **À recréer** : les anciens comptes de test ont été supprimés. Prévoir ~20 clients, ~5 campagnes, des ventes sur plusieurs mois |
| Deux comptes dans deux espaces distincts | Indispensable pour les scénarios 6 |

### Jeu de données minimal recommandé

Pour que les segments et les rapports aient du sens, il faut des **dates variées** :

- 2 clients créés **moins de 30 jours** atrás → segment « Nouveaux » ;
- 3 clients avec **au moins 2 achats**, le dernier il y a **moins de 45 jours** → segment « Réguliers » ;
- 3 clients dont le dernier achat date de **plus de 45 jours**, ou qui n'ont jamais acheté → segment « Inactifs » ;
- des achats **répartis sur 60 jours**, pour que la comparaison de périodes ait un sens ;
- 1 client avec le consentement **explicitement refusé** → vérifie qu'aucun lien de relance n'est proposé.

---

## Scénario 1 — Connexion et création d'espace

**Durée estimée : 5 min** · **Compte** : une adresse e-mail jamais utilisée

| # | Action | Résultat attendu |
|---|---|---|
| 1 | Ouvre l'application | Écran logo, puis écran de connexion |
| 2 | Saisis l'adresse e-mail | Champ rempli, bouton actif |
| 3 | Clique « Recevoir le code » | Message « code envoyé », **pas** d'erreur réseau |
| 4 | Ouvre la boîte mail | Code à **8 chiffres** reçu en moins de 30 secondes |
| 5 | Saisis le code | Accès à l'écran de création du code PIN |
| 6 | Saisis un code à 4 chiffres | Les 4 points se remplissent |
| 7 | Ressaisis ce code | Écran « Votre espace de travail » |
| 8 | Crée un espace au nom unique | Tableau de bord affiché |
| 9 | Regarde les KPI | `Clients actifs : 0`, `À traiter : 0`, `Tâches en retard : 0`, `Ventes du jour : 0`, `Devis (30j) : 0`, `Achats (30j, FCFA) : 0` |

**Conditions de passage**
- [ ] Aucun message d'erreur réseau
- [ ] E-mail reçu en moins de 30 secondes
- [ ] Le code comporte bien **8 chiffres**
- [ ] Le code PIN fonctionne après rechargement de la page
- [ ] Le tableau de bord s'affiche sans erreur

> ⚠️ Ce scénario avait été bloqué jusqu'au 23/09 par une erreur SMTP. Le point a été corrigé, mais
> **ce test n'a pas été refait par l'utilisateur** : c'est le premier à passer.

---

## Scénario 2 — Rejoindre un espace existant

**Durée estimée : 5 min** · **Compte** : une seconde adresse e-mail

| # | Action | Résultat attendu |
|---|---|---|
| 1 | Connexion avec la seconde adresse | Code reçu, puis écran des espaces |
| 2 | Saisis le code d'invitation | Espace rejoint |
| 3 | Crée un code PIN local | Écran verrouillé |
| 4 | Saisis le code PIN | Tableau de bord, **avec les données de l'espace** |
| 5 | Ouvre la liste des clients | Le jeu de données de l'espace est visible |
| 6 | Vérifie un KPI de volume | Le chiffre correspond au contenu réel de l'espace |

**Conditions de passage**
- [ ] Le code d'invitation est accepté
- [ ] Le volume affiché correspond exactement aux données de l'espace
- [ ] Aucune donnée d'un autre espace n'est visible

---

## Scénario 3 — Fiche client complète

**Durée estimée : 8 min** · **Compte** : celui du scénario 1

C'est le cœur métier : à valider en priorité.

### 3a. Création

| # | Action | Résultat attendu |
|---|---|---|
| 1 | Bouton « + » → Nouveau client | Formulaire affiché |
| 2 | Renseigne nom, zone, téléphone, source | Champs remplis |
| 3 | Sélectionne une étape commerciale | Liste déroulante avec les 5 étapes |
| 4 | Choisis une **campagne d'origine** | La liste des campagnes existantes est proposée |
| 5 | Enregistre | Confirmation, fiche refermée |
| 6 | Ouvre la fiche | Nom, zone, téléphone, étape, campagne d'origine corrects |

### 3b. Interactions

| # | Action | Résultat attendu |
|---|---|---|
| 7 | Onglet Interactions, choisis un canal et un type | Les deux champs sont distincts : **canal** (WhatsApp, Facebook, TikTok, appel, visite) et **type** (message, clic, demande de prix) |
| 8 | Saisis une note, valide | Interaction ajoutée |
| 9 | Coche « En attente » | Badge `EN ATTENTE` visible dans la liste |
| 10 | Clique « ✓ Traité » | Le badge disparaît |
| 11 | Vérifie l'accueil | Le KPI « À traiter » a changé de valeur |

### 3c. Achat

| # | Action | Résultat attendu |
|---|---|---|
| 12 | Onglet Achats, montant 50 000, quantité 2 | Les deux champs sont présents |
| 13 | Choisis une date **dans le passé** (ex. 20 jours) et une campagne | Les deux sont acceptés |
| 14 | Valide | Achat créé, la campagne est affichée sur la vente |
| 15 | Ajoute un 2e achat, plus ancien, même client | Le client devient « Régulier » si le dernier achat est < 45 j |

> ⚠️ La **quantité** est un champ du formulaire d'achat. Vérifier qu'elle est bien prise en compte
> dans le panier moyen du rapport « Ventes & CA attribués ».

### 3d. Devis et tâche

| # | Action | Résultat attendu |
|---|---|---|
| 16 | Onglet Devis, montant 200 000, valide | Devis créé |
| 17 | Onglet Tâches, échéance dans 7 jours | Tâche créée, statut « à faire » |
| 18 | Clique « Marquer fait » | Statut bascule, texte barré |
| 19 | Vérifie le KPI « Tâches en retard » | Il réagit à l'échéance |

**Conditions de passage**
- [ ] Le client créé apparaît dans la liste, compteur +1
- [ ] Canal et type d'interaction sont bien deux champs distincts
- [ ] Le consentement refusé **n'apparaît pas** dans les relances prioritaires
- [ ] Une vente liée à une campagne est rattachée à cette campagne

---

## Scénario 4 — Segments, relances et recherche

**Durée estimée : 5 min**

| # | Action | Résultat attendu |
|---|---|---|
| 1 | Accueil → **Segments à relancer** | 4 cartes : Nouveaux, Réguliers, Inactifs, Intérêt catégorie |
| 2 | Vérifie la répartition avec le jeu de données | 2 nouveaux, 3 réguliers, 3 inactifs |
| 3 | **Relances prioritaires** | 6 clients au maximum, triés de la plus ancienne à la plus récente activité |
| 4 | Vérifie le client sans consentement | Aucun lien WhatsApp proposé, mention « sans consentement » |
| 5 | Clique un lien de relance | Ouvre WhatsApp avec le message pré-rempli |
| 6 | **À traiter** | Interactions en attente, triées par ancienneté |
| 7 | Clients → recherche « test » | Filtrage insensible à la casse |
| 8 | Filtre par étape commerciale | Seuls les clients de l'étape choisie s'affichent |
| 9 | Retour à « Tous » | Tous les clients réapparaissent |
| 10 | Change le nombre de clients affichés dans Réglages (hors de 3 à 50) | Message « Entrez un nombre entre 3 et 50. », valeur refusée |

**Seuils à respecter (ils sont fixes dans le code) :**

| Segment | Règle |
|---|---|
| Nouveaux | créé il y a **30 jours** ou moins |
| Réguliers | au moins 2 achats **et** dernier achat il y a **45 jours** ou moins |
| Inactifs | dernier achat > 45 jours, ou n'a jamais acheté et n'est pas nouveau |

**Conditions de passage**
- [ ] Les 3 seuils (30 j / 45 j / 2 achats) se comportent comme décrit
- [ ] La limite de 6 relances prioritaires est respectée
- [ ] Le réglage du nombre de clients refuse les valeurs hors bornes

---

## Scénario 5 — Campagnes, ROAS et rapports

**Durée estimée : 10 min** · **Le plus important pour le pilotage**

| # | Action | Résultat attendu |
|---|---|---|
| 1 | Réseaux → « 📊 Campagnes publicitaires — saisir & mesurer » | La sous-page s'ouvre |
| 2 | Vérifie le rappel « ≠ Publier du contenu » | Présent |
| 3 | Crée une campagne manuelle : nom, plateforme, type, dates, budget, dépense 100 000, portée, impressions, clics | Campagne créée |
| 4 | Associe un prospect à cette campagne | Le champ « Campagne d'origine » est proposé à la création d'un client |
| 5 | Enregistre une vente pour ce client, en lui assignant la campagne | La vente affiche sa campagne d'origine |
| 6 | Rapports → **Campagnes — Ventes & CA attribués** | Ventes, CA attribuable, panier moyen, clients acheteurs |
| 7 | Rapports → **Campagnes — Rentabilité (ROAS)** | Dépense, CA attribuable, ROAS, coût d'acquisition |
| 8 | Rapports → **Campagnes — Entonnoir** | Prospects, contactés, négociation, acheteurs, taux de conversion |
| 9 | Rapports → **Impact opérationnel** | Offres publiées, échanges, achats, clients suivis, répartition par canal |
| 10 | Change la période (7 / 30 / 90 j / historique) et observe le ROAS | **Le ROAS change avec la période** si l'historique de dépense contient plusieurs jours |
| 11 | Retourne à l'accueil → section Performance publicitaire | ROAS affiché **différent** du rapport, car non borné par la période |
| 12 | Exporte un rapport en Google Sheets et en PDF | Les deux fichiers sont produits |

> ⚠️ **L'étape 10 est le test le plus important de toute la checklist.** Elle valide l'intérêt de la
> migration V15. Sans historique de dépense sur plusieurs jours, la dépense de la période vaut zéro
> et le ROAS ne peut pas être validé. C'est aussi le seul moyen de vérifier l'écart connu entre le
> tableau de bord et les rapports.

**Conditions de passage**
- [ ] Une campagne supprimée **conserve** les prospects et les ventes rattachés
- [ ] Le rapport ROAS respecte la période sélectionnée
- [ ] L'écart entre le ROAS de l'accueil et celui du rapport est bien observé
- [ ] L'export Google Sheets fonctionne

---

## Scénario 6 — Cloisonnement multi-espaces et rôles

**Durée estimée : 15 min** · **Scénario de sécurité, à ne pas sauter**

Ce scénario vérifie le point le plus sensible : **les données d'un espace ne doivent jamais apparaître dans un autre.**

| # | Action | Résultat attendu |
|---|---|---|
| 1 | Espace A : crée 5 clients, 1 vente, 1 tâche | Données créées dans l'espace A |
| 2 | Espace B : ouvre la liste des clients | **Les 5 clients de l'espace A sont absents** |
| 3 | Espace B : regarde les KPI | Volumes à zéro |
| 4 | Espace B : tente d'ouvrir une fiche client de l'espace A par son lien direct | **Accès refusé** |
| 5 | Espace B : cherche le nom d'un client de l'espace A dans la recherche | **Aucun résultat** |
| 6 | Invite un second compte dans l'espace A avec le rôle membre | Invitation acceptée |
| 7 | Le second compte se connecte | Voit les 5 clients, **rien de plus** |
| 8 | Le second compte tente d'insérer une ligne pour un autre espace | **Rejeté par la base** |
| 9 | Rôle mono : configure un collaborateur sur **une seule** fiche client | Il ne voit que cette fiche |
| 10 | Bascule A → B → A | Les données de chaque espace sont correctes à chaque affichage |
| 11 | Compte sans espace | Ne voit que l'écran d'accueil, aucune donnée |

**Conditions de passage**
- [ ] Aucune fuite de données entre les espaces, y compris par accès direct à une URL de fiche
- [ ] La base refuse les écritures hors espace, pas seulement l'interface
- [ ] Le rôle mono limite bien l'accès à une seule fiche
- [ ] Après une bascule d'espace, l'analyse d'audience et le diagnostic des intégrations se rechargent pour le nouvel espace, sans afficher les chiffres de l'ancien. Cache corrigé le 29/09 (`insightsOrg`) : ce contrôle est **maintenant attendu au vert**, et non plus toléré en écart connu.

---

## Scénario 7 — Réseaux sociaux

**Durée estimée : 10 min par plateforme** · **Nécessite un compte connecté**

| # | Action | Résultat attendu |
|---|---|---|
| 1 | Réseaux → Facebook | Bloc App ID / App Secret et bouton « Connecter la page » |
| 2 | Clique « Connecter la page » | Redirection Meta, puis retour dans l'application |
| 3 | La carte Facebook indique l'état | « OK », avec la page et la durée de validité du jeton |
| 4 | Clique « Autoriser l'analyse publicitaire » | Demande des permissions `ads_*`. **Un refus Meta n'empêche pas l'étape 3 de rester fonctionnelle** |
| 5 | Réseaux → diagnostic des intégrations | Diagnostic mis à jour, expiration du jeton signalée |
| 6 | Publie une offre avec image | Publication envoyée, statut enregistré |
| 7 | Publie une offre **sans** compte connecté | Les deux boutons « copier le texte » et « télécharger l'image » sont disponibles |
| 8 | Enregistre une vente | Un événement `Purchase` est envoyé à TikTok si un Pixel est configuré |
| 9 | Vérifie que la vente est bien enregistrée | **L'enregistrement ne dépend jamais du suivi** : un échec TikTok ne bloque rien |
| 10 | Compte Facebook ou TikTok supplémentaire | Les deux comptes sont importés : **il n'existe pas de sélecteur**, c'est connu |

**Conditions de passage**
- [ ] Les autorisations Page et Ads sont bien **indépendantes**
- [ ] Le diagnostic indique correctement l'état et l'expiration des jetons
- [ ] La publication et le repli manuel fonctionnent
- [ ] Une vente est enregistrée même si l'envoi d'événement échoue
- [ ] La publication utilise bien le compte de l'**espace actif**

---

## Récapitulatif

| # | Scénario | Statut | Note |
|---|---|---|---|
| 1 | Connexion et création d'espace | ⬜ À tester | Jamais refait depuis la correction SMTP |
| 2 | Rejoindre un espace existant | ⬜ À tester | Vérifie l'invitation |
| 3 | Fiche client complète | ⬜ À tester | **Cœur métier** |
| 4 | Segments, relances, recherche | ⬜ À tester | Seuils 30 j / 45 j |
| 5 | Campagnes, ROAS, rapports | ⬜ À tester | **Le plus important** |
| 6 | Cloisonnement multi-espaces et rôles | ⬜ À tester | **Sécurité** |
| 7 | Réseaux sociaux | ⬜ À tester | Nécessite des comptes connectés |

---

## Blocages connus à surveiller pendant les tests

| Symptôme | Cause probable | Correctif |
|---|---|---|
| « Failed to fetch » | Application ouverte en `file://` | Passer par un serveur HTTP |
| Le code n'arrive jamais | Courriel bloqué ou filtré | Vérifier le dossier spam, ajouter l'expéditeur Supabase aux contacts |
| Les KPI affichent « – » | Aucune donnée, ou requête bloquée par les RLS | Vérifier que le compte appartient bien à l'espace |
| La recherche ne filtre rien | Erreur JavaScript | Console du navigateur (F12) |
| Le code PIN ne se sauvegarde pas | Déclencheur de base non exécuté | Vérifier que le hachage du code est bien nul avant création |
| Le ROAS reste à 0 | Aucune dépense historisée sur la période | Lancer une synchronisation publicitaire, ou saisir une dépense **avec des dates** |
| Une fiche de l'espace A s'ouvre depuis l'espace B | Accès direct par URL | **Anomalie de sécurité** — à signaler immédiatement |

---

## Questions auxquelles savoir répondre

| Question | Réponse |
|---|---|
| « Combien de clients ça supporte ? » | Les listes sont chargées entièrement, sans pagination : quelques milliers de lignes restent fluides. Au-delà, une pagination serveur serait nécessaire. |
| « C'est sécurisé ? » | Code à un usage, chiffrement en transit, et cloisonnement appliqué **en base** par les politiques RLS — pas seulement dans l'interface. Le code PIN verrouille l'appareil localement. |
| « Ça marche hors ligne ? » | L'application est installable et l'affichage reste accessible, mais les données nécessitent une connexion. |
| « Ça se connecte à Facebook et TikTok ? » | Oui : publication, analyse d'audience, et synchronisation des campagnes publicitaires. Voir `CLASSE MARKETING/integrations-sociales.md`. |
| « Et WhatsApp ? » | Les relances passent par des liens de conversation, sans envoi automatique. L'envoi et le suivi de statuts demandent l'API WhatsApp Business, non implémentée. |
| « Les données sont-elles mélangées entre clients ? » | Non. Chaque espace est cloisonné, et cette séparation est appliquée par la base. Vérifié par des tests automatiques de non-régression (`config/verify_v13_isolation.mjs`, `config/verify_v14_solo.mjs`). |

---

*Toute anomalie constatée doit être reportée avec l'écran concerné, l'espace utilisé et la sortie de la console (F12 → Console et Network).*
