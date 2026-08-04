#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const TASKS_DIR = path.join(__dirname, '..', 'backlog', 'tasks');

const SPECS = {
  'AH-E-9': {
    description: 'Documentar motor buildProjectGantt, APIs REST, persistencia frontmatter, UI externa :63447, capacidad, ruta crítica, calendario CO, dependencias FS/SS/FF/SF y limitaciones actuales.',
    ac: [
      'Existe diagnóstico en docs/plans/ariadne-gantt.md con existente/parcial/ausente',
      'docs/ARQUITECTURA.md y docs/GANTT.md presentes y referenciados',
      'Resultado baseline de npm test registrado (65/65)',
      'Ubicación UI externa confirmada o bloqueo documentado',
    ],
  },
  'AH-E-10': {
    description: 'Definir contrato JSON estable del planificador y fixtures reproducibles para FS/SS/FF/SF, lags, ciclos, capacidad, queue ordinal, festivos CO y tareas bloqueadas.',
    ac: [
      'Fixtures versionados bajo tests/fixtures/gantt/',
      'Escenarios documentados en docs/GANTT.md',
      'Pruebas fallan antes de cambios y pasan con motor actual donde aplique',
    ],
  },
  'AH-E-11': {
    description: 'Reemplazar parseo regex de frontmatter por parser YAML confiable con round-trip sin perder cuerpo Markdown ni campos desconocidos.',
    ac: [
      'Leer/modificar/guardar tarea preserva contenido',
      'Compatibilidad con archivos existentes verificada',
      'Pruebas de ida y vuelta incluidas',
    ],
  },
  'AH-E-12': {
    description: 'Extraer de server.js módulos: esquema, grafo, calendarios, restricciones, capacidad, ruta crítica, diagnósticos, baselines.',
    ac: [
      'Módulos en lib/gantt/ o equivalente',
      'server.js delega sin cambiar comportamiento',
      'Regresión npm test verde',
    ],
  },
  'AH-E-13': {
    description: 'Incorporar campos temporales (planned/actual/target/deadline/not_before/fixed/progress/remaining/blocked) con precedencia documentada.',
    ac: [
      'Precedencia y migración documentadas',
      'Compatibilidad con estimate_days, due_date, started_date',
      'Pronóstico calculado, no persistido como verdad manual',
    ],
  },
  'AH-E-14': {
    description: 'Implementar PATCH /api/projects/{slug}/tasks/{id} con validación, escritura atómica, hash/updated_date y errores explicativos.',
    ac: [
      'Actualizaciones parciales funcionan',
      'Markdown y campos desconocidos preservados',
      'Pruebas HTTP de conflicto y validación',
    ],
  },
  'AH-E-15': {
    description: 'Registrar actual_start al entrar In Progress y actual_finish al Done; no destruir fechas al reabrir.',
    ac: [
      'Reglas aplican por UI, CLI, runner y API',
      'Pruebas de transición de estado',
      'Reapertura no falsifica historial',
    ],
  },
  'AH-E-16': {
    description: 'Motor considera not_before, fixed dates, deadline, target_finish; diagnósticos explican causa de cada fecha.',
    ac: [
      'Incumplimientos detectados y reportados',
      'Explicabilidad por dependencia/capacidad/calendario/restricción',
      'Pruebas por tipo de restricción',
    ],
  },
  'AH-E-17': {
    description: 'Unificar Doing/Queue/To Do con capacity.total/bugs/enhancements; proyección alineada al runner.',
    ac: [
      'Doing consume capacidad primero',
      'Queue respeta ordinal',
      'Compatibilidad ai-capacity.config.json',
    ],
  },
  'AH-E-18': {
    description: 'Mostrar bloqueo FS en Kanban; política estricta vs advertencia configurable; no auto-Blocked sin decisión.',
    ac: [
      'UI muestra predecesora pendiente',
      'Mover a Doing respeta política',
      'Pruebas de bloqueo',
    ],
  },
  'AH-E-19': {
    description: 'Guardar/consultar baselines inmutables en backlog/docs/gantt/baselines/ con comparación vs pronóstico.',
    ac: [
      'Baseline con nombre, fecha, autor',
      'No mutación silenciosa',
      'API de consulta y comparación',
    ],
  },
  'AH-E-20': {
    description: 'Diferenciar progress, remaining_hours, esfuerzo ejecutado; pronóstico usa remaining prioritariamente.',
    ac: [
      'Done=100%, Doing editable',
      'Checklist sugiere % sin sobrescribir remaining sin autorización',
    ],
  },
  'AH-E-21': {
    description: 'Modelar blocked_since, blocked_reason, blocked_by, expected_unblock_date; pronóstico de baja confianza sin fecha.',
    ac: [
      'Campos en frontmatter',
      'Motor marca confianza baja',
      'Pruebas de bloqueo temporal',
    ],
  },
  'AH-E-22': {
    description: 'Soportar parent_id, release, workstream, hitos duración cero; IDs B/E existentes intactos.',
    ac: [
      'Hitos visibles en API Gantt',
      'Jerarquía padre-hijo en JSON',
    ],
  },
  'AH-E-23': {
    description: 'Coordinar UI editable en repo externo (:63447); contrato API; tabla+timeline; dependencias visuales; enlace en ledger.',
    ac: [
      'Bloqueo UI documentado si repo no disponible',
      'Tareas coordinadora con URL del frontend',
      'Smoke de integración Hub→UI',
    ],
  },
  'AH-E-24': {
    description: 'Hub muestra fin planeado/pronosticado, variación, % completado, atrasos, deadlines en riesgo, bloqueos, confianza.',
    ac: [
      'Métricas por proyecto en tarjeta Hub',
      'Confianza baja con reglas documentadas',
    ],
  },
  'AH-E-25': {
    description: 'Modelo assignee, required_skills, resource_type; disponibilidad y maxParallel por recurso.',
    ac: [
      'Esquema documentado',
      'Motor opcionalmente condicionado por recurso',
    ],
  },
  'AH-E-26': {
    description: 'Holgura total, frente a deadline, ruta crítica lógica vs condicionada por recursos.',
    ac: [
      'Campos en respuesta Gantt',
      'Pruebas con fixture de capacidad',
    ],
  },
  'AH-E-27': {
    description: 'Simular capacidad, inicio, festivos, bug urgente, estimaciones sin alterar plan vigente; adoptar con confirmación.',
    ac: [
      'Escenarios no persisten sin confirmación',
      'Comparación side-by-side',
    ],
  },
  'AH-E-28': {
    description: 'Vista portafolio: todos los proyectos, hitos, riesgos, capacidad compartida, dependencias cross-project.',
    ac: [
      'API o página multiproyecto',
      'Documentación operativa',
    ],
  },
  'AH-E-29': {
    description: 'Migración dry-run, docs, smoke, regresión, rendimiento 1000 tareas, reversión, actualizar GANTT.md y ARQUITECTURA.md.',
    ac: [
      'npm test verde',
      'Manual operativo Gantt',
      'Evidencia en ledger',
    ],
  },
};

function upsertSection(source, sectionName, body) {
  const begin = `<!-- SECTION:${sectionName}:BEGIN -->`;
  const end = `<!-- SECTION:${sectionName}:END -->`;
  const block = `${begin}\n${body.trim()}\n${end}`;
  if (source.includes(begin)) {
    return source.replace(new RegExp(`${begin}[\\s\\S]*?${end}`), block);
  }
  const acBegin = '<!-- AC:BEGIN -->';
  if (sectionName === 'DESCRIPTION' && source.includes(acBegin)) {
    return source.replace(acBegin, `${block}\n\n## Acceptance Criteria\n${acBegin}`);
  }
  return `${source.trim()}\n\n${block}\n`;
}

function upsertAc(source, items) {
  const lines = items.map((text, i) => `- [ ] #${i + 1} ${text}`).join('\n');
  const begin = '<!-- AC:BEGIN -->';
  const end = '<!-- AC:END -->';
  const block = `${begin}\n${lines}\n${end}`;
  if (source.includes(begin)) {
    return source.replace(new RegExp(`${begin}[\\s\\S]*?${end}`), block);
  }
  return `${source.trim()}\n\n## Acceptance Criteria\n${block}\n`;
}

for (const file of fs.readdirSync(TASKS_DIR)) {
  const idMatch = file.match(/^(ah-e-\d+)/i);
  if (!idMatch) continue;
  const specKey = `AH-E-${Number(idMatch[1].split('-').pop())}`;
  if (!SPECS[specKey]) continue;
  const spec = SPECS[specKey];
  const filePath = path.join(TASKS_DIR, file);
  let source = fs.readFileSync(filePath, 'utf8');
  source = upsertSection(source, 'DESCRIPTION', spec.description);
  source = upsertAc(source, spec.ac);
  if (!source.includes('docs/plans/ariadne-gantt.md')) {
    source = source.replace(/^---\n([\s\S]*?)\n---\n/m, (fm) => {
      if (fm.includes('references:')) return fm;
      return fm.replace(/---\n$/, 'references:\n  - docs/plans/ariadne-gantt.md\n---\n');
    });
  }
  fs.writeFileSync(filePath, source);
  console.log('enriched', specKey);
}
