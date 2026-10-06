# Plan de mise en œuvre — App CRM opérationnelle

> **Plan exécuté. Dernière mise à jour : 29 septembre 2026.**
> Reprend la logique des documents « LOGIQUE CRM », « modèles de données CRM » et « Modèles rapports CRM »,
> et la confronte à l'existant de MAYELA CRM (`mayela-crm.html` + `config/SCHEMA_SUPABASE.md`).

## En clair

Ce document est le **plan de construction** du volet « pilotage » de MAYELA CRM : capter les données
au point de vente, transformer le fichier clients en outil de relance quotidienne, puis mesurer ce que
rapporte la publicité.

**Les 5 étapes prévues ont été appliquées** entre le 12 et le 13 septembre 2026.

Ce qui a changé depuis : l'étape 6 prévue — la **synchronisation automatique** des campagnes — a
elle aussi été réalisée (migrations V10, V10.1 et V11), puis renforcée par un historique de dépense
quotidien (V15). Le comportement marketing qui découle de tout cela est expliqué dans
**`CLASSE MARKETING/`** ; ce document explique **pourquoi** les choses ont été faites ainsi.

**Objectif de la mise au point** : préparer une app **performante et opérationnelle**, pas une app
de « mémoire ». L'ordre de priorité optimise la **valeur opérationnelle quotidienne** (CA,
fidélisation, réactivité) rapportée à l'effort, et non la rapidité d'une démonstration.

---

## 1. Logique CRM cible (6 briques)

| # | Brique | Rôle |
|---|--------|------|
| 1 | Meta Business Suite | Résultats Facebook / Instagram : portée, impressions, clics, messages, budget, coût par résultat |
| 2 | TikTok Ads Manager | Résultats TikTok : vues, clics, leads, dépenses, performances des publicités |
| 3 | CRM mobile | Centralise contacts, messages, campagnes, données de vente, préférences et relances |
| 4 | Module IA du CRM | Classe les demandes, aide à segmenter, détecte des tendances, suggère des relances, résume les interactions |
| 5 | Moteur de reporting | Conversion, CA attribuable, coût par prospect, panier moyen, réachat, ROAS, résultats par campagne |
| 6 | Tableau de bord | Présente les résultats au responsable : tableaux, cartes et graphiques simples |

---

## 2. État de l'existant — aujourd'hui

| Brique | État | Détail |
|--------|------|--------|
| 3. CRM mobile | 🟢 Opérationnel | Fiches clients, interactions (+ « en attente »), achats, devis, créances, tâches, Centre d'action (`renderCentreAction`) |
| 4. Module IA | 🟡 Débuté | Conseiller IA (`ia-conseiller`, moteur Gemini), classification, segmentation, historique des conversations |
| 5. Moteur de reporting | 🟢 Opérationnel | Résumés + tableaux par catégorie, export Google Sheets (`loadReports`), catégories Campagnes (Performance, Entonnoir, CA attribué, ROAS) et Impact opérationnel |
| 1. Meta Business Suite | 🟢 Intégré | Publication sur la Page **et** synchronisation Meta Ads (dépenses, impressions, clics) via `social-facebook`. Revue Meta encore requise pour les permissions publicitaires |
| 2. TikTok Ads Manager | 🟡 Code prêt, accès bloqué | Synchronisation `marketing_sync` opérationnelle côté code (campagnes, dépenses, leads, audiences). **Bloqué par la revue TikTok**, application rejetée puis mise en pause |
| 6. Tableau de bord | 🟢 Opérationnel | KPIs accueil (`renderDashboardKpis`) + section Performance publicitaire (`renderDashboardPerf`) |

**Point de vigilance sur la brique 5 et 6** : le calcul de rentabilité existe en **deux versions** qui
ne coïncident pas. Les rapports utilisent l'historique de dépense quotidien (V15) et respectent la
période ; le tableau de bord et le résumé « Campagnes — Performance » utilisent encore le cumul
`campaigns.depense_reelle`, non borné par la période. Voir `CLASSE MARKETING/README.md`.

---

## 3. Écadre « données requises » vs « données existantes »

*État constaté au moment du plan, avant migration. La colonne « Action » indique ce qui a été fait.*

| Donnée du modèle | Existait dans le schéma ? | Action |
|---|---|---|
| **Campagne** : budget prévu, dépense réelle, portée, impressions, clics/messages, type, période, catégorie | ❌ Aucune table `campaigns` (`social_posts` est un journal de publications, pas un modèle campagne) | ✅ Table `campaigns` créée (V8) |
| Prospect : source | ✅ `clients.source` | — |
| Prospect : **campagne d'origine** | ❌ | ✅ `clients.campagne_origine` |
| Prospect : **consentement promotionnel** | ❌ | ✅ `clients.consentement` |
| Prospect : date de premier contact | ✅ `clients.created_at` | — |
| Prospect : statut | ✅ `clients.stage_override` | — |
| Vente : montant, date, client, produit | ✅ `achats` | — |
| Vente : **quantité** | ❌ | ✅ `achats.quantite` |
| Vente : **campagne associée** | ❌ | ✅ `achats.campagne_id` |
| Vente : initiale / réachat | ⚠️ Calculable | ≥ 2 achats = réachat, sans colonne dédiée |
| Interaction : **canal** | ✅ `interactions.type` (facebook / tiktok / whatsapp / appel / visite) | — |
| Interaction : **type** (message / clic / demande de prix) | ❌ Confondu avec le canal | ✅ `interactions.type_interaction` |
| Interaction : statut traité / en attente | ❌ | ✅ `interactions.statut_traitement` |
| Produit : **catégorie** | ❌ | ✅ `produits_services.categorie` |

---

## 4. Les 5 rapports et leur faisabilité

*Faisabilité **avant** exécution du plan, puis état obtenu.*

| Rapport | Données bloquantes | Faisable avant ? | État |
|---|---|---|---|
| **Clients & réachat** → devenu un **outil d'action** (relances) | segments, CA, dernier achat, réachats, action suggérée | ✅ Oui, données actuelles | ✅ Réalisé (étape 2) |
| **Entonnoir de conversion** | comptage par campagne | ✅ global / ❌ par campagne | ✅ Réalisé (étape 3) |
| **Performance des campagnes** | table `campaigns` + `clients.campagne_origine` | ❌ | ✅ Réalisé (étape 3) |
| **Ventes & CA attribués** | + `achats.campagne_id` | ❌ | ✅ Réalisé (étape 4) |
| **Rentabilité publicitaire (ROAS)** | + dépense réelle des campagnes | ❌ | ✅ Réalisé (étape 4) |

**Formules de référence :**
- Coût par prospect = dépense réelle ÷ prospects CRM créés
- Taux de conversion = prospects ayant acheté × 100 ÷ prospects CRM
- CA attribuable = Σ montants des ventes liées à la campagne
- Panier moyen = CA attribuable ÷ nombre de ventes attribuées
- ROAS = CA attribuable ÷ dépense publicitaire
- Coût d'acquisition client = dépense ÷ nouveaux clients acheteurs
- Taux de réachat = clients ayant acheté au moins 2 fois

---

## 5. Les 5 étapes, exécutées

**Principe :** chaque étape maximise la valeur opérationnelle quotidienne (CA / réactivité /
fidélisation) ÷ effort, en s'appuyant sur l'existant.

### Étape 1 — Fondation : capturer au point de vente 🔑 APPLIQUÉE
*Migration `MIGRATION_V8_CAMPAGNES.sql`, appliquée en base le 12/09/2026, plus quelques ajustements de formulaires.*

- **Motif** : aucun rapport, aucune relance ciblée, aucune attribution possible sans données saisies au bon endroit. C'est le socle ; le faire tôt évite de retravailler après.
- **Livré** : table `campaigns` complète ; colonnes `clients.campagne_origine`, `clients.consentement`, `achats.campagne_id`, `achats.quantite`, `produits_services.categorie`, `interactions.type_interaction`, `interactions.statut_traitement` ; RLS alignées sur l'isolation par espace ; champ **quantité** ajouté au formulaire d'achat existant (défaut 1), sans créer de formulaire dédié.

### Étape 2 — Centre d'action : relances intelligentes + demandes en attente 💰 APPLIQUÉE
*Livrée le 13/09/2026 dans `mayela-crm.html`.*

- **Motif** : c'est le levier de CA le plus rapide pour une PME — récupérer les clients inactifs, remercier les nouveaux, fidéliser les réguliers, et surtout ne plus laisser une demande sans réponse.
- **Livré** : `renderCentreAction` sur l'accueil, avec trois sections :
  - **« À traiter »** : interactions `statut_traitement = en_attente`, triées par ancienneté, avec raccourci WhatsApp et bouton « ✓ Traité ».
  - **« Segments à relancer »** : Nouveaux (≤ 30 j), Réguliers (dernier achat ≤ 45 j), Inactifs (> 45 j ou jamais acheté, avec comptage « X consentent »), Intérêt catégorie.
  - **« Relances prioritaires »** : jusqu'à 6 inactifs, message WhatsApp pré-rempli uniquement si le consentement n'est pas explicitement refusé.
  - Fiche client : case **« En attente »** sur le formulaire d'interaction, badge `EN ATTENTE` et action « ✓ Traité » dans la liste.
- **Usage** : le commercial ouvre l'application le matin et voit exactement **qui répondre et qui relancer**. C'est l'usage quotidien le plus rentable.

### Étape 3 — Saisie des campagnes + rapports « Performance » & « Entonnoir » 📢 APPLIQUÉE
*Livrée le 13/09/2026.*

- **Motif** : le responsable doit savoir **quelle campagne amène des prospects et à quel coût**, et où les prospects sont perdus — pour montrer que le problème vient de la réactivité ou de la relance, donc de l'étape 2.
- **Livré** : sous-page « Campagnes » dans l'écran Réseaux, avec formulaire de création (nom, plateforme, type visibilité/messages/leads/promotion produit, catégorie, dates, budget, dépense, portée, impressions, clics) ; suppression d'une campagne **conservant** prospects et ventes ; sélecteur « Campagne d'origine » sur la création d'un client ; rapports **Performance** et **Entonnoir de conversion**, exportables.

### Étape 4 — Rapports « CA attribuable » & « Rentabilité (ROAS) » 💵 APPLIQUÉE
*Livrée le 13/09/2026, déployée sur Vercel.*

- **Motif** : le lien direct « publicité → ventes » est ce qui justifie ou infirme une dépense publicitaire. C'est une décision budgétaire.
- **Livré** : liste déroulante « Aucune / <campagne> » dans l'onglet Ventes de la fiche client, enregistrant `achats.campagne_id` ; rapport **Ventes & CA attribués** ; rapport **Rentabilité (ROAS)** avec dépense, CA attribuable, ROAS et coût d'acquisition client.

### Étape 5 — Tableau de bord consolidé 📊 APPLIQUÉE
*Livrée le 13/09/2026, déployée sur Vercel.*

- **Motif** : la vue d'ensemble en une ouverture — ce qui se passe aujourd'hui (demandes en attente, relances dues, ventes du jour) et ce qui va bien (ROAS, coût par prospect, panier moyen, réachat).
- **Livré** : grille KPI portée à 6 cartes (Clients actifs, À traiter, Tâches en retard, Ventes du jour, Devis 30 j, Achats 30 j) ; section **📊 Performance publicitaire** affichée seulement s'il existe des campagnes, avec ROAS, coût/prospect, panier moyen, réachat et graphique de la répartition du CA attribué par campagne (top 5).

**Chronologie cumulée de l'exécution : ~5 à 7 h.**

---

## 6. Saisie des campagnes : ce qui a été décidé, et ce qui a changé

### Décision initiale : manuel d'abord, automatique ensuite

Le formulaire de campagne a été conçu pour **les deux** chemins.

- **V1 — saisie manuelle.** L'équipe saisit en une minute ce qu'elle lit dans Meta ou TikTok Ads Manager : dépense, portée, impressions, clics. Fonctionne sans jeton API, sans risque de coupure externe. **C'est ce qui a été livré en septembre.**
- **V2 — synchronisation automatique.** Prévue comme une amélioration ultérieure, non bloquante.

### Ce que V2 est devenue

**V2 a été réalisée, et va au-delà de ce qui était prévu.**

| Étape | Contenu |
|---|---|
| V10 (15/09) | Synchronisation TikTok Marketing API : campagnes, groupes d'annonces, dépenses |
| V10.1 | Leads et audiences TikTok, colonnes `tik_*`, campagne de source `tik` |
| V11 (25/09) | Synchronisation Meta Ads : comptes publicitaires, campagnes, ensembles de pubs, dépenses |
| Correction du 29/09 | Séparation des autorisations Meta **Page** et **Ads**, pour que le refus de la revue publicitaire ne bloque plus l'accès à la page |
| V15 (29/09) | Historique de dépense **jour par jour** (`campaign_spend_daily`), qui rend le ROAS calculable sur la bonne période |

**Conséquence** : la saisie manuelle n'est plus la seule voie, mais elle **reste disponible** — utile
quand un compte publicitaire n'est pas connecté, ou pour corriger une valeur.

**Deux limites introduites par cette automatisation, documentées et non tranchées :**
- aucun sélecteur de compte : **tous** les comptes accessibles au profil qui a autorisé sont importés ;
- aucune conversion de devise entre la dépense publicitaire (devise du compte) et les ventes (FCFA).

---

## 7. Décisions confirmées

### Formulaire de vente

Pas de formulaire dédié séparé. La **quantité** a été ajoutée comme champ dans le formulaire
d'achat de la fiche client (défaut 1). Enrichissement de l'existant, pas de refonte.

### Écran « Campagnes »

**Sous-page de l'écran Réseaux** (pas un onglet de navigation dédié). Un bouton ouvre la sous-page
dédiée (liste + formulaire).

---

## 8. Notes de performance (appliquées le 13/09/2026)

Garder l'application réactive sur mobile à mesure que le volume grossit :

- **Cache partagé des achats (60 s)** : le tableau de bord, le centre d'action et les rapports lisaient chacun toute la table `achats`. Une seule lecture est désormais partagée via `getAchatsAll()`, les périodes étant calculées en mémoire. Invalidation après ajout ou suppression.
- **Clients allégés** : `loadClientsCache()` ne sélectionne que les colonnes réellement affichées au lieu de `*`.
- **Anti-rebond de 90 ms** sur la recherche clients (pas de rendu DOM à chaque frappe).
- **Index** : `MIGRATION_V9_INDEXES.sql` — **appliquée le 29/09/2026** (elle attendait depuis
  le 13/09, sans trace dans le runbook de déploiement). 13 index couvrent les colonnes de filtrage
  des rapports et du tableau de bord (date d'achat, campagne, client, statut de traitement des
  interactions, échéance des tâches, statut de publication, dates de devis et de créance).
- **Limite honnête** : pas de pagination serveur ni de recherche SQL — les listes sont chargées entièrement. Pertinent jusqu'à quelques milliers de lignes ; à reconsidérer au-delà. C'est cette absence de pagination, plus que les index, qui pèsera sur les gros volumes.

---

## Documents liés

| Sujet | Fichier |
|---|---|
| Comportement marketing expliqué | `CLASSE MARKETING/` |
| Schéma actuel | `config/SCHEMA_SUPABASE.md` |
| Application | `mayela-crm.html` |
| Suivi des points en attente | `docs/suivi/EN_ATTENTE.md` |
