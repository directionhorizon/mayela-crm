# Attribution du CA & rentabilité (ROAS, panier moyen, réachat)

**Fichier source** : `mayela-crm.html`, fonction `campaignAttribution()` (l.3838), `renderDashboardPerf()` (l.2739), résumés `roas`/`caattrib` (l.3917-3926).

---

## Périmètre d'attribution

L'attribution repose sur **deux liens** :
- `achats.campagne_id` : une vente est « attribuée » à une campagne.
- `clients.campagne_origine` : un prospect est rattaché à une campagne d'origine.

**Règle clé** : le calcul s'effectue sur **l'ensemble de l'historique** (toutes les campagnes, tous les achats), **indépendamment de la période** sélectionnée dans Rapports. La période ne sert qu'à la lecture brute des données.

---

## CA attribuable & métriques par campagne

Pour **chaque campagne** dans `campaignAttribution()` :

| Métrique | Formule | Réf. |
|---|---|---|
| `n` (ventes) | nombre d'achats avec `campagne_id = camp.id` | l.3843 |
| `ca` (CA attribuable) | somme des `montant` de ces achats | l.3844 |
| `avg` (panier moyen) | `ca / n` (arrondi entier) | l.3850 |
| `buyers` (clients acheteurs) | nombre de **clients distincts** parmi ces achats | l.3846 |
| `spend` (dépense) | `depense_reelle` de la campagne (ou 0) | l.3845 |
| `roas` | `ca / spend`, arrondi à 2 décimales ; **`null` si dépense nulle** | l.3853 |
| `cacCost` (coût d'acquisition) | `spend / buyers` (entier) ; 0 si aucun acheteur | l.3854 |
| `cats` | catégories de produits **distinctes** parmi les ventes attribuées | l.3855 |

---

## Totaux globaux

| Métrique | Formule |
|---|---|
| `totCa` | somme des CA attribuables |
| `totSpend` | somme des dépenses réelles |
| `totSales` | somme des ventes attribuées |
| `totalRoas` | `totCa / totSpend` (arrondi 2 déc.) ; `null` si dépense nulle |

---

## KPIs publicitaires du tableau de bord (l.2739)

| KPI | Formule | Affichage |
|---|---|---|
| **ROAS** | `CA attribué ÷ dépense réelle totale` | `X,YY×` |
| **Coût / prospect** | `dépense totale ÷ nb clients avec campagne_origine` (0 FCFA si dépense nulle) | compact FCFA |
| **Panier moyen (campagnes)** | `CA attribué ÷ nb ventes attribuées` | compact FCFA |
| **Réachat** | `(clients avec ≥ 2 achats attribués ÷ clients acheteurs) × 100` | % |

**Graphique CA par campagne** : top 5 campagnes par CA attribué, barres proportionnelles au CA max (l.2771-2780).

---

## Résumé textuel ROAS (Rapports)

> Dépense totale X FCFA · CA attribuable Y FCFA · ROAS global Z FCFA gagné(s) par FCFA dépensé. À partir de 1, la publicité se rembourse.

(« non calculable (dépense nulle) » si `totalRoas` = null)

---

## Interprétation métier

- **ROAS ≥ 1** : la publicité se rembourse.
- **Coût d'acquisition** vs **panier moyen** : à comparer pour juger la rentabilité immédiate par campagne.
- **Réachat** : effort de fidélisation.

---

*Fichier figé au 13/09/2026*