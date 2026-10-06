# Rapports et exports

**Vérifié le 29 septembre 2026.** Code : `loadReports`, `reportRows`, `reportSummaryText`, `periodSince`.

---

## En clair

L'écran Rapports est votre outil d'analyse. Vous choisissez :
1. une **période** (7 jours, 30 jours, 90 jours, ou tout l'historique) ;
2. une **catégorie** de rapport (clients, ventes, campagnes, réseaux sociaux…) ;
3. vous consultez le tableau, éventuellement avec un résumé automatique ;
4. vous **exportez vers Google Sheets** ou en **PDF**.

Le point important : **toutes les catégories ne réagissent pas de la même façon à la période**. C'est le détail qui surprend le plus, et il est détaillé plus bas.

---

## Les périodes

| Choix | Ce que vous observez |
|---|---|
| 7 jours | la semaine |
| **30 jours** | le mois (choix par défaut) |
| 90 jours | le trimestre |
| Tout l'historique | depuis la création de l'espace |

---

## Les catégories de rapport

### Catégories classiques

| Catégorie | Contenu du tableau |
|---|---|
| **Synthèse globale** | 5 indicateurs : achats, ventes, devis, clients, créances |
| **Clients** | nom, zone, source, étape, date d'enregistrement |
| **Ventes & achats** | client, montant, produit, date |
| **Devis** | client, montant, produit, date |
| **Créances** | client, montant, produit, statut, date |
| **Interactions** | client, type, date |
| **Tâches** | client, libellé, échéance, statut |
| **Produits & services** | nom, description, prix, actif |
| **Réseaux sociaux** | réseau, contenu, statut, date |

### Catégories marketing

| Catégorie | Contenu |
|---|---|
| **Impact opérationnel** | voir la fiche dédiée |
| **Campagnes — Performance** | dépense, portée, impressions, clics, prospects, coût par prospect |
| **Campagnes — Entonnoir** | prospects, contactés, négociation, clients, acheteurs, taux |
| **Campagnes — Ventes & CA** | ventes, CA attribuable, panier moyen, acheteurs, catégories |
| **Campagnes — Rentabilité (ROAS)** | dépense, CA, ROAS, coût d'acquisition, acheteurs |

**Le dernier rapport est celui à privilégier pour juger la rentabilité** — c'est le seul qui utilise l'historique de dépense sur la bonne période. Voir [Attribution du CA et ROAS](attribution-ca-et-roas.md).

---

## ⚠️ Ce que la période ne filtre pas

C'est le piège principal de cet écran.

| Élément | Borné par la période ? |
|---|---|
| Ventes, devis, créances, interactions | ✅ Oui |
| Publications (réseaux sociaux) | ✅ Oui |
| Clients listés | ⚠️ Partiellement |
| **Dépense publicitaire** | ✅ Oui (depuis V15) |
| **Nombre de prospects** | ❌ Non |
| **Entonnoir de conversion** | ❌ Non |
| **La liste des campagnes** | ❌ Non |

**Concrètement** : si vous choisissez « 7 jours » mais que la seule campagne a tourné pendant trois mois, vous verrez quand même cette campagne, avec tous ses prospects et tout son entonnoir. Seuls les montants d'achats et de dépenses sont restreints à la semaine.

C'est un choix délibéré — une campagne en cours ne doit pas disparaître d'un rapport hebdomadaire — mais il faut le connaître pour ne pas se tromper d'interprétation.

---

## Les résumés automatiques

Chaque rapport commence par un paragraphe généré automatiquement qui résume les chiffres. Utile en démonstration, mais **attention** : ces résumés sont rédigés au temps présent sans toutes les précautions des tableaux. En particulier, le résumé de « Campagnes — Performance » utilise la dépense cumulée et non la dépense de la période, et le résumé de ROAS emploie une unité inadaptée. **En cas de doute, lisez le tableau plutôt que le résumé.**

---

## L'export

| Format | Ce qu'il produit |
|---|---|
| **Google Sheets** | un onglet par rapport, avec le titre et la période dans le nom |
| **PDF** | une version imprimable du rapport courant |

Le nom de la feuille est construit à partir de la catégorie et de la période, par exemple « Campagnes — Entonnoir de conversion 30 jours ». Les caractères interdits dans un nom de feuille (`\ / : * ? " < > |`) sont remplacés automatiquement.

L'export passe par une Edge Function côté serveur : vos identifiants Google ne transitent jamais par le navigateur.

---

## Détail technique

### La fonction `periodSince`

Convertit la période choisie en date de début ISO. Pour « tout l'historique », la date renvoyée est le 1er janvier 1970, ce qui ne filtre rien.

### Ce qui est chargé

Toutes les requêtes sont lancées en parallèle au chargement du rapport. Les filtres de date sont appliqués **côté base de données** pour les devis, créances, interactions et publications.

L'historique de dépense est chargé séparément via la table `campaign_spend_daily`, filtré sur la période.

**Point technique** : les achats passent par un cache partagé (environ 60 secondes) et sont filtrés sur la période côté navigateur, contrairement aux autres tables. Ce n'est pas incohérent en pratique, mais cela explique pourquoi les achats peuvent être très légèrement en retard sur les autres données.

### L'export Google Sheets

Le bouton d'export appelle une Edge Function `google-sheets`. Le nom de la feuille est assaini : les caractères interdits sont remplacés par des espaces, les espaces multiples réduits, et le résultat est limité à 60 caractères.

### Colonnes de la catégorie « Campagnes — Performance »

| Colonne | Origine |
|---|---|
| Campagne | `campaigns.nom` |
| Plateforme | libellé lisible (Facebook, TikTok…) |
| Type | libellé lisible (Visibilité, Leads…) |
| Dépense (FCFA) | `campaigns.depense_reelle` — **cumul, non borné** |
| Portée, impressions, clics | valeurs de la campagne |
| Prospects CRM | clients rattachés |
| Coût / prospect | dépense ÷ prospects |

**À noter** : cette catégorie utilise elle aussi le cumul non borné, contrairement à la catégorie ROAS. Si vous cherchez la dépense réellement engagée sur la période, consultez le rapport ROAS.
