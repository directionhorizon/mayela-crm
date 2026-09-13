# Meta Ads Manager & données recueillies (Facebook — WhatsApp)

## Résumé

- **Ce qui est recueilli automatiquement** : les **événements webhook** de chaque message WhatsApp (contenu, numéro qui écrit, horodatage, statut livré/lu) + **Insights API** (agrégats par numéro).
- **Meta Ads Manager est unique et commun** : un **seul compte publicitaire, un seul tableau de bord** pour les pubs **Facebook, Instagram, Messenger et WhatsApp (Click-to-WhatsApp)**.
- **Ads Manager = le côté pub** (impressions, clics, dépense, conversions — agrégats) ; **Webhook = le côté conversation** (détail par contact). Le CRM combine les deux.
- WhatsApp Cloud ne calcule aucune campagne : **l'attribution et les rapports se font dans le CRM** (principe : *WhatsApp transmet → le CRM attribue → la base stocke → les rapports calculent*).

---

## 1. Les données recueillies automatiquement

### 1.1 Webhook WhatsApp — données par message (la source de vérité)
Chaque message déclenche un événement transmis à votre serveur :

| Événement | Données transmises | Exemple |
|---|---|---|
| Message **reçu** | Numéro `wa_id` de l'expéditeur, contenu, type de média (texte/image/vidéo…), horodatage | « +23769… → “Bonjour, je suis intéressé par l'offre NOEL25” via WhatsApp » |
| Message **envoyé** | Confirmations de distribution | « message distribué / lu » |
| **Statuts** | `delivered`, `read` → conversation ouverte, contact joignable | « lu à 14:32 » |
| Conversation | Session initiée par l'entreprise ou par l'utilisateur, modèle de message utilisé | « session utilisateur » |

C'est ce qui permet l'analyse **par client** : nb d'échanges, taux de lecture, temps de réponse.

### 1.2 Insights API — agrégats par numéro
Modules via `/insights` (plages 24 h / 7 / 14 / 30 / 90 jours) :

- `messages_sent`, `messages_delivered`, `messages_read`
- `conversation`, `conversation_label` (entreprise / utilisateur)
- `cost` (facturation Meta par conversation)
- Qualité des numéros et des messages modèles (vert / orange / rouge)

**Limites** : pas de profil démographique, pas de détail « qui a lu quoi » (privé), pas de notion de campagne.

## 2. Le champ (périmètre) de Meta Ads Manager

### 2.1 Un seul Ads Manager pour tout l'écosystème Meta
Le **compte publicitaire** est le même pour :
- les pubs **Facebook** (feed, stories, reels) ;
- les pubs **Instagram** ;
- les pubs **Messenger** ;
- les pubs **WhatsApp** (objectif « Messagerie » / **Click-to-WhatsApp** : l'utilisateur clique sur la pub → la discussion WhatsApp s'ouvre).

Il n'y a **pas deux interfaces à surveiller** : Facebook et WhatsApp se pilotent et se mesurent dans **le même tableau de bord**, même devise, mêmes exports.

### 2.2 Données fournies par Ads Manager

| Type | Métriques |
|---|---|
| **Communes à toutes les pubs** | Impressions, clics, dépense, CTR, CPM, CPC, conversions (pixel / Conversions API), résultats |
| **Propres au Click-to-WhatsApp** | **Conversations démarrées** (starts), messages envoyés depuis la pub, **coût par conversation**, messages ouverts/répondues |
| **Segmentation** | Par campagne, groupe de pubs, pub, période, plateforme de diffusion |

Ces données sont des **agrégats de la pub** : elles disent « la pub a coûté X, généré Y clics et Z conversations » — c'est le socle des rapports de rentabilité (CA attribué, ROAS, coût d'acquisition).

## 3. Qui fournit quoi (récapitulatif)

| Acteur | Données | Granularité | Usage dans le CRM |
|---|---|---|---|
| **Meta Ads Manager** | Impressions, clics, dépense, CTR, CPM, CPC, conversions, conversations démarrées, coût/conversation | Pubs / campagnes (agrégats) | Dépense réelle, coût par prospect, ROAS, panier moyen, réachat |
| **Webhook WhatsApp** | Chaque message reçu/envoyé, statuts livré/lu, contenu | **Par contact** | Interactions automatiques, top clients par réseau, relance si non lu |
| **Insights API** | Messages envoyés/livrés/lus, conversations, coût, qualité | Par numéro | Supervision plateforme |
| **CRM (local)** | Croisement client ↔ campagne, historique | Par client + campagne | Segmentation, attribution, entonnoir, rapports |

## 4. Conséquence pour les campagnes Facebook ET WhatsApp

- **Une seule source** pour le volet pub : Ads Manager couvre les deux familles dans un même compte → les rapports peuvent mettre côte à côte les KPIs Facebook et WhatsApp (dépense, clics, leads, conversions).
- Le **détail conversationnel** (qui a répondu, relancé, acheté) reste fourni par le **webhook** → relié au client via `wa_id`, attribué à la campagne (code du lien pré-rempli, contexte de pub ou numéro dédié).
- Résultat : campagnes Facebook et WhatsApp analysées **sans saisie manuelle** dès que le webhook est branché.

---

### Références dans le code
- `supabase/functions/social-publish/index.ts:124` — état actuel (Cloud API non branchée).
- `mayela-crm.html` — `loadSocialTopClients`, table `interactions` (types `whatsapp/facebook/tiktok`), table `campaigns`.
- `campagnes-publicitaires.md` (champ `depense_reelle` lu dans Ads Manager), `attribution-ca-et-roas.md` (ROAS, coût d'acquisition).