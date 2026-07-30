const DELETABLE_STATUSES = new Set(['To Do', 'Queued', 'In Progress', 'Blocked']);

function isTaskDeletable(status) {
  return DELETABLE_STATUSES.has(status);
}

function boardDeleteStyles(theme) {
  const colors = theme === 'bugs'
    ? { border: '#7a2d3a', bg: '#3a151c', hover: '#521824', text: '#ffb4c5' }
    : { border: '#6b3a2f', bg: '#3a2018', hover: '#522818', text: '#ffc9b8' };
  return `.delete-button{border:1px solid ${colors.border};background:${colors.bg};color:${colors.text};border-radius:9px;padding:10px 14px;font-weight:800;cursor:pointer;font:inherit}.delete-button:hover:not(:disabled){background:${colors.hover}}.delete-button:disabled{opacity:.45;cursor:not-allowed}.delete-button[hidden]{display:none!important}`;
}

function boardDeleteButton(label = 'Delete') {
  return `<button id="delete-task" class="delete-button" type="button" disabled hidden>${label}</button>`;
}

function boardDeleteInitScript({ confirmText, blockBugs = false }) {
  return `
const deleteButton=document.querySelector('#delete-task');
const DELETABLE=new Set(['To Do','Queued','In Progress','Blocked']);
function isBugTaskClient(task){
  if(!task)return false;
  if(String(task.type||'').toLowerCase()==='bug')return true;
  return /^(bug|historico-bug|seguridad)\\b/i.test(String(task.title||''));
}
function syncDeleteButton(task){
  if(!deleteButton)return;
  if(!task){
    deleteButton.hidden=true;
    deleteButton.disabled=true;
    return;
  }
  const blocked=${blockBugs ? 'isBugTaskClient(task)' : 'false'};
  const canDelete=!blocked&&DELETABLE.has(task.status);
  deleteButton.hidden=false;
  deleteButton.disabled=!canDelete;
  deleteButton.title=canDelete?'':task.status==='Done'?'Done tasks cannot be deleted':'Only To Do, Queue, Doing or Blocked tasks can be deleted';
}
if(deleteButton){
    deleteButton.onclick=async()=>{
    if(!selectedTask||deleteButton.disabled)return;
    const prompt=${JSON.stringify(confirmText)}.replace('{id}',selectedTask.id||'');
    if(!window.confirm(prompt))return;
    deleteButton.disabled=true;
    const errorEl=document.querySelector('#action-error');
    if(errorEl)errorEl.textContent='';
    try{
      const response=await fetch('/api/tasks/delete?project='+encodeURIComponent(project),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:selectedTask.id})});
      const result=await response.json();
      if(!response.ok)throw new Error(result.error||'Could not delete task');
      window.location.reload();
    }catch(error){
      if(errorEl)errorEl.textContent=error.message;
      deleteButton.disabled=false;
    }
  };
}
`;
}

module.exports = {
  DELETABLE_STATUSES,
  isTaskDeletable,
  boardDeleteStyles,
  boardDeleteButton,
  boardDeleteInitScript,
};
