const projects = document.querySelector('#projects');
const empty = document.querySelector('#empty');
const dialog = document.querySelector('#dialog');

async function load() {
  const response = await fetch('/api/projects', { cache: 'no-store' });
  const data = await response.json();
  projects.innerHTML = data.map(card).join('');
  empty.hidden = data.length > 0;
  projects.querySelectorAll('[data-board]').forEach((button) => {
    button.onclick = () => openBoard(button.dataset.board, button.dataset.view);
  });
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
load();
