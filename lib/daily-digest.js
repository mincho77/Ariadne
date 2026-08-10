'use strict';

/**
 * Local daily digest: Markdown snapshot of Doing / Queue / risks (no cloud).
 */

function formatTaskLine(task) {
  if (!task) return '- (ninguna)';
  const ready = task.ready === false ? ' ⛔' : '';
  const prio = task.priority ? ` [${task.priority}]` : '';
  return `- **${task.id}**${prio}${ready} — ${task.title || ''}`.trim();
}

function renderProjectDigest(projectHoy) {
  const lines = [];
  lines.push(`## ${projectHoy.name || projectHoy.project} (\`${projectHoy.project}\`)`);
  lines.push('');
  lines.push(`- Doing: **${projectHoy.doingCount || 0}** · Queue: **${projectHoy.queueLength || 0}** · Riesgos: **${(projectHoy.risks || []).length}**`);
  if (projectHoy.next) {
    lines.push(`- Siguiente ready: **${projectHoy.next.id}** — ${projectHoy.next.title || ''}`);
  } else if (projectHoy.blockedHead) {
    lines.push(`- Cabeza Queue bloqueada: **${projectHoy.blockedHead.id}**`);
  } else {
    lines.push('- Siguiente ready: _(ninguna)_');
  }
  lines.push('');
  lines.push('### Doing');
  if (!(projectHoy.doing || []).length) {
    lines.push('- _(vacío)_');
  } else {
    for (const item of projectHoy.doing) {
      const blocked = item.fsBlocked ? ' ⛔ FS' : '';
      lines.push(`- **${item.id}** [${item.priority || '?'}]${blocked} — ${item.title || ''}`);
    }
  }
  lines.push('');
  lines.push('### Queue');
  if (!(projectHoy.queue || []).length) {
    lines.push('- _(vacío)_');
  } else {
    for (const item of projectHoy.queue) {
      lines.push(formatTaskLine(item));
    }
  }
  lines.push('');
  lines.push('### Riesgos');
  if (!(projectHoy.risks || []).length) {
    lines.push('- _(ninguno)_');
  } else {
    for (const risk of projectHoy.risks) {
      const tid = risk.taskId ? ` (${risk.taskId})` : '';
      lines.push(`- **${risk.kind}**${tid}: ${risk.message}`);
    }
  }
  if (projectHoy.ganttMetrics) {
    const m = projectHoy.ganttMetrics;
    lines.push('');
    lines.push('### Gantt (resumen)');
    lines.push(`- Forecast: ${m.forecastFinishDate || '—'} · confianza ${m.forecastConfidence || '—'}`);
    lines.push(`- Deadlines en riesgo: ${m.deadlineAtRisk || 0} · bloqueadas: ${m.blockedTasks || 0}`);
  }
  lines.push('');
  return lines.join('\n');
}

/**
 * @param {object} hoySnapshot — from buildHoySnapshot
 * @param {{ date?: string }} [options]
 */
function renderDailyDigest(hoySnapshot, options = {}) {
  const generatedAt = hoySnapshot.generatedAt || new Date().toISOString();
  const day = options.date || generatedAt.slice(0, 10);
  const lines = [
    `# Digest diario · ${day}`,
    '',
    `Generado: ${generatedAt}`,
    `Proyectos: ${hoySnapshot.projectCount || (hoySnapshot.projects || []).length}`,
    '',
    '## Focus',
    '',
  ];

  for (const row of hoySnapshot.focus || []) {
    lines.push(
      `- **${row.project}**: doing ${row.doingCount}`
      + (row.next ? ` · next ${row.next.id}` : '')
      + (row.riskCount ? ` · riesgos ${row.riskCount}` : ''),
    );
  }
  if (!(hoySnapshot.focus || []).length) {
    lines.push('- _(sin proyectos)_');
  }
  lines.push('');

  for (const project of hoySnapshot.projects || []) {
    lines.push(renderProjectDigest(project));
  }

  lines.push('---');
  lines.push('_Local only · `npm run ariadne:digest` · sin cloud_');
  lines.push('');
  return lines.join('\n');
}

function digestOutputPaths(root, day) {
  const dir = require('node:path').join(root, '.ariadne', 'digests');
  return {
    dir,
    dated: require('node:path').join(dir, `${day}.md`),
    latest: require('node:path').join(dir, 'latest.md'),
    latestJson: require('node:path').join(dir, 'latest.json'),
  };
}

module.exports = {
  renderDailyDigest,
  renderProjectDigest,
  digestOutputPaths,
  formatTaskLine,
};
