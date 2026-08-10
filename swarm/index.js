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
const { listPacks, getPack, suggestPack, recommendPackPolicy, modelHintForPack, modelHintFromTier } = require('./packs');
const { buildTaskBrief, extractAcceptanceCriteria, extractPaths } = require('./brief');
const { ensureRoleWorktree, listRoleWorktrees, WORKTREE_ROOT } = require('./worktrees');
const {
  applyCloseoutToTaskSource,
  appendLedgerHistorial,
  formatLedgerCheckpoint,
  checkpointLedger,
  markAcceptanceCriteriaDone,
} = require('./closeout');
const {
  packRequiresSpecifier,
  hasApprovableAcceptanceCriteria,
  assertSpecifierBeforeCoder,
  resolveStartingRole,
  applySpecifierAcceptance,
  hasSpecifierToCoderHandoff,
} = require('./specifier-gate');
const {
  packRequiresQa,
  runQaGate,
  shouldEnforceQaGate,
  formatQaHandoffSummary,
} = require('./qa-gate');
const {
  buildSwarmObservability,
  extractTaskHandoffs,
  appendHandoffLog,
  readHandoffLog,
} = require('./observability');
const {
  exportSwarmforgeBundle,
  renderSwarmforgeConf,
} = require('./swarmforge-export');
const {
  listBackends,
  listRoleBackends,
  backendForRole,
  governanceNote,
  renderBackendsMarkdown,
} = require('./backends');

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
  listPacks,
  getPack,
  suggestPack,
  recommendPackPolicy,
  modelHintForPack,
  modelHintFromTier,
  buildTaskBrief,
  extractAcceptanceCriteria,
  extractPaths,
  ensureRoleWorktree,
  listRoleWorktrees,
  WORKTREE_ROOT,
  applyCloseoutToTaskSource,
  appendLedgerHistorial,
  formatLedgerCheckpoint,
  checkpointLedger,
  markAcceptanceCriteriaDone,
  packRequiresSpecifier,
  hasApprovableAcceptanceCriteria,
  assertSpecifierBeforeCoder,
  resolveStartingRole,
  applySpecifierAcceptance,
  hasSpecifierToCoderHandoff,
  packRequiresQa,
  runQaGate,
  shouldEnforceQaGate,
  formatQaHandoffSummary,
  buildSwarmObservability,
  extractTaskHandoffs,
  appendHandoffLog,
  readHandoffLog,
  exportSwarmforgeBundle,
  renderSwarmforgeConf,
  listBackends,
  listRoleBackends,
  backendForRole,
  governanceNote,
  renderBackendsMarkdown,
};
