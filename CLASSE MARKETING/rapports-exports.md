# Moteur de reporting & exports (côté marketing)

**Fichier source** : `mayela-crm.html`, fonctions `reportSummaryText()` (l.3865), `reportRows()` (l.3934), `periodSince()` (l.3802) ; constantes `PERIOD_MS` (l.3801), `REPORT_TYPE_LABEL` (l.4217).

---

## Périodes disponibles

| Valeur | Période | formule |
|---|---|---|
| `7` | 7 jours | `Date.now() - 7*86400000` |
| `30` | 30 jours (défaut) | `30*864e5` |
| `90` | 90 jours | `90*864e5` |
| `all` | Tout l'historique | `1970-01-01` |

`periodSince()` renvoie la date ISO de début ; si la période est `all` → `'1970-01-01'`.

**Attention** : pour les catégories de campagnes (`campagnes`, `entonnoir`, `caattrib`, `roas`), **la période ne filtre pas le calcul** : les campagnes et les rattachements (prospects & ventes) sont lus sur leur **durée réelle** (l.3808-3810).

---

## Catégories marketing du rapport

| Valeur | Libellé UI | Lignes du tableau | Code |
|---|---|---|---|
| `reseaux` | Réseaux sociaux (publications) | Réseau, Contenu, Statut, Date | l.3967-3970 |
| `impact` | Impact opérationnel (interne) | Indicateur, Valeur, Détail (offres publiées / en échec, échanges, achats, clients suivis, répartition par canal) | l.3971-3988 |
| `campagnes` | Campagnes — Performance | Campagne, Plateforme, Type, Dépense, Portée, Impressions, Clics/messages, Prospects CRM, Coût / prospect | l.3989-4007 |
| `entonnoir` | Campagnes — Entonnoir de conversion | Campagne, Prospects, Contactés, Négociation, Clients / Fidèles, Acheteurs, Taux de conversion | l.4009-4013 |
| `caattrib` | Campagnes — Ventes & CA attribués | Campagne, Ventes, CA attribuable, Panier moyen, Clients acheteurs, Catégories vendues | l.4015-4020 |
| `roas` | Campagnes — Rentabilité (ROAS) | Campagne, Dépense, CA attribuable, ROAS, Coût d'acquisition, Clients acheteurs | l.4021-4025 |

---

## Résumés textuels (préambule du rapport)

| Catégorie | Résumé généré |
|---|---|
| `impact` | « X offre(s) publiée(s) [dont Y en échec à retenter] · Z échange(s) enregistré(s) · W client(s) suivi(s) · V FCFA d'achats sur la période. Indicateurs internes du CRM (remplacent les statistiques réseaux non disponibles). » |
| `campagnes` | « X campagne(s) pour Y FCFA de dépense, Z prospect(s) rattaché(s) dans le CRM. Coût par prospect global : W FCFA (calcul sur toute la durée des campagnes, indépendamment de la période). » |
| `entonnoir` | « X prospect(s) issus des campagnes, dont Y acheteur(s) réels (Z % de conversion). Maintenez l'étape de chaque prospect (Contacté, Négociation, Client) et laissez le système calculer la perte d'attention entre les étapes. » |
| `caattrib` | « X vente(s) attribuée(s) aux Y campagne(s), soit Z FCFA de CA attribuable. Le panier moyen et les catégories vendues sont détaillés par campagne dans le tableau (calcul sur toute la durée des campagnes). » |
| `roas` | « Dépense totale X FCFA · CA attribuable Y FCFA · ROAS global Z FCFA gagné(s) par FCFA dépensé. À partir de 1, la publicité se rembourse. » |

---

## Export

- **Google Sheets** : bouton d'export du rapport courant (`gsExportBtn2`, l.4242) → Edge Function `google-sheets`.
- Ligne de titre : libellé de catégorie + période (ex. « Campagnes — Entonnoir de conversion 30 jours »).

---

## Formules des colonnes (rappel)

| Colonne | Formule | Réf. |
|---|---|---|
| Coût / prospect (par campagne) | `depense_reelle ÷ prospects.` | l.4002 |
| Taux de conversion (par campagne) | `acheteurs ÷ prospects × 100` | l.4012 |
| ROAS (par campagne) | `CA attribuable ÷ depense_reelle` | l.3853 |
| Coût d'acquisition | `depense_reelle ÷ clients acheteurs` | l.3854 |

Détails complets : voir `campagnes-publicitaires.md`, `attribution-ca-et-roas.md`, `funnel-de-vente.md`.

---

*Fichier figé au 13/09/2026*