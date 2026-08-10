'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { buildHoySnapshot } = require('../hub-hoy');
const { renderDailyDigest, digestOutputPaths } = require('../lib/daily-digest');

test('renderDailyDigest includes doing queue and risks', () => {
  const snap = buildHoySnapshot(
    [{ slug: 'ariadne', name: 'Ariadne', path: '/tmp' }],
    {
      projectTasks: () => [
        {
          id: 'AH-E-1',
          title: 'Doing',
          status: 'In Progress',
          priority: 'High',
          source: '---\nid: AH-E-1\nstatus: In Progress\n---\n',
        },
        {
          id: 'AH-E-2',
          title: 'Queued next',
          status: 'Queued',
          ordinal: 10,
          priority: 'Medium',
          source: '---\nid: AH-E-2\nstatus: Queued\nordinal: 10\n---\n',
        },
      ],
      buildProjectGanttMetrics: () => ({ deadlineAtRisk: 1, blockedTasks: 0, forecastFinishDate: '2026-08-20' }),
    },
  );
  const md = renderDailyDigest(snap, { date: '2026-08-10' });
  assert.match(md, /# Digest diario · 2026-08-10/);
  assert.match(md, /AH-E-1/);
  assert.match(md, /AH-E-2/);
  assert.match(md, /deadline/);
  assert.match(md, /sin cloud/i);
});

test('digestOutputPaths stay under .ariadne/digests', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ariadne-digest-'));
  const paths = digestOutputPaths(root, '2026-08-10');
  assert.equal(paths.dated, path.join(root, '.ariadne', 'digests', '2026-08-10.md'));
  assert.equal(paths.latest, path.join(root, '.ariadne', 'digests', 'latest.md'));
});
