// tools/timer-tool.js
// Minimal timer tool. Exports default async function init(core)
export default async function init(core){
  const NAME = 'timer-tool.js';
  // create a small panel anchored top-left of the dashboard
  function openPanel(){
    if(panel){ panel.remove(); panel = null; return; }
    panel = document.createElement('div');
    Object.assign(panel.style, { position:'fixed', right:'410px', top:'12px', width:'360px', background:'#071127', color:'#e6eef6', padding:'10px', borderRadius:'8px', boxShadow:'0 8px 30px rgba(0,0,0,.6)', zIndex:2147483649 });
    panel.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center"><strong>Timers</strong><button id="tclose" style="background:transparent;border:0;color:#9fb7d8">×</button></div>
      <div style="margin-top:8px;display:flex;gap:8px">
        <input id="t-id" placeholder="ID (optional)" style="flex:1;padding:6px;border-radius:6px;background:#06101a;color:#e6eef6;border:1px solid rgba(255,255,255,0.04)">
        <select id="t-mode" style="padding:6px;border-radius:6px;background:#06101a;color:#e6eef6">
          <option value="stopwatch">Stopwatch</option><option value="timer">Timer</option>
        </select>
      </div>
      <div style="margin-top:8px;display:flex;gap:8px">
        <input id="t-sec" placeholder="Seconds (timer)" style="padding:6px;border-radius:6px;background:#06101a;color:#e6eef6;border:1px solid rgba(255,255,255,0.04)">
        <button id="t-create" style="background:#1f6feb;color:#fff;border:none;padding:6px 10px;border-radius:6px;cursor:pointer">Create</button>
      </div>
      <div id="t-list" style="margin-top:10px;max-height:240px;overflow:auto"></div>
    `;
    document.body.appendChild(panel);
    panel.querySelector('#tclose').addEventListener('click', ()=>{ panel.remove(); panel = null; });
    panel.querySelector('#t-create').addEventListener('click', ()=>{
      const id = panel.querySelector('#t-id').value.trim() || null;
      const mode = panel.querySelector('#t-mode').value;
      const secs = Number(panel.querySelector('#t-sec').value) || 0;
      const tid = core.createTimer({ id, mode, seconds: secs });
      renderList();
    });
    renderList();
  }

  function formatTime(ms){
    const total = Math.floor(ms/1000); const h = Math.floor(total/3600); const m = Math.floor((total%3600)/60); const s = total%60;
    const pad = n=>String(n).padStart(2,'0'); return `${pad(h)}:${pad(m)}:${pad(s)}`;
  }

  function renderList(){
    if(!panel) return;
    const out = panel.querySelector('#t-list'); out.innerHTML = '';
    Object.values(core.timers).forEach(t=>{
      const row = document.createElement('div'); row.style.display='flex'; row.style.justifyContent='space-between'; row.style.alignItems='center'; row.style.padding='6px 0';
      const left = document.createElement('div'); left.innerHTML = `<div style="font-weight:700">${t.id}</div><div style="font-size:12px;color:#9fb7d8">${t.mode} ${t.targetSeconds?(' | target '+t.targetSeconds+'s'):''}</div>`;
      const right = document.createElement('div');
      const disp = document.createElement('div'); disp.textContent = formatTime(t.elapsed); disp.style.fontFamily='monospace'; disp.style.marginRight='8px';
      const startBtn = document.createElement('button'); startBtn.textContent = t.running? 'Stop' : 'Start'; startBtn.style.marginRight='6px';
      startBtn.addEventListener('click', ()=>{ if(t.running) core.stopTimer(t.id); else core.startTimer(t.id); renderList(); });
      const reset = document.createElement('button'); reset.textContent = 'Reset'; reset.addEventListener('click', ()=>{ core.resetTimer(t.id); renderList(); });
      right.appendChild(disp); right.appendChild(startBtn); right.appendChild(reset);
      row.appendChild(left); row.appendChild(right); out.appendChild(row);
      // listen to updates
      const u = (updated)=>{ if(updated.id===t.id) disp.textContent = formatTime(updated.elapsed); };
      core.on('timer:update', u);
    });
  }

  let panel = null;
  core.registerTool(NAME, { openPanel });
}
