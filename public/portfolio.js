const summaryEl = document.querySelector('#summary');
const projectsEl = document.querySelector('#projects');
const milestonesEl = document.querySelector('#milestones');
const crossEl = document.querySelector('#cross');

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  }[char]));
}

function formatFlags(flags) {
  if (!flags?.length) return 'Sin alertas';
  return flags.join(' · ');
}

function projectCard(row) {
  if (!row.available) {
    return `<article class="project-card portfolio-card">
      <h2>${escapeHtml(row.name)}</h2>
      <p class="lane-meta">No disponible: ${escapeHtml(row.error || 'error')}</p>
    </article>`;
  }
  const m = row.metrics || {};
  return `<article class="project-card portfolio-card">
    <div class="card-top">
      <h2>${escapeHtml(row.name)}</h2>
      <span class="confidence-pill ${escapeHtml(m.forecastConfidence || 'high')}">${escapeHtml(m.forecastConfidence || 'high')}</span>
    </div>
    <p class="lane-meta">Fin pronóstico: <strong>${escapeHtml(m.forecastFinishDate || '—')}</strong></p>
    <p class="lane-meta">${row.summary?.estimatedPendingDays ?? '—'}d pendientes · ${row.summary?.milestoneCount ?? 0} hitos</p>
    <p class="lane-next"><em>Riesgos</em>${escapeHtml(formatFlags(row.riskFlags))}</p>
    <div class="card-actions">
      <a class="btn-gantt" href="/">Ver en Hub</a>
    </div>
  </article>`;
}

function renderTable(headers, rows) {
  if (!rows.length) return '<p class="lane-meta">Sin registros.</p>';
  const head = headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('');
  const body = rows.map((cells) => `<tr>${cells.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('');
  return `<table class="portfolio-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

async function loadPortfolio() {
  summaryEl.textContent = 'Cargando portafolio…';
  projectsEl.innerHTML = '';
  milestonesEl.innerHTML = '';
  crossEl.innerHTML = '';
  try {
    const response = await fetch('/api/gantt/portfolio?includeDone=0', { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Error al cargar portafolio');

    const s = data.summary || {};
    summaryEl.innerHTML = `<div class="portfolio-kpis">
      <p><strong>${s.availableProjects ?? 0}</strong> / ${s.projectCount ?? 0} proyectos</p>
      <p><strong>${s.milestoneCount ?? 0}</strong> hitos</p>
      <p><strong>${s.atRiskProjects ?? 0}</strong> con riesgo</p>
      <p>Fin más lejano: <strong>${escapeHtml(s.latestForecastFinish || '—')}</strong></p>
      <p>Cross-deps: ${s.crossProjectDependencies ?? 0} (${s.unresolvedCrossProjectDependencies ?? 0} sin resolver)</p>
    </div>`;

    projectsEl.innerHTML = (data.projects || []).map(projectCard).join('');

    const milestoneRows = (data.milestones || []).map((row) => [
      escapeHtml(row.compositeId || row.id),
      escapeHtml(row.title),
      escapeHtml(row.endDate || row.startDate || '—'),
      escapeHtml(row.projectName || row.projectSlug),
    ]);
    milestonesEl.innerHTML = renderTable(['Id', 'Título', 'Fecha', 'Proyecto'], milestoneRows);

    const crossRows = (data.crossProjectDependencies || []).map((row) => [
      escapeHtml(`${row.fromProjectSlug}:${row.fromTaskId}`),
      escapeHtml(`${row.toProjectSlug}:${row.toTaskId}`),
      escapeHtml(row.relation || 'FS'),
      escapeHtml(row.raw),
    ]);
    crossEl.innerHTML = renderTable(['Desde', 'Hacia', 'Rel', 'Token'], crossRows);
  } catch (error) {
    summaryEl.textContent = error.message;
  }
}

document.querySelector('#refresh').onclick = () => loadPortfolio();
loadPortfolio();
