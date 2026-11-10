'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const net = require('node:net');

async function reservePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const { port } = server.address();
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function waitForHub(url) {
  for (let i = 0; i < 80; i += 1) {
    try {
      if ((await fetch(url)).ok) return;
    } catch { /* wait for startup */ }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Hub did not start at ${url}`);
}

test('project settings can move a project to another local path', { timeout: 15000 }, async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ariadne-project-path-'));
  const oldPath = path.join(root, 'old-location');
  const newPath = path.join(root, 'external-project-folder');
  fs.mkdirSync(path.join(oldPath, 'backlog', 'tasks'), { recursive: true });
  fs.mkdirSync(path.join(newPath, 'backlog', 'tasks'), { recursive: true });
  const catalogPath = path.join(root, 'projects.json');
  fs.writeFileSync(catalogPath, JSON.stringify([
    { slug: 'outside-project', name: 'Outside Project', path: oldPath, port: 6422 },
  ]));

  const port = await reservePort();
  const child = spawn(process.execPath, ['server.js'], {
    cwd: path.join(__dirname, '..'),
    env: {
      ...process.env,
      ARIADNE_HUB_PORT: String(port),
      ARIADNE_BOARD_PORT: String(port),
      ARIADNE_CATALOG_PATH: catalogPath,
    },
    stdio: 'ignore',
  });
  try {
    const base = `http://127.0.0.1:${port}`;
    await waitForHub(`${base}/api/projects`);
    const response = await fetch(`${base}/api/projects/outside-project/settings`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path: newPath }),
    });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).path, newPath);
    assert.equal(JSON.parse(fs.readFileSync(catalogPath, 'utf8'))[0].path, newPath);

    const invalid = await fetch(`${base}/api/projects/outside-project/settings`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path: path.join(root, 'missing') }),
    });
    assert.equal(invalid.status, 400);
  } finally {
    child.kill('SIGTERM');
    await Promise.race([once(child, 'exit'), new Promise((resolve) => setTimeout(resolve, 1500))]);
    if (child.exitCode === null) child.kill('SIGKILL');
  }
});
