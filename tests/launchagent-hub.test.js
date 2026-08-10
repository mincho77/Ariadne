'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  renderHubPlist,
  legacyConflictNotes,
  HUB_LABEL,
  LEGACY_HUB_LABEL,
} = require('../lib/launchagent-hub');

test('renderHubPlist emits single com.ariadne.hub label and paths', () => {
  const xml = renderHubPlist({
    nodePath: '/opt/homebrew/bin/node',
    serverPath: '/Users/me/Code/Ariadne/server.js',
    workingDirectory: '/Users/me/Code/Ariadne',
  });
  assert.match(xml, new RegExp(`<string>${HUB_LABEL}</string>`));
  assert.match(xml, /\/opt\/homebrew\/bin\/node/);
  assert.match(xml, /ARIADNE_HUB_PORT/);
  assert.match(xml, /4177/);
  assert.doesNotMatch(xml, /jurismate\.ariadne-hub/);
  assert.doesNotMatch(xml, /TU_USUARIO/);
});

test('legacyConflictNotes documents bootout of JurisMate hub', () => {
  const notes = legacyConflictNotes();
  assert.equal(notes.activeLabel, HUB_LABEL);
  assert.equal(notes.legacyLabel, LEGACY_HUB_LABEL);
  assert.ok(notes.bootout.some((line) => line.includes(LEGACY_HUB_LABEL)));
});
