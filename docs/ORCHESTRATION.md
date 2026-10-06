# Orchestration — harnais headless de revue de développement

Le harnais `config/orchestration/` transpose les mécanismes de THE 100TRAL (Android/Kotlin) vers un support de développement **headless, CLI-first et externe au code applicatif** de `mayela-crm`.

Il répond à un problème structurel constaté sur le projet : **aucun point unique ne tranche jamais si un travail est « accompli »**. Ce harnais introduit un **gate bidirectionnel unique** qui peut dire `CONFORME` comme `NON_CONFORME`, avec des motifs nommés.

> Le harnais **n'écrit jamais** dans le code de l'application (`mayela-crm.html`, `supabase/functions/`). Par défaut, le périmètre est `relecture` (aucune écriture). L'écriture est restreinte à `config/` uniquement (`--ecriture`).

## 1. Objectif

- Fournir une **chaîne de commandement unique** (entrée → validation → décomposition → exécution → gate → rapport typé).
- Rendre les rapports **comparables d'un agent à l'autre** (même structure de clés, quel que soit le domaine).
- Décider « c'est fini » par **un seul point de décision** (gate), avec verdict ancré et verbatim.
- Lire **l'état réel du chantier** (git + migrations appliquées en base + suivi) **avant** de juger, pour éviter de trancher sur une base fausse.
- Rester **testable intégralement en CLI**, découplé du code applicatif (support externe).

## 2. Architecture

```
config/orchestration/
├── pont-llm.mjs         # Pont unique vers opencode (JSON brut, --pure)
├── domaines.mjs         # Liste blanche des domaines + normalisation
├── porte-entree.mjs      # Validation unique de la mission (secrets, périmètre)
├── memoire.mjs          # Journal JSONL + réinjection des décisions/échecs
├── decomposition.mjs    # Décomposition JSON filtrée + repli non silencieux
├── agents.mjs           # Boucle bornée (TOOL_CALL) — réservé (non utilisé ici)
├── gate.mjs             # UN SEUL gate bidirectionnel (verdict ancré)
├── rapport.mjs          # Rapport typé + 3 audiences
├── etat.mjs             # État réel (git + suivi + migrations)
├── orchestrateur.mjs    # Chaîne unique + dispatch parallèle borné
└── test-chaine.mjs      # Test de fumée (porte d'entrée + mémoire + décomposition)
```

Le flux est descendant (`Command`) et le rapport remonte (`Report`) à sens unique.

```
mission (CLI)
  ↓
porte-entree.valider()        validation + filtrage secrets + périmètre
  ↓
etat.etat()                   état réel (git + suivi + migrations)
  ↓
memoire.blocMemoire()          décisions/échecs passés réinjectés
  ↓
decomposition.decomposer()    LLM → tableau JSON filtré (liste blanche) + fallback
  ↓
orchestrateur.dispatch()      sous-tâches en parallèle (concurrence bornée)
  ↓
gate.juger()                  UN SEUL gate (verdict ancré, verbatim)
  ↓
rapport.construire()+agregger()  rapport typé + agrégat (accompli = tout conforme)
  ↓
sortie CLI (JSON optionnel)
```

## 3. Modules

### 3.1 `pont-llm.mjs` — pont unique vers le modèle
- Appelle `opencode run --pure --format json -m <modele>`.
- `--pure` : immunise le harnais contre un routage d'agents cassé dans la config globale.
- `--format json` : lit les événements bruts (`step_start`, `text`, `step_finish`, `error`) plutôt que du texte affiché. Permet d'éviter le test cassable `response.contains("NON")`.
- Distinction sans ambiguïté de 4 statuts : `ok`, `timeout`, `modele_indisponible`, `binaire_absent`.
- Délais différenciés : `DELAI_SONDE=90s`, `DELAI_AGENT=420s`, `DELAI_GATE=240s` (charge différente entre sonde et agent lisant le dépôt).
- Drapeau `tue` (kill timeout) pour distinguer explicitement « trop lent » de « refus du modèle ».

### 3.2 `domaines.mjs` — liste blanche
- 8 domaines : `SCHEMA`, `SECURITE`, `BACKEND`, `FRONTEND`, `RECETTE`, `DOCS`, `OPS`, `AUDIT`.
- Normalisation (`toUpperCase`, suppression caractères non-alpha) pour tolérer de petites variations du LLM.
- Bloc injecté explicitement dans le prompt de décomposition (le modèle reçoit la liste blanche, pas seulement la vérification a posteriori).
- Un domaine inventé est **rejeté** (diagnostic + liste des rejets), jamais silencieusement transformé.

### 3.3 `porte-entree.mjs` — validation unique
- Refus structurés : `mission_vide`, `mission_trop_longue` (4000), `secret_dans_la_mission`, `perimetre_inconnu`.
- Détection de secrets (jetons JWT, `sk-*`, `service_role`, URL Postgres avec identifiants, `SUPABASE_ACCESS_TOKEN`).
- Périmètres : `relecture` (défaut, `ecriture=false`) — aucun fichier applicatif modifié ; `outillage` (`ecriture=true`) — uniquement `config/`.

### 3.4 `memoire.mjs` — mémoire réinjectée
- Journal JSONL versionné : `config/orchestration/memoire/journal.jsonl`.
- Types : `decision`, `echec`. Plafonds 12/12 (lecture la plus récente).
- Réinjecte dans le prompt de décomposition : « Ce qui a déjà échoué… Ne le reproduis pas », « Ce qui a été décidé… Ne le rediscute pas sans raison », + état du chantier.
- Tolérant aux lignes corrompues (comptées, non consommées). Écriture non-bloquante.

### 3.5 `decomposition.mjs` — contrat JSON filtré
- Demande un tableau JSON unique : `[{ "domaine":"<ID>", "instruction":"<phrase impérative>" }]` (1–4 sous-tâches, `MAX_SOUS_TACHES=4`).
- Extraction robuste depuis blocs ```json/fences + équilibrage de crochets (ignore `]` dans chaînes).
- Filtre contre liste blanche. Chaque rejet est listé (`diagnostic.rejetes`).
- **Repli non silencieux** : si JSON illisible/aucun domaine valide/appel échoue → sous-tâche unique avec `repli` (`json_illisible`, `aucun_domaine_valide`, `appel_echoue`), domaine `AUDIT`. Le diagnostic rend ce repli **visible**.

### 3.6 `gate.mjs` — UN SEUL gate bidirectionnel
- Verdict **ancré et verbatim** : dernière ligne non-vide doit être exactement `VERDICT: CONFORME` ou `VERDICT: NON_CONFORME`. Un verdict au milieu d'une phrase ne décide pas.
- **Illisible ne vaut jamais approbation** : absence de ligne d'ancre → `illisible` (`conforme: null`).
- **Motifs obligatoires** si `NON_CONFORME` : un rejet sans motif nommé est signalé (`raison: "rejet sans motif nommé..."`) — il ne peut pas être corrigé.
- Rejet préventif local : un rapport sans **aucune référence** (fichier/ligne/commande) est rejeté sans appeler le modèle (`reference`).
- Critères appliqués : (1) références présentes, (2) distinction observation/supposition, (3) franchise (ne pas annoncer une vérification non exécutée).

### 3.7 `rapport.mjs` — rapport typé + audiences
- Structure fixe, comparable d'un agent à l'autre : `ts`, `mission`, `domaine`, `instruction`, `repli`, `modele`, `statut`, `rapport`, `motifs[]`, `raison`, `dureeMs`.
- Statuts : `conforme`, `non_conforme`, `illisible`, `echec_appel`.
- Agrégat : `accompli = (conformes === total)` — **tout doit être conforme** (pas « au moins un »). Cela évite de déclarer une mission réussie alors qu'une partie critique échoue.
- 3 audiences (rédaction reformulée sans changer le fond) : `technique` (références + ordre de correction), `decisionnel` (arrêter/faires/ne pas changer), `chantier` (impact sur `docs/suivi/EN_ATTENTE.md`, 2 phrases max).

### 3.8 `etat.mjs` — état réel du chantier
- Délègue à `config/scripts/orchestrator.mjs` (source de vérité existante) : `suivi --json`, `verif-migrations`.
- Lit `git` : branche/SHA/sujet, `modifies`, `non_suivis`, `en_avance`, `propre` (booléen).
- Synthèse `resume` injectée dans prompts (décomposition + exécution). Un gate ne tranche jamais sans connaître l'état réel.

### 3.9 `orchestrateur.mjs` — chaîne unique + dispatch
- Commandes CLI : `run <mission> [--ecriture] [--perimetre=...] [--no-net] [--json]`, `etat [--no-net]`, `list`.
- **Dispatch parallèle borné** (`CONCURRENCE=3`) au lieu du `forEach` strictement séquentiel de THE 100TRAL. Le compromis (quota anonyme partagé) est mesuré empiriquement.
- Codes de sortie uniques : `ACCOMPLI=0`, `NON_CONFORME=1`, `CONFIG=2`, `SANS_VERDICT=3`.
- Jamais d'écriture dans l'app. Périmètre appliqué dès la porte d'entrée.

## 4. Utilisation (CLI)

```bash
# Lister domaines, périmètres, commandes
node config/orchestration/orchestrateur.mjs list

# État réel du chantier
node config/orchestration/orchestrateur.mjs etat
node config/orchestration/orchestrateur.mjs etat --no-net

# Lancer une mission (relecture par défaut)
node config/orchestration/orchestrateur.mjs run "Vérifier V14,V15,V16 vs SCHEMA_SUPABASE.md"

# Autoriser écriture limitée à config/ uniquement
node config/orchestration/orchestrateur.mjs run "..." --ecriture

# Sortie JSON structurée (preuves)
node config/orchestration/orchestrateur.mjs run "..." --json

# Tester le pont LLM (bassin)
node config/orchestration/pont-llm.mjs verifier

# Test de fumée de la chaîne
node config/orchestration/test-chaine.mjs
```

## 5. Limites connues

- **Quota anonyme partagé** : avec les 8 modèles gratuits validés, le parallélisme (`CONCURRENCE=3`) est un gain net (vs série) mais chaque appel ralentit les autres. Avec authentification (`/login`), ce partage diminue.
- **Durée** : un agent lisant plusieurs fichiers du dépôt dépasse `DELAI_AGENT=420s`. Pour une mission très large, mieux de **décomposer plus finement** (1–2 domaines max) ou augmenter le délai au cas par cas.
- **Dépendance à `opencode`** : nécessite `opencode` dans le PATH (ou `OPENCODE_BIN`). Le pont détecte `binaire_absent` proprement.
- **Délégation aux scripts existants** : `etat.mjs` délègue à `config/scripts/orchestrator.mjs` (`suivi --json`, `verif-migrations`). Toute évolution du format de `EN_ATTENTE.md` impacte ce dernier (limite déjà documentée dans `docs/ORCHESTRATEUR.md`).
- **Pas de boucle ReAct complète** : ici un agent = un appel borné (le sous-agent opencode décide lui-même des fichiers à lire). Ce choix évite un parseur `TOOL_CALL` supplémentaire tout en restant fidèle à l'esprit de THE 100TRAL.
- **Le `ConflictArbitrator` de THE 100TRAL n'est pas réactivé** : il n'était appelé nulle part. À la place, le gate rejette avec **motifs obligatoires** quand un verdict est ambigu (illisible/sans motifs) — ce qui force une correction exploitable plutôt qu'un arbitrage obscur.

## 6. Ce que ce harnais NE fait PAS

- **N'écrit jamais dans le code applicatif** (`mayela-crm.html`, `supabase/functions/`). Périmètre `relecture` par défaut.
- **Ne commit ni ne pousse**. Il lit l'état, rend un verdict/rapport. Fermer le chantier reste une décision humaine.
- **N'applique aucune migration SQL**. Action destructive, délibérée, manuelle (conformément à `docs/ORCHESTRATEUR.md`).
- **Ne corrige pas la documentation automatiquement**. Il signale les écarts (gate + rapports typés). La relecture métier est nécessaire.
- **Ne remplace pas une recette E2E**. Le gate juge sur des critères de forme/franchise (références, distinction observation/supposition). Il ne constate pas qu'un scénario utilisateur fonctionne — c'est le rôle de `docs/CHECKLIST_TEST_E2E.md` (toujours ouvert au moment de l'écriture).
- **N'invente pas de verdict**. `illisible`/`appel_echoue`/`timeout` ne valent **jamais** approbation. Un rejet sans motifs est détecté et signalé.

## 7. Distinction vs `config/scripts/orchestrator.mjs`

| Aspect | `config/scripts/orchestrator.mjs` | `config/orchestration/orchestrateur.mjs` |
|---|---|---|
| Nature | **Orchestrateur de vérification** (déterministe, sans LLM) | **Harnais d'orchestration d'agents IA** (LLM-driven) |
| But | Contrôles codés en dur (doc-audit, js-syntax, RLS, migrations) — « le dépôt est-il cohérent ? » | Décomposition d'une mission + exécution par sous-agents + **gate unique** — « la mission est-elle accomplie ? » |
| Sortie | Code de sortie + résumé console | Rapport **typé comparable** + agrégat + 3 audiences + JSON structuré |
| Décision | Vérifie des faits (présence/fichiers) | **Tranche un jugement** (conforme/non conforme) avec motifs nommés |
| Parallélisme | Séquentiel/contrôles ciblés | **Parallèle borné** (`CONCURRENCE=3`) |

Les deux sont complémentaires : le premier vérifie la **cohérence structurelle** (dépôt/base), le second juge l'**accomplissement d'une mission** avec un gate unique.

## 8. Preuves

- `pont-llm.mjs verifier` : **8/8 modèles opérationnels** sans credential.
- `test-chaine.mjs` : validation + mémoire + décomposition sur mission réelle (4 sous-tâches, diagnostic `ok`).
- `orchestrateur.mjs etat` : lit l'état réel (35 modifiés / 33 non suivis, migrations toutes appliquées, suivi lu).
- `orchestrateur.mjs run` : exécution complète avec rapports typés, agrégat et code de sortie unique.

## 9. Philosophie

THE 100TRAL apporte le **mécanisme du gate unique**. Ce harnais l'adapte à MAYELA CRM sous forme **headless/CLI-first, externe au code applicatif**, avec les corrections nécessaires (remplacement de `contains("NON")` par verdict ancré verbatim, rejet sans référence automatique, repli non silencieux, distinction explicite timeout/illisible/appel échoué). L'objectif est de **briser le cycle sans fin** (« découvre un problème → choisit une option → découvre un problème plus fin → jamais "c'est réglé" ») en forçant un **tranchant unique, motivé et vérifiable**.
