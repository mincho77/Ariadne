'use strict';

const HUB_LABEL = 'com.ariadne.hub';
const HUB_PLIST_NAME = 'com.ariadne.hub.plist';

function escapeXml(value) {
  const text = String(value);
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(text)) throw new Error('plist values cannot contain XML control characters');
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderHubPlist({ nodePath, serverPath, workingDirectory, catalogPath } = {}) {
  const node = String(nodePath || '').trim();
  const server = String(serverPath || '').trim();
  const cwd = String(workingDirectory || '').trim();
  if (!node || !server || !cwd) {
    throw new Error('nodePath, serverPath and workingDirectory are required');
  }

  const catalogEnvironment = catalogPath
    ? `    <key>ARIADNE_CATALOG_PATH</key>\n    <string>${escapeXml(String(catalogPath))}</string>\n`
    : '';
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${escapeXml(HUB_LABEL)}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${escapeXml(node)}</string>
    <string>${escapeXml(server)}</string>
  </array>
  <key>WorkingDirectory</key>
  <string>${escapeXml(cwd)}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>ARIADNE_HUB_PORT</key>
    <string>4177</string>
    <key>ARIADNE_BOARD_PORT</key>
    <string>6421</string>
${catalogEnvironment.trimEnd()}
  </dict>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>/tmp/ariadne-hub.log</string>
  <key>StandardErrorPath</key>
  <string>/tmp/ariadne-hub-error.log</string>
</dict>
</plist>
`;
}

module.exports = {
  HUB_LABEL,
  HUB_PLIST_NAME,
  renderHubPlist,
  escapeXml,
};
