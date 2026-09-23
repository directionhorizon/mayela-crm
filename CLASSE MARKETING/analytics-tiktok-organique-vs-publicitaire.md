# Analytics TikTok : organique vs publicitaire — intérêt pratique

**Fichier source** : `mayela-crm.html` — analyse d'audience `loadSocialInsights()` (l.1738), top clients par réseau `loadSocialTopClients()` (l.1772), tracking événements `trackTikTokPurchase()` (l.1899) ; Edge Functions `social-insights`, `tiktok-events`, `social-tiktok`, `social-publish`.

---

## Les deux types d'analytics TikTok

| | **ORGANIQUE** | **PUBLICITAIRE (TikTok Marketing API)** |
|---|---|---|
| **Source des données** | Compte TikTok / Business connecté + Pixel (événements) | Compte publicitaire TikTok Business + app TikTok Developer (App ID/Secret) |
| **Ce qu'il mesure** | Portée/vues réelles des vidéos publiées + événements (formulaires, devis, sales, RDV) | Performance des campagnes payantes (impressions, clics, dépenses, conversions) |
| **Question à laquelle il répond** | « Mon contenu plaît-il ? Qui m'interagit ? » | « Mes pubs rapportent-elles ? » |
| **Volumétrie** | Publique (lié aux comptes sociaux connectés) | Payante (liée au budget publicitaire) |
| **Point de branchement** | Déjà actif dans l'app | À venir — nécessite l'app TikTok Developer (plan item 9) |

---

## 1. Analytics ORGANIQUE — déjà en place

C'est l'analyse de l'**activité naturelle** du compte TikTok connecté dans l'app.

### Intérêt pratique
- **Savoir si le contenu publié atteint son audience** : vues, portée, likes/commentaires des vidéos publiées via la publication d'offres.
- **Comprendre qui interagit** : le « top clients par réseau » (Réglages → Marketing, défaut 15) classe les clients les plus actifs sur TikTok → relance ciblée (bouton Relancer, `wa.me`).
- **Mesurer les micro-conversions du parcours** : événements Pixel/événements serveur (`page`, `SubmitForm`, `CompleteRegistration`, `Contact`, `Purchase`, `Schedule`).
- **Suivre la performance des ventes réelles** : l'événement `Purchase` envoie valeur, devise `XAF`, produit, quantité → les ventes saisies alimentent l'optimisation TikTok.

### Emplacement dans l'app
- Écran **Réseaux sociaux** → « 📊 Analyser mon audience ».
- Tracking automatique, non bloquant (échec silencieux).

**Bilan** : organique = **comprendre et fidéliser son audience**.

---

## 2. Analytics PUBLICITAIRE (TikTok Marketing API) — à connecter

C'est l'analyse des **campagnes payantes** TikTok Business, via l'API Marketing.

### Intérêt pratique
- **Savoir si les campagnes remboursent** : impressions, clics, dépense réelle, portée des campagnes TikTok.
- **Alimenter les campagnes du CRM** : la table `campaigns` (plateforme `tiktok`) enregistre budget prévu, dépense réelle, portée, impressions, clics → coût par prospect et attribution du CA déjà calculés dans l'app (voir `campagnes-publicitaires.md` et `attribution-ca-et-roas.md`).
- **Coupler avec l'organique** : organique pré-chauffe l'audience (notoriété), publicitaire convertit (prospects) — les deux données se complètent pour décider où mettre le budget.

### Conditions de branchement
- Compte publicitaire TikTok Business : ✅ **créé** (plan item 9, 14/09/2026).
- App TikTok Developer (App ID + Client Secret) + produit **Marketing API** + consentement des scopes : ⏳ **à créer** côté client, puis à renseigner dans l'app (Réglages → Réseaux sociaux → Connexion TikTok : `Client ID` / `Client Secret`).
- L'app devra passer l'**App Review** TikTok (vidéo démo, cas d'usage) avant d'accéder aux vraies données — voir le guide client `docs/TIKTOK_MARKETING_API_SETUP_CLIENT.md`.

**Bilan** : publicitaire = **mesurer le retour sur investissement des pubs**.

---

## Comment utiliser les deux ensemble

| Objectif | Faire pendant | Faire après |
|---|---|---|
| Notoriété locale | Publier des offres en contenu organique | Regarder portée/engagement dans Réseaux |
| Génération de prospects | Lancer une campagne TikTok payante | Comparer dépense réelle vs prospects (coût/prospect, campagne `tiktok`) |
| Améliorer le ciblage | Observer quelles vidéos organiques performent | Reproduire les formats gagnants en campagne payante |
| Calcul du retour | Suivre les achats qui suivent les campagnes | Lire le ROAS / CA attribué dans Rapports |

---

*Fichier figé au 14/09/2026 — à mettre à jour quand la TikTok Marketing API sera branchée (plan item 8).*