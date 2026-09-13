# Funnel de vente (Pipeline de conversion)

**Fichier source** : `mayela-crm.html`, constantes et fonctions `renderClients()`, `campaignFunnel()` (~l.3726-3746).

---

## Étapes du pipeline

| Ordre | Étape | Couleur | Valeur `stage_override` |
|---|---|---|---|
| 1 | Prospect | `#9CAB9F` (vert-gris) | `Prospect` (défaut) |
| 2 | Contacté | `#D9A441` (or) | `Contacté` |
| 3 | Négociation | `#E8926F` (terracotta) | `Négociation` |
| 4 | Client | `#7BC79A` (vert clair) | `Client` |
| 5 | Fidèle | `#4C9A6B` (vert foncé) | `Fidèle` |

**Affichage** : filtre par étapes au-dessus de la liste clients (l.443, `stageTabs`).

**Étiquette** : le champ `stage_override` est affiché dans chaque fiche client ; si vide → affiché comme « Prospect ».

---

## Entonnoir par campagne

**Fonction** : `campaignFunnel(d)` (l.3726)

### Logique

Pour **chaque campagne** enregistrée :

```
Prospects     = nombre de clients dont campagne_origine = campagne.id
Contactés     = prospects avec stage_override = 'Contacté'
Négociation   = prospects avec stage_override = 'Négociation'
Clients       = prospects avec stage_override IN ('Client', 'Fidèle')
Acheteurs     = prospects dont l'ID figure dans la table des achats (achAll)
Taux conv.    = acheteurs / prospects × 100  (ou « — » si 0 prospect)
```

### Taux global

```
Taux global = somme(acheteurs) / somme(prospects) × 100
```
Affiché dans le résumé textuel du rapport (l.3816).

### Source de données

| Source | Champ utilisé |
|---|---|
| `clients` | `id`, `campagne_origine`, `stage_override` |
| `achats` (cache) | `client_id` |

### Où consulter

Rapports → type « Campagnes — Entonnoir de conversion ».

---

## Limites actuelles

- Le stage est un champ **unique par client** (pas un historique) : on ne suit pas l'évolution temporelle des étapes.
- Tous les prospects d'une campagne n'ont pas forcément un `stage_override` (les prospects créés depuis l'import sans passer par la fiche client n'ont pas de stage).
- Le taux de conversion est calculé **sur toute la durée des campagnes**, indépendamment de la période sélectionnée dans Rapports.

---

*Fichier figé au 13/09/2026*