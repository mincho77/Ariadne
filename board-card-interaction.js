function boardCardInteractionStyles(theme = 'default') {
  const dragOver = theme === 'bugs'
    ? 'border-color:#ff8da8;background:#2a151c'
    : theme === 'mejoras'
      ? 'border-color:#73d8ff;background:#1a4560'
      : 'border-color:#73d8c6;background:#162c3f';
  return `.task{cursor:grab;user-select:none;-webkit-user-select:none}.task:active{cursor:grabbing}.task.dragging{opacity:.35;cursor:grabbing}.drag-hint{display:block;margin-top:8px;font-size:10px;opacity:.72;line-height:1.3}.column.drag-over{${dragOver}}`;
}

function boardDragHintHtml(hint = 'Drag to change column') {
  return `<span class="drag-hint">⋮⋮ ${hint}</span>`;
}

function boardCardInteractionScript() {
  return `
function bindTaskCards(cards,tasks,openTask){
  cards.forEach((card)=>{
    let suppressClick=false;
    card.addEventListener('dragstart',(event)=>{
      suppressClick=true;
      card.classList.add('dragging');
      event.dataTransfer.effectAllowed='move';
      event.dataTransfer.setData('text/plain',card.dataset.taskId||'');
    });
    card.addEventListener('dragend',()=>{
      card.classList.remove('dragging');
      setTimeout(()=>{suppressClick=false},0);
    });
    card.addEventListener('click',()=>{
      if(suppressClick)return;
      openTask(tasks[card.dataset.task]);
    });
  });
}
function bindColumnDropTargets(columns,tasks,onDrop){
  columns.forEach((column)=>{
    column.addEventListener('dragover',(event)=>{
      event.preventDefault();
      event.dataTransfer.dropEffect='move';
      column.classList.add('drag-over');
    });
    column.addEventListener('dragleave',(event)=>{
      if(!column.contains(event.relatedTarget))column.classList.remove('drag-over');
    });
    column.addEventListener('drop',async(event)=>{
      event.preventDefault();
      column.classList.remove('drag-over');
      const id=event.dataTransfer.getData('text/plain');
      const task=tasks.find((item)=>item.id===id);
      const status=column.dataset.column;
      if(!task||!status||task.status===status)return;
      await onDrop(id,status,task,event);
    });
  });
}
`;
}

module.exports = {
  boardCardInteractionStyles,
  boardDragHintHtml,
  boardCardInteractionScript,
  boardDragHandleStyles: boardCardInteractionStyles,
  boardDragHandleHtml: boardDragHintHtml,
};
