# Audit documentaire — `config/scripts/audit_docs.py`

Script d'automatisation qui verifie que la documentation du schema MAYELA CRM
reste alignee sur ce que la base reellement contient et sur ce que le code
appelle reellement.

## Ce que le script verifie

Le depot a trois sources de verite qui divergent facilement :

| Source | Fichiers | Role |
| --- | --- | --- |
| Migrations SQL | `config/MIGRATION_V*.sql` | ce qui est **declare** en base |
| Documentation | `config/SCHEMA_SUPABASE.md` | ce qui est **ecrit** |
| Code applicatif | `supabase/functions/**`, `src/**` | ce qui est **utilise** |

L'audit croise les trois et signale quatre familles de divergences :

1. **`table non documentee`** — une table creee par une migration n'a pas de
   section `## \`table\`` dans `SCHEMA_SUPABASE.md`.
2. **`colonne non documentee`** — une colonne ajoutee par une migration
   (`alter table ... add column`) n'apparait pas dans le bloc de colonnes de
   sa table dans la doc.
3. **`table utilisee inconnue du schema`** — le code appelle
   `.from("table")` sur une table qui n'existe ni dans les migrations ni dans
   la doc. C'est la famille la plus grave : elle signale du code casse.
4. **`RPC_ABSENTE`** — le code appelle `.rpc("fn")` sur une fonction qui
   n'est decrite ni dans les migrations ni dans la section « Fonctions RPC
   utilisees par le frontend ».

S'y ajoutent deux controles editoriaux sur la documentation francaise
(fautes de frappe recurrentes, marqueurs de documentation perimee), repris et
elargis a partir de `config/_check_doc_fr.mjs`.

## Prerequis

- Python 3.10 ou superieur (annotations `X | Y`).
- PyYAML, seule dependance externe :

```
uv pip install pyyaml
```

## Utilisation

Depuis la racine du depot :

```
python config/scripts/audit_docs.py
```

Sortie console, code de sortie `1` car le depot presente actuellement 7
divergences de schema (voir « Etat actuel » plus bas).

### Options

| Option | Effet |
| --- | --- |
| `--config <chemin>` | Utilise un autre fichier YAML que `config/audit.yaml` |
| `--format console` | Rapport terminal groupe par type de constat (defaut) |
| `--format markdown` | Ecrit `config/reports/audit-docs.md` et affiche la synthese |
| `--format json` | JSON sur stdout, pour un usage en CI ou par un autre outil |
| `--quiet` | N'affiche que la synthese, sans le detail des constats |
| `--no-write` | En mode `markdown`, n'ecrit pas le fichier de rapport |

### Codes de sortie

| Code | Signification |
| --- | --- |
| `0` | Aucun probleme (ou uniquement editorial si `fail_on_editorial: false`) |
| `1` | Au moins une divergence de schema |
| `2` | Problemes editoriaux uniquement, et `fail_on_editorial: true` |
| `3` | Erreur d'execution : YAML absent ou invalide |

## Configuration

Tout le comportement est pilote par `config/audit.yaml`. Les sections :

- **`paths`** — ou lire les migrations, la doc, le code, et ou ecrire le
  rapport. Les chemins sont relatifs a la racine du depot.
- **`schema.ignore_tables`** — tables volontairement non documentees
  (`horizon_leads`, hors perimetre produit ; `social_accounts_safe`, une vue
  decrite dans la section RLS plutot que comme table).
- **`schema.ignore_columns`** — colonnes recurrentes non documentees
  individuellement (`created_at`, `updated_at`, `synced_at`).
- **`code_usage.patterns`** — regex de detection des appels `.from(...)` et
  `.rpc(...)` dans le code. Un motif contenant `rpc` est classe comme
  fonction RPC, sinon comme table.
- **`editorial.typos`** — paires `[mot incorrect, correction attendue]`.
  Volontairement etroit : uniquement des fautes reellement observees dans ce
  depot, pour ne pas produire de faux positifs sur du francais correct.
- **`editorial.stale_markers`** — regex de documentation perimee, par exemple
  les references `l.NNN4` a des numeros de ligne, qui cassent des que le code
  bouge.
- **`exit`** — si un code de sortie doit etre non nul. Par defaut une
  divergence de schema fait echouer le script, un probleme editorial non.

## Integration : l'orchestrateur

Ce script est le controle `doc-audit` de l'orchestrateur
(`config/scripts/orchestrator.mjs`), qui le lance avec les autres verifications.
En usage quotidien, on passe par l'orchestrateur plutot que par ce script
directement — voir `docs/ORCHESTRATEUR.md` :

```
node config/scripts/orchestrator.mjs precheck       avant commit / push
node config/scripts/orchestrator.mjs postmigrate    apres un changement en base
```

## Integration : blocage au push

L'audit ne vaut que s'il bloque. Un rapport consulté une fois puis oublié ne
prévient rien — c'est exactement ce qui a laissé V12 et V15 diverger.

Le dépôt embarque un crochet `pre-push` qui lance l'audit. Comme `.git/hooks`
n'est pas suivi par git (c'est un répertoire local, propre à chaque clone), le
crochet est versionné dans `config/git-hooks/pre-push` et installé par :

```
node config/scripts/install-git-hooks.mjs
```

| Option | Effet |
| --- | --- |
| (aucune) | Installe (ou réinstalle) les crochets versionnés |
| `--check` | Vérifie que `.git/hooks` correspond à `config/git-hooks`, sans écrire. Code 1 sinon |
| `--remove` | Supprime les crochets installés |

Le crochet ne déclenche l'audit que si le push touche au moins un de ces
chemins : `config/MIGRATION_*.sql`, `config/audit.yaml`, `supabase/functions/`,
`src/`. Un push qui ne touche que de la documentation ou du texte passe sans
contrôle — la doc ne peut pas diverger du schéma sans qu'une migration soit
impliquée. Il n'a pas besoin de l'audit non plus.

Contournement ponctuel : `git push --no-verify`. À réserver au cas où la
divergence est déjà corrigée ailleurs, ou quand l'audit lui-même est faux
positif (voir « Limites connues »).

Si l'interpréteur Python n'est pas dans le `PATH` du shell git, le crochet
préfère `$PYTHON` s'il est défini, et sinon laisse passer en affichant un
rappel plutôt que de bloquer un push par surprise.

## Etat actuel

Au moment de l'ecriture, l'audit remonte **0 divergence de schema** et
**0 probleme editorial**. Les 7 divergences constatees a la premiere execution
ont ete corrigees dans `config/SCHEMA_SUPABASE.md` :

| Constat | Correction apportee |
| --- | --- |
| `campaign_spend_daily` non documentee | section `## \`campaign_spend_daily\`` ajoutee (V15) |
| `ia_messages` non documentee | section `## \`ia_messages\`` ajoutee (V5, V6) |
| `campaigns.depense_source` | ajoute au bloc de colonnes de `campaigns` (V15) |
| `campaigns.depense_devise` | ajoute au bloc de colonnes de `campaigns` (V15) |
| `campaigns.depense_periode_debut` | ajoute au bloc de colonnes de `campaigns` (V15) |
| `campaigns.depense_periode_fin` | ajoute au bloc de colonnes de `campaigns` (V15) |
| `profiles.top_clients_limit` | ajoute au bloc de colonnes de `profiles` (V12) |

Le bandeau de statut en tete de `SCHEMA_SUPABASE.md` annonce desormais V15, et
signale V16 comme **present dans le depot mais d'application en base non
confirmee** — a verifier en base.

`SCHEMA_SUPABASE.md` etant une documentation maintenue a la main, l'audit ne
corrige rien de lui-meme : il indique ou la doc a ete depassee. Corriger la
doc passe par une relecture, pas par le script.


## Limites connues

- Le parsing SQL est par instruction (`split_statements`) et couvre
  `create table`, `alter table ... add/drop column` et `create view`. Les
  colonnes ajoutees par du SQL dynamique ou des `do $$ ... $$` ne sont pas
  vues.
- La detection du code est lexicale : une table nommee dans une chaine de
  caracteres hors contexte `.from(...)` est ignoree, et inversement un appel
  construit dynamiquement peut passer inaperçu.
- Un constat « colonne non documentee » designe la section a completer, meme si
  la notion est deja evoquee ailleurs dans le fichier. C'etait le cas de
  `top_clients_limit`, mentionne dans le bandeau de statut mais absent du bloc
  `## \`profiles\``. Le constat est litteralement vrai : le bloc de colonnes etait
  incomplet.

## Integration en CI

Le crochet pre-push couvre le push local. Pour une chaine d'integration continue,
le meme script s'enchaîne sans configuration supplementaire :

```
python config/scripts/audit_docs.py --quiet
```

Le code de sortie suffit : 1 en cas de divergence de schema. Pour un rapport
m exploitable par une tache posterieure, `--format json` expose `summary.schema`
et `summary.editorial`, et `findings` avec `kind`, `path`, `line` et `message`
pour chaque constat.
