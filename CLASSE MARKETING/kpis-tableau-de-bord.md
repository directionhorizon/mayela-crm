# KPIs du tableau de bord

**Vérifié le 29 septembre 2026.** Code : `renderDashboardKpis`, `renderDashboardPerf`.

---

## En clair

L'écran d'accueil affiche deux blocs de chiffres.

**En haut**, six indicateurs rapides sur l'activité du jour : combien de clients vous suivez, combien de tâches sont en retard, combien de demandes attendent, les ventes du jour, les devis du mois, et le chiffre d'affaires des 30 derniers jours.

**Au milieu**, la « Performance publicitaire » : quatre indicateurs qui disent si vos pubs rapportent. Ce bloc **n'apparaît que si vous avez au moins une campagne enregistrée**.

---

## Les six indicateurs du haut

| Indicateur | Ce qu'il compte | Période |
|---|---|---|
| **Clients** | nombre total de clients dans l'espace | tout l'historique |
| **Tâches en retard** | tâches non faites dont la date est dépassée | aujourd'hui |
| **À traiter** | demandes en attente de réponse | aujourd'hui |
| **Ventes du jour** | achats enregistrés aujourd'hui | aujourd'hui |
| **Devis** | devis créés dans les 30 derniers jours | 30 jours |
| **CA** | somme des achats des 30 derniers jours | 30 jours |

Le chiffre d'affaires est affiché en format compact (par exemple « 1,2 M FCFA ») pour tenir dans la tuile.

---

## ⚠️ Un libellé trompeur sur le ROAS

Sur la tuile « Performance publicitaire », le ROAS est étiqueté **« ROAS (depense ÷ ventes) »**.

**Ce libellé est faux.** Le calcul réel est bien CA attribué ÷ dépense. Un ROAS de 2 signifie donc « 2 FCFA gagnés pour 1 FCFA dépensé » — l'inverse de ce que suggère l'étiquette.

Le nombre affiché est correct ; **le texte entre parenthèses est à corriger**. C'est un point connu, non résolu, qui figure aussi dans [Attribution du CA et ROAS](attribution-ca-et-roas.md).

---

## Les quatre indicateurs de performance publicitaire

| Indicateur | Ce qu'il mesure | Ce qui se passe si la donnée est absente |
|---|---|---|
| **ROAS** | chiffre d'affaires attribué ÷ dépense réelle | « — » si la dépense est nulle |
| **Coût / prospect** | dépense ÷ nombre de prospects rattachés | « 0 FCFA » si la dépense est nulle, « — » si aucun prospect |
| **Panier moyen** | CA attribué ÷ nombre de ventes attribuées | « — » s'il n'y a aucune vente |
| **Réachat** | clients ayant acheté au moins deux fois ÷ clients acheteurs | « — » s'il n'y a aucun acheteur |

### Le graphique « CA par campagne »

L'application affiche les **5 campagnes** qui ont rapporté le plus, sous forme de barres proportionnelles à la meilleure d'entre elles.

Si aucune vente n'est attribuée, l'écran affiche un message qui vous oriente : ouvrez une fiche client, allez dans Ventes, et associez un achat à une campagne.

**C'est l'action la plus rentable pour améliorer vos chiffres** : sans ce lien, vos ventes restent invisibles dans toute la partie publicitaire.

---

## Performances techniques

L'application évite de ralentir l'écran d'accueil :

- les tâches, devis et interactions sont comptés par la base de données directement (`count exact`), sans charger les lignes ;
- les achats utilisent un cache partagé d'environ 60 secondes, réutilisé par tous les autres écrans.

C'est pourquoi les chiffres peuvent avoir jusqu'à une minute de retard sur une saisie très récente.

---

## Détail technique

### La fonction `renderDashboardKpis`

Requêtes utilisées :

| Cible | Méthode |
|---|---|
| Tâches en retard | comptage avec filtre statut « à faire » et date inférieure à aujourd'hui |
| À traiter | comptage des interactions « en attente » |
| Devis | comptage des devis des 30 derniers jours |
| Ventes du jour et CA 30 j | calculés à partir du cache d'achats, pas par requête dédiée |

Le total des clients vient directement de la longueur du cache mémoire des clients.

### La fonction `renderDashboardPerf`

Requêtes utilisées :

| Cible | Colonnes lues |
|---|---|
| Campagnes | `id`, `nom`, `depense_reelle` |
| Achats | via le cache partagé |
| Prospects | clients avec une campagne d'origine renseignée |

**Point technique important** : cette fonction utilise `campaigns.depense_reelle` (un cumul non borné) et l'intégralité des achats, sans fenêtre de dates. C'est le calcul antérieur à la migration V15.

→ **Le ROAS du tableau de bord et celui des Rapports ne sont pas le même calcul.** Pour un chiffre fiable, utilisez [les Rapports](attribution-ca-et-roas.md). Ce point est détaillé dans la fiche dédiée et listé dans les écarts connus du [README](README.md).

### Formules exactes

| Indicateur | Formule |
|---|---|
| ROAS | CA attribué ÷ dépense totale, arrondi à 2 décimales |
| Coût / prospect | dépense totale ÷ nombre de prospects |
| Panier moyen | CA attribué ÷ nombre de ventes attribuées |
| Réachat | (clients avec au moins 2 achats ÷ clients acheteurs) × 100 |
| CA 30 jours | somme des montants d'achats des 30 derniers jours |

Les valeurs monétaires sont formatées en notation compacte française, avec le suffixe « FCFA ».
