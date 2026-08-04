'use strict';

function criticalPath(nodes, dependents, pendingMap) {
  const memo = new Map();
  const pathMemo = new Map();

  const score = (id, stack = new Set()) => {
    if (memo.has(id)) return memo.get(id);
    if (stack.has(id)) return pendingMap.get(id)?.durationIaHours || 1;
    stack.add(id);
    const node = pendingMap.get(id);
    const children = dependents.get(id) || [];
    let bestChild = null;
    let bestScore = 0;
    for (const childId of children) {
      const childScore = score(childId, stack);
      if (childScore > bestScore) {
        bestScore = childScore;
        bestChild = childId;
      }
    }
    stack.delete(id);
    const own = (node?.durationIaHours || 1) + bestScore;
    memo.set(id, own);
    pathMemo.set(id, bestChild);
    return own;
  };

  let bestRoot = null;
  let best = 0;
  for (const node of nodes) {
    const value = score(node.id);
    if (value > best) {
      best = value;
      bestRoot = node.id;
    }
  }

  const route = [];
  const visited = new Set();
  let cursor = bestRoot;
  while (cursor && !visited.has(cursor)) {
    visited.add(cursor);
    const node = pendingMap.get(cursor);
    if (!node) break;
    route.push({
      id: node.id,
      title: node.title,
      durationDays: node.durationDays,
      durationIaHours: node.durationIaHours,
      priority: node.priority,
    });
    cursor = pathMemo.get(cursor);
  }
  return { route, estimatedIaHours: best };
}

module.exports = { criticalPath };
