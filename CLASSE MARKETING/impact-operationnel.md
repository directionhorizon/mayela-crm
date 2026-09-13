# Impact opérationnel (statistiques internes)

**Fichier source** : `mayela-crm.html`, **catégorie de rapport** `impact` dans l'écran Rapports (`reportRows()` l.3971+, `reportSummaryText()` l.3897+, libellé `REPORT_TYPE_LABEL.impact` l.4227, option du sélecteur l.856).

> Rôle affiché : « Indicateurs internes du CRM (remplacent les statistiques réseaux non disponibles) ». Tant que les statistiques réseau externes (TikTok/Facebook) ne sont pas branchées en profondeur, ce rapport mesure l'impact réel du marketing sur les clients — au format rapport (période + export), comme les autres catégories.
>
> Ce rapport est passé des Réseaux vers les Rapports le 13/09/2026 (donnée interne, format rapport). L'ancienne fonction `loadOperationalImpact()` a été supprimée.

---

## KPIs affichés (période sélectionnée)

| Indicateur | Source | Réf. |
|---|---|---|
| **Offres publiées** | `social_posts` avec `status = 'sent'` (sur la période) | l.3978 |
| **En échec à retenter** | `social_posts` avec `status = 'failed'` (sur la période) | l.3979 |
| **Échanges enregistrés** | `interactions` (sur la période, tous types) | l.3980 |
| **Achats (FCFA)** | somme des achats de la période | l.3981 |
| **Clients suivis** | total du fichier clients | l.3982 |

La phase de résumé textuel (`reportSummaryText()`, l.3897) reprend ces valeurs : « N offre(s) publiée(s) [dont X en échec] · N échange(s) enregistré(s) · N client(s) suivi(s) · montant d'achats sur la période ».

---

## Répartition des échanges par canal

Types comptés (`INTERACTION_TYPE_LABEL`, l.4216) :

| Valeur | Libellé |
|---|---|
| `whatsapp` | WhatsApp |
| `facebook` | Facebook |
| `tiktok` | TikTok |
| `appel` | Appel |
| `visite` | Visite |
| `autre` | Autre |

Affichage : lignes « Canal (part des échanges) : N » avec détails.

---

## Période & export

- Le rapport respecte le **sélecteur de période** commun aux Rapports (7 / 30 / 90 jours, ou tout l'historique).
- **Export** : Google Sheets (`gsExportBtn2`) et PDF (`exportPdfBtn`), via `currentExportRows()` → `reportRows(d)`.

---

*Fichier mis à jour le 13/09/2026 (déplacement Réseaux → Rapports).*