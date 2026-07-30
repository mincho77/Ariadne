function taskMatchesColumn(task, columnStatus) {
  const taskStatus = task.status.toLowerCase();
  const column = columnStatus.toLowerCase();
  if (column === 'to do') return taskStatus === 'to do' || taskStatus === 'blocked';
  return taskStatus === column;
}

module.exports = {
  taskMatchesColumn,
};
