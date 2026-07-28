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
ID_RE = re.compile(r"^[A-Z][A-Z0-9-]*-\d{3}(?:\.\d+)*$")
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


def main() -> int:
    if len(sys.argv) != 2:
        print("Usage: check_plan.py <ledger.md>", file=sys.stderr)
        return 2

    path = Path(sys.argv[1])
    if not path.is_file():
        print(f"ERROR: ledger not found: {path}", file=sys.stderr)
        return 2

    text = path.read_text(encoding="utf-8")
    errors: list[str] = []
    warnings: list[str] = []

    for heading in REQUIRED_HEADINGS:
        if heading not in text:
            errors.append(f"missing heading: {heading}")

    rows = master_rows(text)
    if not rows:
        errors.append("Registro maestro has no task rows")

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

    for message in errors:
        print(f"ERROR: {message}")
    for message in warnings:
        print(f"WARN: {message}")
    print(f"Checked {len(rows)} task(s): {len(errors)} error(s), {len(warnings)} warning(s)")
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
