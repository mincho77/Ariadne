'use strict';

function dependencyAnchors(relation) {
  const normalized = String(relation || 'FS').toUpperCase();
  if (normalized === 'SS') return { relation: 'SS', fromAnchor: 'start', toAnchor: 'start', sequential: false };
  if (normalized === 'FF') return { relation: 'FF', fromAnchor: 'end', toAnchor: 'end', sequential: false };
  if (normalized === 'SF') return { relation: 'SF', fromAnchor: 'start', toAnchor: 'end', sequential: true };
  return { relation: 'FS', fromAnchor: 'end', toAnchor: 'start', sequential: true };
}

function parseDependencySpec(raw, iaHoursPerDay) {
  const value = String(raw || '').trim();
  if (!value) return null;

  const compact = value.replace(/\s+/g, '');
  const match = compact.match(/^([A-Za-z0-9][A-Za-z0-9-]*)(?:[:|@](FS|SS|FF|SF)([+-]\d+(?:[dh])?)?)?$/i)
    || compact.match(/^([A-Za-z0-9][A-Za-z0-9-]*)$/);
  if (!match) return null;

  const id = String(match[1] || '').trim();
  if (!id) return null;

  const anchors = dependencyAnchors(match[2] || 'FS');
  const lagToken = String(match[3] || '').trim();
  let lagBusinessDays = 0;
  let lagIaHours = 0;

  if (lagToken) {
    const lagMatch = lagToken.match(/^([+-]\d+)([dh])?$/i);
    if (lagMatch) {
      const amount = Number(lagMatch[1]);
      const unit = String(lagMatch[2] || 'd').toLowerCase();
      if (Number.isFinite(amount)) {
        if (unit === 'h') {
          lagIaHours = amount;
          lagBusinessDays = iaHoursPerDay > 0 ? Math.trunc(amount / iaHoursPerDay) : 0;
        } else {
          lagBusinessDays = amount;
          lagIaHours = amount * iaHoursPerDay;
        }
      }
    }
  }

  return {
    raw: value,
    id,
    relation: anchors.relation,
    fromAnchor: anchors.fromAnchor,
    toAnchor: anchors.toAnchor,
    lagBusinessDays,
    lagIaHours,
    sequential: anchors.sequential,
  };
}

module.exports = { dependencyAnchors, parseDependencySpec };
