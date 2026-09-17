'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  renderHubPlist,
  HUB_LABEL,
} = require('../lib/launchagent-hub');

test('renderHubPlist emits single com.ariadne.hub label and paths', () => {
  const xml = renderHubPlist({
    nodePath: '/opt/homebrew/bin/node',
    serverPath: '/home/user/Ariadne/server.js',
    workingDirectory: '/home/user/Ariadne',
  });
  assert.match(xml, new RegExp(`<string>${HUB_LABEL}</string>`));
  assert.match(xml, /\/opt\/homebrew\/bin\/node/);
  assert.match(xml, /ARIADNE_HUB_PORT/);
  assert.match(xml, /4177/);
  assert.doesNotMatch(xml, /TU_USUARIO/);
});
