'use strict';

const path = require('node:path');

function escapeVbs(value) {
  const text = String(value);
  if (/[\u0000-\u001f\u007f]/.test(text)) throw new Error('La ruta de inicio no puede contener caracteres de control.');
  return text.replace(/"/g, '""');
}

function renderWindowsStartupScript({ nodePath, serverPath, workingDirectory, catalogPath } = {}) {
  if (!nodePath || !serverPath || !workingDirectory) throw new Error('nodePath, serverPath and workingDirectory are required');
  const command = `"${nodePath}" "${serverPath}"`;
  const lines = [
    'Set shell = CreateObject("WScript.Shell")',
    `shell.CurrentDirectory = "${escapeVbs(workingDirectory)}"`,
  ];
  if (catalogPath) lines.push(`shell.Environment("PROCESS")("ARIADNE_CATALOG_PATH") = "${escapeVbs(catalogPath)}"`);
  lines.push(`shell.Run "${escapeVbs(command)}", 0, False`);
  return `${lines.join('\r\n')}\r\n`;
}

function escapeSystemd(value) {
  const text = String(value);
  if (/[\u0000-\u001f\u007f]/.test(text)) throw new Error('La ruta de inicio no puede contener caracteres de control.');
  return `"${text.replace(/%/g, '%%').replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function renderSystemdUnit({ nodePath, serverPath, workingDirectory, catalogPath } = {}) {
  if (!nodePath || !serverPath || !workingDirectory) throw new Error('nodePath, serverPath and workingDirectory are required');
  const env = [
    'Environment="ARIADNE_HUB_PORT=4177"',
    'Environment="ARIADNE_BOARD_PORT=6421"',
  ];
  if (catalogPath) env.push(`Environment=${escapeSystemd(`ARIADNE_CATALOG_PATH=${catalogPath}`)}`);
  return [
    '[Unit]',
    'Description=Ariadne local project hub',
    'After=network.target',
    '',
    '[Service]',
    'Type=simple',
    `WorkingDirectory=${escapeSystemd(workingDirectory)}`,
    `ExecStart=${escapeSystemd(nodePath)} ${escapeSystemd(serverPath)}`,
    'Restart=on-failure',
    'RestartSec=3',
    ...env,
    '',
    '[Install]',
    'WantedBy=default.target',
    '',
  ].join('\n');
}

function userConfigDirectory(home, platform, env = process.env) {
  const pathApi = platform === 'win32' ? path.win32 : path.posix;
  if (platform === 'win32') return env.APPDATA || pathApi.join(home, 'AppData', 'Roaming');
  if (platform === 'darwin') return pathApi.join(home, 'Library', 'Application Support');
  return env.XDG_CONFIG_HOME || pathApi.join(home, '.config');
}

module.exports = { escapeSystemd, escapeVbs, renderSystemdUnit, renderWindowsStartupScript, userConfigDirectory };
