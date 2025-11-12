/*
Cocrea / Gandi IDE - Multitool Extension
Filename: cocrea-multitool-extension.js
Purpose: lightweight, modular multitool extension with togglable tools:
  - AI Tools (stub + local-api hooks + endpoint input)
  - Time Tools (multi-format, multi-timer)
  - Variable Inspector (fixed scan + editor)
  - Pop-out windows for stage/sprites/code (modal selector)
  - Blocks that replicate tool actions as draggable UI blocks
  - Draggable & collapsible windows
  - Settings UI retained (user-request)
  - Fatal error modal + non-fatal log pane

How to use:
  1. Drop this file into your IDE extensions folder or include via a <script> tag in the IDE environment.
  2. Call `CocreaMultiToolExtension.init({ /* options */ })` from the platform bootstrap or console.

Notes:
  - This file preserves the prompts/settings UI (per your last message).
  - The AI tool keeps stub mode and local-api mode; the UI now includes inputs for endpoint & auth so missing endpoint won't throw a confusing error.
  - Everything stays zero-dependency and single-file.

--- Sections ---
1) Boilerplate & integration
2) UI creation & styling (draggable + collapsible)
3) Module toggles & settings
4) AI tool (UI includes endpoint + auth input; safer local-api handling)
5) Time tool (Start/Stop/Reset visible + cleaner UI)
6) Variable inspector (case-insensitive scan fixed)
7) Pop-out implementation (modal with clickable options)
8) Blocks implementation (draggable blocks + reporter output)
9) Error handling & logging
10) API / BOOTSTRAP

*/

(function globalScope(root){
  if (!root) return;

  const EXT_ID = 'cocrea-multitool';
  const STORAGE_KEY = EXT_ID + ':settings:v1';

  // Default settings (kept; user requested no removal)
  const defaultSettings = {
    enabledTools: {
      ai: true,
      timers: true,
      inspector: true,
      blocks: true
    },
    ai: {
      // Mode: 'stub' (no model), 'local-api', 'webworker'
      mode: 'stub',
      localApiEndpoint: '',
      localApiAuth: '',
      reasoningDepth: 2
    },
    timers: {
      defaultFormat: 'hh:mm:ss',
      maxTimers: 50
    },
    ui: {
      position: { right: '8px', top: '8px' },
      collapsed: false
    }
  };

  // Integration hooks
  const integration = {
    selectors: {
      stage: '#stage',
      spritesPanel: '#sprites',
      codeArea: '#code'
    },
    saveSettings: async (settings) => { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); },
    loadSettings: async () => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch(e){ return null; } },
    log: (...args) => console.log('[Multitool]', ...args),
    reportError: async (errInfo) => { console.error('[Multitool:Report]', errInfo); }
  };

  const state = {
    settings: JSON.parse(JSON.stringify(defaultSettings)),
    timers: {},
    logs: [],
    isInitialized: false,
    openPopouts: {},
    blocks: []
  };

  /* =========================
     Helpers
     ========================= */
  function escapeHtml(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function mergeDeep(a,b){ for(const k in b){ if(typeof b[k]==='object' && b[k] && !Array.isArray(b[k])){ a[k]=a[k]||{}; mergeDeep(a[k],b[k]); } else a[k]=b[k]; } return a; }

  /* =========================
     Styling + draggable/collapsible support
     ========================= */
  function createStyles(){
    const prev = document.getElementById(EXT_ID+'-styles'); if (prev) prev.remove();
    const style = document.createElement('style'); style.id = EXT_ID+'-styles';
    style.innerText = `
      .multitool-panel{position:fixed;right:${state.settings.ui.position.right};top:${state.settings.ui.position.top};width:360px;max-width:46vw;background:rgba(18,18,20,0.96);color:#e6e6e6;border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,.6);font-family:Inter,ui-sans-serif,system-ui,Arial;z-index:2147483646}
      .mt-header{display:flex;align-items:center;justify-content:space-between;padding:8px;cursor:move}
      .mt-title{font-weight:700}
      .mt-btn{background:transparent;border:0;color:inherit;padding:6px;cursor:pointer;border-radius:6px}
      .mt-body{padding:8px;max-height:60vh;overflow:auto}
      .mt-section{margin-bottom:10px}
      .mt-section label{display:block;margin:4px 0}
      .mt-primary{background:#2b6cb0;border:0;color:white;padding:8px 10px;border-radius:6px;cursor:pointer}
      .mt-logs{background:rgba(255,255,255,0.03);padding:8px;border-radius:6px;font-size:12px;max-height:120px;overflow:auto}
      .timer-row{display:flex;gap:6px;align-items:center;margin-bottom:6px}
      .timer-row input{flex:1}
      /* collapsible */
      .mt-collapsed .mt-body{display:none}
      /* Draggable blocks */
      .mt-block{position:fixed;left:40px;top:80px;background:#161616;color:#fff;padding:8px;border-radius:8px;box-shadow:0 8px 20px rgba(0,0,0,0.5);cursor:grab;z-index:2147483645}
      .mt-block .mt-block-header{font-weight:700;margin-bottom:6px}
      .mt-reporter{background:rgba(255,255,255,0.02);padding:6px;border-radius:6px;margin-top:6px;min-width:120px}
      .mt-small{font-size:13px}
    `;
    document.head.appendChild(style);
  }

  function makeElementDraggable(el, handle){
    handle = handle || el;
    let dragging = false; let startX=0, startY=0, origX=0, origY=0;
    function down(e){ dragging=true; startX = e.clientX; startY = e.clientY; const rect = el.getBoundingClientRect(); origX = rect.left; origY = rect.top; document.addEventListener('mousemove', move); document.addEventListener('mouseup', up); e.preventDefault(); }
    function move(e){ if(!dragging) return; const dx = e.clientX - startX; const dy = e.clientY - startY; el.style.left = (origX + dx) + 'px'; el.style.top = (origY + dy) + 'px'; }
    function up(){ dragging=false; document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); }
    handle.addEventListener('mousedown', down);
    // touch support
    handle.addEventListener('touchstart', (ev)=>{ const t = ev.touches[0]; dragging=true; startX=t.clientX; startY=t.clientY; const rect=el.getBoundingClientRect(); origX=rect.left; origY=rect.top; document.addEventListener('touchmove', touchMove); document.addEventListener('touchend', touchEnd); ev.preventDefault(); });
    function touchMove(ev){ if(!dragging) return; const t = ev.touches[0]; const dx = t.clientX - startX; const dy = t.clientY - startY; el.style.left = (origX + dx) + 'px'; el.style.top = (origY + dy) + 'px'; }
    function touchEnd(){ dragging=false; document.removeEventListener('touchmove', touchMove); document.removeEventListener('touchend', touchEnd); }
  }

  /* =========================
     UI CREATION
     ========================= */
  function createUI(){
    // main panel
    const old = document.getElementById(EXT_ID+'-panel'); if (old) old.remove();
    const panel = document.createElement('div'); panel.id = EXT_ID + '-panel'; panel.className = 'multitool-panel';
    if (state.settings.ui.collapsed) panel.classList.add('mt-collapsed');

    panel.innerHTML = `
      <div class="mt-header">
        <div style="display:flex;gap:8px;align-items:center"><div class="mt-title">MultiTool</div></div>
        <div>
          <button id="mt-collapse" class="mt-btn">▾</button>
          <button id="mt-open-main" class="mt-btn">Open</button>
        </div>
      </div>
      <div class="mt-body">
        <div class="mt-section">
          <label><input type="checkbox" data-tool="ai"> AI Tools</label>
          <label><input type="checkbox" data-tool="timers"> Time Tools</label>
          <label><input type="checkbox" data-tool="inspector"> Variable Inspector</label>
          <label><input type="checkbox" data-tool="blocks"> Blocks</label>
        </div>
        <div class="mt-section" id="mt-tool-area"></div>
        <div class="mt-section">
          <button id="mt-popout-btn" class="mt-primary">Pop-out Stage/Sprites/Code</button>
          <button id="mt-new-block" class="mt-primary">Create Block</button>
        </div>
        <div class="mt-section mt-logs" id="mt-logs"></div>
      </div>
    `;

    document.body.appendChild(panel);

    // wire collapse and drag
    const header = panel.querySelector('.mt-header');
    const collapseBtn = panel.querySelector('#mt-collapse');
    collapseBtn.addEventListener('click', ()=>{ panel.classList.toggle('mt-collapsed'); state.settings.ui.collapsed = panel.classList.contains('mt-collapsed'); integration.saveSettings(state.settings); });
    makeElementDraggable(panel, header);

    panel.querySelector('#mt-open-main').addEventListener('click', openMainInterface);
    panel.querySelector('#mt-popout-btn').addEventListener('click', openPopoutDialog);
    panel.querySelector('#mt-new-block').addEventListener('click', ()=>{ createBlock(); });

    // wire tool checkboxes
    const checkboxes = panel.querySelectorAll('input[type=checkbox][data-tool]');
    checkboxes.forEach(cb =>{
      const tool = cb.getAttribute('data-tool'); cb.checked = !!state.settings.enabledTools[tool];
      cb.addEventListener('change', (e)=>{ state.settings.enabledTools[tool] = e.target.checked; integration.saveSettings(state.settings); renderToolArea(); });
    });

    return panel;
  }

  function renderToolArea(){
    const area = document.getElementById('mt-tool-area'); if (!area) return; area.innerHTML = '';
    if (state.settings.enabledTools.ai) area.appendChild(renderAiTool());
    if (state.settings.enabledTools.timers) area.appendChild(renderTimersTool());
    if (state.settings.enabledTools.inspector) area.appendChild(renderInspectorTool());
    if (state.settings.enabledTools.blocks) area.appendChild(renderBlocksTool());
  }

  /* =========================
     4) AI TOOL (UI + safer local-api handling)
     ========================= */
  function renderAiTool(){
    const wrap = document.createElement('div'); wrap.className = 'mt-ai-tool';
    wrap.innerHTML = `
      <div><strong>AI Tools</strong></div>
      <div style="margin-top:6px">
        <textarea id="mt-ai-prompt" placeholder="Ask something..." style="width:100%;height:80px"></textarea>
        <div style="display:flex;gap:8px;margin-top:6px;align-items:center">
          <button id="mt-ai-run" class="mt-primary">Run</button>
          <select id="mt-ai-mode">
            <option value="stub">Stub (demo)</option>
            <option value="local-api">Local API</option>
            <option value="webworker">WebWorker</option>
          </select>
        </div>
        <div style="display:flex;gap:6px;margin-top:6px;align-items:center">
          <input id="mt-ai-endpoint" placeholder="Local API endpoint (optional)" style="flex:1"/>
          <input id="mt-ai-auth" placeholder="Auth token (optional)" style="width:180px"/>
        </div>
        <pre id="mt-ai-output" style="white-space:pre-wrap;margin-top:8px;background:rgba(255,255,255,0.03);padding:8px;border-radius:6px;min-height:60px"></pre>
      </div>
    `;

    setTimeout(()=>{
      const runBtn = wrap.querySelector('#mt-ai-run');
      const modeSel = wrap.querySelector('#mt-ai-mode');
      const prompt = wrap.querySelector('#mt-ai-prompt');
      const out = wrap.querySelector('#mt-ai-output');
      const endpointInput = wrap.querySelector('#mt-ai-endpoint');
      const authInput = wrap.querySelector('#mt-ai-auth');

      // populate from saved settings if present
      modeSel.value = state.settings.ai.mode || 'stub';
      endpointInput.value = state.settings.ai.localApiEndpoint || '';
      authInput.value = state.settings.ai.localApiAuth || '';

      modeSel.addEventListener('change', ()=>{ state.settings.ai.mode = modeSel.value; integration.saveSettings(state.settings); });
      endpointInput.addEventListener('change', ()=>{ state.settings.ai.localApiEndpoint = endpointInput.value; integration.saveSettings(state.settings); });
      authInput.addEventListener('change', ()=>{ state.settings.ai.localApiAuth = authInput.value; integration.saveSettings(state.settings); });

      runBtn.addEventListener('click', async ()=>{
        const q = prompt.value.trim();
        if (!q){ out.textContent = 'Please enter a prompt.'; return; }
        out.textContent = 'Running...';
        try{
          const resp = await runAiQuery(q, { mode: state.settings.ai.mode, localApiEndpoint: endpointInput.value, localApiAuth: authInput.value });
          out.textContent = resp;
        }catch(err){
          out.textContent = 'Error: ' + (err.message||err);
          reportNonFatal(err);
        }
      });
    },0);

    return wrap;
  }

  async function runAiQuery(prompt, opts={}){
    if (!prompt) return 'No prompt provided.';
    opts = Object.assign({}, state.settings.ai, opts);

    if (opts.mode === 'stub'){
      // Enhanced stub: small KB + heuristic chaining
      const steps = [];
      steps.push('Input: ' + prompt);
      steps.push('Step 1: tokenize and identify patterns');
      // tiny KB
      const kb = [
        {k:'timer', v:'Timers support formats hh:mm:ss, hh:mm:ss.ms, mm:ss, seconds.'},
        {k:'variable', v:'Variables are available on the window or project namespace.'},
        {k:'popout', v:'You can pop out stage/sprites/code via the pop-out button.'}
      ];
      const q = prompt.toLowerCase();
      kb.forEach(entry=>{ if (q.includes(entry.k)) steps.push('Fact: '+entry.v); });
      steps.push('Step 2: Apply heuristic rules');
      if (q.includes('timer')||q.includes('time')){ steps.push('Answer: Use ' + state.settings.timers.defaultFormat + ' for display.'); return steps.join('
'); }
      steps.push('Answer (stub): I can help design logic; provide a concrete question or attach a local model endpoint for deeper answers.');
      return steps.join('
');
    }

    if (opts.mode === 'local-api'){
      const endpoint = opts.localApiEndpoint || state.settings.ai.localApiEndpoint;
      const auth = opts.localApiAuth || state.settings.ai.localApiAuth || '';
      if (!endpoint) throw new Error('No endpoint set in AI settings. Enter an endpoint in the AI UI field.');
      // call endpoint (try JSON with {prompt})
      const headers = {'Content-Type':'application/json'}; if (auth) headers['Authorization'] = auth;
      const r = await fetch(endpoint, { method:'POST', headers, body: JSON.stringify({ prompt }) });
      if (!r.ok) throw new Error('API error: ' + r.status + ' ' + r.statusText);
      const ct = r.headers.get('content-type') || '';
      if (ct.includes('application/json')){
        const j = await r.json(); return (j.text || j.result || JSON.stringify(j));
      }
      return await r.text();
    }

    if (opts.mode === 'webworker'){
      return await runWorkerPrompt(prompt, opts.reasoningDepth);
    }

    throw new Error('Unknown AI mode: ' + opts.mode);
  }

  function runWorkerPrompt(prompt, depth){
    return new Promise((resolve)=>{ setTimeout(()=>resolve('Worker Response (simulated): ' + prompt.slice(0,200)), 300 + Math.random()*500); });
  }

  /* =========================
     5) TIME TOOL (timers updated)
     ========================= */
  function renderTimersTool(){
    const wrap = document.createElement('div'); wrap.className = 'mt-timers-tool';
    wrap.innerHTML = `
      <div><strong>Time Tools</strong></div>
      <div style="margin-top:6px">
        <div style="display:flex;gap:6px;margin-bottom:6px">
          <input id="mt-timer-name" placeholder="Timer name" />
          <select id="mt-timer-format">
            <option value="hh:mm:ss">hh:mm:ss</option>
            <option value="hh:mm:ss.ms">hh:mm:ss.ms</option>
            <option value="mm:ss">mm:ss</option>
            <option value="seconds">seconds</option>
          </select>
          <button id="mt-create-timer" class="mt-primary">Create</button>
        </div>
        <div id="mt-timer-list"></div>
      </div>
    `;

    setTimeout(()=>{
      const list = wrap.querySelector('#mt-timer-list');
      const createBtn = wrap.querySelector('#mt-create-timer');
      const nameInput = wrap.querySelector('#mt-timer-name');
      const formatSel = wrap.querySelector('#mt-timer-format');

      createBtn.addEventListener('click', ()=>{
        const name = nameInput.value || ('Timer ' + (Object.keys(state.timers).length+1));
        const fmt = formatSel.value;
        const id = createTimer({name, format:fmt});
        renderTimerList(list);
      });

      renderTimerList(list);
    },0);

    return wrap;
  }

  function createTimer(opts={}){
    const id = 't_' + Date.now() + '_' + Math.floor(Math.random()*9999);
    state.timers[id] = { id, name: opts.name || id, format: opts.format || state.settings.timers.defaultFormat, running:false, startAt:null, elapsed:0, _last: null };
    return id;
  }

  function startTimer(id){ const t = state.timers[id]; if(!t) return; if (t.running) return; t.running = true; t._last = performance.now(); t._tick = function(){ if(!t.running) return; const now = performance.now(); t.elapsed += (now - t._last); t._last = now; dispatchTimerUpdate(id); t._raf = requestAnimationFrame(t._tick); }; t._raf = requestAnimationFrame(t._tick); }
  function stopTimer(id){ const t = state.timers[id]; if(!t) return; t.running = false; if (t._raf) cancelAnimationFrame(t._raf); t._raf = null; dispatchTimerUpdate(id); }
  function resetTimer(id){ const t = state.timers[id]; if(!t) return; t.running = false; t.elapsed = 0; t._last = null; if (t._raf) cancelAnimationFrame(t._raf); t._raf = null; dispatchTimerUpdate(id); }

  function formatElapsed(ms, fmt){ const total = Math.floor(ms); const hours = Math.floor(total/3600000); const minutes = Math.floor((total%3600000)/60000); const seconds = Math.floor((total%60000)/1000); const msRem = Math.floor(total%1000); function pad(v,d=2){ return String(v).padStart(d,'0'); } if (fmt==='seconds') return (total/1000).toFixed(3)+'s'; if (fmt==='mm:ss') return pad(minutes)+':'+pad(seconds); if (fmt==='hh:mm:ss') return pad(hours)+':'+pad(minutes)+':'+pad(seconds); return pad(hours)+':'+pad(minutes)+':'+pad(seconds)+'.'+String(msRem).padStart(3,'0'); }

  function dispatchTimerUpdate(id){ const ev = new CustomEvent('multitool:timer:update', {detail:{id, timer:state.timers[id]}}); window.dispatchEvent(ev); }

  function renderTimerList(container){
    container.innerHTML = '';
    Object.values(state.timers).forEach(t=>{
      const row = document.createElement('div'); row.className='timer-row';
      const inp = document.createElement('input'); inp.value = t.name; inp.addEventListener('change', (e)=>{t.name=e.target.value});
      const disp = document.createElement('div'); disp.textContent = formatElapsed(t.elapsed||0,t.format); disp.style.minWidth='120px';
      const play = document.createElement('button'); play.textContent = t.running? 'Stop' : 'Start'; play.addEventListener('click', ()=>{ if (t.running) stopTimer(t.id); else startTimer(t.id); renderTimerList(container); } );
      const lapb = document.createElement('button'); lapb.textContent='Lap'; lapb.addEventListener('click', ()=>{ /* lap logic: emit a console log */ console.log('Lap for', t.id, formatElapsed(t.elapsed||0,t.format)); });
      const reset = document.createElement('button'); reset.textContent='Reset'; reset.addEventListener('click', ()=>{ resetTimer(t.id); renderTimerList(container); });

      const updateFn = ()=>{ disp.textContent = formatElapsed(t.elapsed||0,t.format); play.textContent = t.running? 'Stop' : 'Start'; };
      window.addEventListener('multitool:timer:update', (ev)=>{ if (ev.detail.id===t.id) updateFn(); });

      row.appendChild(inp); row.appendChild(disp); row.appendChild(play); row.appendChild(lapb); row.appendChild(reset);
      container.appendChild(row);
    });
  }

  /* =========================
     6) VARIABLE INSPECTOR (fixed scanning)
     ========================= */
  function renderInspectorTool(){
    const wrap = document.createElement('div'); wrap.className='mt-inspector-tool';
    wrap.innerHTML = `
      <div><strong>Variable Inspector</strong></div>
      <div style="margin-top:6px">
        <div style="display:flex;gap:6px;margin-bottom:6px">
          <input id="mt-var-filter" placeholder="Filter variable name" />
          <button id="mt-scan-vars" class="mt-primary">Scan</button>
        </div>
        <div id="mt-vars-list" style="font-size:13px;max-height:200px;overflow:auto;background:rgba(255,255,255,0.02);padding:6px;border-radius:6px"></div>
      </div>
    `;

    setTimeout(()=>{
      const scanBtn = wrap.querySelector('#mt-scan-vars');
      const filter = wrap.querySelector('#mt-var-filter');
      const list = wrap.querySelector('#mt-vars-list');
      scanBtn.addEventListener('click', ()=>{
        const results = scanGlobals(filter.value||'');
        list.innerHTML = '';
        if (!results.length) list.innerHTML = '<div class="mt-small">No variables matched the filter.</div>';
        results.forEach(r=>{
          const item = document.createElement('div');
          item.style.marginBottom = '6px';
          const preview = escapeHtml(r.preview);
          item.innerHTML = `<code>${escapeHtml(r.name)}</code> — <em>${escapeHtml(r.type)}</em> — ${preview}`;
          const editBtn = document.createElement('button'); editBtn.textContent='Edit'; editBtn.style.marginLeft='6px';
          editBtn.addEventListener('click', ()=>{ openVariableEditor(r.name, r.value); });
          item.appendChild(editBtn);
          list.appendChild(item);
        });
      });
    },0);

    return wrap;
  }

  function scanGlobals(filter){
    const out = []; const seen = new Set();
    const f = String(filter||'').toLowerCase();
    function pushKey(k, v){ if (seen.has(k)) return; seen.add(k); if (f && !k.toLowerCase().includes(f)) return; let type = typeof v; let preview = ''; try{ if (v === null) type='null'; else if (type==='object') preview = JSON.stringify(Object.keys(v).slice(0,5)); else preview = String(v).slice(0,120); }catch(e){ preview='[unpreviewable]'; } out.push({name:k,type,preview,value:v}); }
    const candidates = ['project','IDE','cocrea','app'];
    candidates.forEach(n=>{ if (window[n]){ Object.keys(window[n]).forEach(k=> pushKey(n+'.'+k, window[n][k])); } });
    // fallback - sample selected keys from window
    const keys = Object.keys(window).slice(0,800);
    keys.forEach(k=> pushKey(k, window[k]));
    return out.sort((a,b)=>a.name.localeCompare(b.name));
  }

  function openVariableEditor(name, currentValue){
    const w = window.open('', '_blank', 'width=640,height=480');
    if (!w) return alert('Unable to open editor (popups blocked)');
    w.document.title = 'Variable Editor - ' + name;
    const ta = w.document.createElement('textarea'); ta.style.width='100%'; ta.style.height='70%';
    try { ta.value = JSON.stringify(currentValue, null, 2); } catch(e){ ta.value = String(currentValue); }
    const btn = w.document.createElement('button'); btn.textContent='Apply'; btn.addEventListener('click', ()=>{
      try{
        const parsed = JSON.parse(ta.value);
        const parts = name.split('.'); let obj = window; for(let i=0;i<parts.length-1;i++){ obj = obj[parts[i]]; if (!obj) throw new Error('Parent not found'); }
        obj[parts[parts.length-1]] = parsed; alert('Applied');
      }catch(err){ alert('Failed to apply: '+err.message); }
    });
    w.document.body.appendChild(ta); w.document.body.appendChild(btn);
  }

  /* =========================
     7) POPOUT IMPLEMENTATION (modal + options)
     ========================= */
  function openPopoutDialog(){
    // modal selection (no prompt) with default options
    const modal = document.createElement('div'); modal.style.position='fixed'; modal.style.inset='0'; modal.style.background='rgba(0,0,0,0.45)'; modal.style.display='flex'; modal.style.alignItems='center'; modal.style.justifyContent='center'; modal.style.zIndex='100000';
    const box = document.createElement('div'); box.style.background='#fff'; box.style.padding='12px'; box.style.borderRadius='8px'; box.style.minWidth='320px';
    box.innerHTML = `<h3 style='margin:0 0 8px 0'>Pop-out</h3><div style='display:flex;gap:8px;margin-bottom:8px'><button id='mt-popout-stage'>Stage</button><button id='mt-popout-sprites'>Sprites</button><button id='mt-popout-code'>Code</button></div><div style='margin-bottom:8px'><input id='mt-popout-custom' placeholder='Or enter selector (e.g. .my-stage)' style='width:100%'/></div><div style='text-align:right'><button id='mt-popout-cancel'>Cancel</button></div>`;
    modal.appendChild(box); document.body.appendChild(modal);

    box.querySelector('#mt-popout-cancel').addEventListener('click', ()=> modal.remove());
    box.querySelector('#mt-popout-stage').addEventListener('click', ()=>{ modal.remove(); doPopout(integration.selectors.stage, 'stage'); });
    box.querySelector('#mt-popout-sprites').addEventListener('click', ()=>{ modal.remove(); doPopout(integration.selectors.spritesPanel, 'sprites'); });
    box.querySelector('#mt-popout-code').addEventListener('click', ()=>{ modal.remove(); doPopout(integration.selectors.codeArea, 'code'); });
    box.querySelector('#mt-popout-custom').addEventListener('keydown', (e)=>{ if (e.key === 'Enter'){ const val = e.target.value.trim(); if (!val) return; modal.remove(); doPopout(val, val); } });
  }

  function doPopout(selector, name){
    const el = document.querySelector(selector);
    if (!el) return alert('Element not found for selector: ' + selector);
    return popoutElement(el, name);
  }

  function popoutElement(element, name){
    try{
      const w = window.open('', '_blank', 'width=1000,height=700');
      if (!w) return alert('Popout blocked by browser.');
      w.document.title = 'Popout - ' + name;
      const clone = element.cloneNode(true);
      w.document.body.style.margin='0'; w.document.body.appendChild(clone);
      state.openPopouts[name || ('popout_'+Date.now())] = {win:w, selector: element};
      const interval = setInterval(()=>{ if (w.closed){ clearInterval(interval); delete state.openPopouts[name]; } }, 800);
      return w;
    }catch(err){ reportNonFatal(err); }
  }

  /* =========================
     8) BLOCKS (draggable blocks & reporters)
     ========================= */
  function renderBlocksTool(){
    const wrap = document.createElement('div'); wrap.className='mt-blocks-tool';
    wrap.innerHTML = `
      <div><strong>Blocks</strong></div>
      <div style='margin-top:6px'>
        <div style='display:flex;gap:6px;margin-bottom:6px'><input id='mt-block-timer-name' placeholder='Block timer name' /><button id='mt-block-create' class='mt-primary'>Create Timer Block</button></div>
        <div class='mt-small'>Drag created blocks to move them. Blocks can create timers and show reporters.</div>
      </div>
    `;

    setTimeout(()=>{
      const createBtn = wrap.querySelector('#mt-block-create');
      const nameInput = wrap.querySelector('#mt-block-timer-name');
      createBtn.addEventListener('click', ()=>{ createBlock({ timerName: nameInput.value || ('BlockTimer'+(Object.keys(state.timers).length+1)) }); });
    },0);

    return wrap;
  }

  function createBlock(opts={}){
    const block = document.createElement('div'); block.className='mt-block'; block.style.left = '40px'; block.style.top = (80 + state.blocks.length*60) + 'px';
    block.innerHTML = `<div class='mt-block-header'>Timer Block</div><div>Creates timer: <strong>${escapeHtml(opts.timerName||'Timer')}</strong></div><div style='display:flex;gap:6px;margin-top:8px'><button class='mt-block-start'>Start</button><button class='mt-block-stop'>Stop</button><button class='mt-block-reset'>Reset</button></div><div class='mt-reporter' data-timer=''></div>`;
    document.body.appendChild(block);
    // make draggable
    makeElementDraggable(block, block.querySelector('.mt-block-header'));

    // create underlying timer
    const id = createTimer({ name: opts.timerName || ('BlockTimer'+(Object.keys(state.timers).length+1)), format: state.settings.timers.defaultFormat });
    const reporter = block.querySelector('.mt-reporter'); reporter.textContent = formatElapsed(state.timers[id].elapsed||0, state.timers[id].format);
    reporter.setAttribute('data-timer', id);

    block.querySelector('.mt-block-start').addEventListener('click', ()=>{ startTimer(id); });
    block.querySelector('.mt-block-stop').addEventListener('click', ()=>{ stopTimer(id); });
    block.querySelector('.mt-block-reset').addEventListener('click', ()=>{ resetTimer(id); reporter.textContent = formatElapsed(0, state.timers[id].format); });

    // update reporter on tick
    window.addEventListener('multitool:timer:update', (ev)=>{ if (ev.detail.id === id) reporter.textContent = formatElapsed(ev.detail.timer.elapsed||0, ev.detail.timer.format); });

    state.blocks.push({ el: block, timerId: id });
    return block;
  }

  /* =========================
     9) ERROR HANDLING & LOGS
     ========================= */
  function reportFatal(err){ try{ const info = {time:new Date().toISOString(), message:err.message||String(err), stack:err.stack||null}; state.logs.push({level:'fatal',info}); integration.reportError(info); showFatalModal(info); }catch(e){ console.error(e); } }
  function reportNonFatal(err){ try{ const info={time:new Date().toISOString(),message:err.message||String(err),stack:err.stack||null}; state.logs.push({level:'warn',info}); renderLogs(); }catch(e){ console.error(e); } }

  function showFatalModal(info){
    const modal = document.createElement('div'); modal.className='mt-fatal-modal';
    modal.innerHTML = `
      <div style="position:fixed;inset:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:100000">
        <div style="background:white;color:black;padding:16px;border-radius:8px;max-width:900px;min-width:320px">
          <h3>Fatal Error</h3>
          <pre style="white-space:pre-wrap;max-height:300px;overflow:auto">${escapeHtml(JSON.stringify(info, null, 2))}</pre>
          <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px">
            <button id="mt-fatal-copy">Copy</button>
            <button id="mt-fatal-close">Close</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    modal.querySelector('#mt-fatal-copy').addEventListener('click', ()=>{ navigator.clipboard.writeText(JSON.stringify(info, null, 2)); });
    modal.querySelector('#mt-fatal-close').addEventListener('click', ()=>{ modal.remove(); });
  }

  function renderLogs(){ const logsArea = document.getElementById('mt-logs'); if (!logsArea) return; logsArea.innerHTML = state.logs.slice(-50).map(l=>`<div><strong>${l.level}</strong> ${l.info.time} - ${escapeHtml(l.info.message||'')}</div>`).join(''); }

  /* =========================
     10) BOOTSTRAP
     ========================= */
  async function init(userIntegration){
    if (state.isInitialized) return;
    if (userIntegration) Object.assign(integration, userIntegration);
    // load saved settings
    const saved = await integration.loadSettings(); if (saved) mergeDeep(state.settings, saved);
    createStyles();
    const panel = createUI();
    renderToolArea();
    renderLogs();
    state.isInitialized = true;
    integration.log('Multitool initialized');

    window.addEventListener('error', (ev)=>{ reportFatal(ev.error || {message: ev.message}); });
    window.addEventListener('unhandledrejection', (ev)=>{ reportFatal(ev.reason || {message:'Unhandled rejection'}); });
  }

  // Expose API
  root.CocreaMultiToolExtension = { init, getState: ()=>state, runAiQuery, createTimer, startTimer, stopTimer, resetTimer, popoutElement, createBlock, integration };

})(window);

/* =========================
   End of file
   ========================= */
