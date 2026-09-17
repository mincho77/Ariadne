const test = require('node:test');
const assert = require('node:assert/strict');
const { STATUS_DISPLAY, displayStatus, boardColumns } = require('./board-columns');
const { QUEUE_COLUMN } = require('./board-queue');

test('STATUS_DISPLAY uses English kanban labels', () => {
  assert.equal(STATUS_DISPLAY['To Do'], 'To Do');
  assert.equal(STATUS_DISPLAY.Queued, 'Queue');
  assert.equal(STATUS_DISPLAY['In Progress'], 'Doing');
  assert.equal(STATUS_DISPLAY.Done, 'Done');
});

test('displayStatus maps internal Backlog statuses to board labels', () => {
  assert.equal(displayStatus('In Progress'), 'Doing');
  assert.equal(displayStatus('Queued'), 'Queue');
  assert.equal(displayStatus('Unknown'), 'Unknown');
});

test('boardColumns returns the four standard lanes in order', () => {
  const columns = boardColumns();
  assert.deepEqual(columns.map((column) => column.label), ['To Do', 'Queue', 'Doing', 'Done']);
  assert.equal(columns[1], QUEUE_COLUMN);
});
