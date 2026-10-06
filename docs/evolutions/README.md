# Évolutions majeures — documentation

> **Mis à jour le 29 septembre 2026.** La table ci-dessous a été complétée avec les évolutions
> structurantes livrées depuis l'ouverture de ce dossier.

## En clair

Ce dossier est le **journal des évolutions de fond** de MAYELA CRM : les changements qui modifient la
manière de travailler, pas les petites corrections.

Chaque évolution peut faire l'objet d'un fichier `EVO-<identifiant>.md`, qui sert d'**étude** (contexte,
options, décision) puis de **mémoire** (mise en œuvre, vérification, statut).

Toutes les évolutions livrées ne justifient pas un fichier : une simple synchronisation d'un
fournisseur est consignée dans `docs/suivi/EN_ATTENTE.md`. **Le dossier est réservé aux
évolutions qui changent la sécurité, la structure de données ou le modèle de travail.**

---

## Règle

- Toute évolution structurante (schéma de base, multi-comptes, sécurité, modèle de mesure) est documentée ici **avant** son développement.
- Le fichier reste ouvert pendant le développement, puis est mis à jour à la livraison.
- Les évolutions abouties sont marquées `✅ Livrée` ; les études non retenues, `❌ Abandonnée` (pour ne pas perdre la réflexion).

## Modèle de fichier

```markdown
# EVO-<id> — <Titre>

- Statut : 📝 Étude | 🚧 En cours | ✅ Livrée | ❌ Abandonnée
- Date : <AAAA-MM-JJ>
- Décision : <option choisie>

## Contexte / Besoin
## Options envisagées
## Décision
## Impact (base, app, sécurité, données existantes)
## Plan de mise en œuvre
## Ce que la vérification a révélé
## Vérification
```

## Table des évolutions

### Avec dossier d'étude

| Id | Titre | Statut | Ouvert | Livré |
|----|-------|--------|--------|-------|
| EVO-001 | Multi-espaces : un login pour plusieurs business | ✅ Livrée | 09/09/2026 | 29/09/2026 |

### Sans dossier d'étude, consignées dans le suivi

Ces évolutions sont structurantes mais ont été conduites comme des correctifs ou des livraisons
planifiées. Leur trace complète est dans **`docs/suivi/EN_ATTENTE.md`** et dans **`config/`**.

| Sujet | Livrable | Date |
|-------|----------|------|
| Capture du point de vente : table campagnes et champs d'attribution | Migration V8 — appliquée | 12/09/2026 |
| Index de performances sur les colonnes de filtrage | Migration V9 — appliquée | 29/09/2026 |
| Synchronisation TikTok Marketing API | Migration V10 + `social-tiktok` — appliquées | sept. 2026 |
| Leads et audiences TikTok | Migration V10.1 — appliquée | sept. 2026 |
| Synchronisation Meta Ads | Migration V11 + `social-facebook` | 25/09/2026 |
| Préférence « top clients » persistée en base | Migration V12 — appliquée | 28/09/2026 |
| Cloisonnement strict entre espaces | Migration V13 — appliquée | 28/09/2026 |
| Mode « sans espace » (solo) | Migration V14 — appliquée | 29/09/2026 |
| Historique de dépense quotidien, pour un ROAS calculé sur la bonne période | Migration V15 | 29/09/2026 |
| Séparation des autorisations Meta Page et Ads | Correction de `social-facebook` et de l'interface | 29/09/2026 |
| Suppression de la durée de vie des codes de connexion | Configuration de l'authentification | 28/09/2026 |
| Cloisonnement du cache d'analyse d'audience par espace | Correction de `mayela-crm.html` (`insightsOrg`) | 29/09/2026 |

### Points ouverts, à ne pas perdre de vue

| Sujet | Où c'est suivi |
|---|---|
| Application TikTok **rejetée** à la revue, mise en pause | `EN_ATTENTE.md` §1 |
| Connexion Meta (Page) : les 2 use cases ajoutés sur l'app existante | `EN_ATTENTE.md` §7 |
| Absence de **sélecteur de compte publicitaire** | `CLASSE MARKETING/README.md` (écarts connus) |
| Divergence de la valeur par défaut « top clients » (15 annoncé, 20 appliqué) | `EN_ATTENTE.md` §10 |
| Coût de l'application pour le client | À définir — non traité à ce jour |

Deux points qui figuraient dans cette table ont été **résolus le 29 septembre 2026** : le cache
d'analyse d'audience est désormais cloisonné par espace, et la migration V9 (index de performances)
est appliquée en base.

---

## Références croisées

| Sujet | Fichier |
|---|---|
| Schéma de la base et politiques RLS | `config/SCHEMA_SUPABASE.md` |
| Migrations | `config/MIGRATION_*.sql` |
| Déploiement des fonctions | `config/DEPLOY_BACKEND.md` |
| Protocole des intégrations | `config/PROTOCOLE_INTEGRATIONS.md` |
| Suivi fonctionnel et blocages | `docs/suivi/EN_ATTENTE.md` |
| Comportement marketing expliqué | `CLASSE MARKETING/` |

## Ce que ce dossier a appris

Deux enseignements utiles pour la suite, tirés d'EVO-001 :

1. **Un cloisonnement incomplet protège moins bien ceux qu'il oublie.** Les comptes *sans* espace
   suivaient un chemin différent dans les règles RLS, et se sont révélés plus exposés que les autres.
   À chaque nouvelle règle d'accès, il faut se demander qui **sort** du cas nominal.

2. **Les tests de non-régression s'écrivent avant la migration, pas après.** Pour V13 et V14, le test
   a été écrit pour reproduire le défaut *avant* de le corriger. C'est ce qui a permis de mesurer
   ce que la migration corrige réellement, au lieu de supposer qu'elle corrige tout.
