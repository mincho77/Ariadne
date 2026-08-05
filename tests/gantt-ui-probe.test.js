'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const {
  normalizeUiBaseUrl,
  checkFrontendRepoRemote,
  probeGanttUiReachability,
  buildGanttUiBootstrapReport,
} = require('../lib/gantt/ui-probe');

const ROOT = path.join(__dirname, '..');

test('normalizeUiBaseUrl ensures trailing slash', () => {
  assert.equal(normalizeUiBaseUrl('http://127.0.0.1:63447'), 'http://127.0.0.1:63447/');
  assert.equal(normalizeUiBaseUrl('http://127.0.0.1:63447/'), 'http://127.0.0.1:63447/');
});

test('checkFrontendRepoRemote rejects invalid repo URL', () => {
  const result = checkFrontendRepoRemote('https://github.com/repoxai/frontend-angular-does-not-exist-ariadne', {
    timeoutMs: 15000,
  });
  assert.equal(result.available, false);
  assert.match(String(result.error || ''), /not found|Repository/i);
});

test('probeGanttUiReachability detects unreachable port', async () => {
  const result = await probeGanttUiReachability('http://127.0.0.1:1/', { timeoutMs: 500 });
  assert.equal(result.reachable, false);
  assert.ok(result.error);
});

test('probeGanttUiReachability detects minimal HTTP server', async () => {
  const server = http.createServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end('<html>Gantt UI stub</html>');
  });
  await new Promise((resolve, reject) => server.listen(0, '127.0.0.1', (error) => (error ? reject(error) : resolve())));
  const { port } = server.address();
  try {
    const result = await probeGanttUiReachability(`http://127.0.0.1:${port}/`, { timeoutMs: 2000 });
    assert.equal(result.reachable, true);
    assert.equal(result.status, 200);
  } finally {
    await new Promise((resolve) => server.close(() => resolve()));
  }
});

test('buildGanttUiBootstrapReport marks blocked when repo or UI missing', () => {
  const report = buildGanttUiBootstrapReport({
    repoCheck: { available: false, repoUrl: 'https://example.com/x', error: 'nope', heads: [] },
    uiProbe: { reachable: false, uiBaseUrl: 'http://localhost:63447/', status: null, error: 'ECONNREFUSED' },
  });
  assert.equal(report.blockId, 'AGANTT-DEF-01');
  assert.equal(report.backend.ready, true);
  assert.equal(report.frontend.blockedInWorkspace, true);
  assert.ok(report.nextSteps.some((step) => step.includes('ARIADNE_GANTT_UI_REPO')));
});

test('gantt-ui-bootstrap CLI exits 0 with JSON report', () => {
  const result = spawnSync(process.execPath, ['scripts/gantt-ui-bootstrap.js', '--json'], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const body = JSON.parse(result.stdout);
  assert.equal(body.ok, true);
  assert.equal(body.blockId, 'AGANTT-DEF-01');
  assert.equal(typeof body.frontend.repoAvailable, 'boolean');
});
