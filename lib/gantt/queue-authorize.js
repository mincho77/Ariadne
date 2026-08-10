'use strict';

/**
 * Compute Queue order when authorizing a task from Gantt/drawer.
 * Ordinals are later normalized to (index+1)*10 by updateQueueOrder.
 */
function insertTaskInQueueOrder(existingQueuedIds, taskId, options = {}) {
  const id = String(taskId || '').trim();
  if (!id) throw new Error('task id is required');
  const others = (existingQueuedIds || [])
    .map((item) => String(item || '').trim())
    .filter((item) => item && item.toLowerCase() !== id.toLowerCase());

  const position = String(options.position || 'end').toLowerCase();
  if (position === 'head' || position === 'start' || position === 'front') {
    return [id, ...others];
  }

  if (options.ordinal != null && options.ordinal !== '') {
    const ordinal = Number(options.ordinal);
    if (!Number.isFinite(ordinal) || ordinal < 0) {
      throw new Error('ordinal inválido');
    }
    const slot = Math.max(0, Math.floor(ordinal / 10) - 1);
    const next = [...others];
    next.splice(Math.min(Math.max(slot, 0), next.length), 0, id);
    return next;
  }

  return [...others, id];
}

module.exports = {
  insertTaskInQueueOrder,
};
