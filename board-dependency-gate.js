'use strict';

function taskDependencyGateStyles() {
  return `
.dep-gate{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
.dep-gate-pill{display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:999px;font-size:10px;font-weight:700;letter-spacing:.02em}
.dep-gate-pill.blocked{background:#3a1f24;color:#ffb4ab;border:1px solid #7f2d34}
.dep-gate-pill.warn{background:#3a321f;color:#ffd180;border:1px solid #7f6a2d}
.dep-gate-pill.ok{background:#1f3a2a;color:#9be7b5;border:1px solid #2d7f4a}
`;
}

function taskDependencyGateHtml(gate, escapeHtml) {
  if (!gate || !Array.isArray(gate.blocking) || gate.blocking.length === 0) return '';
  const pending = gate.blocking.filter((item) => item.reason === 'pending');
  const unresolved = gate.blocking.filter((item) => item.reason === 'unresolved');
  const pills = [];
  for (const item of pending) {
    pills.push(`<span class="dep-gate-pill blocked" title="Finish-to-Start pendiente">FS ← ${escapeHtml(item.id)}</span>`);
  }
  for (const item of unresolved) {
    pills.push(`<span class="dep-gate-pill warn" title="Predecesora no encontrada">? ${escapeHtml(item.id)}</span>`);
  }
  if (!pills.length) return '';
  return `<div class="dep-gate" aria-label="Dependencias FS">${pills.join('')}</div>`;
}

module.exports = {
  taskDependencyGateStyles,
  taskDependencyGateHtml,
};
