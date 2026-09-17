#!/usr/bin/env python3
"""Validate an Ariadne Markdown plan ledger."""

from __future__ import annotations

import re
import sys
from pathlib import Path

REQUIRED_HEADINGS = [
    "## Control",
    "## Alcance",
    "## Métricas de éxito",
    "## Registro maestro",
    "## Riesgos",
    "## Decisiones",
    "## Diferidos",
    "## Historial",
]
VALID_STATES = {
    "pendiente",
    "en_progreso",
    "bloqueado",
    "hecho",
    "diferido",
    "cancelado",
}
TERMINAL_STATES = {"hecho", "cancelado"}
ACTIVE_STATES = {"pendiente", "en_progreso", "bloqueado"}
ID_TOKEN_RE = re.compile(
    r"(?:[A-Z]{2,}-[BE]-\d+|[A-Z][A-Z0-9-]*-\d{3}(?:\.\d+)*)"
)
ID_RE = re.compile(r"^(?:[A-Z]{2,}-[BE]-\d+|[A-Z][A-Z0-9-]*-\d{3}(?:\.\d+)*)$")
EMPTY_VALUES = {"", "-", "—", "n/a", "na"}


def cells(line: str) -> list[str]:
    return [part.strip() for part in line.strip().strip("|").split("|")]


def master_rows(text: str) -> list[list[str]]:
    match = re.search(
        r"^## Registro maestro\s*$([\s\S]*?)(?=^## |\Z)",
        text,
        flags=re.MULTILINE,
    )
    if not match:
        return []
    rows = []
    for line in match.group(1).splitlines():
        if not line.lstrip().startswith("|"):
            continue
        row = cells(line)
        if not row or row[0] == "ID" or all(set(value) <= {"-", ":"} for value in row):
            continue
        rows.append(row)
    return rows


def parse_dependency_ids(value: str) -> list[str]:
    if value.lower() in EMPTY_VALUES:
        return []
    cleaned = value.replace("`", "")
    found: list[str] = []
    for token in ID_TOKEN_RE.findall(cleaned):
        if token not in found:
            found.append(token)
    return found


def build_task_graph(rows: list[list[str]]) -> tuple[dict[str, dict], dict[str, list[str]]]:
    tasks: dict[str, dict] = {}
    graph: dict[str, list[str]] = {}
    for row in rows:
        if len(row) != 8:
            continue
        task_id, _phase, _task, state, deps_cell, _acceptance, _evidence, _next_action = row
        if not task_id:
            continue
        deps = parse_dependency_ids(deps_cell)
        tasks[task_id] = {"state": state, "deps": deps}
        graph[task_id] = deps
    return tasks, graph


def find_dependency_cycles(graph: dict[str, list[str]]) -> list[list[str]]:
    cycles: list[list[str]] = []
    visited: set[str] = set()
    stack: set[str] = set()
    path: list[str] = []

    def dfs(node: str) -> None:
        if node in stack:
            start = path.index(node)
            cycle = path[start:] + [node]
            normalized = cycle[:-1]
            if normalized not in [c[:-1] for c in cycles]:
                cycles.append(cycle)
            return
        if node in visited:
            return
        visited.add(node)
        stack.add(node)
        path.append(node)
        for dep in graph.get(node, []):
            if dep in graph:
                dfs(dep)
        path.pop()
        stack.remove(node)

    for node in graph:
        dfs(node)
    return cycles


def audit_dependencies(
    tasks: dict[str, dict],
    graph: dict[str, list[str]],
) -> tuple[list[str], list[str]]:
    errors: list[str] = []
    warnings: list[str] = []
    known_ids = set(tasks)

    referenced_by: dict[str, set[str]] = {task_id: set() for task_id in tasks}
    for task_id, deps in graph.items():
        for dep in deps:
            if dep in known_ids:
                referenced_by[dep].add(task_id)

    for task_id, deps in graph.items():
        state = tasks[task_id]["state"]
        for dep in deps:
            if dep == task_id:
                errors.append(f"{task_id}: depends on itself")
                continue
            if dep not in known_ids:
                errors.append(f"{task_id}: missing dependency '{dep}'")
                continue
            dep_state = tasks[dep]["state"]
            if state == "en_progreso" and dep_state not in TERMINAL_STATES:
                errors.append(
                    f"{task_id}: in progress but dependency {dep} is '{dep_state}' (not finished)"
                )
            elif state == "pendiente" and dep_state == "bloqueado":
                warnings.append(
                    f"{task_id}: pending with blocked dependency {dep}"
                )

    for cycle in find_dependency_cycles(graph):
        chain = " -> ".join(cycle)
        errors.append(f"dependency cycle detected: {chain}")

    for task_id, meta in tasks.items():
        state = meta["state"]
        if state in TERMINAL_STATES:
            continue
        if meta["deps"]:
            continue
        if referenced_by.get(task_id):
            continue
        warnings.append(
            f"{task_id}: possible orphan (no dependencies and nothing depends on it)"
        )

    return errors, warnings


def validate_ledger(text: str) -> tuple[list[str], list[str], int]:
    errors: list[str] = []
    warnings: list[str] = []

    for heading in REQUIRED_HEADINGS:
        if heading not in text:
            errors.append(f"missing heading: {heading}")

    rows = master_rows(text)
    if not rows:
        errors.append("Registro maestro has no task rows")
        return errors, warnings, 0

    seen: set[str] = set()
    in_progress = 0
    for row_number, row in enumerate(rows, start=1):
        if len(row) != 8:
            errors.append(f"task row {row_number}: expected 8 columns, got {len(row)}")
            continue
        task_id, _phase, _task, state, _deps, acceptance, evidence, next_action = row
        if not ID_RE.match(task_id):
            errors.append(f"{task_id or 'row '+str(row_number)}: invalid stable ID")
        elif task_id in seen:
            errors.append(f"{task_id}: duplicate ID")
        seen.add(task_id)
        if state not in VALID_STATES:
            errors.append(f"{task_id}: invalid state '{state}'")
        if acceptance.lower() in EMPTY_VALUES:
            errors.append(f"{task_id}: missing acceptance criteria")
        if state == "hecho" and evidence.lower() in EMPTY_VALUES:
            errors.append(f"{task_id}: done without evidence")
        if state == "bloqueado" and next_action.lower() in EMPTY_VALUES:
            errors.append(f"{task_id}: blocked without unblocking action")
        if state == "diferido" and evidence.lower() in EMPTY_VALUES:
            errors.append(f"{task_id}: deferred without reason/notes")
        if state == "en_progreso":
            in_progress += 1
            if next_action.lower() in EMPTY_VALUES:
                errors.append(f"{task_id}: in progress without next action")

    if in_progress > 3:
        warnings.append(f"{in_progress} tasks in progress; Ariadne recommends at most 3")

    for key in ("Estado:", "Última actualización:", "Objetivo:", "Gate actual:", "Próxima acción:"):
        if not re.search(rf"^-\s*{re.escape(key)}\s*\S+", text, flags=re.MULTILINE):
            errors.append(f"Control missing value for {key}")

    tasks, graph = build_task_graph(rows)
    dep_errors, dep_warnings = audit_dependencies(tasks, graph)
    errors.extend(dep_errors)
    warnings.extend(dep_warnings)

    return errors, warnings, len(rows)


def main() -> int:
    if len(sys.argv) != 2:
        print("Usage: check_plan.py <ledger.md>", file=sys.stderr)
        return 2

    path = Path(sys.argv[1])
    if not path.is_file():
        print(f"ERROR: ledger not found: {path}", file=sys.stderr)
        return 2

    text = path.read_text(encoding="utf-8")
    errors, warnings, row_count = validate_ledger(text)

    for message in errors:
        print(f"ERROR: {message}")
    for message in warnings:
        print(f"WARN: {message}")
    print(f"Checked {row_count} task(s): {len(errors)} error(s), {len(warnings)} warning(s)")
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
