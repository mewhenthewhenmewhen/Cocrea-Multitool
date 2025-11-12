/* Minimal stable Cocrea MultiTool replacement
   - Single-file, zero deps
   - Always loads (no syntax errors)
   - Draggable + resizable panel
   - Timers with Start / Stop / Reset
   - Variable inspector (scans common runtime globals)
   - Simple draggable blocks that mirror timers
   - Small local AI stub (no keys required)
*/
(function(window){
  if(!window) return;
  const EXT = 'cocrea-multitool-stable-v1';
  const STORAGE = EXT+':s';

  // defaults
  const defaults = {
    enabled: { ai:true, timers:true, inspector:true, blocks:true },
    timers: { defaultMode:'stopwatch', defaultFormat:'hh:mm:ss' },
    ui: { right:'10px', top:'10px', width:420, height:null }
  };

  // load/save
  let settings = {};
  function loadSettings(){
    try{
      const s = JSON.parse(localStorage.getItem(STORAGE));
      settings = s ? Object.assign({}, defaults, s) : Object.assign({}, defaults);
    }catch(e){ settings = Object.assign({}, defaults); }
  }
  function saveSettings(){ try{ localStorage.setItem(STORAGE, JSON.stringify(settings)); }catch(e){} }
  loadSettings();

  // state
  const state = { timers: {}, blocks: {}, logs: [], aiCache: {} };

  // helpers
  function $qs(sel, ctx=document){ return ctx.querySelector(sel); }
  function $create(tag, attrs){ const el=document.createElement(tag); if(attrs){ for(const k in attrs){ if(k==='html') el.innerHTML = attrs[k]; else if(k==='text') el.textContent = attrs[k]; else el.setAttribute(k, attrs[k]); } } return el; }
  function log(){ const args = Array.from(arguments).map(x=> typeof x==='string'? x : JSON.stringify(x)); state.logs.push({t: new Date().toISOString(), m: args.join(' ')}); renderLogs(); console.log.apply(console, ['[MT]'].concat(Array.from(arguments))); }
  function escapeHtml(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  // inject styles
  function injectStyles(){
    if(document.getElementById(EXT+'-css')) return;
    const css = `
#${EXT}-panel{position:fixed;right:${settings.ui.right};top:${settings.ui.top};width:${settings.ui.width}px;background:#071024;color:#e6eef6;border-radius:10px;box-shadow:0 12px 40px rgba(0,0,0,.6);font-family:Inter,system-ui,Arial;z-index:2147483647;overflow:hidden}
#${EXT}-hdr{display:flex;align-items:center;justify-content:space-between;padding:10px;cursor:grab}
#${EXT}-hdr h3{margin:0;font-size:15px}
#${EXT}-body{padding:10px;max-height:68vh;overflow:auto}
.mt-btn{background:#1f6feb;color:white;border:0;padding:6px 10px;border-radius:8px;cursor:pointer}
.mt-ghost{background:transparent;border:1px solid rgba(255,255,255,0.04);padding:6px;border-radius:6px;color:#cbd5e1}
.mt-section{margin-bottom:10px}
.mt-row{display:flex;gap:8px;align-items:center}
.mt-input{padding:6px;border-radius:6px;border:1px solid rgba(255,255,255,0.06);background:#071127;color:#e6eef6;flex:1}
.timer-line{display:flex;gap:6px;align-items:center;margin-bottom:6px}
.timer-display{min-width:120px;font-family:monospace}
.block{position:fixed;left:60px;top:180px;background:#0f1724;color:#f8fafc;padding:10px;border-radius:8px;box-shadow:0 10px 30px rgba(0,0,0,.5);z-index:2147483646;cursor:grab}
.reporter{background:rgba(255,255,255,0.02);padding:6px;border-radius:6px;margin-top:6px;min-width:120px;text-align:center}
.small{font-size:13px;color:#b3c2d1}
#${EXT}-logs{background:rgba(255,255,255,0.02);padding:8px;border-radius:8px;font-size:12px;max-height:120px;overflow:auto}
#${EXT}-resizer{position:absolute;right:6px;bottom:6px;width:14px;height:14px;background:transparent;cursor:se-resize;z-index:2147483648}
#${EXT}-resizer:after{content:'';display:block;width:12px;height:12px;border-right:2px solid rgba(255,255,255,0.18);border-bottom:2px solid rgba(255,255,255,0.18);transform:rotate(45deg);margin-left:1px;margin-top:1px}
`;
    const s = document.createElement('style'); s.id = EXT+'-css'; s.innerHTML = css; document.head.appendChild(s);
  }

  // draggable
  function makeDraggable(el, handle){
    handle = handle || el;
    let dragging=false, sx=0, sy=0, ox=0, oy=0;
    handle.style.touchAction='none';
    handle.addEventListener('mousedown', e=>{
      dragging=true; sx=e.clientX; sy=e.clientY; const r = el.getBoundingClientRect(); ox=r.left; oy=r.top;
      document.addEventListener('mousemove', mm); document.addEventListener('mouseup', mup); e.preventDefault();
    });
    handle.addEventListener('touchstart', e=>{
      const t=e.touches[0]; dragging=true; sx=t.clientX; sy=t.clientY; const r=el.getBoundingClientRect(); ox=r.left; oy=r.top;
      document.addEventListener('touchmove', tm); document.addEventListener('touchend', mup); e.preventDefault();
    });
    function mm(e){ if(!dragging) return; const dx=e.clientX - sx, dy=e.clientY - sy; el.style.left = (ox + dx) + 'px'; el.style.top = (oy + dy) + 'px'; }
    function tm(e){ if(!dragging) return; const t = e.touches[0]; const dx=t.clientX - sx, dy=t.clientY - sy; el.style.left = (ox + dx) + 'px'; el.style.top = (oy + dy) + 'px'; }
    function mup(){ dragging=false; document.removeEventListener('mousemove', mm); document.removeEventListener('touchmove', tm); document.removeEventListener('mouseup', mup); document.removeEventListener('touchend', mup); }
  }

  // resizer
  function makeResizable(panelEl){
    const resizer = $create('div', { id: EXT+'-resizer' });
    panelEl.appendChild(resizer);
    let resizing=false, sx=0, sy=0, sw=0, sh=0;
    resizer.addEventListener('mousedown', (e)=>{ resizing=true; sx=e.clientX; sy=e.clientY; const r=panelEl.getBoundingClientRect(); sw=r.width; sh=r.height; document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp); e.preventDefault(); });
    resizer.addEventListener('touchstart', (ev)=>{ const t=ev.touches[0]; resizing=true; sx=t.clientX; sy=t.clientY; const r=panelEl.getBoundingClientRect(); sw=r.width; sh=r.height; document.addEventListener('touchmove', onTouchMove); document.addEventListener('touchend', onUp); ev.preventDefault(); });
    function onMove(e){ if(!resizing) return; const dx=e.clientX - sx, dy=e.clientY - sy; const nw = Math.max(320, Math.min(1000, sw + dx)); const nh = Math.max(180, Math.min(window.innerHeight - 60, sh + dy)); panelEl.style.width = nw + 'px'; panelEl.style.height = nh + 'px'; settings.ui.width = nw; settings.ui.height = nh; saveSettings(); }
    function onTouchMove(ev){ if(!resizing) return; const t=ev.touches[0]; const dx=t.clientX - sx, dy=t.clientY - sy; const nw = Math.max(320, Math.min(1000, sw + dx)); const nh = Math.max(180, Math.min(window.innerHeight - 60, sh + dy)); panelEl.style.width = nw + 'px'; panelEl.style.height = nh + 'px'; settings.ui.width = nw; settings.ui.height = nh; saveSettings(); }
    function onUp(){ resizing=false; document.removeEventListener('mousemove', onMove); document.removeEventListener('touchmove', onTouchMove); document.removeEventListener('mouseup', onUp); document.removeEventListener('touchend', onUp); }
  }

  // build UI
  function buildPanel(){
    injectStyles();
    const prev = document.getElementById(EXT+'-panel'); if(prev) prev.remove();
    const panel = $create('div', { id: EXT+'-panel' });
    if(settings.ui.height) panel.style.height = settings.ui.height + 'px';
    panel.innerHTML = `
      <div id="${EXT}-hdr"><h3>MultiTool</h3>
        <div style="display:flex;gap:8px;align-items:center">
          <button id="${EXT}-collapse" class="mt-ghost">▾</button>
          <button id="${EXT}-open" class="mt-btn">Open</button>
        </div>
      </div>
      <div id="${EXT}-body">
        <div class="mt-section">
          <div class="mt-row">
            <label class="small"><input type="checkbox" id="${EXT}-toggle-ai"> AI</label>
            <label class="small"><input type="checkbox" id="${EXT}-toggle-timers"> Timers</label>
            <label class="small"><input type="checkbox" id="${EXT}-toggle-inspector"> Inspector</label>
            <label class="small"><input type="checkbox" id="${EXT}-toggle-blocks"> Blocks</label>
          </div>
        </div>
        <div id="${EXT}-tools"></div>
        <div class="mt-section"><div class="small">Logs</div><div id="${EXT}-logs"></div></div>
      </div>
    `;
    document.body.appendChild(panel);
    makeDraggable(panel, $qs('#'+EXT+'-hdr'));
    makeResizable(panel);
    $qs('#'+EXT+'-collapse').addEventListener('click', ()=> $qs('#'+EXT+'-body').classList.toggle('collapse-hidden'));
    $qs('#'+EXT+'-open').addEventListener('click', ()=> openMainWindow());
    $qs('#'+EXT+'-toggle-ai').checked = settings.enabled.ai;
    $qs('#'+EXT+'-toggle-timers').checked = settings.enabled.timers;
    $qs('#'+EXT+'-toggle-inspector').checked = settings.enabled.inspector;
    $qs('#'+EXT+'-toggle-blocks').checked = settings.enabled.blocks;
    $qs('#'+EXT+'-toggle-ai').addEventListener('change', e=>{ settings.enabled.ai = e.target.checked; saveSettings(); renderTools(); });
    $qs('#'+EXT+'-toggle-timers').addEventListener('change', e=>{ settings.enabled.timers = e.target.checked; saveSettings(); renderTools(); });
    $qs('#'+EXT+'-toggle-inspector').addEventListener('change', e=>{ settings.enabled.inspector = e.target.checked; saveSettings(); renderTools(); });
    $qs('#'+EXT+'-toggle-blocks').addEventListener('change', e=>{ settings.enabled.blocks = e.target.checked; saveSettings(); renderTools(); });
    renderTools();
    renderLogs();
  }

  // render tools
  function renderTools(){
    const area = $qs('#'+EXT+'-tools'); if(!area) return; area.innerHTML = '';
    if(settings.enabled.ai) area.appendChild(aiTool());
    if(settings.enabled.timers) area.appendChild(timersTool());
    if(settings.enabled.inspector) area.appendChild(inspectorTool());
    if(settings.enabled.blocks) area.appendChild(blocksTool());
  }

  // AI tool (local stub)
  function aiTool(){
    const wrap = $create('div', { class: 'mt-section', html: `
      <div><strong>AI Tools</strong></div>
      <div class="mt-row" style="margin-top:6px"><textarea id="${EXT}-ai-prompt" class="mt-input" style="height:72px" placeholder="Ask the AI..."></textarea></div>
      <div class="mt-row" style="margin-top:8px">
        <button id="${EXT}-ai-run" class="mt-btn">Run (local)</button>
      </div>
      <pre id="${EXT}-ai-out" style="margin-top:8px;background:rgba(255,255,255,0.02);padding:8px;border-radius:6px;min-height:60px"></pre>
    `});
    setTimeout(()=>{
      $qs('#'+EXT+'-ai-run').addEventListener('click', ()=>{
        const p = $qs('#'+EXT+'-ai-prompt').value.trim();
        if(!p){ $qs('#'+EXT+'-ai-out').textContent = 'Type a prompt.'; return; }
        $qs('#'+EXT+'-ai-out').textContent = 'Thinking (local)...';
        try{
          const out = runLocalAi(p);
          $qs('#'+EXT+'-ai-out').textContent = out;
        }catch(e){ $qs('#'+EXT+'-ai-out').textContent = 'Error: '+(e.message||e); reportError(e); }
      });
    },0);
    return wrap;
  }

  function runLocalAi(prompt){
    if(state.aiCache[prompt]) return state.aiCache[prompt];
    const p = prompt.toLowerCase();
    const lines = ['Input: '+prompt, 'Parsing...'];
    if(p.includes('timer')||p.includes('stopwatch')) lines.push('Answer: Use stopwatch to count up; timer to countdown. Use Start/Stop/Reset.');
    else if(p.includes('variable')||p.includes('inspect')) lines.push('Answer: Open Variable Inspector and search by name (e.g., project).');
    else lines.push('Answer: Local AI stub — for deeper answers, configure hosted API. Ask to "create timer X" or "explain function".');
    const out = lines.join('\n');
    state.aiCache[prompt]=out;
    return out;
  }

  // timers
  function timersTool(){
    const wrap = $create('div', { class:'mt-section', html: `
      <div><strong>Timers</strong></div>
      <div class="mt-row" style="margin-top:6px">
        <input id="${EXT}-timer-name" class="mt-input" placeholder="Timer ID (optional)">
        <select id="${EXT}-timer-mode" class="mt-select"><option value="stopwatch">Stopwatch</option><option value="timer">Timer</option></select>
        <input id="${EXT}-timer-seconds" class="mt-input" placeholder="Seconds (for timer)">
        <button id="${EXT}-timer-make" class="mt-btn">Create</button>
      </div>
      <div id="${EXT}-timer-list" style="margin-top:8px"></div>
    `});
    setTimeout(()=>{
      $qs('#'+EXT+'-timer-make').addEventListener('click', ()=>{
        const id = $qs('#'+EXT+'-timer-name').value.trim() || ('T' + Date.now().toString().slice(-4));
        const mode = $qs('#'+EXT+'-timer-mode').value;
        const secs = Number($qs('#'+EXT+'-timer-seconds').value) || 0;
        createTimer({ id, mode, seconds: secs });
        renderTimerList();
      });
      renderTimerList();
    },0);
    return wrap;
  }

  function createTimer(opts){
    const id = opts.id || ('t_'+Date.now()+'_'+Math.floor(Math.random()*9999));
    const t = { id, name: opts.id || id, mode: opts.mode || settings.timers.defaultMode, targetSeconds: opts.seconds || 0, elapsed:0, running:false, _last:0 };
    state.timers[id] = t;
    log('Timer created', id, t.mode, t.targetSeconds);
    return id;
  }

  function startTimer(id){
    const t = state.timers[id]; if(!t) return;
    if(t.running) return;
    t.running = true; t._last = performance.now();
    function tick(){
      if(!t.running) return;
      const now = performance.now();
      t.elapsed += (now - t._last);
      t._last = now;
      if(t.mode === 'timer' && t.targetSeconds > 0 && (t.elapsed/1000) >= t.targetSeconds){
        t.running = false;
        t.elapsed = t.targetSeconds * 1000;
        try{ alert('Timer '+t.id+' finished.'); }catch(e){}
      }
      dispatchTimerUpdate(id);
      t._raf = requestAnimationFrame(tick);
    }
    t._raf = requestAnimationFrame(tick);
  }

  function stopTimer(id){ const t = state.timers[id]; if(!t) return; t.running = false; if(t._raf) cancelAnimationFrame(t._raf); t._raf = null; dispatchTimerUpdate(id); }
  function resetTimer(id){ const t = state.timers[id]; if(!t) return; t.running = false; t.elapsed = 0; t._last = 0; if(t._raf) cancelAnimationFrame(t._raf); t._raf = null; dispatchTimerUpdate(id); }

  function formatTime(ms){
    const total = Math.floor(ms/1000);
    const h = Math.floor(total/3600), m = Math.floor((total%3600)/60), s = total%60;
    const pad = n => String(n).padStart(2,'0');
    return pad(h)+':'+pad(m)+':'+pad(s);
  }

  function dispatchTimerUpdate(id){
    const ev = new CustomEvent('multitool:timer-update',{ detail:{ id, timer: state.timers[id] } });
    window.dispatchEvent(ev);
  }

  function renderTimerList(){
    const list = $qs('#'+EXT+'-timer-list'); if(!list) return;
    list.innerHTML = '';
    Object.values(state.timers).forEach(t=>{
      const row = $create('div', { class: 'timer-line' });
      const name = $create('input', { class: 'mt-input' }); name.value = t.name;
      name.addEventListener('change', e=> t.name = e.target.value);
      const disp = $create('div', { class: 'timer-display', html: formatTime(t.elapsed) });
      const startBtn = $create('button', { class: 'mt-btn', text: t.running ? 'Stop' : 'Start' });
      startBtn.textContent = t.running ? 'Stop' : 'Start';
      startBtn.addEventListener('click', ()=>{
        if(t.running) stopTimer(t.id); else startTimer(t.id); renderTimerList();
      });
      const resetBtn = $create('button', { class: 'mt-ghost', text: 'Reset' });
      resetBtn.addEventListener('click', ()=>{ resetTimer(t.id); renderTimerList(); });
      row.appendChild(name); row.appendChild(disp); row.appendChild(startBtn); row.appendChild(resetBtn);
      list.appendChild(row);
      window.addEventListener('multitool:timer-update', ev=>{ if(ev.detail.id === t.id){ const dt = ev.detail.timer; disp.textContent = dt.mode === 'timer' && dt.targetSeconds>0 ? formatTime((dt.targetSeconds*1000)-dt.elapsed) : formatTime(dt.elapsed); startBtn.textContent = dt.running ? 'Stop' : 'Start'; }});
    });
  }

  // inspector (scan common runtime objects)
  function inspectorTool(){
    const wrap = $create('div', { class:'mt-section', html: `
      <div><strong>Variable Inspector</strong></div>
      <div class="mt-row" style="margin-top:6px">
        <input id="${EXT}-var-filter" class="mt-input" placeholder="Filter variable name (e.g., project)">
        <button id="${EXT}-var-scan" class="mt-btn">Scan</button>
      </div>
      <div id="${EXT}-var-list" style="margin-top:8px"></div>
    `});
    setTimeout(()=>{
      $qs('#'+EXT+'-var-scan').addEventListener('click', ()=>{
        const f = $qs('#'+EXT+'-var-filter').value.trim().toLowerCase();
        const res = scanRuntime(f);
        const list = $qs('#'+EXT+'-var-list'); list.innerHTML = '';
        if(!res.length) list.innerHTML = `<div class="small">No variables found matching "${escapeHtml(f)}".</div>`;
        res.forEach(r=>{
          const row = $create('div', { html: `<code>${escapeHtml(r.name)}</code> — <span class="small">${escapeHtml(r.type)}</span> — <span class="small">${escapeHtml(r.preview)}</span>` });
          const edit = $create('button', { class:'mt-ghost', text:'Edit' });
          edit.addEventListener('click', ()=> openVarEditor(r));
          row.appendChild(edit); list.appendChild(row);
        });
      });
    },0);
    return wrap;
  }

  function scanRuntime(filter){
    const candidates = ['project','IDE','cocrea','app','runtime','Cocrea'];
    const out = []; const seen = new Set();
    const f = (filter||'').toLowerCase();
    function push(name, val){
      if(seen.has(name)) return; seen.add(name);
      let type = typeof val; let preview = '';
      try{ if(val===null) type='null'; else if(type==='object') preview = JSON.stringify(Object.keys(val).slice(0,6)); else preview = String(val).slice(0,120); }catch(e){ preview='[unreadable]'; }
      if(!f || name.toLowerCase().includes(f)) out.push({ name, type, preview, value: val });
    }
    for(const n of candidates){ try{ if(window[n]) Object.keys(window[n]).forEach(k=> push(n + '.' + k, window[n][k])); }catch(e){} }
    // fallback to some window keys
    try{
      const keys = Object.keys(window).slice(0,500);
      for(const k of keys){ if(k.toLowerCase().includes('project') || k.toLowerCase().includes('sprite') || k.toLowerCase().includes('stage') || k.toLowerCase().includes('cocrea')){ try{ push(k, window[k]); }catch(e){} } }
      for(const k of keys){ try{ push(k, window[k]); }catch(e){} }
    }catch(e){}
    return out.sort((a,b)=> a.name.localeCompare(b.name));
  }

  function openVarEditor(entry){
    const w = window.open('', '_blank', 'width=720,height=520'); if(!w) return alert('Allow popups to edit variables.');
    w.document.title = 'Edit: ' + entry.name;
    const ta = w.document.createElement('textarea'); ta.style.width='100%'; ta.style.height='72%';
    try{ ta.value = JSON.stringify(entry.value, null, 2); }catch(e){ ta.value = String(entry.value); }
    const btn = w.document.createElement('button'); btn.textContent = 'Apply'; btn.className = 'mt-btn';
    btn.addEventListener('click', ()=>{
      try{
        const parsed = JSON.parse(ta.value);
        const parts = entry.name.split('.');
        if(parts.length === 1) window[parts[0]] = parsed;
        else {
          let obj = window;
          for(let i=0;i<parts.length-1;i++){ obj = obj[parts[i]]; if(obj === undefined) throw new Error('Parent not found'); }
          obj[parts[parts.length-1]] = parsed;
        }
        alert('Applied.');
      }catch(err){ alert('Failed: '+(err.message||err)); }
    });
    w.document.body.appendChild(ta); w.document.body.appendChild(btn);
  }

  // Blocks tool
  function blocksTool(){
    const wrap = $create('div', { class:'mt-section', html: `
      <div><strong>Blocks</strong></div>
      <div class="mt-row" style="margin-top:6px">
        <input id="${EXT}-block-name" class="mt-input" placeholder="Block Timer ID">
        <select id="${EXT}-block-mode" class="mt-select"><option value="stopwatch">Stopwatch</option><option value="timer">Timer</option></select>
        <input id="${EXT}-block-time" class="mt-input" placeholder="Seconds (for timer)">
        <button id="${EXT}-block-create" class="mt-btn">Create Block</button>
      </div>
    `});
    setTimeout(()=>{
      $qs('#'+EXT+'-block-create').addEventListener('click', ()=>{
        const id = $qs('#'+EXT+'-block-name').value.trim() || ('B' + Date.now().toString().slice(-4));
        const mode = $qs('#'+EXT+'-block-mode').value;
        const seconds = Number($qs('#'+EXT+'-block-time').value) || 0;
        makeBlock({ id, mode, seconds });
      });
    },0);
    return wrap;
  }

  function makeBlock(opts){
    const tid = createTimer({ id: opts.id, mode: opts.mode, seconds: opts.seconds });
    const block = $create('div', { class: 'block', html: `<div style="font-weight:700">${escapeHtml(opts.id)}</div><div class="small">${escapeHtml(opts.mode)}</div><div style="margin-top:6px"><button class="mt-btn" data-act="start">Start</button><button class="mt-ghost" data-act="stop">Stop</button><button class="mt-ghost" data-act="reset">Reset</button></div><div class="reporter" data-tid="${tid}">${formatTime(0)}</div>` });
    document.body.appendChild(block);
    makeDraggable(block, block);
    block.querySelector('[data-act="start"]').addEventListener('click', ()=> startTimer(tid));
    block.querySelector('[data-act="stop"]').addEventListener('click', ()=> stopTimer(tid));
    block.querySelector('[data-act="reset"]').addEventListener('click', ()=> resetTimer(tid));
    window.addEventListener('multitool:timer-update', ev=>{ if(ev.detail.id === tid){ const r = block.querySelector('.reporter'); const t = ev.detail.timer; r.textContent = t.mode === 'timer' && t.targetSeconds > 0 ? formatTime((t.targetSeconds*1000) - t.elapsed) : formatTime(t.elapsed); }});
    state.blocks[opts.id] = { el: block, tid };
    log('Block created', opts.id);
    return block;
  }

  // extras: logs / main window
  function renderLogs(){
    const el = $qs('#'+EXT+'-logs'); if(!el) return;
    el.innerHTML = state.logs.slice(-40).map(x=> `<div class="small">${escapeHtml(x.t+' — '+x.m)}</div>`).join('');
  }
  function openMainWindow(){
    const w = window.open('', '_blank', 'width=900,height=600'); if(!w) return alert('Allow popups to open main window.');
    w.document.title = 'MultiTool Main';
    const c = w.document.createElement('div'); c.style.padding='12px';
    c.innerHTML = `<h2>MultiTool</h2><pre>${escapeHtml(JSON.stringify(settings, null, 2))}</pre><h3>Logs</h3><pre>${escapeHtml(state.logs.map(l=> l.t + ' ' + l.m).join('\\n'))}</pre>`;
    w.document.body.appendChild(c);
  }

  // errors
  function reportError(e){
    log('ERROR', e && e.message ? e.message : String(e));
    try{
      const modal = $create('div', { html: `<div style="position:fixed;inset:0;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;z-index:2147483650"><div style="background:white;padding:12px;border-radius:8px;max-width:900px;color:black"><h3>Fatal Error</h3><pre style="max-height:300px;overflow:auto">${escapeHtml(JSON.stringify({time:new Date().toISOString(), message: e && e.message ? e.message : String(e), stack: e && e.stack ? e.stack : ''}, null,2))}</pre><div style="text-align:right"><button id="${EXT}-fatal-close" class="mt-btn">Close</button></div></div></div>` });
      document.body.appendChild(modal);
      modal.querySelector('#'+EXT+'-fatal-close').addEventListener('click', ()=> modal.remove());
    }catch(e){}
  }

  // autodetect runtime (log)
  function autodetect(){
    const names = ['project','IDE','cocrea','app','runtime','Cocrea']; const found=[];
    names.forEach(n=>{ try{ if(window[n]) found.push(n);}catch(e){} });
    if(!found.length){ if(document.getElementById('stage')) found.push('stage element'); if(document.querySelector('[data-stage]')) found.push('data-stage'); }
    log('Autodetected runtime targets: ' + (found.length ? found.join(', ') : 'none'));
    return found;
  }

  // boot
  function boot(){
    try{
      buildPanel();
      autodetect();
      window.addEventListener('error', e=> reportError(e.error || e));
      window.addEventListener('unhandledrejection', e=> reportError(e.reason || e));
      log('MultiTool loaded');
    }catch(e){ reportError(e); }
  }

  // build panel final
  function buildPanel(){ buildPanel = null; /* guard against double-call */ injectStyles(); buildPanel = function(){}; // noop after first
    // create once - use earlier function for structure
    const existing = document.getElementById(EXT+'-panel'); if(existing) existing.remove();
    // reuse top-level build (above)
    const panel = $create('div', { id: EXT+'-panel' });
    if(settings.ui.height) panel.style.height = settings.ui.height + 'px';
    panel.innerHTML = `
      <div id="${EXT}-hdr"><h3>MultiTool</h3>
        <div style="display:flex;gap:8px;align-items:center">
          <button id="${EXT}-collapse" class="mt-ghost">▾</button>
          <button id="${EXT}-open" class="mt-btn">Open</button>
        </div>
      </div>
      <div id="${EXT}-body">
        <div class="mt-section">
          <div class="mt-row">
            <label class="small"><input type="checkbox" id="${EXT}-toggle-ai"> AI</label>
            <label class="small"><input type="checkbox" id="${EXT}-toggle-timers"> Timers</label>
            <label class="small"><input type="checkbox" id="${EXT}-toggle-inspector"> Inspector</label>
            <label class="small"><input type="checkbox" id="${EXT}-toggle-blocks"> Blocks</label>
          </div>
        </div>
        <div id="${EXT}-tools"></div>
        <div class="mt-section"><div class="small">Logs</div><div id="${EXT}-logs"></div></div>
      </div>
    `;
    document.body.appendChild(panel);
    // drag + resize
    makeDraggable(panel, $qs('#'+EXT+'-hdr'));
    makeResizable(panel);
    $qs('#'+EXT+'-collapse').addEventListener('click', ()=> $qs('#'+EXT+'-body').classList.toggle('collapse-hidden'));
    $qs('#'+EXT+'-open').addEventListener('click', ()=> openMainWindow());
    // toggles
    $qs('#'+EXT+'-toggle-ai').checked = settings.enabled.ai;
    $qs('#'+EXT+'-toggle-timers').checked = settings.enabled.timers;
    $qs('#'+EXT+'-toggle-inspector').checked = settings.enabled.inspector;
    $qs('#'+EXT+'-toggle-blocks').checked = settings.enabled.blocks;
    $qs('#'+EXT+'-toggle-ai').addEventListener('change', e=>{ settings.enabled.ai = e.target.checked; saveSettings(); renderTools(); });
    $qs('#'+EXT+'-toggle-timers').addEventListener('change', e=>{ settings.enabled.timers = e.target.checked; saveSettings(); renderTools(); });
    $qs('#'+EXT+'-toggle-inspector').addEventListener('change', e=>{ settings.enabled.inspector = e.target.checked; saveSettings(); renderTools(); });
    $qs('#'+EXT+'-toggle-blocks').addEventListener('change', e=>{ settings.enabled.blocks = e.target.checked; saveSettings(); renderTools(); });
    renderTools(); renderLogs();
  }

  // renderTools wrapper (uses earlier functions)
  function renderTools(){
    const area = $qs('#'+EXT+'-tools'); if(!area) return; area.innerHTML = '';
    if(settings.enabled.ai) area.appendChild(aiTool());
    if(settings.enabled.timers) area.appendChild(timersTool());
    if(settings.enabled.inspector) area.appendChild(inspectorTool());
    if(settings.enabled.blocks) area.appendChild(blocksTool());
  }

  // make sure functions exist in scope for exposure
  window.CocreaMultiTool = {
    boot,
    settings,
    state,
    createTimer,
    startTimer,
    stopTimer,
    resetTimer,
    makeBlock,
    runLocalAi
  };

  // define functions referenced by API (so no undefined)
  function createTimer(opts){ return (function(){ const id = (opts && opts.id) || ('t_'+Date.now()+'_'+Math.floor(Math.random()*9999)); const t = { id, name: opts && opts.id || id, mode: opts && opts.mode || settings.timers.defaultMode, targetSeconds: opts && opts.seconds || 0, elapsed:0, running:false, _last:0 }; state.timers[id] = t; log('Timer created', id); return id; })(); }
  function startTimer(id){ try{ startTimerCore(id); }catch(e){ reportError(e); } }
  function startTimerCore(id){ const t = state.timers[id]; if(!t) return; if(t.running) return; t.running = true; t._last = performance.now(); function tick(){ if(!t.running) return; const now = performance.now(); t.elapsed += (now - t._last); t._last = now; if(t.mode === 'timer' && t.targetSeconds > 0 && (t.elapsed/1000) >= t.targetSeconds){ t.running = false; t.elapsed = t.targetSeconds*1000; try{ alert('Timer '+t.id+' finished'); }catch(e){} } dispatchTimerUpdate(id); t._raf = requestAnimationFrame(tick); } t._raf = requestAnimationFrame(tick); }
  function stopTimer(id){ const t = state.timers[id]; if(!t) return; t.running = false; if(t._raf) cancelAnimationFrame(t._raf); t._raf = null; dispatchTimerUpdate(id); }
  function resetTimer(id){ const t = state.timers[id]; if(!t) return; t.running = false; t.elapsed = 0; t._last = 0; if(t._raf) cancelAnimationFrame(t._raf); t._raf = null; dispatchTimerUpdate(id); }
  function makeBlock(opts){ return makeBlockCore(opts); }
  function makeBlockCore(opts){ const id = opts && opts.id ? opts.id : ('B'+Date.now().toString().slice(-4)); const tid = createTimer({ id: id, mode: opts.mode || 'stopwatch', seconds: opts.seconds || 0 }); const block = $create('div', { class:'block' }); block.innerHTML = `<div style="font-weight:700">${escapeHtml(id)}</div><div class="small">${escapeHtml(opts.mode||'stopwatch')}</div><div style="margin-top:6px"><button class="mt-btn" data-act="start">Start</button><button class="mt-ghost" data-act="stop">Stop</button><button class="mt-ghost" data-act="reset">Reset</button></div><div class="reporter" data-tid="${tid}">${formatTime(0)}</div>`; document.body.appendChild(block); makeDraggable(block, block); block.querySelector('[data-act="start"]').addEventListener('click', ()=> startTimer(tid)); block.querySelector('[data-act="stop"]').addEventListener('click', ()=> stopTimer(tid)); block.querySelector('[data-act="reset"]').addEventListener('click', ()=> resetTimer(tid)); window.addEventListener('multitool:timer-update', ev=>{ if(ev.detail.id === tid){ const r = block.querySelector('.reporter'); const t = ev.detail.timer; r.textContent = t.mode === 'timer' && t.targetSeconds>0 ? formatTime((t.targetSeconds*1000)-t.elapsed) : formatTime(t.elapsed); } }); state.blocks[id] = { el:block, tid }; log('Block created', id); return block; }

  function runLocalAi(prompt){ if(state.aiCache[prompt]) return state.aiCache[prompt]; const p = prompt.toLowerCase(); const lines = ['Input: '+prompt, 'Parsing...']; if(p.includes('timer')) lines.push('Answer: timers support stopwatch (count-up) and timer (countdown).'); else lines.push('Answer: local AI stub. For better results add a hosted endpoint.'); const out = lines.join('\\n'); state.aiCache[prompt]=out; return out; }

  // small helpers used in earlier UI functions
  function dispatchTimerUpdate(id){ const ev = new CustomEvent('multitool:timer-update', { detail: { id, timer: state.timers[id] } }); window.dispatchEvent(ev); }

  // make sure basic UI builder functions exist for renderTools to call
  function aiTool(){ return aiToolImpl(); }
  function timersTool(){ return timersToolImpl(); }
  function inspectorTool(){ return inspectorToolImpl(); }
  function blocksTool(){ return blocksToolImpl(); }

  // implement UI small wrappers (to keep code short above)
  function aiToolImpl(){
    const wrap = $create('div', { class:'mt-section', html: `<div><strong>AI Tools</strong></div><div class="mt-row" style="margin-top:6px"><textarea id="${EXT}-ai-prompt" class="mt-input" style="height:72px" placeholder="Ask the AI..."></textarea></div><div class="mt-row" style="margin-top:8px"><button id="${EXT}-ai-run" class="mt-btn">Run (local)</button></div><pre id="${EXT}-ai-out" style="margin-top:8px;background:rgba(255,255,255,0.02);padding:8px;border-radius:6px;min-height:60px"></pre>`});
    setTimeout(()=>{ $qs('#'+EXT+'-ai-run').addEventListener('click', ()=>{ const p = $qs('#'+EXT+'-ai-prompt').value.trim(); if(!p){ $qs('#'+EXT+'-ai-out').textContent='Type a prompt.'; return; } $qs('#'+EXT+'-ai-out').textContent = 'Thinking...'; try{ $qs('#'+EXT+'-ai-out').textContent = runLocalAi(p); }catch(e){ $qs('#'+EXT+'-ai-out').textContent = 'Error: '+(e.message||e); reportError(e); } }); },0);
    return wrap;
  }

  function timersToolImpl(){
    const wrap = $create('div', { class:'mt-section', html: `<div><strong>Timers</strong></div><div class="mt-row" style="margin-top:6px"><input id="${EXT}-timer-name" class="mt-input" placeholder="Timer ID (optional)"><select id="${EXT}-timer-mode" class="mt-select"><option value="stopwatch">Stopwatch</option><option value="timer">Timer</option></select><input id="${EXT}-timer-seconds" class="mt-input" placeholder="Seconds (for timer)"><button id="${EXT}-timer-make" class="mt-btn">Create</button></div><div id="${EXT}-timer-list" style="margin-top:8px"></div>`});
    setTimeout(()=>{ $qs('#'+EXT+'-timer-make').addEventListener('click', ()=>{ const id = $qs('#'+EXT+'-timer-name').value.trim() || ('T'+Date.now().toString().slice(-4)); const mode = $qs('#'+EXT+'-timer-mode').value; const secs = Number($qs('#'+EXT+'-timer-seconds').value) || 0; createTimer({ id, mode, seconds: secs }); renderTimerList(); }); renderTimerList(); },0);
    return wrap;
  }

  function inspectorToolImpl(){
    const wrap = $create('div', { class:'mt-section', html: `<div><strong>Variable Inspector</strong></div><div class="mt-row" style="margin-top:6px"><input id="${EXT}-var-filter" class="mt-input" placeholder="Filter variable name (e.g., project)"><button id="${EXT}-var-scan" class="mt-btn">Scan</button></div><div id="${EXT}-var-list" style="margin-top:8px"></div>`});
    setTimeout(()=>{ $qs('#'+EXT+'-var-scan').addEventListener('click', ()=>{ const f = $qs('#'+EXT+'-var-filter').value.trim().toLowerCase(); const res = scanRuntime(f); const list = $qs('#'+EXT+'-var-list'); list.innerHTML = ''; if(!res.length) list.innerHTML = `<div class="small">No variables found matching "${escapeHtml(f)}".</div>`; res.forEach(r=>{ const row = $create('div', { html: `<code>${escapeHtml(r.name)}</code> — <span class="small">${escapeHtml(r.type)}</span> — <span class="small">${escapeHtml(r.preview)}</span>`}); const edit = $create('button', { class:'mt-ghost', text: 'Edit' }); edit.addEventListener('click', ()=> openVarEditor(r)); row.appendChild(edit); list.appendChild(row); }); }); },0);
    return wrap;
  }

  function blocksToolImpl(){
    const wrap = $create('div', { class:'mt-section', html: `<div><strong>Blocks</strong></div><div class="mt-row" style="margin-top:6px"><input id="${EXT}-block-name" class="mt-input" placeholder="Block Timer ID"><select id="${EXT}-block-mode" class="mt-select"><option value="stopwatch">Stopwatch</option><option value="timer">Timer</option></select><input id="${EXT}-block-time" class="mt-input" placeholder="Seconds (for timer)"><button id="${EXT}-block-create" class="mt-btn">Create Block</button></div>`});
    setTimeout(()=>{ $qs('#'+EXT+'-block-create').addEventListener('click', ()=>{ const id = $qs('#'+EXT+'-block-name').value.trim() || ('B'+Date.now().toString().slice(-4)); const mode = $qs('#'+EXT+'-block-mode').value; const seconds = Number($qs('#'+EXT+'-block-time').value) || 0; makeBlock({ id, mode, seconds }); }); },0);
    return wrap;
  }

  // scan runtime (same as earlier)
  function scanRuntime(filter){
    const candidates = ['project','IDE','cocrea','app','runtime','Cocrea'];
    const out = []; const seen = new Set();
    const f = (filter||'').toLowerCase();
    function push(name,val){ if(seen.has(name)) return; seen.add(name); let type = typeof val; let preview=''; try{ if(val===null) type='null'; else if(type==='object') preview = JSON.stringify(Object.keys(val).slice(0,6)); else preview = String(val).slice(0,120); }catch(e){ preview='[unreadable]'; } if(!f || name.toLowerCase().includes(f)) out.push({ name, type, preview, value: val }); }
    for(const n of candidates){ try{ if(window[n]) Object.keys(window[n]).forEach(k=> push(n + '.' + k, window[n][k])); }catch(e){} }
    try{ const keys = Object.keys(window).slice(0,500); for(const k of keys){ if(k.toLowerCase().includes('project')||k.toLowerCase().includes('sprite')||k.toLowerCase().includes('stage')||k.toLowerCase().includes('cocrea')) try{ push(k, window[k]); }catch(e){} } for(const k of keys){ try{ push(k, window[k]); }catch(e){} } }catch(e){}
    return out.sort((a,b)=> a.name.localeCompare(b.name));
  }

  function openVarEditor(entry){
    const w = window.open('', '_blank', 'width=720,height=520'); if(!w) return alert('Allow popups to edit variables.');
    w.document.title = 'Edit: ' + entry.name;
    const ta = w.document.createElement('textarea'); ta.style.width='100%'; ta.style.height='72%';
    try{ ta.value = JSON.stringify(entry.value, null, 2); }catch(e){ ta.value = String(entry.value); }
    const btn = w.document.createElement('button'); btn.textContent = 'Apply'; btn.className = 'mt-btn';
    btn.addEventListener('click', ()=>{
      try{
        const parsed = JSON.parse(ta.value);
        const parts = entry.name.split('.');
        if(parts.length === 1) window[parts[0]] = parsed;
        else {
          let obj = window;
          for(let i=0;i<parts.length-1;i++){ obj = obj[parts[i]]; if(obj === undefined) throw new Error('Parent not found'); }
          obj[parts[parts.length-1]] = parsed;
        }
        alert('Applied.');
      }catch(err){ alert('Failed: ' + (err.message||err)); }
    });
    w.document.body.appendChild(ta); w.document.body.appendChild(btn);
  }

  // boot
  setTimeout(()=>{ try{ buildPanel(); log('MultiTool ready'); }catch(e){ reportError(e); } }, 200);

  // expose simple API for debugging
  window.CocreaMultiTool = { createTimer, startTimer, stopTimer, resetTimer, makeBlock, runLocalAi };
})();
