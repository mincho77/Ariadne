'use strict';

const { computeSwarmStatus, findTaskById, isQueuedStatus, isDoingStatus, sortQueued } = require('./status');
const {
  assertRunnable,
  resolveRunTarget,
  runSwarmTask,
  handoffSwarmTask,
  completeSwarmTask,
  DOING_STATUS,
  DONE_STATUS,
} = require('./lifecycle');
const {
  appendHandoff,
  appendEvidence,
  formatHandoffLine,
  formatEvidenceLine,
} = require('./evidence');

function createServerDeps(server) {
  return {
    listTasks: (project) => server.projectTasks(project),
    setStatus: async (project, taskId, status) => server.updateTaskStatus(project, taskId, status),
    writeSource: async (project, taskId, source) => server.updateTaskSource(project, taskId, source),
  };
}

module.exports = {
  computeSwarmStatus,
  findTaskById,
  isQueuedStatus,
  isDoingStatus,
  sortQueued,
  assertRunnable,
  resolveRunTarget,
  runSwarmTask,
  handoffSwarmTask,
  completeSwarmTask,
  DOING_STATUS,
  DONE_STATUS,
  appendHandoff,
  appendEvidence,
  formatHandoffLine,
  formatEvidenceLine,
  createServerDeps,
};
