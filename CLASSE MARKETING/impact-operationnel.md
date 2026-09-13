# Impact opérationnel (statistiques internes)

**Fichier source** : `mayela-crm.html`, fonction `loadOperationalImpact()` (l.1722-1745).

> Rôle affiché : « remplace les statistiques réseaux non disponibles ». Tant que les statistiques réseau externes (TikTok/Facebook) ne sont pas branchées en profondeur, cet écran mesure l'impact réel du marketing sur les clients.

---

## KPIs affichés

| KPI | Source | Réf. |
|---|---|---|
| **Offres publiées** | `social_posts` avec `status = 'sent'` (compte exact) | l.1724 |
| **Échanges clients enregistrés** | `interactions` total (tous types) | l.1726-1729 |
| **Clients suivis** | `clientsCache.length` | l.1735 |
| **Achats (30 j, FCFA)** | Valeur du KPI `kpiCA` (montants des achats des 30 derniers jours) | l.1731-1736 |

---

## Répartition des échanges par canal

Types comptés (`INTERACTION_TYPE_LABEL`, l.4101) :

| Valeur | Libellé |
|---|---|
| `whatsapp` | WhatsApp |
| `facebook` | Facebook |
| `tiktok` | TikTok |
| `appel` | Appel |
| `visite` | Visite |
| `autre` | Autre |

Affichage : étiquettes « Canal : N ».

---

## Alertes

- Si des publications sont en échec (`status = 'failed'`, compte > 0) : bandeau ⚠ **« X publication(s) en échec à retenter. »**

---

## Note de bas d'écran

> « En attendant le branchement TikTok/Facebook, suivez ici l'impact réel de vos offres sur vos clients. »

---

## Comportement

- **Toutes périodes** : les compteurs (offres, échanges, clients) sont calculés sur **l'ensemble de l'historique** ; seul le montant « Achats (30 j) » est limité à 30 jours (via le KPI du tableau de bord).
- **Relié au cache** : utilise `clientsCache` et le cache `achats` (60 s).

---

*Fichier figé au 13/09/2026*