function statsPanelStyles(theme) {
  const colors = theme === 'bugs'
    ? {
      border: '#5a3540',
      bg: '#24161a',
      hoverBg: '#2a151c',
      hoverBorder: '#7a4552',
      openBg: '#2a151c',
      text: '#f8eef0',
      hint: '#c4a9b0',
      chevron: '#ffc2cf',
      detailBg: '#1a1114',
      detailBorder: '#5a3540',
    }
    : {
      border: '#2f6b8f',
      bg: '#0f2433',
      hoverBg: '#123044',
      hoverBorder: '#3d8fd4',
      openBg: '#123044',
      text: '#e8f4ff',
      hint: '#9db3c7',
      chevron: '#9fe0ff',
      detailBg: '#0a1824',
      detailBorder: '#2f6b8f',
    };
  return `
.stats-panel{margin:14px 0 6px}
.stats-grid{display:grid;grid-template-columns:repeat(4,minmax(100px,1fr));gap:10px}
.stats-grid-compact .kpi{padding:12px 14px}
.stats-grid-compact .kpi strong{font-size:22px}
.stats-toggle{display:flex;align-items:center;gap:10px;width:100%;margin-top:10px;padding:12px 14px;border:1px solid ${colors.border};border-radius:12px;background:${colors.bg};color:${colors.text};font:inherit;font-weight:600;cursor:pointer;text-align:left;transition:background .15s,border-color .15s}
.stats-toggle:hover{background:${colors.hoverBg};border-color:${colors.hoverBorder}}
.stats-toggle[aria-expanded="true"]{border-bottom-left-radius:0;border-bottom-right-radius:0;border-bottom-color:transparent;background:${colors.openBg}}
.stats-toggle-label{flex:1}
.stats-toggle-hint{color:${colors.hint};font-size:12px;font-weight:500}
.stats-chevron{width:10px;height:10px;border-right:2px solid ${colors.chevron};border-bottom:2px solid ${colors.chevron};transform:rotate(45deg);transition:transform .2s;margin-right:4px}
.stats-toggle[aria-expanded="true"] .stats-chevron{transform:rotate(-135deg);margin-top:4px}
.stats-detail{padding:14px;border:1px solid ${colors.detailBorder};border-top:0;border-radius:0 0 12px 12px;background:${colors.detailBg}}
.stats-detail.is-collapsed,.stats-detail[hidden]{display:none!important}
`;
}

function renderCollapsibleStatsPanel(summaryHtml, detailHtml, hintText) {
  return `<section class="stats-panel">
    ${summaryHtml}
    <button id="stats-toggle" class="stats-toggle" type="button" aria-expanded="false" aria-controls="stats-detail">
      <span class="stats-toggle-label">Estadísticas detalladas</span>
      <span class="stats-toggle-hint">${hintText}</span>
      <span class="stats-chevron" aria-hidden="true"></span>
    </button>
    <div id="stats-detail" class="stats-detail is-collapsed" hidden>${detailHtml}</div>
  </section>`;
}

function statsPanelInitScript(storagePrefix) {
  return `
const statsToggle=document.querySelector('#stats-toggle');
const statsDetail=document.querySelector('#stats-detail');
const statsStorageKey='${storagePrefix}:'+project;
function setStatsOpen(open){
  if(!statsToggle||!statsDetail)return;
  statsDetail.hidden=!open;
  statsDetail.classList.toggle('is-collapsed',!open);
  statsToggle.setAttribute('aria-expanded',open?'true':'false');
  try{sessionStorage.setItem(statsStorageKey,open?'1':'0')}catch(_e){}
}
if(statsToggle&&statsDetail){
  statsToggle.onclick=()=>setStatsOpen(statsDetail.classList.contains('is-collapsed'));
  try{setStatsOpen(sessionStorage.getItem(statsStorageKey)==='1')}catch(_e){setStatsOpen(false)}
}
`;
}

module.exports = {
  statsPanelStyles,
  renderCollapsibleStatsPanel,
  statsPanelInitScript,
};
