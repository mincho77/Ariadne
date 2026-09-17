'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { buildRunPacketForTask, getImprovementQueueSnapshot } = require('./server');

test('buildRunPacketForTask writes mejoras lane and shared run-packets', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ariadne-mejoras-packet-'));
  const tasksDir = path.join(root, 'backlog', 'tasks');
  fs.mkdirSync(tasksDir, { recursive: true });
  fs.writeFileSync(path.join(tasksDir, 'ah-e-99 - packet.md'), `---
id: AH-E-99
title: Packet demo
status: Queued
type: enhancement
priority: High
ordinal: 10
---

## Description

demo
`, 'utf8');
  const project = { slug: 'fixture', name: 'Fixture', path: root, taskCode: 'AH' };
  const packet = buildRunPacketForTask(project, 'AH-E-99');
  assert.equal(packet.lane, 'mejoras');
  assert.equal(packet.id, 'AH-E-99');
  assert.match(packet.instruction, /swarm -- run --project fixture --task AH-E-99/);
  assert.ok(fs.existsSync(path.join(root, '.ariadne', 'mejoras-queue', 'current.md')));
  assert.ok(fs.existsSync(path.join(root, '.ariadne', 'run-packets', 'AH-E-99.md')));
  assert.ok(fs.existsSync(path.join(root, '.ariadne', 'run-packets', 'latest.json')));

  const snap = getImprovementQueueSnapshot(project);
  assert.equal(snap.next.id, 'AH-E-99');
  assert.equal(snap.queueLength, 1);
});
