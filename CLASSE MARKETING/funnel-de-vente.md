# Entonnoir de vente

**Vérifié le 29 septembre 2026.** Code : `campaignFunnel`, `renderClients`, liste déroulante `stageTabs`.

---

## En clair

L'entonnoir vous montre où en sont vos prospects : combien ont été contactés, combien négocient, combien sont devenus clients, et combien ont réellement acheté.

Chaque client est à **une seule étape** à la fois. Vous déplacez le client d'étape en ouvrant sa fiche et en changeant son statut : c'est une information que **vous** maintenez, pas quelque chose que l'application déduit automatiquement.

L'application peut ensuite répondre à une question simple : « sur 100 personnes amenées par mes campagnes, combien ont acheté ? »

---

## Les cinq étapes

| Étape | Ce que ça veut dire | Couleur |
|---|---|---|
| **Prospect** | identifié, pas encore contacté | vert-gris |
| **Contacté** | vous l'avez Joint | or |
| **Négociation** | en discussion, en cours de décision | terracotta |
| **Client** | a acheté au moins une fois | vert clair |
| **Fidèle** | client fidèle | vert foncé |

**Tout nouveau client commence en « Prospect »** si vous ne précisez rien d'autre.

L'écran Clients affiche des onglets pour filtrer par étape, ce qui vous permet de voir d'un coup d'œil, par exemple, tous les prospects en négociation.

---

## L'entonnoir par campagne

Pour chaque campagne, l'application compte :

| Étape | Comment elle est calculée |
|---|---|
| **Prospects** | nombre de clients dont la campagne d'origine est cette campagne |
| **Contactés** | parmi ces prospects, ceux à l'étape « Contacté » |
| **Négociation** | parmi ces prospects, ceux à l'étape « Négociation » |
| **Clients** | parmi ces prospects, ceux à l'étape « Client » **ou** « Fidèle » |
| **Acheteurs** | parmi ces prospects, ceux qui figurent réellement dans vos ventes |

**Le taux de conversion** = acheteurs ÷ prospects. Si une campagne n'a encore aucun prospect, l'application affiche « — » plutôt que 0.

**Le taux global** fait la même opération sur l'ensemble des campagnes : total des acheteurs ÷ total des prospects.

---

## Trois limites importantes

**L'étape est unique et manuelle.** Un client est à une seule étape, sans historique. Vous ne verrez pas « il était en négociation la semaine dernière » — l'application ne conserve pas les étapes passées.

**Les étapes ne se cumulent pas de façon stricte.** Les étapes « Contactés » et « Négociation » comptent des clients **actuellement** à ce stade. Un client qui est passé par « Négociation » puis est devenu « Client » n'apparaît plus dans la colonne « Négociation ». Les colonnes ne sont donc pas empilées : elles décrivent l'état actuel, pas le parcours.

**La période sélectionnée n'a aucun effet ici.** L'entonnoir se calcule toujours sur toute la durée des campagnes. C'est un choix : une campagne de plusieurs mois ne doit pas disparaître parce que vous consultez la semaine. Mais si vous cherchez un entonnoir « sur 30 jours », il n'existe pas.

---

## Détail technique

### La fonction `campaignFunnel`

Pour chaque campagne, l'application :

1. filtre les clients pour ne garder que ceux dont `campagne_origine` correspond à la campagne ;
2. compte les étapes par comparaison à `stage_override` ;
3. construit un ensemble des identifiants de clients présents dans les achats, pour compter les acheteurs réels.

**Valeur par défaut de l'étape** : si `stage_override` est vide, le client est compté comme « Prospect ».

### Taux global

Le taux global n'est **pas** la moyenne des taux par campagne : c'est le rapport des totaux (somme des acheteurs ÷ somme des prospects). Une campagne sans prospect ne fausse donc pas le résultat.

### Où trouver ce rapport

Dans l'écran **Rapports**, choisissez la catégorie « Campagnes — Entonnoir de conversion ». Un résumé automatique accompagne le tableau.

### Colonnes du rapport

| Colonne | Contenu |
|---|---|
| Campagne | Nom de la campagne |
| Prospects | Nombre de clients rattachés |
| Contactés | À l'étape « Contacté » |
| Négociation | À l'étape « Négociation » |
| Clients / Fidèles | Aux étapes « Client » ou « Fidèle » |
| Acheteurs | Ayant au moins un achat |
| Taux de conversion | Acheteurs ÷ prospects × 100 |

### Relation avec l'attribution

L'entonnoir répond à « combien de gens sont passés à l'achat », tandis que [l'attribution du CA](attribution-ca-et-roas.md) répond à « combien d'argent cette campagne a rapporté ». Les deux s'appuient sur la même population de prospects, mais sur des mesures différentes.
