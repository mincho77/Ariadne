#!/usr/bin/env python3
"""Unit tests for check_plan dependency auditing."""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from check_plan import (
    audit_dependencies,
    build_task_graph,
    find_dependency_cycles,
    master_rows,
    parse_dependency_ids,
    validate_ledger,
)


LEDGER_TEMPLATE = """# Plan: Test

## Control
- Estado: activo
- Última actualización: 2026-08-04
- Objetivo: probar deps
- Gate actual: validación
- Próxima acción: correr tests

## Alcance
### Incluye
### No incluye
### Restricciones

## Métricas de éxito

## Registro maestro
| ID | Fase | Tarea | Estado | Depende de | Aceptación | Evidencia / notas | Próxima acción |
{rows}

## Riesgos
| ID | Severidad | Riesgo | Mitigación | Estado |

## Decisiones
| Fecha | ID | Decisión | Motivo | Impacto |

## Diferidos
| ID | Trabajo | Motivo | Condición de reactivación |

## Historial
"""


def row(task_id: str, state: str, deps: str = "-", evidence: str = "ok") -> str:
    return (
        f"| {task_id} | 1 | Tarea {task_id} | {state} | {deps} | Debe pasar | {evidence} | Siguiente |"
    )


class CheckPlanDependencyTests(unittest.TestCase):
    def test_parse_dependency_ids_splits_commas_and_backticks(self) -> None:
        self.assertEqual(parse_dependency_ids("ARLOCAL-001"), ["ARLOCAL-001"])
        self.assertEqual(
            parse_dependency_ids("ARLOCAL-005, ARLOCAL-007"),
            ["ARLOCAL-005", "ARLOCAL-007"],
        )
        self.assertEqual(parse_dependency_ids("JM-B-1, JM-E-2"), ["JM-B-1", "JM-E-2"])

    def test_find_dependency_cycles(self) -> None:
        graph = {
            "A": ["B"],
            "B": ["C"],
            "C": ["A"],
        }
        cycles = find_dependency_cycles(graph)
        self.assertTrue(any("A" in cycle and "B" in cycle and "C" in cycle for cycle in cycles))

    def test_missing_dependency_is_error(self) -> None:
        rows = master_rows(LEDGER_TEMPLATE.format(rows=row("ARLOCAL-002", "pendiente", "ARLOCAL-999")))
        tasks, graph = build_task_graph(rows)
        errors, warnings = audit_dependencies(tasks, graph)
        self.assertTrue(any("missing dependency" in item for item in errors))
        self.assertEqual(warnings, [])

    def test_in_progress_with_open_dependency_is_error(self) -> None:
        body = "\n".join([
            row("ARLOCAL-001", "pendiente"),
            row("ARLOCAL-002", "en_progreso", "ARLOCAL-001", "working"),
        ])
        rows = master_rows(LEDGER_TEMPLATE.format(rows=body))
        tasks, graph = build_task_graph(rows)
        errors, _warnings = audit_dependencies(tasks, graph)
        self.assertTrue(any("in progress but dependency" in item for item in errors))

    def test_orphan_pending_task_warns(self) -> None:
        rows = master_rows(LEDGER_TEMPLATE.format(rows=row("ARLOCAL-050", "pendiente")))
        tasks, graph = build_task_graph(rows)
        _errors, warnings = audit_dependencies(tasks, graph)
        self.assertTrue(any("possible orphan" in item for item in warnings))

    def test_valid_ledger_passes(self) -> None:
        body = "\n".join([
            row("ARLOCAL-001", "hecho"),
            row("ARLOCAL-002", "pendiente", "ARLOCAL-001"),
        ])
        errors, warnings, count = validate_ledger(LEDGER_TEMPLATE.format(rows=body))
        self.assertEqual(count, 2)
        self.assertEqual(errors, [])
        self.assertEqual(warnings, [])


if __name__ == "__main__":
    raise SystemExit(unittest.main())
