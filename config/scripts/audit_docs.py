#!/usr/bin/env python3
"""Audit de coherence documentation / code pour le depot MAYELA CRM.

Le script croise trois sources de verite du depot :

  1. les migrations SQL      config/MIGRATION_*.sql
  2. la doc de schema        config/SCHEMA_SUPABASE.md
  3. le code applicatif      supabase/functions/**, src/**

et signale toute divergence. Les regles sont externalisees dans
config/audit.yaml ; ce fichier ne contient que la mecanique d'analyse.

Utilisation :
    python config/scripts/audit_docs.py [--config config/audit.yaml]
                                        [--format console|markdown|json]
                                        [--quiet]

Codes de sortie :
    0  aucun probleme
    1  divergence de schema (table ou colonne non documentee)
    2  probleme editorial uniquement
    3  erreur d'execution (configuration introuvable, YAML invalide, ...)
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Iterable

try:
    import yaml
except ImportError:  # pragma: no cover - dependance declaree dans la doc
    sys.stderr.write(
        "PyYAML est requis : uv pip install pyyaml  (ou pip install pyyaml)\n"
    )
    raise SystemExit(3)

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_CONFIG = REPO_ROOT / "config" / "audit.yaml"

# --- Analyse des migrations SQL -------------------------------------------

RE_CREATE_TABLE = re.compile(
    r"create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?([a-z_][a-z0-9_]*)\s*\(",
    re.IGNORECASE | re.MULTILINE,
)
RE_ALTER_TABLE = re.compile(
    r"alter\s+table\s+(?:if\s+exists\s+)?(?:public\.)?([a-z_][a-z0-9_]*)\b",
    re.IGNORECASE,
)
RE_ADD_COLUMN = re.compile(
    r"alter\s+table\s+(?:if\s+exists\s+)?(?:public\.)?[a-z_][a-z0-9_]*\s+"
    r"add\s+column\s+(?:if\s+not\s+exists\s+)?([a-z_][a-z0-9_]*)",
    re.IGNORECASE,
)
RE_DROP_COLUMN = re.compile(
    r"alter\s+table\s+(?:if\s+exists\s+)?(?:public\.)?[a-z_][a-z0-9_]*\s+"
    r"drop\s+column\s+(?:if\s+exists\s+)?([a-z_][a-z0-9_]*)",
    re.IGNORECASE,
)
RE_VIEW = re.compile(
    r"create\s+(?:or\s+replace\s+)?view\s+(?:public\.)?([a-z_][a-z0-9_]*)",
    re.IGNORECASE,
)
# Bloc create table (...) : on retire les contraintes et commentaires pour ne
# garder que les lignes de definition de colonne.
RE_CONSTRAINT = re.compile(
    r"^\s*(primary\s+key|foreign\s+key|unique|check|constraint|exclude)\b",
    re.IGNORECASE,
)
RE_COLUMN_DEF = re.compile(
    r"^\s*([a-z_][a-z0-9_]*)\s+([a-z][a-z ]*(?:\([0-9, ]+\))?)\b"
    r"(.*)$",
    re.IGNORECASE,
)

SQL_KEYWORDS = {
    "select", "insert", "update", "delete", "from", "where", "and", "or",
    "values", "set", "grant", "revoke", "create", "alter", "drop", "table",
    "policy", "on", "as", "with", "check", "not", "null", "default",
    "constraint", "unique", "primary", "key", "foreign", "references", "begin",
    "commit", "rollback", "comment", "explain", "analyze", "refresh",
    "materialized", "using", "owner", "to", "for", "in", "order", "limit",
    "public", "auth", "storage", "true", "false", "case", "when", "then",
    "else", "end", "exists", "if", "cascade", "restrict", "add",
}


def read_text(path: Path) -> str:
    """Lit un fichier texte en tolerant les melanges d'encodage herites.

    Les fins de ligne sont normalisees en LF : le depot melange CRLF et LF, et
    les motifs multi-lignes (`^...`, blocs Markdown) en dependent.
    """
    text = path.read_bytes().decode("utf-8", errors="replace")
    return text.replace("\r\n", "\n").replace("\r", "\n")


def split_statements(sql: str) -> list[str]:
    """Decoupe le SQL en instructions, en ignorant commentaires et litteraux.

    Le decoupage se fait sur le `;` de fin d'instruction : c'est ce qui permet
    d'attribuer chaque `add column` a la table de son propre `alter table`,
    sans avoir aatina deviner a partir du contexte.
    """
    statements: list[str] = []
    current: list[str] = []
    i = 0
    n = len(sql)
    while i < n:
        ch = sql[i]
        nxt = sql[i + 1] if i + 1 < n else ""

        if ch == "-" and nxt == "-":
            j = sql.find("\n", i)
            i = n if j == -1 else j + 1
            continue
        if ch == "/" and nxt == "*":
            j = sql.find("*/", i + 2)
            i = n if j == -1 else j + 2
            continue
        if ch in ("'", '"'):
            quote = ch
            j = i + 1
            while j < n:
                if sql[j] == quote:
                    if j + 1 < n and sql[j + 1] == quote:
                        j += 2
                        continue
                    break
                j += 1
            current.append(sql[i : j + 1])
            i = j + 1
            continue
        if ch == ";":
            statements.append("".join(current))
            current = []
            i += 1
            continue
        current.append(ch)
        i += 1

    if "".join(current).strip():
        statements.append("".join(current))
    return statements


def parse_create_table_columns(sql: str, start: int) -> list[str]:
    """Extrait les colonnes du parenthese d'un `create table` ouvert a `start`."""
    depth = 0
    body: list[str] = []
    for i in range(start, len(sql)):
        ch = sql[i]
        if ch == "(":
            depth += 1
            if depth == 1:
                continue
        elif ch == ")":
            depth -= 1
            if depth == 0:
                break
        if depth >= 1:
            body.append(ch)

    columns: list[str] = []
    for line in "".join(body).splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("--") or RE_CONSTRAINT.match(line):
            continue
        m = RE_COLUMN_DEF.match(line)
        if not m:
            continue
        name, type_tokens = m.group(1), m.group(2).strip().lower()
        if name in SQL_KEYWORDS or type_tokens.split()[0] in SQL_KEYWORDS:
            continue
        columns.append(name)
    return columns


def parse_migration(path: Path) -> tuple[set[str], dict[str, set[str]], set[str]]:
    """Retourne (tables, colonnes par table, vues) declarees par une migration.

    Le parcours se fait instruction par instruction : une migration enchaîne
    souvent plusieurs `alter table` sur des tables differentes, et un
    `add column` n'appartient qu'a l'instruction qui le precede.
    """
    sql = read_text(path)
    tables: set[str] = set()
    columns: dict[str, set[str]] = {}
    views: set[str] = set()

    for statement in split_statements(sql):
        for m in RE_CREATE_TABLE.finditer(statement):
            table = m.group(1)
            tables.add(table)
            columns.setdefault(table, set()).update(
                parse_create_table_columns(statement, m.end() - 1)
            )

        for m in RE_ALTER_TABLE.finditer(statement):
            table = m.group(1)
            tables.add(table)
            columns.setdefault(table, set())
            for cm in RE_ADD_COLUMN.finditer(statement):
                columns[table].add(cm.group(1).lower())
            for cm in RE_DROP_COLUMN.finditer(statement):
                columns[table].discard(cm.group(1).lower())

        for m in RE_VIEW.finditer(statement):
            views.add(m.group(1))

    return tables, columns, views



# --- Analyse de la documentation -------------------------------------------

RE_DOC_SECTION = re.compile(r"^##\s+`([a-z_][a-z0-9_]*)`", re.MULTILINE)
RE_DOC_COLUMN = re.compile(r"^([a-z_][a-z0-9_]*)\s+[a-z][a-z ]*(?:\([0-9, ]+\))?\b")


def parse_schema_doc(path: Path) -> tuple[dict[str, set[str]], set[str], dict[str, set[str]]]:
    """Extrait du fichier de doc les tables, colonnes et fonctions RPC declarees.

    Seules les sections `## \\`table\\`` suivies d'un bloc de colonnes sont
    prises en compte. Les autres sections (RLS, flux, RPC) sont balayees separement.
    """
    text = read_text(path)
    tables: dict[str, set[str]] = {}
    rpc: dict[str, set[str]] = {}
    sections: set[str] = set()

    matches = list(RE_DOC_SECTION.finditer(text))
    for idx, m in enumerate(matches):
        table = m.group(1)
        end = matches[idx + 1].start() if idx + 1 < len(matches) else len(text)
        block = text[m.end():end]
        sections.add(table)

        fenced = re.search(r"```[a-z]*\n(.*?)```", block, re.DOTALL)
        if not fenced:
            continue
        cols: set[str] = set()
        for line in fenced.group(1).splitlines():
            stripped = line.strip()
            if not stripped or stripped.startswith("--"):
                continue
            cm = RE_DOC_COLUMN.match(stripped)
            if cm and cm.group(1) not in SQL_KEYWORDS:
                cols.add(cm.group(1))
        if cols:
            tables[table] = cols

    # Fonctions RPC : noms suivant un mot cle SQL dans toute la doc.
    for m in re.finditer(
        r"\b(?:create\s+(?:or\s+replace\s+)?function|rpc\s*\(?\s*|execute\s+function)\s*"
        r"(?:public\.)?([a-z_][a-z0-9_]*)\s*\(",
        text,
        re.IGNORECASE,
    ):
        name = m.group(1).lower()
        if name not in SQL_KEYWORDS and name not in tables:
            rpc.setdefault(name, set()).add(path.name)

    return tables, sections, rpc


def parse_prose_docs(paths: Iterable[Path]) -> dict[str, str]:
    return {str(p): read_text(p) for p in paths}


# --- Regles editoriales ---------------------------------------------------


@dataclass
class Finding:
    kind: str
    path: str
    line: int
    message: str
    excerpt: str = ""

    def as_dict(self) -> dict[str, object]:
        return {
            "kind": self.kind,
            "path": self.path,
            "line": self.line,
            "message": self.message,
            "excerpt": self.excerpt,
        }


def scan_editorial(
    files: dict[str, str],
    typos: list[list[str]],
    markers: list[dict[str, str]],
) -> list[Finding]:
    findings: list[Finding] = []
    compiled = [(wrong, right) for wrong, right in typos]
    marker_res = [
        (re.compile(m["pattern"], re.IGNORECASE | re.MULTILINE), m["message"]) for m in markers
    ]

    for path, text in files.items():
        for i, line in enumerate(text.splitlines(), start=1):
            lowered = line.lower()
            for wrong, right in compiled:
                if wrong.lower() in lowered:
                    findings.append(
                        Finding(
                            "FAUTE",
                            path,
                            i,
                            f'"{wrong}" attendu "{right}"',
                            line.strip()[:140],
                        )
                    )
            for rx, why in marker_res:
                if rx.search(line):
                    findings.append(
                        Finding("PERIME", path, i, why, line.strip()[:140])
                    )
    return findings


# --- Analyse du code applicatif -------------------------------------------


def iter_code_files(root: Path, dirs: list[str], pattern: str) -> list[Path]:
    files: list[Path] = []
    for d in dirs:
        base = root / d
        if not base.exists():
            continue
        for p in base.rglob("*"):
            if p.is_file() and p.suffix in {".ts", ".tsx", ".js", ".mjs", ".jsx", ".html"}:
                if "node_modules" in p.parts or ".opencode" in p.parts:
                    continue
                files.append(p)
    return sorted(files)


def rel(path: Path) -> str:
    """Chemin relatif au depot, pour des rapports lisibles et portables."""
    try:
        return path.resolve().relative_to(REPO_ROOT).as_posix()
    except ValueError:
        return path.as_posix()


def scan_code_usage(
    files: list[Path], patterns: list[str]
) -> tuple[dict[str, set[str]], dict[str, set[str]]]:
    """Retourne (tables appelees, fonctions RPC appelées) -> ensemble de fichiers."""
    table_rx = [re.compile(p) for p in patterns if "rpc" not in p]
    rpc_rx = [re.compile(p) for p in patterns if "rpc" in p]

    tables: dict[str, set[str]] = {}
    rpcs: dict[str, set[str]] = {}
    for path in files:
        text = read_text(path)
        for rx in table_rx:
            for m in rx.finditer(text):
                tables.setdefault(m.group(1).lower(), set()).add(rel(path))
        for rx in rpc_rx:
            for m in rx.finditer(text):
                rpcs.setdefault(m.group(1).lower(), set()).add(rel(path))
    return tables, rpcs


# --- Orchestration --------------------------------------------------------


@dataclass
class AuditResult:
    migrations: list[str] = field(default_factory=list)
    tables_sql: set[str] = field(default_factory=set)
    tables_doc: dict[str, set[str]] = field(default_factory=dict)
    views: set[str] = field(default_factory=set)
    code_tables: dict[str, set[str]] = field(default_factory=dict)
    code_rpcs: dict[str, set[str]] = field(default_factory=dict)
    doc_rpcs: dict[str, set[str]] = field(default_factory=dict)
    findings: list[Finding] = field(default_factory=list)

    @property
    def schema_findings(self) -> list[Finding]:
        return [f for f in self.findings if f.kind in {"TABLE_ABSENTE", "COLONNE_ABSENTE", "TABLE_INCONNUE", "RPC_ABSENTE"}]

    @property
    def editorial_findings(self) -> list[Finding]:
        return [f for f in self.findings if f.kind in {"FAUTE", "PERIME"}]


def load_config(path: Path) -> dict:
    if not path.exists():
        raise FileNotFoundError(f"configuration introuvable : {path}")
    data = yaml.safe_load(read_text(path)) or {}
    if not isinstance(data, dict):
        raise ValueError("la configuration YAML doit etre un dictionnaire")
    return data


def run_audit(config: dict, root: Path) -> AuditResult:
    paths = config.get("paths", {})
    schema_cfg = config.get("schema", {})
    result = AuditResult()

    ignore_tables = {t.lower() for t in schema_cfg.get("ignore_tables", [])}
    ignore_columns = {c.lower() for c in schema_cfg.get("ignore_columns", [])}

    # 1. migrations
    mig_dir = root / paths.get("migrations_dir", "config")
    mig_glob = paths.get("migration_glob", "MIGRATION_*.sql")
    sql_columns: dict[str, set[str]] = {}
    for mig in sorted(mig_dir.glob(mig_glob)):
        result.migrations.append(mig.name)
        tables, columns, views = parse_migration(mig)
        result.tables_sql |= tables
        result.views |= views
        for table, cols in columns.items():
            sql_columns.setdefault(table, set()).update(cols)

    # 2. documentation
    doc_path = root / paths.get("schema_doc", "config/SCHEMA_SUPABASE.md")
    if doc_path.exists():
        doc_tables, doc_sections, doc_rpcs = parse_schema_doc(doc_path)
        result.tables_doc = doc_tables
        result.doc_rpcs = doc_rpcs
    else:
        result.findings.append(
            Finding("ERREUR", rel(doc_path), 0, "fichier de schema introuvable")
        )

    # 3. code applicatif
    code_files = iter_code_files(
        root,
        paths.get("code_dirs", []),
        paths.get("code_glob", "*"),
    )
    usage_cfg = config.get("code_usage", {})
    code_tables, code_rpcs = scan_code_usage(code_files, usage_cfg.get("patterns", []))
    result.code_tables = code_tables
    result.code_rpcs = code_rpcs

    known_tables = (result.tables_sql | set(result.tables_doc) | result.views) - ignore_tables
    known_tables |= ignore_tables  # ignore => ni signale ni exige
    documented = set(result.tables_doc) | result.views

    # 3a. tables declarees en base mais non documentees
    for table in sorted(result.tables_sql - ignore_tables):
        if table not in documented:
            result.findings.append(
                Finding(
                    "TABLE_ABSENTE",
                    rel(doc_path),
                    0,
                    f"table `{table}` creee par une migration mais absente de la doc",
                )
            )

    # 3b. colonnes issues des migrations, absentes de la doc
    for table in sorted(result.tables_sql & documented):
        for col in sorted(sql_columns.get(table, set()) - ignore_columns):
            doc_cols = result.tables_doc.get(table, set())
            if doc_cols and col not in doc_cols:
                result.findings.append(
                    Finding(
                        "COLONNE_ABSENTE",
                        rel(doc_path),
                        0,
                        f"`{table}.{col}` declaree en migration mais absente de la doc",
                    )
                )

    # 3c. tables utilisees par le code mais inconnues du schema
    for table in sorted(set(code_tables) - known_tables):
        files = ", ".join(sorted(Path(f).name for f in code_tables[table])[:3])
        result.findings.append(
            Finding(
                "TABLE_INCONNUE",
                files,
                0,
                f"table `{table}` appelee par le code mais absente des migrations et de la doc",
            )
        )

    # 3d. RPC appelees par le code mais non documentees
    if usage_cfg.get("rpc_check", True):
        for name in sorted(set(code_rpcs) - set(result.doc_rpcs) - set(result.tables_doc)):
            files = ", ".join(sorted(Path(f).name for f in code_rpcs[name])[:3])
            result.findings.append(
                Finding(
                    "RPC_ABSENTE",
                    files,
                    0,
                    f"fonction RPC `{name}` appelee par le code mais non documentee",
                )
            )

    # 4. regles editoriales
    editorial_cfg = config.get("editorial", {})
    if editorial_cfg.get("enabled", True):
        prose: dict[str, str] = {}
        for d in paths.get("prose_dirs", []):
            base = root / d
            if not base.exists():
                continue
            for p in sorted(base.rglob(paths.get("prose_glob", "*.md"))):
                prose[rel(p)] = read_text(p)
        if doc_path.exists():
            prose[rel(doc_path)] = read_text(doc_path)
        result.findings.extend(
            scan_editorial(
                prose,
                editorial_cfg.get("typos", []),
                editorial_cfg.get("stale_markers", []),
            )
        )

    return result


# --- Sortie ---------------------------------------------------------------

KIND_LABEL = {
    "TABLE_ABSENTE": "table non documentee",
    "COLONNE_ABSENTE": "colonne non documentee",
    "TABLE_INCONNUE": "table utilisee inconnue du schema",
    "RPC_ABSENTE": "RPC appelee non documentee",
    "FAUTE": "faute de frappe",
    "PERIME": "marqueur perime",
    "ERREUR": "erreur",
}


def render_console(result: AuditResult, config: dict, quiet: bool) -> None:
    total_tables = len(result.tables_sql)
    # Sortie volontairement ASCII : la console Windows gere mal les tirets
    # cadratins, et le rapport Markdown peut lui en contenir.
    print(f"Audit {config.get('project', '?')} - {len(result.migrations)} migrations lues")
    print(
        f"  schema : {total_tables} tables, {len(result.views)} vues, "
        f"{len(result.tables_doc)} sections documentees, "
        f"{len(result.code_tables)} tables utilisees par le code"
    )
    if quiet:
        return
    if not result.findings:
        print("  aucune divergence detectee")
        return
    for kind in ("TABLE_ABSENTE", "COLONNE_ABSENTE", "TABLE_INCONNUE", "RPC_ABSENTE", "FAUTE", "PERIME", "ERREUR"):
        group = [f for f in result.findings if f.kind == kind]
        if not group:
            continue
        print(f"\n[{KIND_LABEL[kind]}] {len(group)}")
        for f in group:
            loc = f"{f.path}:{f.line}" if f.line else f.path
            print(f"  {loc}  {f.message}")
            if f.excerpt:
                print(f"      {f.excerpt}")


def render_markdown(result: AuditResult, config: dict) -> str:
    ts = datetime.now().strftime("%Y-%m-%d %H:%M")
    lines = [
        f"# Audit documentaire — {config.get('project', '?')}",
        "",
        f"_Genere le {ts} par `config/scripts/audit_docs.py`._",
        "",
        "## Synthese",
        "",
        "| Mesure | Valeur |",
        "| --- | --- |",
        f"| Migrations analysees | {len(result.migrations)} |",
        f"| Tables declarees en migration | {len(result.tables_sql)} |",
        f"| Tables documentees | {len(result.tables_doc)} |",
        f"| Tables utilisees par le code | {len(result.code_tables)} |",
        f"| Divergences de schema | {len(result.schema_findings)} |",
        f"| Problemes editoriaux | {len(result.editorial_findings)} |",
        "",
    ]
    sections = [
        ("Divergences de schema", result.schema_findings),
        ("Problemes editoriaux", result.editorial_findings),
    ]
    for title, findings in sections:
        lines += [f"## {title}", ""]
        if not findings:
            lines += ["_Aucun._", ""]
            continue
        lines += ["| Gravite | Fichier | Ligne | Constat |", "| --- | --- | --- | --- |"]
        for f in findings:
            msg = f.message.replace("|", "\\|")
            lines.append(f"| {KIND_LABEL.get(f.kind, f.kind)} | `{f.path}` | {f.line or '-'} | {msg} |")
        lines.append("")
    return "\n".join(lines)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--config", default=str(DEFAULT_CONFIG), help="chemin du fichier YAML de configuration")
    ap.add_argument("--format", choices=("console", "markdown", "json"), default="console")
    ap.add_argument("--quiet", action="store_true", help="n'afficher que la synthese")
    ap.add_argument("--no-write", action="store_true", help="ne pas ecrire le rapport sur disque")
    args = ap.parse_args()

    cfg_path = Path(args.config)
    if not cfg_path.is_absolute():
        cfg_path = REPO_ROOT / cfg_path

    try:
        config = load_config(cfg_path)
    except (FileNotFoundError, ValueError) as exc:
        sys.stderr.write(f"erreur de configuration : {exc}\n")
        return 3
    except yaml.YAMLError as exc:
        sys.stderr.write(f"YAML invalide : {exc}\n")
        return 3

    root = REPO_ROOT
    result = run_audit(config, root)

    if args.format == "json":
        payload = {
            "project": config.get("project"),
            "migrations": result.migrations,
            "tables_sql": sorted(result.tables_sql),
            "views": sorted(result.views),
            "tables_doc": sorted(result.tables_doc),
            "tables_code": sorted(result.code_tables),
            "findings": [f.as_dict() for f in result.findings],
            "summary": {
                "schema": len(result.schema_findings),
                "editorial": len(result.editorial_findings),
            },
        }
        print(json.dumps(payload, ensure_ascii=False, indent=2))
    else:
        render_console(result, config, args.quiet or args.format == "markdown")
        if args.format == "markdown":
            content = render_markdown(result, config)
            out = root / config.get("paths", {}).get("report_dir", "config/reports") / (
                config.get("paths", {}).get("report_basename", "audit-docs") + ".md"
            )
            if not args.no_write:
                out.parent.mkdir(parents=True, exist_ok=True)
                out.write_text(content, encoding="utf-8")
                print(f"\nrapport ecrit : {out.relative_to(root).as_posix()}")

    exit_cfg = config.get("exit", {})
    if result.editorial_findings and not result.schema_findings:
        return 2 if exit_cfg.get("fail_on_editorial", False) else 0
    if result.schema_findings:
        return 1 if exit_cfg.get("fail_on_schema", True) else 0
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
