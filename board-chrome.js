function boardCounts(project, projectTasks, isBugTask, isImprovementTask) {
  const tasks = projectTasks(project);
  const bugs = tasks.filter(isBugTask);
  const improvements = tasks.filter(isImprovementTask);
  const openCount = (list) => list.filter((task) => !/^done|complete$/i.test(String(task.status || ''))).length;
  return {
    bugs: bugs.length,
    bugsOpen: openCount(bugs),
    improvements: improvements.length,
    improvementsOpen: openCount(improvements),
  };
}

function boardNavHtml(project, activeView, counts, helpers) {
  const { escapeHtml, HOST, PORT, BOARD_PORT } = helpers;
  const base = `http://${HOST}:${BOARD_PORT}/?project=${encodeURIComponent(project.slug)}`;
  const bugsUrl = `${base}&view=bugs`;
  const mejorasUrl = `${base}&view=mejoras`;
  const hubUrl = `http://${HOST}:${PORT}`;
  const bugsBadge = counts.bugsOpen > 0
    ? `<span class="seg-badge seg-badge-warn">${counts.bugsOpen}</span>`
    : '';
  const impBadge = counts.improvementsOpen > 0
    ? `<span class="seg-badge">${counts.improvementsOpen}</span>`
    : '';
  const isBugs = activeView === 'bugs';
  const modeTitle = isBugs ? 'Bugs' : 'Mejoras';
  const modeSubtitle = isBugs
    ? 'Corrección y estabilidad'
    : 'Evolución del producto';
  let bannerClass = 'mode-banner';
  let bannerText = isBugs
    ? 'Modo bugs activo. Solo ves incidencias; las mejoras están en la pestaña Mejoras.'
    : 'Modo mejoras activo. Si hay bugs abiertos, atiéndelos primero en la pestaña Bugs.';
  if (!isBugs && counts.bugsOpen > 0) {
    bannerClass += ' mode-banner-alert';
    bannerText = `${counts.bugsOpen} bug${counts.bugsOpen === 1 ? '' : 's'} abierto${counts.bugsOpen === 1 ? '' : 's'} — prioridad operativa sobre mejoras.`;
  } else if (isBugs && counts.bugsOpen === 0) {
    bannerClass += ' mode-banner-clear';
    bannerText = 'Sin bugs abiertos. Puedes pasar a Mejoras cuando quieras.';
  }

  return `<header class="board-chrome view-${activeView}">
  <div class="chrome-row">
    <a class="back-hub" href="${hubUrl}"><span aria-hidden="true">←</span> Hub</a>
    <div class="chrome-title-block">
      <p class="chrome-project">${escapeHtml(project.name)}</p>
      <h1 class="chrome-mode">${modeTitle}</h1>
      <p class="chrome-sub">${modeSubtitle}</p>
    </div>
  </div>
  <nav class="segmented" role="tablist" aria-label="Tipo de tablero">
    <a class="seg-item${isBugs ? ' active' : ''}" href="${bugsUrl}" role="tab" aria-selected="${isBugs}">Bugs${bugsBadge}</a>
    <a class="seg-item${!isBugs ? ' active' : ''}" href="${mejorasUrl}" role="tab" aria-selected="${!isBugs}">Mejoras${impBadge}</a>
  </nav>
  <p class="${bannerClass}">${bannerText}</p>
</header>`;
}

function boardNavStyles() {
  return `
.board-chrome{margin-bottom:22px;padding:20px 22px;border-radius:20px;border:1px solid var(--chrome-border);background:var(--chrome-bg);backdrop-filter:saturate(180%) blur(20px);-webkit-backdrop-filter:saturate(180%) blur(20px);box-shadow:0 8px 32px #00000033}
.board-chrome.view-bugs{--chrome-bg:#1a1012cc;--chrome-border:#5a3038;--seg-active:#ff5d7d;--seg-track:#2a151c}
.board-chrome.view-mejoras{--chrome-bg:#0d1824cc;--chrome-border:#2f6b8f;--seg-active:#2f8cff;--seg-track:#123044}
.chrome-row{display:flex;align-items:flex-start;gap:18px;margin-bottom:18px}
.back-hub{display:inline-flex;align-items:center;gap:6px;padding:8px 12px;border-radius:999px;background:#ffffff12;color:var(--text-muted);font-size:13px;font-weight:600;text-decoration:none;white-space:nowrap;transition:background .15s,color .15s}
.back-hub:hover{background:#ffffff1f;color:var(--text-primary)}
.chrome-title-block{min-width:0;flex:1}
.chrome-project{margin:0 0 4px;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--text-muted)}
.chrome-mode{margin:0;font-size:34px;font-weight:700;letter-spacing:-.03em;line-height:1.05}
.chrome-sub{margin:6px 0 0;font-size:14px;color:var(--text-muted)}
.segmented{display:grid;grid-template-columns:1fr 1fr;gap:4px;padding:4px;border-radius:14px;background:var(--seg-track);max-width:420px}
.seg-item{display:flex;align-items:center;justify-content:center;gap:8px;padding:11px 14px;border-radius:11px;color:var(--text-muted);font-size:14px;font-weight:700;text-decoration:none;transition:background .18s,color .18s,box-shadow .18s}
.seg-item.active{background:var(--seg-active);color:#fff;box-shadow:0 4px 14px #00000044}
.seg-item:not(.active):hover{color:var(--text-primary);background:#ffffff0d}
.seg-badge{min-width:22px;height:22px;padding:0 7px;border-radius:999px;background:#ffffff22;color:#fff;font-size:12px;font-weight:800;display:inline-grid;place-items:center}
.seg-badge-warn{background:#ffffff33}
.seg-item.active .seg-badge{background:#ffffff33}
.mode-banner{margin:14px 0 0;padding:12px 14px;border-radius:12px;font-size:13px;line-height:1.45;color:var(--text-muted);background:#ffffff08;border:1px solid #ffffff10}
.mode-banner-alert{color:#ffc2cf;background:#ff5d7d18;border-color:#ff5d7d44}
.mode-banner-clear{color:#8de1b8;background:#8de1b814;border-color:#8de1b833}
@media(max-width:700px){.chrome-row{flex-direction:column;gap:12px}.chrome-mode{font-size:28px}.segmented{max-width:none}}
`;
}

module.exports = {
  boardCounts,
  boardNavHtml,
  boardNavStyles,
};
