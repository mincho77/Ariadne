'use strict';

const { getFrontmatterField } = require('../task-markdown');
const { parseBooleanField } = require('./restrictions');

function parseStructureFields(task) {
  const source = task.source || '';
  const type = String(task.type || getFrontmatterField(source, 'type') || 'task').toLowerCase();
  const parentRaw = getFrontmatterField(source, 'parent_id') || getFrontmatterField(source, 'parentId');
  const parentId = String(parentRaw || '').trim() || null;
  const release = String(getFrontmatterField(source, 'release') || '').trim() || null;
  const workstream = String(getFrontmatterField(source, 'workstream') || '').trim() || null;

  const isMilestone = type === 'milestone'
    || parseBooleanField(getFrontmatterField(source, 'is_milestone'))
    || parseBooleanField(getFrontmatterField(source, 'milestone'));

  let nodeKind = 'task';
  if (isMilestone) nodeKind = 'milestone';
  else if (type === 'phase' || type === 'epic') nodeKind = 'phase';
  else if (type === 'deliverable') nodeKind = 'deliverable';

  return {
    parentId,
    release,
    workstream,
    isMilestone,
    nodeKind,
  };
}

function buildTaskHierarchy(planningTasks, scheduleById = new Map()) {
  const nodes = {};
  for (const task of planningTasks) {
    const scheduled = scheduleById.get(task.id);
    nodes[task.id] = {
      id: task.id,
      title: task.title,
      parentId: task.parentId || null,
      release: task.release || null,
      workstream: task.workstream || null,
      nodeKind: task.nodeKind || 'task',
      isMilestone: Boolean(task.isMilestone),
      status: task.status,
      childrenIds: [],
      startDate: scheduled?.startDate || null,
      endDate: scheduled?.endDate || null,
    };
  }

  const roots = [];
  for (const node of Object.values(nodes)) {
    if (node.parentId && nodes[node.parentId]) {
      nodes[node.parentId].childrenIds.push(node.id);
    } else {
      roots.push(node.id);
    }
  }

  for (const node of Object.values(nodes)) {
    node.childrenIds.sort((a, b) => a.localeCompare(b, 'en'));
  }
  roots.sort((a, b) => a.localeCompare(b, 'en'));

  return { roots, nodes };
}

function collectMilestones(scheduledItems) {
  return scheduledItems.filter((item) => item.isMilestone);
}

module.exports = {
  parseStructureFields,
  buildTaskHierarchy,
  collectMilestones,
};
