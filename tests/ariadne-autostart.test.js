'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  renderSystemdUnit,
  renderWindowsStartupScript,
  userConfigDirectory,
} = require('../lib/ariadne-autostart');
const { renderHubPlist } = require('../lib/launchagent-hub');

test('Windows startup script launches Ariadne hidden with paths containing spaces', () => {
  const source = renderWindowsStartupScript({
    nodePath: 'C:\\Program Files\\nodejs\\node.exe',
    serverPath: 'C:\\Users\\Example\\Ariadne Hub\\server.js',
    workingDirectory: 'C:\\Users\\Example\\Ariadne Hub',
    catalogPath: 'C:\\Users\\Example\\AppData\\Ariadne\\projects.json',
  });
  assert.match(source, /shell\.Run """C:\\Program Files\\nodejs\\node\.exe"" ""C:\\Users\\Example\\Ariadne Hub\\server\.js""", 0, False/);
  assert.match(source, /ARIADNE_CATALOG_PATH/);
  assert.match(source, /CurrentDirectory/);
});

test('Linux systemd unit keeps paths and the local catalog intact', () => {
  const unit = renderSystemdUnit({
    nodePath: '/usr/bin/node',
    serverPath: '/home/example/Ariadne Hub/server.js',
    workingDirectory: '/home/example/Ariadne Hub',
    catalogPath: '/home/example/.config/Ariadne Hub/projects.json',
  });
  assert.match(unit, /WorkingDirectory="\/home\/example\/Ariadne Hub"/);
  assert.match(unit, /ExecStart="\/usr\/bin\/node" "\/home\/example\/Ariadne Hub\/server\.js"/);
  assert.match(unit, /ARIADNE_CATALOG_PATH=\/home\/example\/\.config\/Ariadne Hub\/projects\.json/);
  assert.match(unit, /WantedBy=default\.target/);
});

test('macOS LaunchAgent receives the selected local catalog path', () => {
  const plist = renderHubPlist({
    nodePath: '/usr/local/bin/node',
    serverPath: '/Users/example/Ariadne/server.js',
    workingDirectory: '/Users/example/Ariadne',
    catalogPath: '/Users/example/Library/Application Support/Ariadne/projects.json',
  });
  assert.match(plist, /<key>ARIADNE_CATALOG_PATH<\/key>/);
  assert.match(plist, /Application Support\/Ariadne\/projects\.json/);
});

test('user service paths do not require administrator directories', () => {
  assert.equal(userConfigDirectory('/Users/example', 'darwin', {}), '/Users/example/Library/Application Support');
  assert.equal(userConfigDirectory('/home/example', 'linux', { XDG_CONFIG_HOME: '/home/example/.config-test' }), '/home/example/.config-test');
  assert.match(userConfigDirectory('C:\\Users\\example', 'win32', { APPDATA: 'C:\\Users\\example\\Roaming' }), /Roaming/);
});
