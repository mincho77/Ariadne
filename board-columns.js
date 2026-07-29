const { QUEUE_COLUMN } = require('./board-queue');

const STATUS_DISPLAY = {
  'To Do': 'To Do',
  Queued: 'Queue',
  'In Progress': 'Doing',
  Done: 'Done',
};

function displayStatus(status) {
  return STATUS_DISPLAY[status] || status;
}

function boardColumns(hints = {}) {
  return [
    { status: 'To Do', label: 'To Do', hint: hints.todo || 'Pending work' },
    QUEUE_COLUMN,
    { status: 'In Progress', label: 'Doing', hint: hints.doing || 'Active work' },
    { status: 'Done', label: 'Done', hint: hints.done || 'Completed work' },
  ];
}

module.exports = {
  STATUS_DISPLAY,
  displayStatus,
  boardColumns,
};
