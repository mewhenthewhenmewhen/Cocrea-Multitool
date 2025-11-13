// tools/ai-tool.js
// Minimal AI tool: local lightweight reasoning + optional hosted endpoint.
// Exports default init(core)
export default async function init(core){
  const NAME = 'ai-tool.js';
  let panel = null;

  function openPanel(){
    if(panel){ panel.remove(); panel = null; return; }
    panel = document.createElement('div');
    Object.assign(panel.style, { position:'fixed', right:'410px', top:'420px', width:'420px', background:'#061426', color:'#e6eef6', padding:'10px', borderRadius:'8px', boxShadow:'0 8px 30px rgba(0,0,0,.6)', zIndex:2147483649 });
    panel.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center"><strong>AI Tool</strong><button id="aiclose" style="background:transparent;border:0;color:#9fb7d8">×</button></div>
      <div style="margin-top:8px"><textarea id="ai-prompt" placeholder="Ask (local AI)..." style="width:100%;height:120px;background:#041021;color:#e6eef6;border-radius:6px;padding:8px;border:1px solid rgba(255,255,255,0.04)"></textarea></div>
      <div style="display:flex;gap:8px;margin-top:8px">
        <input id="ai-endpoint" placeholder="Hosted endpoint (optional)" style="flex:1;padding:6px;border-radius:6px;background:#041021;color:#e6eef6;border:1px solid rgba(255,255,255,0.04)">
        <button id="ai-run" style="background:#1f6feb;color:#fff;border:none;padding:6px 10px;border-radius:6px;cursor:pointer">Run</button>
      </div>
      <pre id="ai-out" style="margin-top:8px;background:rgba(255,255,255,0.02);padding:8px;border-radius:6px;min-height:80px"></pre>
    `;
    document.body.appendChild(panel);
    panel.querySelector('#aiclose').addEventListener('click', ()=>{ panel.remove(); panel=null; });
    panel.querySelector('#ai-run').addEventListener('click', async ()=>{
      const prompt = panel.querySelector('#ai-prompt').value.trim();
      const endpoint = panel.querySelector('#ai-endpoint').value.trim();
      const out = panel.querySelector('#ai-out');
      if(!prompt){ out.textContent = 'Type a prompt.'; return; }
      out.textContent = 'Thinking...';
      try{
        // Try hosted if endpoint provided, else local stub
        if(endpoint){
          try{
            const resp = await fetch(endpoint, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ prompt })});
            if(!resp.ok) throw new Error('API error '+resp.status);
            const ct = resp.headers.get('content-type')||'';
            if(ct.includes('json')){ const j = await resp.json(); out.textContent = j.text || j.result || JSON.stringify(j); }
            else out.textContent = await resp.text();
            return;
          }catch(e){
            out.textContent = 'Hosted call failed, falling back to local.\n' + (e.message||e);
          }
        }
        // Local improved stub
        out.textContent = localAi(prompt);
      }catch(e){ out.textContent = 'Error: '+(e.message||e); core.log('AI tool error '+e.message); }
    });
  }

  function localAi(prompt){
    // compact heuristic engine: pattern matching + KB + explanation templates
    const p = prompt.toLowerCase();
    const kb = [
      {k:'timer', v:'Timers: stopwatch (count up) or timer (countdown). Use createTimer/startTimer APIs.'},
      {k:'variable', v:'Variables usually live in window.project or window.cocrea.'},
      {k:'block', v:'Blocks can create timers and expose reporters that update via events.'}
    ];
    const lines = ['Local AI — heuristic reply', 'Input: ' + prompt, '---'];
    for(const it of kb) if(p.includes(it.k)) lines.push('Fact: ' + it.v);
    if(p.match(/explain|what does|how (does|to)/)) lines.push('Advice: break problem into steps, provide minimal reproducible example, then ask for a specific improvement.');
    if(p.includes('timer')) lines.push('Example usage: core.createTimer({id:\"race1\", mode:\"stopwatch\"}); core.startTimer(\"race1\");');
    lines.push('Tip: paste a hosted endpoint above for richer model answers.');
    return lines.join('\n');
  }

  core.registerTool(NAME, { openPanel });
}
