# Campagnes publicitaires (modèle & saisie)

**Fichier source** : `mayela-crm.html`, fonctions `loadCampaigns()` (l.2216), `renderCampaigns()` (l.2232), handler `saveCampaignBtn` (l.2256-2286).

---

## Champs de la table `campaigns`

| Champ | Type | Obligatoire | Description |
|---|---|---|---|
| `id` | UUID (auto) | — | Identifiant unique |
| `org_id` | UUID | — | Espace propriétaire |
| `nom` | text | **Oui** | Nom de la campagne (ex. `META_SOINS_VISAGE_OCT_2026`) |
| `plateforme` | text | Non | `facebook` / `instagram` / `tiktok` (défaut : facebook) |
| `type` | text | Non | Un des 4 types (voir ci-dessous) |
| `categorie_promue` | text | Non | Catégorie de produit promue (ex. « Soins visage ») |
| `date_debut` | date | Non | Date de début |
| `date_fin` | date | Non | Date de fin |
| `budget_prevu` | numeric | Non | Budget prévu (FCFA) |
| `depense_reelle` | numeric | Non | Dépense réelle lue dans Ads Manager (FCFA) |
| `portee` | integer | Non | Portée (nombre de personnes atteintes) |
| `impressions` | integer | Non | Nombre d'impressions |
| `clics` | integer | Non | Clics / messages reçus |
| `created_by` | UUID | — | Auteur de la saisie |
| `created_at` | timestamptz | — | Horodatage de création |

---

## Plateformes

| Valeur | Libellé | Icône | Description |
|---|---|---|---|
| `facebook` | Page Facebook | 📘 | Publication directe d'offres |
| `instagram` | _(affiché brut)_ | — | Non géré dans PLATFORM_META |
| `tiktok` | TikTok Business | 🎵 | Publication via Login Kit |

**Ref.** : `PLATFORM_META` (l.1352-1356) ; `CAMPAIGN_TYPE_LABEL` (l.1357).

---

## Types de campagne

| Valeur | Libellé affiché |
|---|---|
| `visibilite` | Visibilité |
| `messages` | Messages |
| `leads` | Leads |
| `promotion_produit` | Promotion produit |

**Par défaut** : `visibilite`.

---

## Valeurs par défaut à la création

| Champ | Valeur par défaut |
|---|---|
| plateforme | `facebook` |
| type | `visibilite` |
| budget_prevu | `null` |
| depense_reelle | `0` |
| portee / impressions / clics | `0` |

---

## Coût par prospect

```
coût / prospect = depense_reelle / nombre de clients dont campagne_origine = campagne.id
```

Si 0 prospect → « — ».

Calcul **par campagne** dans `renderCampaigns()` (l.2244) et **global** dans les rapports (l.3748, somme des dépenses / somme des prospects).

---

## Liens clients → campagnes

| Direction | Champ | Utilisé pour |
|---|---|---|
| Client → Campagne | `clients.campagne_origine` | Compter les prospects rattachés |
| Achat → Campagne | `achats.campagne_id` | Attribution du CA |

---

## Suppression

Supprimer une campagne est possible (croix ✕ dans la liste). Les prospects rattachés (`campagne_origine`) et ventes liées (`campagne_id`) **sont conservés** — seul l'intitulé disparaît (l.2287-2294).

---

*Fichier figé au 13/09/2026*