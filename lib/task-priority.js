'use strict';

const PRIORITY_ORDER = new Map([['ultra high', 0], ['high', 1], ['medium', 2], ['low', 3]]);

function priorityLabel(priority) {
  const normalized = String(priority || '').trim().toLowerCase();
  return normalized === 'ultra high' ? 'Ultra High' : normalized ? `${normalized[0].toUpperCase()}${normalized.slice(1)}` : 'Medium';
}

function priorityRank(priority) {
  return PRIORITY_ORDER.get(String(priority || '').trim().toLowerCase()) ?? 99;
}

module.exports = { PRIORITY_ORDER, priorityLabel, priorityRank };
