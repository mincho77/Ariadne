const QUEUE_BOARD_CSS = `
.queue-column{position:relative;background:linear-gradient(180deg,#241d3c,#171f36 70%);border-color:#6956a7!important;box-shadow:0 12px 34px #10082755}
.queue-column:before{content:"";position:absolute;inset:0;border-radius:15px;pointer-events:none;background:linear-gradient(120deg,#8b5cf622,transparent 45%)}
.queue-column .column-head{border-color:#56468b}
.queue-column .column-kicker{color:#b8a7ef}
.queue-column .column-count{background:#6d4bd2;color:#fff}
.queue-icon{display:inline-grid;place-items:center;width:24px;height:24px;margin-right:7px;border-radius:8px;background:#7252d6;color:#fff;vertical-align:middle}
.queue-rule{margin:10px 4px 8px;color:#b8acd8;font-size:11px;line-height:1.4}
.queue-column.drag-over{background:linear-gradient(180deg,#322454,#1c2740);border-color:#a78bfa!important}
.task{position:relative}
.queue-task{padding-left:52px;background:#292344!important;border-color:#594a88!important}
.queue-task:hover{border-color:#a78bfa!important}
.queue-next{background:linear-gradient(135deg,#3a2b64,#292344)!important;border-color:#9a7cf0!important;box-shadow:0 6px 18px #150a3555}
.queue-position{position:absolute;left:11px;top:13px;display:grid;place-items:center;width:31px;height:40px;border-radius:9px;background:#6d4bd2;color:#fff;font-size:16px;font-weight:900}
.queue-position small{margin:0;color:#ddd6fe;font-size:7px;text-transform:uppercase;letter-spacing:.08em}
`;

const QUEUE_COLUMN = { status: 'Queued', label: 'Queue', hint: 'Execution order', queue: true };

function queuePositionHtml(position) {
  return `<span class="queue-position" title="Queue position"><small>Turn</small>${position + 1}</span>`;
}

function queueTaskClassName(base, queue, position) {
  return `${base}${queue ? ` queue-task${position === 0 ? ' queue-next' : ''}` : ''}`;
}

function queueColumnTitle(label, queue) {
  return queue ? `<span class="queue-icon">≡</span>${label}` : label;
}

module.exports = {
  QUEUE_BOARD_CSS,
  QUEUE_COLUMN,
  queuePositionHtml,
  queueTaskClassName,
  queueColumnTitle,
};
