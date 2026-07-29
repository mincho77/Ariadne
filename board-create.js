function boardCreateStyles(theme) {
  const colors = theme === 'bugs'
    ? { border: '#6c3a48', bg: '#2a151c', hover: '#3a1a24', text: '#ffc2cf' }
    : { border: '#2f6b8f', bg: '#123044', hover: '#1a4560', text: '#9fe0ff' };
  return `.create-button{flex:0 0 auto;border:1px solid ${colors.border};background:${colors.bg};color:${colors.text};border-radius:12px;padding:12px 15px;font-weight:700;cursor:pointer;font:inherit}.create-button:hover{background:${colors.hover}}.create-button:disabled{opacity:.6;cursor:wait}`;
}

function boardCreateButton(label) {
  return `<button id="create-task" class="create-button" type="button">${label}</button>`;
}

function boardCreateInitScript({ type, priority, labels, promptText, buttonLabel }) {
  const labelsJson = JSON.stringify(labels || []);
  return `
const createButton=document.querySelector('#create-task');
if(createButton){
  createButton.onclick=async()=>{
    const title=prompt(${JSON.stringify(promptText)});
    if(!title)return;
    createButton.disabled=true;
    createButton.textContent='Creating…';
    try{
      const response=await fetch('/api/tasks/create?project='+encodeURIComponent(project),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({title,type:${JSON.stringify(type)},priority:${JSON.stringify(priority)},labels:${labelsJson}})});
      const result=await response.json();
      if(!response.ok)throw new Error(result.error||'Could not create task');
      window.location.reload();
    }catch(error){
      alert(error.message);
      createButton.disabled=false;
      createButton.textContent=${JSON.stringify(buttonLabel)};
    }
  };
}
`;
}

module.exports = {
  boardCreateStyles,
  boardCreateButton,
  boardCreateInitScript,
};
