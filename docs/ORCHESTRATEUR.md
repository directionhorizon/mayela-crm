# Orchestrateur de verification — `config/scripts/orchestrator.mjs`

Regroupe en un seul point d'entree des controles jusqu'ici disperses, et ajoute
deux commandes qui manquaient : verifier apres un changement en base, et lire
l'etat du chantier.

Le depot avait quatre controles existants et separes :

| Controle | Fichier | Ce qu'il verifie |
| --- | --- | --- |
| `doc-audit` | `config/scripts/audit_docs.py` | la doc du schema suit les migrations |
| `js-syntax` | `config/_check_js.mjs` | la syntaxe des blocs `<script>` de l'app |
| `rls-espaces` | `config/verify_v13_isolation.mjs` | cloisonnement entre espaces |
| `rls-solo` | `config/verify_v14_solo.mjs` | mode sans espace (solo) |
| `migrations-appliquees` | interne | toute migration du depot existe en base |

L'orchestrateur ne les reecrit pas : il les invoque, dans le bon ordre, et
transforme leurs sorties disparates en un rapport unique et un code de sortie
unique.

## Commandes

```
node config/scripts/orchestrator.mjs precheck     [--no-net] [--all] [--only=doc-audit,js-syntax]
node config/scripts/orchestrator.mjs postmigrate  [migration] [--no-net]
node config/scripts/orchestrator.mjs suivi         [--json]
node config/scripts/orchestrator.mjs list
node config/scripts/orchestrator.mjs verif-migrations
```

### `precheck` — avant commit

Le contrôle le plus courant. Il regarde **ce que le push contient** et ne lance
que les contrôles qui ont du sens :

| Fichiers poussés | Contrôles retenus |
| --- | --- |
| `config/MIGRATION_*.sql` | doc, migrations appliquées, RLS espaces, RLS solo |
| `config/audit.yaml` | doc |
| `supabase/functions/**` | RLS espaces, RLS solo |
| `src/**`, `mayela-crm.html`, `*.ts`, `*.mjs` | syntaxe JS, doc |
| uniquement de la documentation | **aucun** |

Un push de documentation ne peut pas avoir cassé le schéma, ni la syntaxe, ni la
RLS. Lancer quand même ces contrôles coûte du temps et apprend à ignorer les
échecs. L'orchestrateur affiche alors le nombre de fichiers poussés et
s'arrête.

`--all` force tous les contrôles. `--only=a,b` en sélectionne.

### `postmigrate` — après un changement en base

C'est la commande qui répond au problème de fond : quand une migration vient
d'être appliquée, la doc dérive presque toujours, et personne ne s'en aperçoit
avant des mois. L'ordre des contrôles est imposé :

1. **`doc-audit`** en premier — c'est le moment où la doc vient de décrocher
2. `js-syntax`
3. `rls-espaces` puis `rls-solo` — une nouvelle politique RLS casse le cloisonnement
4. `migrations-appliquees` — vérifie que rien n'a été oublié

En cas d'échec, la commande affiche la marche à suivre plutôt qu'un compte de
constats :

```
Suite a faire :
  La doc du schema a derive. Corriger config/SCHEMA_SUPABASE.md :
    - ajouter la section de la table si elle est nouvelle
    - ajouter les colonnes dans le bloc existant, marquees par la version
    - mettre a jour le bandeau de statut en tete de fichier
  Puis relancer : node config/scripts/orchestrator.mjs postmigrate
```

Le paramètre optionnel (le nom de la migration) est purement informatif :
il sert à afficher le contexte. Appliquer une migration reste une action
manuelle, volontaire — voir « Ce que l'orchestrateur ne fait pas ».

### `suivi` — pilotage du chantier

Lit `docs/suivi/EN_ATTENTE.md` et le transforme en vue d'ensemble. Quatre états,
distingués parce qu'ils appellent des actions différentes :

| État | Signification | Ce qu'on en fait |
| --- | --- | --- |
| `BLOQUANT` | rejeté, bloqué, jamais passé | attendre une action externe |
| `EN COURS` | actions ouvertes | continuer |
| `REPORTE` | « sans limite », « plus tard » | décision différée, à reassurer |
| `CLOS` | résolu, fait, appliqué | ne plus y revenir |

La distinction compte : une action de recette subsiste souvent sous un titre
« RÉSOLU », donc le décompte des cases décochées dans le corps de la section
prime sur le mot dans le titre. Un point marqué RÉSOLU mais avec 1 action
ouverte reste un point à faire.

État au moment de l'écriture :

```
10 points numerotes | 30 actions a faire | 41 faites
Repartition : 2 bloquant(s), 4 en cours, 1 reporte(s), 3 clos
Bloquants : 1, 4
Reportes  : 9
```

`--json` ajoute la sortie structurée pour un usage programmatique.

### `list` — contrôles disponibles

Décrit chaque contrôle : ce qu'il vérifie, s'il a besoin du réseau, et **pourquoi
il est bloquant**. Cette troisième information est celle qui manque le plus
souvent : un contrôle qu'on ne comprend pas est un contrôle qu'on contourne.

## Réseau et variables d'environnement

| Contrôle | Réseau | Dépendances |
| --- | --- | --- |
| `doc-audit` | non | Python + PyYAML |
| `js-syntax` | non | Node |
| `rls-espaces` | oui | `.env.deploy`, réseau |
| `rls-solo` | oui | `.env.deploy`, réseau |
| `migrations-appliquees` | oui | `.env.deploy`, réseau |

`--no-net` saute les contrôles réseau. Le motif de saut est affiché, jamais
silencieux : un contrôle ignoré qui ne le dit pas est un contrôle qu'on croit
avoir passé.

Si Python est absent du `PATH`, les contrôles doc sont signalés `ABSENT` et
l'échec est explicite, plutôt que d'être confondu avec une divergence. Pour
viser un autre interpréteur : `PYTHON=/chemin/vers/python node ... precheck`.
## Intégration au push

Le crochet `pre-push` délègue entièrement à l'orchestrateur :

```
node config/scripts/install-git-hooks.mjs    # installer
node config/scripts/install-git-hooks.mjs --check  # vérifier sans écrire
```

Si `node` est absent, le crochet laisse passer avec un message plutôt que de
bloquer le push. Contournement manuel : `git push --no-verify`.

## Ce que l'orchestrateur ne fait pas

- **Il n'applique aucune migration.** Appliquer du SQL sur une base de données
  de production est une action destructive possible. Elle reste délibérée, à la
  main, avec relecture du SQL. Un outil qui automatise l'application d'un
  fichier SQL écrit par quelqu'un d'autre est un outil qui peut casser la base
  sans que personne l'ait vu.
- **Il ne corrige pas la documentation.** Il signale. Corriger la doc demande
  de la relecture : les commentaires métier que porte `SCHEMA_SUPABASE.md` ne
  sont pas déductibles d'un `create table`.
- **Il ne remplace pas une recette.** Les contrôles RLS vérifient que la
  cloisonnement tient, pas que l'application fait ce qu'on attend d'elle. Le
  point ouvert n°6 du suivi — aucun test de bout en bout passé — reste entier.

## Limites connues

- La détection de pertinence compare au `@{u}` (branche upstream). Au premier
  push d'une branche sans upstream, le repli est `HEAD~1..HEAD`, c'est-à-dire
  le dernier commit seulement.
- `verif-migrations` compare la présence des tables et colonnes, pas leur
  définition complète. Une contrainte ou un index manquant en base ne sera pas
  détecté.
- `suivi` dépend de la forme du fichier `EN_ATTENTE.md` : titres `## N. Titre`
  et cases `- [ ]`. Un point écrit dans une section non numérotée est compté
  dans le total d'actions mais n'apparaît pas dans la liste.
