const projects = document.querySelector('#projects');
const empty = document.querySelector('#empty');
const dialog = document.querySelector('#dialog');
const hoyBody = document.querySelector('#hoy-body');
const hoyRefresh = document.querySelector('#hoy-refresh');
const DEFAULT_GANTT_BASE_URL = 'http://localhost:63447/';
let ganttBaseUrl = DEFAULT_GANTT_BASE_URL;

function normalizeBaseUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return DEFAULT_GANTT_BASE_URL;
  try {
    const url = new URL(raw);
    if (!url.pathname || url.pathname === '/') {
      url.pathname = '/';
    }
    return url.toString();
  } catch {
    return DEFAULT_GANTT_BASE_URL;
  }
}

async function loadHubConfig() {
  try {
    const response = await fetch('/api/hub-config', { cache: 'no-store' });
    if (!response.ok) return;
    const data = await response.json();
    ganttBaseUrl = normalizeBaseUrl(data?.ganttBaseUrl);
  } catch {
    // Keep default/fallback URL when hub-config is unavailable.
  }
}

async function load() {
  const response = await fetch('/api/projects', { cache: 'no-store' });
  const data = await response.json();
  projects.innerHTML = data.map(card).join('');
  empty.hidden = data.length > 0;
  projects.querySelectorAll('[data-board]').forEach((button) => {
    button.onclick = () => openBoard(button.dataset.board, button.dataset.view);
  });
  projects.querySelectorAll('[data-gantt]').forEach((button) => {
    button.onclick = () => openGantt(button.dataset.gantt);
  });
  projects.querySelectorAll('[data-swarm-status]').forEach((button) => {
    button.onclick = () => showSwarmStatus(button.dataset.swarmStatus);
  });
  projects.querySelectorAll('[data-swarm-observe]').forEach((button) => {
    button.onclick = () => showSwarmObserve(button.dataset.swarmObserve);
  });
  projects.querySelectorAll('[data-swarm-run]').forEach((button) => {
    button.onclick = () => runSwarm(button.dataset.swarmRun);
  });
  await loadHoy();
}

function hoyProjectHtml(item) {
  const next = item.next
    ? `${escapeHtml(item.next.id)} · ${escapeHtml(item.next.title)}`
    : (item.blockedHead
      ? `Bloqueada: ${escapeHtml(item.blockedHead.id)}`
      : 'Cola vacía');
  const doing = item.doingCount
    ? item.doing.map((task) => `<li><strong>${escapeHtml(task.id)}</strong> ${escapeHtml(task.title || '')}</li>`).join('')
    : '<li class="muted">Nada en Doing</li>';
  const risks = item.risks?.length
    ? item.risks.map((risk) => `<li>${escapeHtml(risk.message)}</li>`).join('')
    : '<li class="muted">Sin alertas</li>';

  return `<article class="hoy-card" data-hoy-project="${escapeHtml(item.project)}">
    <div class="hoy-card-top">
      <h3>${escapeHtml(item.name || item.project)}</h3>
      <span class="hoy-pill">${item.doingCount} doing · ${item.queueLength} queue</span>
    </div>
    <div class="hoy-grid">
      <section>
        <p class="hoy-label">Doing</p>
        <ul>${doing}</ul>
      </section>
      <section>
        <p class="hoy-label">Siguiente (Queue)</p>
        <p class="hoy-next">${next}</p>
      </section>
      <section>
        <p class="hoy-label">Riesgos</p>
        <ul>${risks}</ul>
      </section>
    </div>
    <div class="hoy-actions">
      <button type="button" data-swarm-status="${escapeHtml(item.project)}" class="btn-swarm secondary">Status</button>
      <button type="button" data-swarm-observe="${escapeHtml(item.project)}" class="btn-swarm secondary">Handoffs</button>
      <button type="button" data-swarm-run="${escapeHtml(item.project)}" class="btn-swarm">Run swarm</button>
    </div>
  </article>`;
}

async function loadHoy() {
  if (!hoyBody) return;
  try {
    const response = await fetch('/api/hoy', { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) {
      hoyBody.innerHTML = `<p class="hoy-empty">${escapeHtml(data.error || 'No se pudo cargar Hoy')}</p>`;
      return;
    }
    if (!data.projects?.length) {
      hoyBody.innerHTML = '<p class="hoy-empty">Sin proyectos para Hoy.</p>';
      return;
    }
    hoyBody.innerHTML = data.projects.map(hoyProjectHtml).join('');
    hoyBody.querySelectorAll('[data-swarm-status]').forEach((button) => {
      button.onclick = () => showSwarmStatus(button.dataset.swarmStatus);
    });
    hoyBody.querySelectorAll('[data-swarm-observe]').forEach((button) => {
      button.onclick = () => showSwarmObserve(button.dataset.swarmObserve);
    });
    hoyBody.querySelectorAll('[data-swarm-run]').forEach((button) => {
      button.onclick = async () => {
        await runSwarm(button.dataset.swarmRun);
        await loadHoy();
      };
    });
  } catch (error) {
    hoyBody.innerHTML = `<p class="hoy-empty">${escapeHtml(error.message || 'Error de red')}</p>`;
  }
}

function formatConfidenceLabel(level) {
  if (level === 'low') return 'Confianza baja';
  if (level === 'medium') return 'Confianza media';
  return 'Confianza alta';
}

function formatVariance(days) {
  if (days == null || !Number.isFinite(days)) return null;
  if (days === 0) return 'Sin variación vs baseline';
  const sign = days > 0 ? '+' : '';
  return `${sign}${days}d vs baseline`;
}

function ganttMetricsHtml(metrics) {
  if (!metrics) {
    return `<section class="lane lane-gantt" aria-label="Seguimiento Gantt">
      <div class="lane-head">
        <span class="lane-label">Seguimiento</span>
      </div>
      <p class="lane-meta">Sin pronóstico disponible</p>
    </section>`;
  }

  const confidence = metrics.forecastConfidence || 'high';
  const finish = metrics.forecastFinishDate || '—';
  const completion = metrics.completionRate != null ? `${metrics.completionRate}% completado` : '';
  const variance = formatVariance(metrics.finishVarianceDays ?? metrics.pendingDaysDelta);
  const risks = [];
  if (metrics.deadlineAtRisk > 0) risks.push(`${metrics.deadlineAtRisk} deadline${metrics.deadlineAtRisk === 1 ? '' : 's'} en riesgo`);
  if (metrics.blockedTasks > 0) risks.push(`${metrics.blockedTasks} bloqueo${metrics.blockedTasks === 1 ? '' : 's'}`);
  if (metrics.slippedTasks > 0) risks.push(`${metrics.slippedTasks} atraso${metrics.slippedTasks === 1 ? '' : 's'}`);
  if (metrics.cycleDetected) risks.push('ciclo detectado');

  return `<section class="lane lane-gantt" aria-label="Seguimiento Gantt">
    <div class="lane-head">
      <span class="lane-label">Seguimiento</span>
      <span class="confidence-pill ${escapeHtml(confidence)}">${escapeHtml(formatConfidenceLabel(confidence))}</span>
    </div>
    <p class="lane-meta">Fin pronóstico: <strong>${escapeHtml(finish)}</strong>${completion ? ` · ${escapeHtml(completion)}` : ''}</p>
    <p class="lane-meta">${variance ? escapeHtml(variance) : 'Sin baseline para comparar'}${metrics.forecastPendingDays != null ? ` · ${metrics.forecastPendingDays}d pendientes` : ''}</p>
    <p class="lane-next"><em>Riesgos</em>${escapeHtml(risks.length ? risks.join(' · ') : 'Sin alertas activas')}</p>
  </section>`;
}

function card(p) {
  const bugsOpen = Number(p.bugsOpen ?? 0);
  const improvementsTotal = Number(p.improvements ?? p.tasks ?? 0);
  const improvementsDone = Number(p.done ?? 0);
  const improvementsOpen = Number(p.improvementsOpen ?? Math.max(0, improvementsTotal - improvementsDone));
  const bugProgress = Number(p.bugProgress ?? 0);
  const progress = Number(p.progress ?? 0);
  const focus = p.focus ?? (bugsOpen > 0 ? 'bugs' : 'mejoras');
  const focusLabel = focus === 'bugs' ? 'Prioridad: bugs' : 'Enfoque: mejoras';
  const focusClass = focus === 'bugs' ? 'bugs' : 'mejoras';
  const bugsNext = p.nextBug || 'Sin bugs pendientes';
  const mejoraNext = p.next || 'Sin mejoras pendientes';
  const bugsActionClass = focus === 'bugs' ? '' : ' secondary-style';
  const mejoraActionClass = focus === 'mejoras' ? '' : ' secondary-style';

  return `<article class="project-card">
    <div class="card-top">
      <h2>${escapeHtml(p.name)}</h2>
      <span class="focus-pill ${focusClass}">${focusLabel}</span>
    </div>
    <p class="path">${escapeHtml(p.path)}</p>
    <div class="lanes">
      <section class="lane lane-bugs" aria-label="Resumen de bugs">
        <div class="lane-head">
          <span class="lane-label">Bugs</span>
          <span class="lane-count">${bugsOpen}</span>
        </div>
        <div class="lane-progress" aria-hidden="true"><i style="width:${bugProgress}%"></i></div>
        <p class="lane-meta">${bugsOpen} abiertos · ${bugProgress}% resueltos</p>
        <p class="lane-next"><em>Siguiente</em>${escapeHtml(bugsNext)}</p>
        <button data-board="${escapeHtml(p.slug)}" data-view="bugs" class="lane-action${bugsActionClass}">Abrir bugs</button>
      </section>
      <section class="lane lane-mejoras" aria-label="Resumen de mejoras">
        <div class="lane-head">
          <span class="lane-label">Mejoras</span>
          <span class="lane-count">${improvementsOpen}</span>
        </div>
        <div class="lane-progress" aria-hidden="true"><i style="width:${progress}%"></i></div>
        <p class="lane-meta">${improvementsOpen} abiertas · ${progress}% hechas</p>
        <p class="lane-next"><em>Siguiente</em>${escapeHtml(mejoraNext)}</p>
        <button data-board="${escapeHtml(p.slug)}" data-view="mejoras" class="lane-action${mejoraActionClass}">Abrir mejoras</button>
      </section>
    </div>
    ${ganttMetricsHtml(p.ganttMetrics)}
    <div class="card-actions">
      <button data-gantt="${escapeHtml(p.slug)}" class="btn-gantt">Abrir Gantt</button>
      <button data-swarm-status="${escapeHtml(p.slug)}" class="btn-swarm secondary">Swarm status</button>
      <button data-swarm-observe="${escapeHtml(p.slug)}" class="btn-swarm secondary">Handoffs</button>
      <button data-swarm-run="${escapeHtml(p.slug)}" class="btn-swarm">Run swarm</button>
    </div>
  </article>`;
}

async function openBoard(slug, view) {
  const response = await fetch(`/api/projects/${slug}/browser`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ view }),
  });
  const data = await response.json();
  if (data.url) window.open(data.url, '_blank', 'noopener');
  else alert(data.error || 'No se pudo abrir el tablero');
}

function openGantt(slug) {
  const url = new URL(ganttBaseUrl);
  url.searchParams.set('project', String(slug || ''));
  window.open(url.toString(), 'ariadne-gantt', 'noopener');
}

async function showSwarmStatus(slug) {
  try {
    const response = await fetch(`/api/projects/${encodeURIComponent(slug)}/swarm/status?detail=0`, { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) return alert(data.error || 'No se pudo leer swarm status');
    const next = data.next ? `${data.next.id} · ${data.next.title}` : (data.blockedHead
      ? `Bloqueada: ${data.blockedHead.id}`
      : 'Cola vacía');
    alert(`Swarm · ${slug}\nQueue: ${data.queueLength} · Doing: ${data.doingCount}\nNext: ${next}`);
  } catch (error) {
    alert(error.message || 'Error de red');
  }
}

async function showSwarmObserve(slug) {
  try {
    const response = await fetch(`/api/projects/${encodeURIComponent(slug)}/swarm/observe`, { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) return alert(data.error || 'No se pudo leer observabilidad');
    const doing = (data.doingDetail || []).map((item) => {
      const role = item.activeRole || '—';
      const last = item.lastHandoff
        ? `${item.lastHandoff.fromRole}→${item.lastHandoff.toRole}`
        : 'sin handoff';
      const trees = (item.worktrees || []).map((tree) => tree.name).join(', ') || '—';
      return `${item.id} · rol ${role} · ${last} · wt ${trees}`;
    }).join('\n') || '(nada en Doing)';
    const recent = (data.recentHandoffs || []).slice(0, 5).map((row) => {
      if (row.fromRole) return `${row.taskId || ''} ${row.fromRole}→${row.toRole}: ${row.summary || ''}`.trim();
      return JSON.stringify(row).slice(0, 120);
    }).join('\n') || '(sin log)';
    alert(`Observabilidad · ${slug}\n\nDoing:\n${doing}\n\nHandoffs recientes:\n${recent}\n\nLog: ${data.handoffLog || '—'}`);
  } catch (error) {
    alert(error.message || 'Error de red');
  }
}

async function runSwarm(slug) {
  if (!window.confirm(`¿Arrancar cabeza de Queue en ${slug}?`)) return;
  try {
    const response = await fetch(`/api/projects/${encodeURIComponent(slug)}/swarm/run`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });
    const data = await response.json();
    if (!response.ok) return alert(data.error || 'No se pudo hacer run');
    const task = data.task || {};
    alert(`Run · ${task.id || '?'} → ${task.status || ''}${data.resumed ? ' (resume)' : ''}`);
    load();
  } catch (error) {
    alert(error.message || 'Error de red');
  }
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
}

document.querySelector('#new-project').onclick = () => dialog.showModal();
document.querySelector('#project-form').onsubmit = async (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.target));
  const response = await fetch('/api/projects', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) });
  if (!response.ok) return alert((await response.json()).error);
  dialog.close();
  event.target.reset();
  load();
};
window.addEventListener('focus', load);
document.addEventListener('visibilitychange', () => { if (!document.hidden) load(); });
if (hoyRefresh) hoyRefresh.onclick = () => loadHoy();
const checkpointBtn = document.querySelector('#checkpoint');
if (checkpointBtn) {
  checkpointBtn.onclick = async () => {
    checkpointBtn.disabled = true;
    try {
      const response = await fetch('/api/checkpoint', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ledger: 'docs/plans/ariadne-e2e.md' }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Checkpoint falló');
      alert(`Checkpoint OK\nPróxima: ${data.suggestedNext || '—'}\nCambios: ${(data.changes || []).length}`);
      await loadHoy();
    } catch (error) {
      alert(error.message || 'Checkpoint falló');
    } finally {
      checkpointBtn.disabled = false;
    }
  };
}
loadHubConfig().finally(load);
