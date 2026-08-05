'use strict';

const { spawnSync } = require('node:child_process');
const { FRONTEND_REPO, FRONTEND_DEFAULT_PORT } = require('./ui-contract');

function normalizeRepoUrl(repoUrl) {
  return String(repoUrl || FRONTEND_REPO).trim().replace(/\/+$/, '');
}

function normalizeUiBaseUrl(baseUrl) {
  const raw = String(baseUrl || `http://localhost:${FRONTEND_DEFAULT_PORT}/`).trim();
  return raw.endsWith('/') ? raw : `${raw}/`;
}

function checkFrontendRepoRemote(repoUrl, { timeoutMs = 12000 } = {}) {
  const url = normalizeRepoUrl(repoUrl);
  const result = spawnSync('git', ['ls-remote', '--heads', url], {
    encoding: 'utf8',
    timeout: timeoutMs,
  });

  if (result.error) {
    return {
      available: false,
      repoUrl: url,
      error: result.error.message,
      heads: [],
    };
  }

  const stderr = String(result.stderr || '').trim();
  const stdout = String(result.stdout || '').trim();

  if (result.status !== 0) {
    const message = stderr || stdout || `git ls-remote exited ${result.status}`;
    return {
      available: false,
      repoUrl: url,
      error: message,
      heads: [],
    };
  }

  const heads = stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split(/\s+/)[1])
    .filter(Boolean);

  return {
    available: true,
    repoUrl: url,
    error: null,
    heads,
  };
}

async function probeGanttUiReachability(baseUrl, { timeoutMs = 2000 } = {}) {
  const uiBaseUrl = normalizeUiBaseUrl(baseUrl);
  try {
    const response = await fetch(uiBaseUrl, { signal: AbortSignal.timeout(timeoutMs) });
    return {
      reachable: response.status < 500,
      uiBaseUrl,
      status: response.status,
      error: null,
    };
  } catch (error) {
    return {
      reachable: false,
      uiBaseUrl,
      status: null,
      error: error?.message || String(error),
    };
  }
}

function buildGanttUiBootstrapReport({
  repoUrl = FRONTEND_REPO,
  uiBaseUrl = `http://localhost:${FRONTEND_DEFAULT_PORT}/`,
  repoCheck,
  uiProbe,
} = {}) {
  const repo = repoCheck || { available: false, repoUrl: normalizeRepoUrl(repoUrl), error: 'not checked', heads: [] };
  const ui = uiProbe || { reachable: false, uiBaseUrl: normalizeUiBaseUrl(uiBaseUrl), status: null, error: 'not checked' };

  const nextSteps = [
    'npm start  # Hub API en 127.0.0.1:4177',
    'npm run gantt:smoke  # contrato backend',
  ];

  if (!repo.available) {
    nextSteps.push(
      `export ARIADNE_GANTT_UI_REPO=<url-git-del-frontend>  # default ${normalizeRepoUrl(repoUrl)} no responde`,
      'git clone $ARIADNE_GANTT_UI_REPO && cd frontend-angular && npm install && npm start',
    );
  } else {
    nextSteps.push('git clone ' + repo.repoUrl + ' && cd frontend-angular && npm install && npm start');
  }

  if (!ui.reachable) {
    nextSteps.push(`Abrir ${normalizeUiBaseUrl(uiBaseUrl)}?project=ariadne tras levantar el frontend`);
  }

  return {
    ok: true,
    blockId: 'AGANTT-DEF-01',
    backend: {
      contract: 'docs/gantt-ui-integration.md',
      smoke: 'npm run gantt:smoke',
      ready: true,
    },
    frontend: {
      repoUrl: repo.repoUrl,
      repoAvailable: repo.available,
      repoError: repo.error,
      branchHeads: repo.heads?.slice(0, 5) || [],
      uiBaseUrl: ui.uiBaseUrl,
      uiReachable: ui.reachable,
      uiStatus: ui.status,
      uiError: ui.error,
      blockedInWorkspace: !repo.available || !ui.reachable,
    },
    env: {
      ARIADNE_GANTT_UI_REPO: repo.repoUrl,
      ARIADNE_GANTT_BASE_URL: ui.uiBaseUrl,
      ARIADNE_GANTT_UI_PORT: FRONTEND_DEFAULT_PORT,
    },
    nextSteps,
  };
}

module.exports = {
  normalizeRepoUrl,
  normalizeUiBaseUrl,
  checkFrontendRepoRemote,
  probeGanttUiReachability,
  buildGanttUiBootstrapReport,
};
