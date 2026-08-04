#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const HOST = process.env.ARIADNE_BOARD_HOST || '127.0.0.1';
const PORT = Number(process.env.ARIADNE_BOARD_PORT || 6421);
const HUB = process.env.ARIADNE_HUB_URL || `http://${HOST}:${PORT}`;
const POLL_MS = Number(process.env.ARIADNE_QUEUE_POLL_MS || 5000);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function usage() {
  console.error(`Usage: node scripts/bug-queue-runner.js <project-slug> [--once]

Keeps the bug queue moving one task at a time:
  1. Claims turn 1 when nothing is In Progress
  2. Writes instruction to <project>/.ariadne/bug-queue/current.md
  3. Waits until the active bug leaves In Progress
  4. Repeats

Environment:
  ARIADNE_HUB_URL=http://127.0.0.1:6421
  ARIADNE_QUEUE_POLL_MS=5000
`);
  process.exit(1);
}

function readCatalog() {
  return JSON.parse(fs.readFileSync(path.join(ROOT, 'projects.json'), 'utf8'));
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const body = await response.json();
  if (!response.ok) {
    const error = new Error(body.error || `HTTP ${response.status}`);
    error.status = response.status;
    error.body = body;
    throw error;
  }
  return body;
}

async function getState(project) {
  return fetchJson(`${HUB}/api/queue/bugs?project=${encodeURIComponent(project)}`);
}

async function claimNext(project) {
  return fetchJson(`${HUB}/api/queue/bugs/claim?project=${encodeURIComponent(project)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}',
  });
}

async function waitForActiveToClear(project, taskId) {
  while (true) {
    await sleep(POLL_MS);
    const state = await getState(project);
    if (!state.active) {
      console.log(`[bug-queue] ${taskId} ya no está activo.`);
      return;
    }
    if (state.active.id !== taskId) {
      console.log(`[bug-queue] turno cambió (${state.active.id}).`);
      return;
    }
    process.stdout.write('.');
  }
}

async function tick(project) {
  const state = await getState(project);
  if (state.active) {
    console.log(`[bug-queue] En curso: ${state.active.id} · ${state.active.title}`);
    await waitForActiveToClear(project, state.active.id);
    return true;
  }
  if (!state.next) {
    console.log('[bug-queue] Cola de bugs vacía.');
    return false;
  }
  const packet = await claimNext(project);
  console.log(`[bug-queue] Arrancando ${packet.id} · ${packet.title}`);
  console.log(packet.instruction);
  console.log(`[bug-queue] Instrucción escrita en ${packet.runFile || 'current.json'}`);
  await waitForActiveToClear(project, packet.id);
  return true;
}

async function main() {
  const args = process.argv.slice(2);
  if (!args[0]) usage();
  const project = args[0];
  const once = args.includes('--once');
  const catalog = readCatalog();
  if (!catalog.some((item) => item.slug === project)) {
    console.error(`Proyecto desconocido: ${project}`);
    process.exit(1);
  }
  console.log(`[bug-queue] Runner activo para ${project} · ${HUB} · poll ${POLL_MS}ms`);
  do {
    try {
      await tick(project);
    } catch (error) {
      if (error.status === 404) {
        await sleep(POLL_MS);
        continue;
      }
      if (error.status === 409) {
        await waitForActiveToClear(project, error.body.active.id);
        continue;
      }
      console.error(`[bug-queue] Error: ${error.message}`);
      await sleep(POLL_MS);
    }
    if (!once) await sleep(POLL_MS);
  } while (!once);
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
