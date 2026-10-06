# EVO-001 — Multi-espaces : un login pour plusieurs business

- **Statut : ✅ Livrée et vérifiée** (implémentation close le 29/09/2026)
- **Date d'ouverture :** 2026-09-09
- **Décision :** Option 2 — multi-appartenance + espace actif
- **Livrables :** migrations V6, V12, V13, V14

## En clair

Un directeur gère **plus de 5 business**, chacun avec son propre compte TikTok et son propre
Facebook. Avant, une adresse e-mail donnait accès à **un seul** espace : il fallait donc autant
d'adresses, et on risquait de travailler dans le mauvais espace.

La solution retenue : **une seule adresse e-mail peut gérer plusieurs espaces**, avec un espace
actif choisi au lancement. Tout ce qui suit — clients, ventes, campagnes, comptes connectés —
est propre à l'espace choisi.

**Point central pour la sécurité** : cette séparation n'est pas seulement visuelle. Elle est
appliquée par la base de données, qui refuse de renvoyer une ligne appartenant à un autre espace.

---

## Contexte / Besoin

Le directeur gère **plus de 5 business**, chacun ayant **son propre compte TikTok** (et potentiellement son propre Facebook / Google Sheets).

Situation de départ : `profiles.org_id` lie chaque compte à **un seul** espace (`organizations`).

- 1 e-mail = 1 espace = 1 business.
- Pour gérer 5 business, il faut autant d'e-mails et des reconnexions constantes.

Besoin : gérer **plusieurs espaces depuis un même login**, tout en conservant **1 compte TikTok par business, isolé de ses voisins**.

## Bilan de l'existant (vérifié en base le 09/09/2026)

- `social_accounts` : unicité sur (espace, plateforme) → **1 connexion TikTok/Facebook par espace**.
- RLS à base d'espace partout (`current_org_id()`) : clients, créances, comptes sociaux, publications, journal d'événements, intégrations OAuth, produits et services.
- `integrations_oauth` : unicité sur (espace, fournisseur) → déjà un Google Sheets par espace.
- `social_accounts` : 0 ligne en production → aucune connexion sociale configurée.
- Profils : 3. Aucune table de multi-appartenance n'existait.
- `current_org_id()` : fonction utilisée par toutes les politiques RLS, définition à relever avant toute modification.

## Options envisagées

### Option 1 — Un login par business (état initial, zéro développement)
- 1 e-mail = 1 espace = 1 compte TikTok.
- Garde-fou : chaque business a ses propres identifiants.
- Inconvénient : 5 adresses à gérer, reconnexions permanentes, risque de se tromper de compte.

### Option 2 — Multi-appartenance + espace actif (retenue)
- Nouvelle table `org_members` : un compte appartient à plusieurs espaces.
- `current_org_id()` retourne l'espace **actif sélectionné**, avec repli sur l'ancien `profiles.org_id` → aucune régression pour les comptes existants.
- À l'ouverture : si plusieurs espaces, écran de choix ; sinon, comportement inchangé.
- Réglages → **Changer d'espace** : la bascule change clients, comptes connectés, publications et exports.
- Le compte TikTok reste **par espace** : ce modèle n'est pas modifié.
- Une adresse peut être à la fois dédiée à un espace et gestionnaire de plusieurs autres.

### Option 3 — Espace « groupe » père / fils
- Un espace « groupe » engloberait les espaces business.
- Plus complexe (héritage RLS, agrégation, propriété et permissions) — écartée, réexaminable si un besoin de vue consolidée apparaît.

## Décision

**Option 2.** Réponse directe au besoin, additive (les adresses dédiées continuent de fonctionner),
sans remettre en cause l'isolation par espace ni le modèle 1 compte social par business.

## Impact

### Base
- Nouvelle table `org_members` + politiques RLS associées.
- `current_org_id()` adapté pour lire l'espace actif, avec repli sur `profiles.org_id`.
- Aucune politique RLS appelant `current_org_id()` ne doit cesser de fonctionner.

### Application (`mayela-crm.html`)
- Écran de sélection d'espace à la connexion quand plusieurs espaces sont accessibles.
- Réglages → « Changer d'espace ».
- `activeOrgId()` devient la référence : toutes les écritures et lectures suivent l'espace actif.

### Fonctions Edge
- `social-tiktok`, `google-sheets`, `ia-conceiller` : lecture de l'espace actif.
- `social-publish`, `tiktok-events`, `adjust-events` : s'appuient sur les politiques RLS.

### Données existantes
- Aucune donnée sociale à migrer ; les tables clients, créances et produits étaient déjà cloisonnées.

## Mise en œuvre

| # | Étape | État |
|---|---|---|
| 1 | Relevé de l'implémentation de `current_org_id()` : `select org_id from profiles where id = auth.uid()` (STABLE SECURITY DEFINER) | ✅ |
| 2 | Migration V6 : `org_members` + `profiles.active_org_id` + `switch_org(uuid)` + `current_org_id()` actif + politiques de stockage | ✅ |
| 3 | Application : `activeOrgId()`, menu « Changer d'espace », bascule de toutes les écritures | ✅ |
| 4 | Fonctions Edge alignées sur l'espace actif | ✅ |
| 5 | Application de V6 en base et vérification | ✅ |
| 6 | Déploiement et tests multi-espaces | ✅ |
| 7 | **V12** — préférence « top clients » persistée en base au lieu du cache local | ✅ 28/09 |
| 8 | **V13** — cloisonnement strict entre espaces | ✅ 28/09 |
| 9 | **V14** — mode « sans espace » (solo), comblement du trou laissé par V13 | ✅ 29/09 |

## Ce que la vérification a révélé

Cette section est la plus instructive du dossier : les deux migrations de durcissement n'étaient pas
prévues au départ. Elles ont été rendues nécessaires par ce que les tests ont trouvé.

### V13 — des politiques RLS qui se neutralisaient entre elles

Les politiques de refus des visiteurs anonymes étaient **permissives** (`auth.role() <> 'anon'`).
Plusieurs politiques permissives se combinant par **OU**, dès qu'un compte était connecté, la ligne
passait par cette politique — ce qui **annulait l'effet de toutes les autres**.

Autrement dit : **la connexion suffisait à contourner le cloisonnement par espace.** Le navigateur
n'était pas en cause ; c'est la règle elle-même qui était trop laxiste.

### V14 — le mode « sans espace » n'était pas couvert

La V13 avait traité `clients` et `produits_services` avec une branche pour les comptes sans espace,
mais **pas les 5 tables enfants**, ni la table des messages de l'IA.

Or, avec deux valeurs `NULL`, une comparaison comme `org_id = current_org_id()` vaut `NULL` — et non
`true`. La ligne était donc **refusée** : le propriétaire d'un compte sans espace ne pouvait pas
accéder à ses propres données.

C'est exactement le type de trou qu'un cloisonnement incomplet produit : les comptes **sans** espace
sont plus exposés que les autres, précisément parce qu'ils suivent un chemin différent dans les règles.

## Vérification

Des tests de non-régression ont été écrits **avant** chaque migration, pour reproduire le défaut,
puis rejoués après.

| Vérification | Moyen | Résultat |
|---|---|---|
| Aucune fuite de données entre espaces | `config/verify_v13_isolation.mjs` | ✅ 11/11 |
| Compte sans espace : écriture propriétaire, relecture, conversation IA, absence de fuite, écriture concurrente refusée | `config/verify_v14_solo.mjs` | ✅ 11/11 |
| Conservation des comptes existants | Aucun changement de comportement : le repli sur `profiles.org_id` est conservé | ✅ |
| Chaque espace garde ses propres comptes connectés | Unicité sur (espace, plateforme) préservée, aucun déplacement de données | ✅ |
| Code d'invitation et appartenance | Table `org_members` pilotée par les politiques RLS | ✅ |
| Un compte peut rejoindre plusieurs espaces | `org_members` autorise plusieurs lignes par compte | ✅ |
| La bascule d'espace change clients, comptes connectés, publications et exports | **Non couvert par les tests automatisés** — reste couvert par le test manuel | ⬜ |

### Test manuel restant

Le seul point non couvert par un test automatique est la **bascule d'espace vue de l'interface** :
que les listes, les filtres, les KPI et les caches se rechargent correctement au changement d'espace.

Il est décrit au **scénario 6** de `docs/CHECKLIST_TEST_E2E.md`, et ne peut pas être exécuté tant que
l'application ne contient qu'un seul espace.

**Un point connu, à surveiller dans ce test :** le cache de l'analyse d'audience n'est pas associé à
un espace, contrairement au diagnostic des intégrations qui l'est explicitement. Après une bascule,
les chiffres de l'espace précédent peuvent s'afficher jusqu'à un rafraîchissement manuel.
Voir `docs/suivi/EN_ATTENTE.md` §10 et `CLASSE MARKETING/espaces-et-acces.md`.

## Documents liés

| Sujet | Fichier |
|---|---|
| Comportement pour l'utilisateur | `CLASSE MARKETING/espaces-et-acces.md` |
| Récapitulatif des écarts connus | `CLASSE MARKETING/README.md` |
| Suivi opérationnel | `docs/suivi/EN_ATTENTE.md` §10 |
| Schéma et politiques | `config/SCHEMA_SUPABASE.md` |
