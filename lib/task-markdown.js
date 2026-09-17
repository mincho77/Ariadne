'use strict';

const YAML = require('yaml');

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---(\r?\n?)/;

function splitTaskDocument(source) {
  const text = String(source || '');
  const match = text.match(FRONTMATTER_RE);
  if (!match) {
    return { frontmatter: {}, body: text, hasFrontmatter: false, tail: text };
  }
  let frontmatter = {};
  try {
    const parsed = YAML.parse(match[1]);
    frontmatter = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    frontmatter = {};
  }
  const body = text.slice(match[0].length);
  return { frontmatter, body, hasFrontmatter: true, tail: body };
}

function composeTaskDocument(frontmatter, body) {
  const yamlText = YAML.stringify(frontmatter, {
    lineWidth: 0,
    defaultKeyType: 'PLAIN',
    defaultStringType: 'QUOTE_SINGLE',
  }).trimEnd();
  const normalizedBody = body === '' ? '\n' : (body.startsWith('\n') ? body : `\n${body}`);
  return `---\n${yamlText}\n---${normalizedBody}`;
}

function parseTaskDocument(source) {
  return splitTaskDocument(source);
}

function getFrontmatterField(source, field) {
  const { frontmatter } = splitTaskDocument(source);
  const value = frontmatter[field];
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

function getFrontmatterList(source, field) {
  const { frontmatter } = splitTaskDocument(source);
  const value = frontmatter[field];
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (value === undefined || value === null || value === '') return [];
  return String(value).split(',').map((item) => item.trim()).filter(Boolean);
}

function getFrontmatterNumber(source, field) {
  const { frontmatter } = splitTaskDocument(source);
  const value = frontmatter[field];
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function upsertFrontmatterScalar(source, field, value) {
  const { frontmatter, body } = splitTaskDocument(source);
  if (value === undefined || value === null || value === '') {
    delete frontmatter[field];
  } else if (typeof value === 'number') {
    frontmatter[field] = value;
  } else {
    frontmatter[field] = String(value);
  }
  return composeTaskDocument(frontmatter, body);
}

function upsertFrontmatterList(source, field, values) {
  const { frontmatter, body } = splitTaskDocument(source);
  const list = [...new Set(values.map((item) => String(item).trim()).filter(Boolean))];
  if (!list.length) delete frontmatter[field];
  else frontmatter[field] = list;
  return composeTaskDocument(frontmatter, body);
}

function upsertFrontmatterFields(source, patch) {
  const { frontmatter, body } = splitTaskDocument(source);
  for (const [key, value] of Object.entries(patch || {})) {
    if (value === undefined) continue;
    if (value === null || (Array.isArray(value) && value.length === 0)) delete frontmatter[key];
    else frontmatter[key] = value;
  }
  return composeTaskDocument(frontmatter, body);
}

module.exports = {
  splitTaskDocument,
  composeTaskDocument,
  parseTaskDocument,
  getFrontmatterField,
  getFrontmatterList,
  getFrontmatterNumber,
  upsertFrontmatterScalar,
  upsertFrontmatterList,
  upsertFrontmatterFields,
};
