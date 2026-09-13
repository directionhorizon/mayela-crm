# CLASSE MARKETING — Logique-métier marketing de MAYELA CRM

Ce dossier documente **toute la logique-métier « MARKETING »** actuellement implémentée dans l'application (fichier source : `mayela-crm.html`, Edge Functions dans `supabase/functions/`).

Chaque fichier couvre un domaine distinct. Les paramètres, seuils, formules et libellés sont ceux **exactement en vigueur aujourd'hui** dans le code, avec les références de code pour retrouver l'endroit à modifier.

| Fichier | Domaine | Ce qu'il contient |
|---|---|---|
| `segments-clients.md` | Segmentation Centre d'action | Fenêtres 30 j / 45 j, règles Nouveaux / Réguliers / Inactifs, intérêt catégorie |
| `funnel-de-vente.md` | Pipeline de vente | Étapes Prospect → Fidèle, entonnoir par campagne, taux de conversion |
| `campagnes-publicitaires.md` | Modèle campagne | Champs, plateformes, types, saisie manuelle, coût par prospect |
| `attribution-ca-et-roas.md` | Rentabilité | CA attribué, ROAS, panier moyen, coût d'acquisition, réachat |
| `relances-et-actions.md` | Relances & file d'attente | Top 6 inactifs, message WhatsApp, consentement, « à traiter » |
| `publication-offres.md` | Contenu / publications | Publier une offre, événements TikTok, repli manuel |
| `tracking-pixel-tiktok.md` | Tracking événements | Pixel client, événements serveur, événement Purchase |
| `analyse-audience-et-insights.md` | Audience & insights | social-insights, clients les plus actifs par réseau |
| `impact-operationnel.md` | Statistiques internes | Offres publiées, échanges, clients suivis, achats 30 j |
| `kpis-tableau-de-bord.md` | KPIs accueil | Ventes du jour, CA 30 j, tâches, perf publicitaire |
| `rapports-exports.md` | Moteur de reporting | Catégories, périodes, colonnes, export Google Sheets |

**Conventions transverses**
- Devise : **FCFA (XAF)** — formatage `fmtFCFA`/`Intl.NumberFormat('fr-FR')`.
- Dates comparées en **chaînes locales** (`localDateStr`), seuils calculés en millisecondes (`Date.now() - N*86400000`).
- La segmentation et les KPIs sont **recalculés à chaque affichage**, rien n'est persistant.
- Les données « campagnes » couvrent **toute la durée réelle des campagnes** (pas la période sélectionnée dans Rapports).
- **Paramètres utilisateur** (localStorage) : nombre de « clients les plus actifs en ligne » (défaut **15**, plage 3–50), réglable dans Réglages → Marketing.

*Documentation figée au 13/09/2026 — à mettre à jour à chaque évolution de la logique marketing.*