# Suivi de la publicité (Meta & TikTok)

**Vérifié le 29 septembre 2026.** Code : Edge Functions `social-facebook` et `social-tiktok` (actions `ads_connect`, `ads_campaigns_get`, `marketing_sync`).

---

## En clair

Quand vous autorisez l'analyse publicitaire, MAYELA CRM va chercher vos campagnes **tout seul** : combien elles ont dépensé, combien de personnes ont vu vos pubs, combien ont cliqué.

**Le but est de ne plus ressaisir vos dépenses à la main.** Avant cette intégration, il fallait entrer chaque chiffre dans un formulaire — et il arrivait régulièrement d'oublier ou de se tromper.

**Ce que l'application récupère aujourd'hui** :

| Ce que vous voulez savoir | Ce que l'application récupère |
|---|---|
| Combien j'ai dépensé | ✅ dépense par jour |
| Combien de personnes ont vu | ⚠️ portée partielle (voir plus bas) |
| Combien de clics / messages | ✅ clics |
| Quelles campagnes sont actives | ✅ statut de chaque campagne |
| Qui a vu mes pubs | ❌ données démographiques non récupérées |

---

## Ce que l'application fait, et ne fait pas

**Elle synchronize automatiquement.** Une fois le compte publicitaire connecté, les campagnes sont mises à jour sans intervention. Vous n'avez pas à cliquer pour rafraîchir.

**Elle enregistre l'historique jour par jour.** C'est le point clé. Depuis la migration V15, chaque jour de dépense est conservé séparément. C'est ce qui permet de calculer un ROAS honnête : on compare la dépense et les ventes **sur la même période**.

Avant cette amélioration, la synchronisation ne gardait que 30 jours de dépense alors que les ventes étaient comptabilisées depuis toujours. Le ratio obtenu n'avait aucun sens.

---

## ⚠️ Ce qui n'est pas récupéré

**La portée (nombre de personnes touchées) n'est pas historisée.** Meta fournit la portée sur les 28 derniers jours, mais pas jour par jour. Dans l'historique quotidien, la portée est donc **toujours à 0**. Vous verrez une portée sur la fiche de campagne, mais pas dans les rapports calculés sur une période.

**Les données démographiques ne sont pas récupérées.** Ni l'âge, ni le genre, ni la localisation des personnes touchées. Ce sont des données protégées par les plateformes.

**Le coût par conversation WhatsApp n'est pas remonté.** C'est une donnée spécifique à l'écosystème Meta, non implémentée à ce jour.

**Aucune action de modification n'est disponible depuis l'interface.**
Les Edge Functions exposent bien des actions pour modifier les campagnes (changer un budget, mettre en pause, reprendre) et, côté TikTok, pour **créer** des campagnes et des audiences. **Ces actions ne sont pas appelées par l'interface** : elles existent dans le code, prêtes à être branchées, mais sans aucun bouton dans l'application. MAYELA CRM reste donc, aujourd'hui, un outil de lecture et de mesure.

---

## ⚠️ Le point de vigilance principal

**Tous les comptes publicitaires accessibles à votre profil sont importés.**

Il n'existe pas encore d'écran pour choisir lequel importer. Concrètement :

- si votre profil Facebook donne accès à 3 comptes publicitaires, les 3 sont importés ;
- idem côté TikTok avec les comptes annonceurs.

**La seule parade actuelle** : autorisez l'application avec un profil qui n'a accès qu'au compte souhaité. Si ce n'est pas possible, il faut attendre l'ajout d'un sélecteur.

C'est un point connu, non résolu, listé dans les écarts connus du [README](README.md).

---

## La structure récupérée

### Facebook

| Niveau | Ce qui est enregistré |
|---|---|
| Compte publicitaire | l'identifiant du compte |
| Campagne | nom, statut, objectif, budget, dates |
| Ensemble de pubs (ad set) | budget, enchère, statut d'optimisation |
| Dépense quotidienne | montant, impressions, clics, par jour |

Les ensembles de pubs sont stockés dans une table dédiée, équivalente aux groupes d'annonces de TikTok.

### TikTok

| Niveau | Ce qui est enregistré |
|---|---|
| Compte annonceur | l'identifiant du compte |
| Campagne | nom, statut, budget |
| Groupe d'annonces | budget, enchère |
| Dépense quotidienne | montant, impressions, clics, par jour |
| Leads générés | les prospects collectés par les formulaires |
| Audiences | les audiences personnalisées |

**TikTok va au-delà de Meta** sur un point : les **leads** (prospects collectés par un formulaire publicitaire) et les **audiences** sont récupérés. Meta n'offre pas d'équivalent direct dans l'intégration actuelle.

---

## Ce que vous pouvez faire dans l'interface

Une fois la synchronisation faite, l'application affiche les campagnes dans l'écran Campagnes et alimente tous les rapports. Vous pouvez aussi :

| Action | Disponible ? |
|---|---|
| Voir les campagnes synchronisées | ✅ |
| Voir leur dépense et leurs métriques | ✅ |
| Les retrouver dans les rapports | ✅ |
| Modifier une dépense importée | ⚠️ Possible, mais la synchronisation l'écrasera |
| Créer une campagne depuis le CRM | ❌ Non branché dans l'interface |
| Mettre une pub en pause depuis le CRM | ❌ Non branché dans l'interface |

---

## Détail technique

### Le déclenchement de la synchronisation

La synchronisation est déclenchée en connectant le compte publicitaire (action `ads_connect` côté Meta, `marketing_sync` côté TikTok). Elle est idempotente : la relancer ne crée pas de doublons, car l'écriture dans `campaign_spend_daily` repose sur une contrainte d'unicité sur (campagne, jour).

### Ce qui est écrit en base

À chaque synchronisation, l'application écrit dans `campaigns` :
- `depense_reelle` : la dernière valeur connue (un **cumul**, pas une valeur de période) ;
- `depense_source` : `api` pour indiquer que la valeur vient de l'API ;
- `depense_periode_debut` et `depense_periode_fin` : la période réellement couverte.

Et dans `campaign_spend_daily`, **une ligne par campagne et par jour**.

### La devise

Le champ `depense_devise` enregistre la devise du compte publicitaire. **Aucune conversion n'est effectuée.** Si votre compte est en dollars et vos ventes en francs CFA, les ratios seront faussés. C'est un point connu, non résolu.

### Le tri des campagnes

Les campagnes sont présentées avec leur statut Meta d'origine (`ACTIVE`, `PAUSED`, etc.). Le statut vient de la plateforme, il n'est pas modifiable depuis le CRM.

### La portée

Le champ `portee` de la table `campaign_spend_daily` est documenté en base comme « toujours 0 », car Meta ne fournit pas de portée journalière. Il en va de même pour TikTok.

---

## En pratique

Si vous ne deviez retenir qu'une chose : **le suivi de la dépense est fiable et historisé ; le suivi de l'audience ne l'est pas.** Utilisez les rapports de rentabilité pour vos décisions d'investissement, et traitez la portée et les données démographiques comme des ordres de grandeur.
