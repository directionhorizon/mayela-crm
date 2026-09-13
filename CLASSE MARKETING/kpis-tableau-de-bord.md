# KPIs du tableau de bord (accueil)

**Fichier source** : `mayela-crm.html`, fonctions `renderDashboardKpis()` (l.2628-2644) et `renderDashboardPerf()` (l.2649-2692).

---

## KPI généraux (haut de l'accueil)

| KPI | ID | Source & logique | Réf. |
|---|---|---|---|
| **Clients** | `kpiClients` | `clientsCache.length` | l.2629 |
| **Tâches en retard** | `kpiOverdue` | `tasks` avec `status = 'a_faire'` **et** `due_date < date du jour` (compte exact) | l.2636 |
| **À traiter** | `kpiPending` | `interactions` avec `statut_traitement = 'en_attente'` (compte exact) | l.2637 |
| **Ventes du jour** | `kpiTodaySales` | Nombre d'achats avec `achat_date >= date du jour` (cache) | l.2639 |
| **Devis (30 j)** | `kpiDevis` | `devis` avec `devis_date >= date du jour - 30 j` (compte exact) | l.2640 |
| **CA 30 j** | `kpiCA` | Somme des `montant` des achats avec `achat_date >= date du jour - 30 j` | l.2642-2643 |

---

## Section « Performance publicitaire »

Affiche si au moins **une campagne** existe (sinon la section est masquée ; l.2654-2656).

### Mesures

Cumulées **sur toute la durée des campagnes** (non filtrées par période) :

| KPI | ID | Formule | Réf. |
|---|---|---|---|
| **ROAS** | `dashPerfChips` | `CA attribué ÷ dépense réelle totale` ; `null` si dépense nulle → « — » | l.2660-2671 |
| **Coût / prospect** | idem | `dépense ÷ nb clients avec campagne_origine` (0 FCFA si dépense nulle, « — » sans prospect) | l.2654, 2676 |
| **Panier moyen (campagnes)** | idem | `CA attribué ÷ nb ventes attribuées` | l.2677 |
| **Réachat** | idem | `(clients avec ≥ 2 achats attribués ÷ clients acheteurs) × 100` | l.2663-2669 |

### Graphique CA par campagne

`perCamp` : somme des montants des achats par `campagne_id`. Top **5** campagnes, barres proportionnelles au CA maximum (l.2663-2681). Message si aucune vente attribuée : guidage vers « Fiche client → Ventes → lier un achat à une campagne ».

---

## Feed turbines

- Les requêtes `tasks`/`devis`/`interactions` utilisent `count:'exact', head:true` (léger).
- Les achats utilisent **`getAchatsAll()`** (cache partagé 60 s) — pas de re-lecture de la table.

---

*Fichier figé au 13/09/2026*