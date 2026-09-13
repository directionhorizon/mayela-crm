# Plan de mise en œuvre — App CRM opérationnelle

> Reprend la logique définie dans les documents « LOGIQUE CRM », « modèles de données CRM » et
> « Modèles rapports CRM » et la confronte à l'existant de MAYELA CRM (`mayela-crm.html` +
> `config/SCHEMA_SUPABASE.md`).
>
> **Mise au point — objectif :** on prépare une **app performante et opérationnelle**, pas une app
> de « mémoire ». L'ordre de priorité optimise donc la **valeur opérationnelle quotidienne**
> (CA, fidélisation, réactivité) rapportée à l'effort, et non la rapidité d'une démonstration.

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

## 2. État de l'existant dans l'app

| Brique | État | Détail |
|--------|------|--------|
| 3. CRM mobile | ✅ Solide | Fiches clients, interactions (+ « en attente »), achats, devis, créances, tâches, **Centre d'action** (`renderCentreAction`) |
| 4. Module IA | 🟡 Débuté | Conseiller IA (`ia-conseiller`), classification, segmentation, historique des conversations |
| 5. Moteur de reporting | 🟡 Partiel | Résumés + tableaux par catégorie, export Google Sheets (`loadReports`). **Manquent** : ROAS, CA attribuable, coût/prospect, réachat |
| 1. Meta Business Suite | 🟡 Partiel | Suivi social / santé des intégrations. Pas de remontée réelle des résultats FB/IG par campagne |
| 2. TikTok Ads Manager | 🟡 Partiel | Auth TikTok, Pixel, suivi d'achat (`trackTikTokPurchase`). Pas de remontée des métriques Ads par campagne |
| 6. Tableau de bord | 🟡 Partiel | KPIs génériques (`renderDashboardKpis`). Pas encore portée/impressions/ROAS/coût par prospect ni graphiques |

**Verdict** : la colonne vertébrale (le « CRM mobile ») est opérationnelle mais capte trop peu de
données au quotidien (pas de campagne, pas de quantité, pas de traitement des demandes). Le potentiel
de CA « laissé sur la table » (demandes sans réponse, relances aveugles) est le premier chantier.

---

## 3. Écart « données requises » vs « données existantes »

Modèle de données attendu confronté au schéma Supabase.

| Donnée du modèle | Existe dans le schéma ? | Action |
|---|---|---|
| **Campagne** : budget prévu, dépense réelle, portée, impressions, clics/messages, type, période, catégorie | ❌ Aucune table `campaigns` (`social_posts` = journal de pubs, pas un modèle campagne) | **Créer la table** `campaigns` |
| Prospect : source | ✅ `clients.source` | — |
| Prospect : **campagne d'origine** | ❌ | Ajouter `clients.campagne_origine` |
| Prospect : **consentement promotionnel** | ❌ | Ajouter `clients.consentement` (booléen) |
| Prospect : date premier contact | ✅ `clients.created_at` | — |
| Prospect : statut | ✅ `clients.stage_override` | — |
| Vente : montant, date, client, produit | ✅ `achats` | — |
| Vente : **quantité** | ❌ | Ajouter `achats.quantite` (entier) |
| Vente : **campagne associée** | ❌ | Ajouter `achats.campagne_id` → `campaigns` |
| Vente : initiale / réachat | ⚠️ Calculable | ≥ 2 achats = réachat, sans colonne |
| Interaction : **canal** | ✅ `interactions.type` (fb/tiktok/whatsapp/appel/visite) | — |
| Interaction : **type** (message/clic/demande de prix) | ❌ Confondu avec le canal | Ajouter `interactions.type_interaction` |
| Interaction : statut traité/en attente + délai de réponse | ❌ | Ajouter `interactions.statut_traitement` (+ calcul du délai) |
| Produit : **catégorie** | ❌ (`produits_services` sans catégorie) | Ajouter `produits_services.categorie` |

---

## 4. Impact sur les 5 rapports du mémoire

| Rapport | Données bloquantes | Faisable aujourd'hui ? |
|---|---|---|
| **5. Clients & réachat** → devient un **outil d'action** (relances) | segments, CA, dernier achat, réachats, action suggérée | ✅ **Oui, données actuelles** — aucun changement de schéma |
| **2. Entonnoir de conversion** | comptage par campagne | ✅ global / ❌ par campagne |
| **1. Performance des campagnes** | table `campaigns` + `clients.campagne_origine` | ❌ |
| **3. Ventes & CA attribués** | + `achats.campagne_id` | ❌ |
| **4. Rentabilité publicitaire** | + dépense réelle des campagnes | ❌ |

Rappel des formules :
- Coût par prospect = dépense réelle ÷ prospects CRM créés
- Taux de conversion = prospects ayant acheté × 100 ÷ prospects CRM
- CA attribuable = Σ montants des ventes liées à la campagne
- Panier moyen = CA attribuable ÷ nombre de ventes attribuées
- ROAS = CA attribuable ÷ dépense publicitaire
- Coût d'acquisition client = dépense ÷ nouveaux clients acheteurs
- Taux de réachat = clients ayant acheté au moins 2 fois

---

## 5. Ordre de priorité opérationnel

**Principe :** chaque étape maximise la valeur opérationnelle quotidienne (CA / réactivité /
fidélisation) ÷ effort, en s'appuyant sur l'existant.

### Étape 1 — Fondation : capturer au point de vente (~1–2 h) 🔑 ✅ APPLIQUÉE
*Une seule migration (`config/MIGRATION_V8_CAMPAGNES.sql`, appliquée en base le 12/09/2026)
+ micro-ajustements de formulaires.*

- **Motif** : aucun rapport, aucune relance ciblée, aucune attribution possible sans données
  saisies au bon endroit. C'est le socle ; le faire tôt évite de re-travailler après.
- **Actions** :
  - Table `campaigns` : org_id, nom/ID campagne, plateforme (facebook/instagram/tiktok), type,
    période (début/fin), catégorie promue, budget prévu, dépense réelle, portée, impressions, clics/messages.
  - Colonnes : `clients.campagne_origine`, `clients.consentement`, `achats.campagne_id`,
    `achats.quantite`, `produits_services.categorie`, `interactions.type_interaction`,
    `interactions.statut_traitement`.
  - RLS alignées sur les tables existantes (isolation org).
  - Formulaire d'achat existant (fiche client) : ajouter le champ **quantité** (valeur par défaut 1) — pas de formulaire dédié, on enrichit l'existant.
- **Livrable** : les ventes et prospects portent désormais quantité + attribution campagne. Rien
  ne bloque plus la suite.

### Étape 2 — Centre d'action : relances intelligentes + demandes en attente (~1 h) 💰 ✅ APPLIQUÉE
*Transforme le rapport 5 du mémoire en OUTIL quotidien. Livré le 13/09/2026 dans `mayela-crm.html`.*

- **Motif** : c'est le levier de CA le plus rapide pour une PME — récupérer les clients inactifs,
  remercier les nouveaux, fidéliser les réguliers, et surtout **ne plus laisser une demande sans réponse**.
- **Actions** (état réel du code) :
  - **Centre d'action sur l'accueil** (`renderCentreAction`, remplace `relanceCandidates`) :
    - Section **« À traiter »** : interactions `statut_traitement = en_attente` triées par
      ancienneté, avec raccourci **WhatsApp 💬** et bouton **✓ Traité**.
    - Section **« Segments à relancer »** : Nouveaux (< 30 j), Réguliers (ré-achat < 45 j),
      Inactifs (> 45 j / jamais acheté, avec comptage « X consentent »), Intérêt catégorie
      (affichée dès que des catégories sont saisies).
    - Section **« Relances prioritaires »** : jusqu'à 6 inactifs, message WhatsApp pré-rempli
      uniquement si `consentement !== false` (sinon mention « sans consentement »).
  - **Fiche client** : case **« En attente »** sur le formulaire d'interaction (saisit
    `statut_traitement = en_attente`), badge `EN ATTENTE` + « ✓ Traité » dans la liste.
- **Livrable** : le commercial ouvre l'app le matin et voit exactement **qui répondre et qui relancer**. C'est l'usage quotidien le plus rentable.

### Étape 3 — Saisie des campagnes + rapports « Performance » & « Entonnoir » (~1–1,5 h) 📢

- **Motif** : le responsable doit savoir **quelle campagne amène des prospects et à quel coût**
  (coût par prospect) et où les prospects sont perdus (montrer que le problème vient de la
  réactivité ou de la relance → relance le centre d'action de l'étape 2).
- **Actions** :
  - **Sous-page « Campagnes »** dans l'écran « Réseaux » : bouton dédié → liste + formulaire de création (nom, plateforme, type, période, catégorie, budget, dépense, portée, impressions, clics/messages).
  - Associer la campagne d'origine à la création d'une fiche prospect (menu déroulant depuis les campagnes existantes).
  - Rapport « Performance des campagnes » : dépense, portée, clics/messages, prospects CRM créés, coût par prospect (formule §4).
  - Rapport « Entonnoir de conversion » : prospects → contactés → relancés → achats, taux de conversion par campagne.
- **Livrable** : comparer objectivement les campagnes (même à portées différentes) + localiser les pertes.

### Étape 4 — Rapports « CA attribuable » & « Rentabilité (ROAS) » (~1 h) 💵

- **Motif** : le lien direct « publicité → ventes parapharmaceutiques » = décision budgétaire.
  Justifier ce qu'on dépense en pub ne tient qu'à ce calcul.
- **Actions** :
  - « Ventes & CA attribués » : par campagne → catégorie de produit, clients acheteurs, ventes,
    CA attribuable, panier moyen.
  - « Rentabilité publicitaire » : dépense, CA attribuable, ROAS, coût d'acquisition client.
- **Livrable** : l'app prouve (ou non) la rentabilité des campagnes et oriente le budget.

### Étape 5 — Tableau de bord consolidé (~1 h) 📊

- **Motif** : la vue d'ensemble en une ouverture : ce qui se passe aujourd'hui (demandes en attente,
  relances dues, ventes du jour) + ce qui va bien (ROAS, coût par prospect, panier moyen, réachat).
- **Actions** :
  - Cartes KPIs : demandes en attente, relances à faire, ventes du jour, CA du jour.
  - Graphique simple : répartition du CA ou des prospects par campagne (option A : libellés barres).
- **Livrable** : le responsable décide en 30 secondes, tableaux/cartes/graphiques simples.

**Chronologie cumulée estimée : ~5–7 h.**

---

## 6. Décisions confirmées

### Saisie des campagnes : manuel (V1) + auto-sync (V2)

- **V1 — Saisie manuelle (retenue pour le passage en prod)**
  L'équipe saisit en 1 minute ce qu'elle lit dans Meta/TikTok Ads Manager : dépense,
  portée, impressions, clics. Fonctionne avec une connexion limitée, aucun token API à
  gérer, aucun risque de coupure externe. Le formulaire existe déjà via la sous-page
  « Campagnes » de l'écran Réseaux.

- **V2 — Synchronisation automatique (amélioration ultérieure, non bloquante)**
  Meta Graph API et TikTok Marketing API exposent des endpoints (respectivement
  `ads_insights` et `report/integrated/get`) qui retournent exactement les métriques
  cibles (spend, reach, impressions, clicks) au niveau campagne. L'infrastructure
  partielle existe déjà côté Edge Functions (`social-insights`). V2 consiste à :
  quand un compte Meta/TikTok est connecté (déjà en place dans l'écran Réseaux),
  tirer automatiquement les métriques au moment de la création de la campagne ou en
  tâche de fond. 2–3× de travail en plus (OAuth tokens, refresh, mapping) — à
  re-planifier une fois l'app en usage réel.

**Position officielle** : le formulaire de campagne est conçu pour les deux chemins.
V1 est fiable jour 1. V2 s'y greffe sans changer la structure.

### Formulaire de vente

Pas de formulaire dédié séparé. La **quantité** est ajoutée comme champ existant
dans le formulaire d'achat dans la fiche client (valeur par défaut 1). Enrichissement
de l'existant, pas de refonte.

### Écran « Campagnes »

**Sous-page de l'écran Réseaux** (pas un onglet nav dédié). Un bouton « Campagnes »
dans l'écran Réseaux ouvre la sous-page dédiée (liste + formulaire).

---

*Document lié : `config/SCHEMA_SUPABASE.md` (schéma actuel), `mayela-crm.html` (app), LOGIQUE CRM / modèles de données / modèles rapports (mémoire).*  