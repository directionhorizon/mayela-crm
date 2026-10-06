# Attribution du CA et rentabilité (ROAS)

**Vérifié le 29 septembre 2026.** Code : `campaignAttribution` (rapports), `renderDashboardPerf` (tableau de bord), `reportSummaryText`.

---

## En clair

Pour savoir si une publicité rapporte, il faut deux nombres : **ce qu'elle a coûté** et **ce qu'elle a rapporté**.

L'application fait le lien entre les deux grâce à deux liens vers une campagne :
- quand vous créez un client depuis une campagne, on note **quelle campagne l'a amené** ;
- quand vous enregistrez une vente, on note **à quelle campagne elle se rattache**.

À partir de là, l'application calcule le **ROAS** : combien de francs CFA gagnés pour un franc CFA dépensé. Un ROAS de 2 signifie « 2 FCFA gagnés pour 1 FCFA dépensé ».

---

## ⚠️ À lire avant d'utiliser un chiffre de rentabilité

**Il y a aujourd'hui deux calculs de ROAS différents dans l'application, et ils ne donnent pas le même résultat.**

| Où | Ce qui est utilisé | Fiabilité |
|---|---|---|
| **Rapports → Campagnes — Rentabilité (ROAS)** | L'historique quotidien de dépense (V15), borné à la période choisie | ✅ **Fiable** |
| **Tableau de bord d'accueil** | Le cumul `campaigns.depense_reelle`, non borné | ⚠️ À manier avec prudence |
| **Rapports → Campagnes — Performance** (résumé) | Le cumul `campaigns.depense_reelle`, non borné | ⚠️ À manier avec prudence |

**Pourquoi cette différence ?** Avant la migration V15, la synchronisation ne gardait que 30 jours de dépense, alors que le chiffre d'affaires était cumulé depuis toujours. Le ratio comparait donc une dépense courte à un chiffre d'affaires long : il ne voulait rien dire. V15 corrige ce problème **dans les Rapports uniquement** ; le tableau de bord n'a pas encore été mis à jour.

→ **Pour décider, utilisez toujours la catégorie Rapports « Rentabilité (ROAS) ».**

### Deux autres Prudences

1. **Pas de conversion de devise.** Si votre compte publicitaire est en dollars et vos ventes en FCFA, le ROAS est faussé. L'application enregistre la devise (`depense_devise`) mais ne convertit pas. Point connu, non résolu.
2. **Avant la première synchronisation complète**, une campagne peut n'avoir aucune ligne d'historique. Le code applique alors un repli sur le cumul, sauf si une période est sélectionnée — auquel cas il affiche zéro plutôt qu'un chiffre faux. L'écart est signalé en interne par `depenseFenetre`, mais pas visible dans l'interface.

---

## Détail technique

### Fonction `campaignAttribution`

Pour chaque campagne, l'application calcule :

| Métrique | Formule |
|---|---|
| Ventes | Nombre d'achats dont `campagne_id` correspond |
| CA attribuable | Somme des montants de ces achats |
| Panier moyen | CA ÷ nombre de ventes, arrondi à l'entier |
| Clients acheteurs | Nombre de clients **distincts** parmi ces ventes |
| Dépense | Somme de `campaign_spend_daily` sur la période ; sinon repli (voir ci-dessus) |
| ROAS | CA ÷ dépense, arrondi à 2 décimales ; **vide si la dépense est nulle** |
| Coût d'acquisition | Dépense ÷ clients acheteurs ; 0 si aucun acheteur |
| Catégories vendues | Catégories **distinctes** des produits vendus |

**Totaux** : le total est la somme des lignes, et le ROAS global est le total du CA divisé par le total de la dépense. Le ROAS global n'est donc **pas** la moyenne des ROAS par campagne.

### Le repli sur `depense_reelle`

Quand aucune ligne d'historique n'existe pour une campagne :
- si aucune période n'est sélectionnée (vue historique), le cumul est utilisé ;
- si une période est sélectionnée, la dépense est forcée à `0` — afficher 0 vaut mieux que comparer un CA de 7 jours à une dépense cumulée depuis toujours.

Le drapeau interne `depenseFenetre` indique si la valeur est réellement bornée.

### Le cas du tableau de bord

`renderDashboardPerf` utilise `campaigns.depense_reelle` et l'intégralité des achats, sans fenêtre. C'est le calcul historique, antérieur à V15. Il reste affiché sur l'accueil.

**Le graphique « CA par campagne »** montre les 5 campagnes au plus fort chiffre d'affaires attribué, avec des barres proportionnelles à la meilleure.

---

## Comment lire ces chiffres

- **ROAS ≥ 1** : la publicité s'autofinance. En dessous, chaque franc dépensé rapporte moins d'un franc de chiffre d'affaires — mais cela reste compatible avec de la fidélisation, qui se comptera plus tard dans le réachat.
- **Coût d'acquisition vs panier moyen** : si le coût d'acquisition est proche du panier moyen, chaque client gagné ne produit que le premier achat. Il faut alors que le réachat fasse la différence.
- **Réachat** : la part de clients ayant acheté au moins deux fois parmi ceux attribués. C'est l'indicateur qui dit si l'acquisition tient dans la durée.

### Résumé textuel automatique

Le rapport « Rentabilité (ROAS) » produit un résumé automatique du type :
> Dépense totale X FCFA · CA attribuable Y FCFA · ROAS global Z …

**Deux défauts de formulation connus dans ce texte** : l'unité « FCFA gagné(s) par FCFA dépensé » est inadaptée à un ratio, et la phrase « À partir de 1, la publicité se rembourse » est une interprétation simplifiée. Le nombre affiché est correct ; sa formulation est à corriger.

---

## Ce que la période change, et ce qu'elle ne change pas

| Élément | Borné par la période ? |
|---|---|
| Ventes et chiffre d'affaires | ✅ Oui |
| Dépense publicitaire (V15) | ✅ Oui |
| Nombre de prospects rattachés | ❌ Non |
| Entonnoir de conversion | ❌ Non |
| Liste des campagnes | ❌ Non |

C'est un choix assumé : une campagne de trois mois ne doit pas disparaître parce qu'on consulte la semaine.
