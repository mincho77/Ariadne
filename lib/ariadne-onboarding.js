'use strict';

const fs = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');

const MIN_NODE_MAJOR = 18;

function slugify(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'proyecto';
}

function canonicalPath(value) {
  const absolute = path.resolve(String(value || ''));
  try {
    return fs.realpathSync.native ? fs.realpathSync.native(absolute) : fs.realpathSync(absolute);
  } catch {
    return absolute;
  }
}

function normalizedForCompare(value, platform = process.platform) {
  const resolved = path.resolve(String(value || ''));
  return platform === 'win32' ? resolved.toLowerCase() : resolved;
}

function defaultUserCatalogPath({ platform = process.platform, home = os.homedir(), env = process.env } = {}) {
  if (platform === 'win32') return path.join(env.APPDATA || path.join(home, 'AppData', 'Roaming'), 'Ariadne', 'projects.json');
  if (platform === 'darwin') return path.join(home, 'Library', 'Application Support', 'Ariadne', 'projects.json');
  return path.join(env.XDG_CONFIG_HOME || path.join(home, '.config'), 'ariadne', 'projects.json');
}

function readCatalog(catalogPath) {
  if (!fs.existsSync(catalogPath)) return [];
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
  } catch (error) {
    throw new Error(`No se pudo leer el catálogo ${catalogPath}: ${error.message}`);
  }
  if (!Array.isArray(parsed)) throw new Error(`El catálogo ${catalogPath} debe contener una lista JSON.`);
  return parsed;
}

function writeCatalogAtomic(catalogPath, projects) {
  fs.mkdirSync(path.dirname(catalogPath), { recursive: true });
  const temporaryPath = `${catalogPath}.${process.pid}.${Date.now()}.tmp`;
  try {
    fs.writeFileSync(temporaryPath, `${JSON.stringify(projects, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
    fs.renameSync(temporaryPath, catalogPath);
  } catch (error) {
    try { fs.rmSync(temporaryPath, { force: true }); } catch {}
    throw error;
  }
}

function probePort(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', (error) => {
      if (error.code === 'EADDRINUSE') resolve(false);
      else resolve(null);
    });
    server.listen(port, host, () => server.close(() => resolve(true)));
  });
}

async function nextBoardPort(projects, portProbe = probePort) {
  const used = new Set(projects.map((project) => Number(project.port)).filter(Number.isInteger));
  let candidate = Math.max(6421 + projects.length, ...[...used].map((port) => port + 1));
  while (candidate <= 65535) {
    const available = used.has(candidate) ? false : await portProbe(candidate);
    if (available === true || available == null) return candidate;
    candidate += 1;
  }
  throw new Error('No hay un puerto libre para el tablero. Cierra otra aplicación y vuelve a intentar.');
}

async function registerProject({ catalogPath, projectPath, name, portProbe: portProbeOverride } = {}) {
  if (!catalogPath) throw new Error('catalogPath is required');
  if (!projectPath) throw new Error('projectPath is required');
  const resolvedProjectPath = canonicalPath(projectPath);
  if (!fs.existsSync(resolvedProjectPath) || !fs.statSync(resolvedProjectPath).isDirectory()) {
    throw new Error(`No existe una carpeta de proyecto en: ${projectPath}`);
  }

  const projects = readCatalog(catalogPath);
  const normalizedTarget = normalizedForCompare(resolvedProjectPath);
  const existing = projects.find((project) => project?.path
    && normalizedForCompare(canonicalPath(project.path)) === normalizedTarget);
  if (existing) return { created: false, project: existing, projects };

  const projectName = String(name || path.basename(resolvedProjectPath) || 'Proyecto')
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!projectName) throw new Error('El nombre del proyecto no puede estar vacío.');
  const base = slugify(projectName);
  let slug = base;
  let suffix = 2;
  while (projects.some((project) => project?.slug === slug)) slug = `${base}-${suffix++}`;

  const port = await nextBoardPort(projects, portProbeOverride);
  const project = {
    slug,
    name: projectName,
    path: resolvedProjectPath,
    port,
    createdAt: new Date().toISOString(),
  };
  const next = [...projects, project];
  writeCatalogAtomic(catalogPath, next);
  return { created: true, project, projects: next };
}

function parseNodeMajor(version) {
  const match = String(version || '').match(/^v?(\d+)/);
  return match ? Number(match[1]) : 0;
}

function check(label, status, detail) {
  return { label, status, detail };
}

async function runDoctor({
  root = path.join(__dirname, '..'),
  catalogPath = path.join(root, 'projects.json'),
  hubUrl = 'http://127.0.0.1:4177',
  nodeVersion = process.version,
  fetchImpl = globalThis.fetch,
  portProbe = probePort,
} = {}) {
  const checks = [];
  const major = parseNodeMajor(nodeVersion);
  checks.push(major >= MIN_NODE_MAJOR
    ? check('Node.js', 'ok', `${nodeVersion} (mínimo ${MIN_NODE_MAJOR})`)
    : check('Node.js', 'fail', `Se requiere Node.js ${MIN_NODE_MAJOR} o superior; detectado ${nodeVersion || 'desconocido'}.`));

  const packageFile = path.join(root, 'package.json');
  checks.push(fs.existsSync(packageFile)
    ? check('Ariadne', 'ok', 'Se encontró package.json en la instalación.')
    : check('Ariadne', 'fail', 'No se encuentra package.json. Ejecuta el comando desde la carpeta de Ariadne.'));

  const missingDependencies = ['backlog.md', 'yaml'].filter((name) => !fs.existsSync(path.join(root, 'node_modules', name)));
  checks.push(missingDependencies.length
    ? check('Dependencias', 'fail', `Faltan ${missingDependencies.join(', ')}. Ejecuta npm install en la carpeta de Ariadne.`)
    : check('Dependencias', 'ok', 'Las dependencias principales están instaladas.'));

  try {
    const projects = readCatalog(catalogPath);
    if (!fs.existsSync(catalogPath)) {
      checks.push(check('Proyectos', 'info', 'Aún no hay catálogo local. Ejecuta npm run setup para registrar uno.'));
    } else {
      const seen = new Set();
      const missing = [];
      const invalid = [];
      for (const project of projects) {
        if (!project || typeof project.slug !== 'string' || typeof project.name !== 'string' || typeof project.path !== 'string') {
          invalid.push('una entrada sin slug, name o path');
          continue;
        }
        const key = normalizedForCompare(canonicalPath(project.path));
        if (seen.has(key)) invalid.push(`ruta duplicada en ${project.slug}`);
        seen.add(key);
        if (!fs.existsSync(project.path)) missing.push(project.slug);
      }
      if (invalid.length) checks.push(check('Catálogo', 'fail', `${invalid.join('; ')}. Revisa el archivo local ${path.basename(catalogPath)}; Ariadne no lo modificó.`));
      else checks.push(check('Catálogo', 'ok', `${projects.length} proyecto(s) local(es) registrado(s).`));
      if (missing.length) checks.push(check('Rutas de proyectos', 'fail', `No se encuentran: ${missing.join(', ')}. Corrige la ruta desde el catálogo local.`));
      else if (projects.length) checks.push(check('Rutas de proyectos', 'ok', 'Todas las carpetas registradas existen.'));
    }
  } catch (error) {
    checks.push(check('Catálogo', 'fail', `${error.message}. Se conservó el archivo sin cambios.`));
  }

  let hubHealthy = false;
  if (typeof fetchImpl === 'function') {
    let timeout;
    try {
      const controller = new AbortController();
      timeout = setTimeout(() => controller.abort(), 1500);
      const response = await fetchImpl(`${hubUrl.replace(/\/$/, '')}/api/projects`, { signal: controller.signal });
      hubHealthy = response.ok;
    } catch {} finally {
      if (timeout) clearTimeout(timeout);
    }
  }
  if (hubHealthy) {
    checks.push(check('Hub local', 'ok', `${hubUrl} está respondiendo.`));
  } else {
    checks.push(check('Hub local', 'info', 'No está en ejecución ahora. Puedes abrirlo con npm start o ariadne-hub start.'));
    for (const port of [4177, 6421]) {
      try {
        const available = await portProbe(port);
        if (available === false) checks.push(check(`Puerto ${port}`, 'fail', `El puerto ${port} ya está ocupado y el Hub no responde. Cierra la aplicación que lo usa y ejecuta doctor otra vez.`));
        else if (available == null) checks.push(check(`Puerto ${port}`, 'warn', `No se pudo comprobar el puerto ${port} en este entorno. Ejecuta doctor fuera de un entorno restringido.`));
      } catch (error) {
        checks.push(check(`Puerto ${port}`, 'warn', `No se pudo comprobar el puerto ${port}: ${error.message}`));
      }
    }
  }

  const failed = checks.some((item) => item.status === 'fail');
  return { ok: !failed, exitCode: failed ? 1 : 0, checks };
}

module.exports = {
  MIN_NODE_MAJOR,
  canonicalPath,
  defaultUserCatalogPath,
  normalizedForCompare,
  parseNodeMajor,
  probePort,
  readCatalog,
  registerProject,
  runDoctor,
  slugify,
  writeCatalogAtomic,
};
