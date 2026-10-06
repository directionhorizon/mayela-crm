# CLASSE MARKETING — comprendre le marketing de MAYELA CRM

> **Dernière vérification : 29 septembre 2026.**
> Ce dossier décrit ce que fait réellement l'application aujourd'hui, vérifié dans le code et les migrations de base de données.

---

## À quoi sert ce dossier

MAYELA CRM sert à suivre des clients et à mesurer l'effet du marketing. Ce dossier explique **la logique marketing complète** : comment les clients sont classés, comment les campagnes sont suivies, comment la rentabilité est calculée, et ce qui remonte des réseaux sociaux.

Chaque fiche est écrite en deux niveaux :

- **« En clair »** — ce que ça veut dire pour utiliser l'application, en français courant.
- **« Détail technique »** — les tables, champs et formules exacts, pour l'équipe qui maintient le code.

### Comment lire ce dossier

| Vous êtes… | Commencez par |
|---|---|
| dirigeant ou marketeur | [Entonnoir de vente](funnel-de-vente.md) puis [Rentabilité (ROAS)](attribution-ca-et-roas.md) |
| en train de paramétrer les réseaux sociaux | [Intégrations sociales](integrations-sociales.md) puis [Suivi des pubs](suivi-publicite-meta-tiktok.md) |
| en train de faire une démonstration | [Segmentation](segments-clients.md) et [Relances](relances-et-actions.md) |
| développeur ou mainteneur | les sections « Détail technique » de chaque fiche |

---

## Les 13 fiches

### Comprendre ses clients

| Fiche | En une phrase |
|---|---|
| [Segmentation des clients](segments-clients.md) | Comment l'application classe automatiquement chaque client en « nouveau », « régulier » ou « inactif ». |
| [Relances & actions](relances-et-actions.md) | Les messages à envoyer en priorité aux clients qui n'ont pas donné signe de vie. |
| [Entonnoir de vente](funnel-de-vente.md) | Où en sont mes prospects, et combien deviennent réellement acheteurs. |

### Mesurer la rentabilité

| Fiche | En une phrase |
|---|---|
| [Campagnes publicitaires](campagnes-publicitaires.md) | Comment une campagne est enregistrée, qu'elle soit saisie à la main ou importée des plateformes. |
| [Attribution du CA et ROAS](attribution-ca-et-roas.md) | Combien chaque campagne a rapporté, et si la publicité se rembourse. |
| [KPIs du tableau de bord](kpis-tableau-de-bord.md) | Les chiffres affichés en haut de l'écran d'accueil. |
| [Rapports et exports](rapports-exports.md) | Tous les rapports disponibles, leurs périodes, et l'export vers Google Sheets. |
| [Impact opérationnel](impact-operationnel.md) | Ce que l'on sait mesurer sur sa propre activité, sans dépendre des statistiques des réseaux sociaux. |

### Utiliser les réseaux sociaux

| Fiche | En une phrase |
|---|---|
| [Intégrations sociales](integrations-sociales.md) | Comment connecter Facebook et TikTok, et ce que chaque autorisation donne accès. |
| [Suivi de la publicité Meta & TikTok](suivi-publicite-meta-tiktok.md) | Comment les campagnes payantes sont récupérées automatiquement, et leurs limites. |
| [Publication d'offres](publication-offres.md) | Publier une offre sur Facebook ou TikTok depuis le CRM, ou la préparer pour un envoi manuel. |
| [Suivi des événements](tracking-pixel-tiktok.md) | Comment les ventes et les actions des clients sont transmises à TikTok pour mesurer l'impact réel. |
| [Audience et clients actifs](analyse-audience-et-insights.md) | Voir qui suit vos publications, et quels clients répondent le plus. |

---

## Les repères à connaître

**Devise.** Tous les montants sont affichés en **FCFA (XAF)**.

**Multi-espaces.** Chaque espace (par exemple PHARMAZEN) a ses propres clients, campagnes et comptes sociaux. Les données d'un espace ne sont jamais visibles depuis un autre. Voir [Espaces et accès](espaces-et-acces.md).

**Dates.** Les comparaisons de dates se font sur des chaînes locales `AAAA-MM-JJ`. Les fenêtres (30 jours, 45 jours…) sont calculées en millisecondes à partir de l'heure actuelle.

**Recalcul à l'affichage.** La segmentation, les KPIs et les statistiques sont recalculés chaque fois que l'écran s'affiche. Rien de tout cela n'est enregistré comme un résultat figé.

---

## À lire absolument avant de décider

Trois points peuvent induire en erreur si on les ignore. Ils sont détaillés dans les fiches, mais doivent être signalés ici.

### 1. Le ROAS existe en deux versions, qui ne coïncident pas

Depuis la migration **V15**, l'application enregistre la dépense publicitaire **jour par jour**. Les Rapports utilisent cet historique, ce qui permet de comparer une dépense et un chiffre d'affaires **sur la même période** — c'est le calcul fiable.

En revanche, le **tableau de bord de l'accueil** et le **résumé texte de la catégorie « Campagnes — Performance »** continuent d'utiliser le cumul `campaigns.depense_reelle`, qui n'est pas borné par la période.

→ Concrètement : **pour un ROAS fiable, utilisez la catégorie Rapports « Campagnes — Rentabilité (ROAS) »**, pas le chiffre affiché sur l'accueil. Voir [Attribution du CA et ROAS](attribution-ca-et-roas.md).

### 2. La période sélectionnée ne filtre pas tout

Le sélecteur de période (7 / 30 / 90 jours / historique) agit sur :
- les ventes, devis, créances, interactions, publications ;
- la dépense publicitaire, **depuis V15**.

Il **ne filtre pas** :
- les campagnes elles-mêmes et le nombre de prospects rattachés ;
- l'entonnoir de conversion.

Ces trois-là se lisent toujours sur la durée réelle des campagnes. C'est un choix délibéré : une campagne qui dure trois mois ne doit pas disparaître parce qu'on a choisi la semaine.

### 3. Le nombre de comptes publicitaires récupérés n'est pas encore maîtrisé

Lors d'une autorisation Meta Ads ou TikTok Marketing API, l'application récupère **tous les comptes publicitaires accessibles au profil qui a autorisé**. Il n'existe pas encore de sélecteur pour choisir lequel importer.

→ Si plusieurs comptes sont accessibles depuis le profil Facebook utilisé, ils seront tous importés. Voir [Suivi de la publicité](suivi-publicite-meta-tiktok.md).

---

## Écarts connus, non tranchés

Ces points ont été relevés et **n'ont pas été tranchés**. Ils sont documentés ici pour être visibles, pas masqués.

| Écart | Détail |
|---|---|
| Nombre de « top clients » | Le libellé de l'interface annonce « défaut : 15 » et la migration V12 a créé la colonne avec 15, mais la **valeur réellement appliquée par le code est 20**. En pratique les profils existants sont déjà à 20, donc la valeur n'est presque jamais visible. Voir [Audience et clients actifs](analyse-audience-et-insights.md). |
| Sélection des comptes publicitaires | Aucun sélecteur : tous les comptes accessibles au profil autorisé sont importés. |
| Écart de dépense non signalé | Si une dépense est saisie à la main puis écrasée par une synchronisation, l'écart est tracé en base (`depense_source`) mais pas remonté dans l'interface. |
| Unités du ROAS | Le résumé textuel affiche « X FCFA gagné(s) par FCFA dépensé » : l'unité FCFA ne convient pas à un ratio. Le nombre est correct, son libellé est fautif. |

## Écarts corrigés le 29 septembre 2026

Conservés ici pour tracer ce qui a été trouvé et corrigé, plutôt que de faire disparaître le problème.

| Écart | Correction |
|---|---|
| Cache d'audience non cloisonné | `insightsData` était réutilisé après un changement d'espace, sans vérifier sa provenance : l'analyse pouvait afficher les chiffres de l'espace précédent. Une variable `insightsOrg` associe désormais le cache à son espace, sur le modèle de `healthCacheOrg`. Les **deux** points de lecture sont protégés. Voir [Analyse d'audience](analyse-audience-et-insights.md). |
| Index de performance absents | La migration V9 (`config/MIGRATION_V9_INDEXES.sql`) était écrite depuis le 13/09 mais n'avait jamais été appliquée. Les 13 index sont en base au 29/09. Deux lignes de la migration ont été retirées au passage parce qu'elles créaient des doublons d'index déjà posés. |
| Noms d'actions inexistants | La documentation citait des actions `start` et `start_ads` sur `social-facebook`, et une fonction `saveCampaigns` : aucune n'existe dans le code. La documentation a été réalignée sur les noms réels. |

---

## État des données

Au 29 septembre 2026, l'espace **PHARMAZEN** existe mais **ne contient aucune donnée métier** : 0 client, 0 campagne, 0 produit. Tous les mécanismes décrits ici sont implémentés et vérifiés dans le code, mais **aucun n'a encore été exercé sur des données réelles**.

Conséquence importante : les chiffres affichés par l'application n'ont pas encore été confrontés à une situation réelle. C'est la prochaine étape de validation.

---

## Comment cette documentation est maintenue

- Elle est vérifiée contre `mayela-crm.html` et les Edge Functions du dossier `supabase/functions/`.
- Le schéma de base de données est défini par les migrations de `config/`, de `V1_1` à `V15`.
- Les références pointent vers des **noms de fonctions**, pas vers des numéros de ligne : le fichier principal dépasse 5 800 lignes et les numéros de ligne changent à chaque évolution.
- Toute évolution du comportement marketing doit être répercutée ici.

---

## Conventions

**Numéros de ligne.** Évités, pour la raison indiquée ci-dessus. Les noms de fonctions (`renderCentreAction`, `campaignAttribution`…) suffisent à retrouver le code.

**Marquage des incertitudes.** Les points qui appellent une décision humaine sont listés dans « Écarts connus » plutôt que présentés comme des choix établis.

**Séparation des niveaux.** Aucun détail technique ne doit apparaître avant l'explication en langage courant correspondante.
