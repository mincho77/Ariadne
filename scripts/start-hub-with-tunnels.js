const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const CONFIG_PATH = path.join(ROOT, 'devtunnels.config.json');
const SERVER_PATH = path.join(ROOT, 'server.js');

function readConfig() {
  if (!fs.existsSync(CONFIG_PATH)) return null;
  const source = fs.readFileSync(CONFIG_PATH, 'utf8');
  const data = JSON.parse(source);
  if (!data || typeof data !== 'object') return null;
  return data;
}

function normalizeUrl(raw) {
  const value = String(raw || '').trim();
  if (!value) return '';
  const url = new URL(value);
  if (!url.pathname || url.pathname === '') url.pathname = '/';
  return url.toString();
}

async function isReachable(baseUrl) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2500);
  try {
    const response = await fetch(baseUrl, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
    });
    return response.ok || (response.status >= 300 && response.status < 500);
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

async function isLocalPortReachable(port) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 1500);
  try {
    const response = await fetch(`http://127.0.0.1:${port}/`, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
    });
    return response.ok || (response.status >= 300 && response.status < 500);
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  let envOverrides = {};
  const config = readConfig();

  if (config?.enabled) {
    try {
      const boardBaseUrl = normalizeUrl(config.boardBaseUrl);
      const ganttBaseUrl = normalizeUrl(config.ganttBaseUrl);

      const localGanttUp = await isLocalPortReachable(63447);

      if (localGanttUp) {
        envOverrides = {
          ARIADNE_BOARD_BASE_URL: boardBaseUrl,
          ARIADNE_GANTT_BASE_URL: ganttBaseUrl,
        };
        console.log('[ariadne] DevTunnels enabled for this run');
        console.log(`[ariadne] board: ${boardBaseUrl}`);
        console.log(`[ariadne] gantt: ${ganttBaseUrl}`);
      } else {
        const [boardPublicReachable, ganttPublicReachable] = await Promise.all([
          isReachable(boardBaseUrl),
          isReachable(ganttBaseUrl),
        ]);
        console.warn('[ariadne] DevTunnels config enabled but Gantt local service is not up yet.');
        console.warn(`[ariadne] local gantt (63447): ${localGanttUp}`);
        console.warn(`[ariadne] public board URL reachable: ${boardPublicReachable}`);
        console.warn(`[ariadne] public gantt URL reachable: ${ganttPublicReachable}`);
        console.warn('[ariadne] Starting with local URLs.');
      }
    } catch (error) {
      console.warn(`[ariadne] Invalid devtunnels config: ${error.message}`);
      console.warn('[ariadne] Starting with local URLs.');
    }
  } else {
    console.log('[ariadne] DevTunnels disabled. Starting with local URLs.');
  }

  const child = spawn(process.execPath, [SERVER_PATH], {
    cwd: ROOT,
    stdio: 'inherit',
    env: {
      ...process.env,
      ...envOverrides,
    },
  });

  child.on('exit', (code, signal) => {
    if (signal) process.kill(process.pid, signal);
    process.exit(code ?? 0);
  });
}

main().catch((error) => {
  console.error('[ariadne] Failed to start hub:', error.message);
  process.exit(1);
});
