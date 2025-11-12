/* Cocrea / Gandi IDE - Multitool Extension (single-file, no deps)
   - Auto-starts (tools OFF)
   - Local-only settings (localStorage)
   - AI: compact local reasoning stub + hooks for local API
   - Timers: default hh:mm:ss, multiple timers
   - Variable inspector: view + edit JSON
   - Pop-out: clone to new window
   - Fatal modal with Copy
   - Image for buttons via <img id="mt-attached-image"> or localStorage key
*/
(function(root){
  if(!root) return;
  const EXT_ID = 'cocrea-multitool';
  const STORAGE_KEY = EXT_ID + ':settings:v2';

  // default settings (tools OFF by default)
  const defaultSettings = {
    enabledTools: { ai:false, timers:false, inspector:false },
    ai: { mode:'local-stub', reasoningDepth:3, customModelEndpoint:'' },
    timers: { defaultFormat:'hh:mm:ss', maxTimers:100 },
    ui: { position:{ right:'8px', top:'8px' }, useAttachedImageForButtons:true },
    startup: { showMenuOnLoad:true, autoInit:true }
  };

  // integration hooks (override with init())
  const integration = {
    selectors: { stage:'#stage', spritesPanel:'#sprites', codeArea:'#code' },
    log: (...a)=>console.log('[Multitool]',...a),
    saveSettings: async s=>localStorage.setItem(STORAGE_KEY, JSON.stringify(s)),
    loadSettings: async ()=>{ try{ return JSON.parse(localStorage.getItem(STORAGE_KEY)); }catch(e){ return null; } },
    reportError: async info=>console.error('[Multitool Report]', info)
  };

  const state = { settings: JSON.parse(JSON.stringify(defaultSettings)), timers:{}, logs:[], initialized:false, popouts:{} };

  // small helpers
  function mergeDeep(a,b){ for(const k in b){ if(typeof b[k]==='object' && b[k] && !Array.isArray(b[k])){ a[k]=a[k]||{}; mergeDeep(a[k],b[k]); } else a[k]=b[k]; } return a; }
  function escapeHtml(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  // attached image support
  function getAttachedImageUrl(){
    const img = document.getElementById('mt-attached-image');
    if(img && img.src) return img.src;
    try{ const data = localStorage.getItem(STORAGE_KEY+':btn-image'); if(data) return data; }catch(e){}
    return null;
  }
  function createStyles(imgUrl){
    const css = `
      .${EXT_ID}-panel{position:fixed;right:${state.settings.ui.position.right};top:${state.settings.ui.position.top};width:340px;background:rgba(18,18,20,0.96);color:#e6e6e6;border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,.6);font-family:Inter,Arial,system-ui;z-index:999999}
      .${EXT_ID}-header{display:flex;align-items:center;justify-content:space-between;padding:10px}
      .${EXT_ID}-title{font-weight:700}
      .${EXT_ID}-btn{background:transparent;border:0;color:inherit;padding:8px;cursor:pointer;border-radius:8px}
      .${EXT_ID}-body{padding:10px;max-height:65vh;overflow:auto}
      .${EXT_ID}-section{margin-bottom:10px}
      .${EXT_ID}-primary{background:#2b6cb0;border:0;color:white;padding:8px 10px;border-radius:8px;cursor:pointer}
      .${EXT_ID}-logs{background:rgba(255,255,255,0.03);padding:8px;border-radius:8px;font-size:12px;max-height:140px;overflow:auto}
      .${EXT_ID}-small{font-size:13px}
      .${EXT_ID}-logo-btn{width:36px;height:36px;border-radius:6px;display:inline-flex;align-items:center;justify-content:center}
    `;
    const style = document.createElement('style'); style.id = EXT_ID+'-styles'; style.innerHTML = css; document.head.appendChild(style);
    if(imgUrl){
      const s = document.createElement('style'); s.id = EXT_ID+'-btn-img'; s.innerHTML = `.${EXT_ID}-logo-btn{background-image:url(${imgUrl});background-size:cover;background-position:center}`; document.head.appendChild(s);
    }
  }

  // UI creation
  function createUI(){
    const prev = document.getElementById(EXT_ID+'-panel'); if(prev) prev.remove();
    const panel = document.createElement('div'); panel.id = EXT_ID+'-panel'; panel.className = EXT_ID+'-panel';
    panel.innerHTML = `
      <div class="${EXT_ID}-header">
        <div style="display:flex;gap:8px;align-items:center"><div id="mt-logo" class="${EXT_ID}-logo-btn"></div><div class="${EXT_ID}-title">MultiTool</div></div>
        <div><button id="mt-open-main" class="${EXT_ID}-btn">Open</button></div>
      </div>
      <div class="${EXT_ID}-body">
        <div class="${EXT_ID}-section">
          <label><input type="checkbox" data-tool="ai"> AI Tools</label>
          <label><input type="checkbox" data-tool="timers"> Time Tools</label>
          <label><input type="checkbox" data-tool="inspector"> Variable Inspector</label>
        </div>
        <div class="${EXT_ID}-section" id="mt-tool-area"></div>
        <div class="${EXT_ID}-section"><button id="mt-popout-btn" class="${EXT_ID}-primary">Pop-out Stage/Sprites/Code</button></div>
        <div class="${EXT_ID}-section ${EXT_ID}-logs" id="mt-logs"></div>
      </div>
    `;
    document.body.appendChild(panel);

    panel.querySelector('#mt-open-main').addEventListener('click', openMainInterface);
    panel.querySelector('#mt-popout-btn').addEventListener('click', openPopoutDialog);

    const checkboxes = panel.querySelectorAll('input[type=checkbox][data-tool]');
    checkboxes.forEach(cb=>{
      const tool = cb.getAttribute('data-tool'); cb.checked = !!state.settings.enabledTools[tool];
      cb.addEventListener('change', e=>{ state.settings.enabledTools[tool]=e.target.checked; integration.saveSettings(state.settings); renderToolArea(); });
    });

    return panel;
  }

  function renderToolArea(){
    const area = document.getElementById('mt-tool-area'); if(!area) return; area.innerHTML='';
    if(state.settings.enabledTools.ai) area.appendChild(renderAiTool());
    if(state.settings.enabledTools.timers) area.appendChild(renderTimersTool());
    if(state.settings.enabledTools.inspector) area.appendChild(renderInspectorTool());
  }

  /* AI - small reasoning stub + hooks */
  function renderAiTool(){
    const wr = document.createElement('div'); wr.className = EXT_ID+'-ai';
    wr.innerHTML = `
      <div class="${EXT_ID}-small"><strong>AI Tools</strong></div>
      <textarea id="mt-ai-prompt" style="width:100%;height:84px;margin-top:6px;" placeholder="Ask something..."></textarea>
      <div style="display:flex;gap:8px;margin-top:6px">
        <button id="mt-ai-run" class="${EXT_ID}-primary">Run</button>
        <select id="mt-ai-mode"><option value="local-stub">Local (fast)</option><option value="local-api">Local API</option></select>
      </div>
      <pre id="mt-ai-output" style="white-space:pre-wrap;margin-top:8px;background:rgba(255,255,255,0.03);padding:8px;border-radius:6px;min-height:40px"></pre>
    `;
    setTimeout(()=>{
      const run = wr.querySelector('#mt-ai-run'); const mode = wr.querySelector('#mt-ai-mode'); const prompt = wr.querySelector('#mt-ai-prompt'); const out = wr.querySelector('#mt-ai-output');
      mode.value = state.settings.ai.mode || 'local-stub';
      mode.addEventListener('change', ()=>{ state.settings.ai.mode = mode.value; integration.saveSettings(state.settings); });
      run.addEventListener('click', async ()=>{
        const q = prompt.value.trim(); if(!q){ out.textContent='No prompt.'; return; }
        out.textContent = 'Thinking...';
        try{ const resp = await runAiQuery(q); out.textContent = resp; }catch(e){ out.textContent = 'Error: '+(e.message||e); reportFatal(e); }
      });
    },0);
    return wr;
  }

  const tinyKB = [
    {id:'timefmt', content:'Time formats: hh:mm:ss, hh:mm:ss.ms, mm:ss, seconds.'},
    {id:'timers', content:'Multiple timers can run in parallel; use unique names.'},
    {id:'variables', content:'Variables live on project/global object; edit with care.'}
  ];

  async function runAiQuery(prompt){
    const mode = state.settings.ai.mode || 'local-stub';
    if(mode === 'local-api'){
      if(!state.settings.ai.customModelEndpoint) throw new Error('No endpoint set in settings.ai.customModelEndpoint');
      const r = await fetch(state.settings.ai.customModelEndpoint, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({prompt})});
      if(!r.ok) throw new Error('Endpoint error '+r.status);
      return await r.text();
    }

    // local-stub reasoning
    const steps = []; steps.push('> parse'); const q = prompt.toLowerCase();
    const found = tinyKB.filter(k=> q.split(/\W+/).some(w=> k.content.toLowerCase().includes(w)));
    if(found.length){ steps.push('> retrieve relevant facts:'); found.forEach(f=> steps.push('- '+f.content)); }
    if(q.includes('timer') || q.includes('time')){ steps.push('> infer: default format ' + state.settings.timers.defaultFormat); steps.push('Answer: Use hh:mm:ss for timer displays.'); return steps.join('\n'); }
    steps.push('> reason step 1: simplify'); steps.push('> reason step 2: apply heuristics'); steps.push('Answer: (local stub) For deeper replies, plug a local model endpoint.'); return steps.join('\n');
  }

  /* TIMERS */
  function renderTimersTool(){
    const w = document.createElement('div'); w.className = EXT_ID+'-timers';
    w.innerHTML = `
      <div class="${EXT_ID}-small"><strong>Time Tools</strong></div>
      <div style="display:flex;gap:8px;margin-top:6px">
        <input id="mt-timer-name" placeholder="Timer name" />
        <button id="mt-create" class="${EXT_ID}-primary">Create</button>
      </div>
      <div id="mt-timer-list" style="margin-top:8px"></div>
    `;
    setTimeout(()=>{ const list = w.querySelector('#mt-timer-list'); const create = w.querySelector('#mt-create'); const name = w.querySelector('#mt-timer-name'); create.addEventListener('click', ()=>{ const id = createTimer({name: name.value||('Timer '+(Object.keys(state.timers).length+1))}); renderTimerList(list); }); renderTimerList(list); },0);
    return w;
  }

  function createTimer(opts={}){ const id = 't_'+Date.now()+'_'+Math.floor(Math.random()*9999); state.timers[id] = { id, name: opts.name||id, format: state.settings.timers.defaultFormat, running:false, elapsed:0, lastTick:null }; return id; }
  function startTimer(id){ const t=state.timers[id]; if(!t) return; if(t.running) return; t.running=true; t.lastTick=performance.now(); t._tick = function(){ if(!t.running) return; const now=performance.now(); t.elapsed += (now - t.lastTick); t.lastTick = now; dispatchTimerUpdate(id); t._raf = requestAnimationFrame(t._tick); }; t._raf = requestAnimationFrame(t._tick); }
  function stopTimer(id){ const t=state.timers[id]; if(!t) return; t.running=false; if(t._raf) cancelAnimationFrame(t._raf); t._raf=null; }
  function resetTimer(id){ const t=state.timers[id]; if(!t) return; t.running=false; t.elapsed=0; if(t._raf) cancelAnimationFrame(t._raf); t._raf=null; dispatchTimerUpdate(id); }
  function formatElapsed(ms){ const total = Math.floor(ms); const h = Math.floor(total/3600000); const m = Math.floor((total%3600000)/60000); const s = Math.floor((total%60000)/1000); function p(v){return String(v).padStart(2,'0');} return `${p(h)}:${p(m)}:${p(s)}`; }
  function dispatchTimerUpdate(id){ window.dispatchEvent(new CustomEvent('multitool:timer:update',{detail:{id,timer:state.timers[id]}})); }
  function renderTimerList(container){ container.innerHTML=''; Object.values(state.timers).forEach(t=>{ const row=document.createElement('div'); row.style.display='flex'; row.style.gap='8px'; row.style.alignItems='center'; const name=document.createElement('input'); name.value=t.name; name.addEventListener('change',e=>t.name=e.target.value); const disp=document.createElement('div'); disp.textContent=formatElapsed(t.elapsed||0); disp.style.minWidth='110px'; const btn=document.createElement('button'); btn.textContent = t.running? 'Stop':'Start'; btn.addEventListener('click', ()=>{ if(t.running) stopTimer(t.id); else startTimer(t.id); renderTimerList(container); }); const reset=document.createElement('button'); reset.textContent='Reset'; reset.addEventListener('click', ()=>{ resetTimer(t.id); renderTimerList(container); }); row.appendChild(name); row.appendChild(disp); row.appendChild(btn); row.appendChild(reset); container.appendChild(row); window.addEventListener('multitool:timer:update', (ev)=>{ if(ev.detail.id===t.id) disp.textContent = formatElapsed(ev.detail.timer.elapsed||0); }); }); }

  /* VARIABLE INSPECTOR */
  function renderInspectorTool(){
    const w = document.createElement('div'); w.className = EXT_ID+'-inspector';
    w.innerHTML = `
      <div class="${EXT_ID}-small"><strong>Variable Inspector</strong></div>
      <div style="display:flex;gap:8px;margin-top:6px"><input id="mt-var-filter" placeholder="Filter" /><button id="mt-scan" class="${EXT_ID}-primary">Scan</button></div>
      <div id="mt-vars" style="margin-top:8px;max-height:200px;overflow:auto;background:rgba(255,255,255,0.02);padding:6px;border-radius:6px"></div>
    `;
    setTimeout(()=>{ const scan = w.querySelector('#mt-scan'); const filter = w.querySelector('#mt-var-filter'); const list = w.querySelector('#mt-vars'); scan.addEventListener('click', ()=>{ const res = scanGlobals(filter.value||''); list.innerHTML=''; res.forEach(it=>{ const row=document.createElement('div'); row.style.marginBottom='6px'; row.innerHTML = `<code>${escapeHtml(it.name)}</code> — <em>${it.type}</em> — ${escapeHtml(it.preview)}`; const edit=document.createElement('button'); edit.textContent='Edit'; edit.style.marginLeft='6px'; edit.addEventListener('click', ()=>openVariableEditor(it.name,it.value)); row.appendChild(edit); list.appendChild(row); }); }); },0);
    return w;
  }

  function scanGlobals(filter){ const out=[]; const seen=new Set(); function push(k,v){ if(seen.has(k)) return; seen.add(k); if(filter && !k.includes(filter)) return; let type=typeof v; let preview=''; try{ if(v===null) type='null'; else if(type==='object') preview = JSON.stringify(Object.keys(v).slice(0,6)); else preview = String(v).slice(0,120); }catch(e){ preview='[unpreviewable]'; } out.push({name:k,type,preview,value:v}); }
    const candidates=['project','IDE','cocrea','app']; candidates.forEach(n=>{ if(window[n]) Object.keys(window[n]).forEach(k=> push(n+'.'+k, window[n][k])); }); const keys=Object.keys(window).slice(0,600); keys.forEach(k=> push(k, window[k])); return out.sort((a,b)=>a.name.localeCompare(b.name)); }

  function openVariableEditor(name,current){ const w = window.open('', '_blank', 'width=720,height=520'); if(!w) return alert('Popup blocked'); w.document.title='Var Editor - '+name; const ta = w.document.createElement('textarea'); ta.style.width='100%'; ta.style.height='72%'; try{ ta.value = JSON.stringify(current,null,2); }catch(e){ ta.value = String(current); } const btn = w.document.createElement('button'); btn.textContent='Apply'; btn.addEventListener('click', ()=>{ try{ const parsed = JSON.parse(ta.value); const parts = name.split('.'); let obj = window; for(let i=0;i<parts.length-1;i++){ obj = obj[parts[i]]; if(!obj) throw new Error('Parent not found'); } obj[parts[parts.length-1]] = parsed; alert('Applied'); }catch(err){ alert('Failed: '+err.message); } }); w.document.body.appendChild(ta); w.document.body.appendChild(btn); }

  /* POPOUT (clone into new window) */
  function openPopoutDialog(){ const s = integration.selectors; const choice = prompt('Pop-out which area? Type: stage / sprites / code. Leave blank to cancel.'); if(!choice) return; const selector = (choice==='stage'?s.stage: choice==='sprites'?s.spritesPanel: choice==='code'?s.codeArea:choice); const el = document.querySelector(selector); if(!el) return alert('Element not found: '+selector); popoutElement(el, choice); }
  function popoutElement(element,name){ try{ const w = window.open('', '_blank', 'width=1000,height=700'); if(!w) return alert('Popout blocked'); w.document.title = 'Popout - '+name; const clone = element.cloneNode(true); w.document.body.style.margin='0'; w.document.body.appendChild(clone); state.popouts[name] = {win:w, selectorName:name}; const interval = setInterval(()=>{ if(w.closed){ clearInterval(interval); delete state.popouts[name]; } },1000); return w; }catch(e){ reportNonFatal(e); } }

  /* ERROR HANDLING */
  function reportFatal(err){ try{ const info = {time:new Date().toISOString(), message:err && err.message?err.message:String(err), stack:err && err.stack?err.stack:null}; state.logs.push({level:'fatal',info}); integration.reportError(info); showFatalModal(info); }catch(e){ console.error(e); } }
  function reportNonFatal(err){ try{ const info={time:new Date().toISOString(),message:err&&err.message?err.message:String(err),stack:err&&err.stack?err.stack:null}; state.logs.push({level:'warn',info}); renderLogs(); }catch(e){ console.error(e); } }
  function showFatalModal(info){ const modal = document.createElement('div'); modal.style.position='fixed'; modal.style.inset='0'; modal.style.background='rgba(0,0,0,0.6)'; modal.style.display='flex'; modal.style.alignItems='center'; modal.style.justifyContent='center'; modal.style.zIndex='1000000'; const box = document.createElement('div'); box.style.background='white'; box.style.color='black'; box.style.padding='12px'; box.style.borderRadius='8px'; box.style.maxWidth='900px'; box.innerHTML = `<h3>Fatal Error</h3><pre style="white-space:pre-wrap;max-height:300px;overflow:auto">${escapeHtml(JSON.stringify(info,null,2))}</pre>`; const copy = document.createElement('button'); copy.textContent='Copy'; copy.addEventListener('click', ()=>navigator.clipboard.writeText(JSON.stringify(info,null,2))); const close = document.createElement('button'); close.textContent='Close'; close.style.marginLeft='8px'; close.addEventListener('click', ()=>modal.remove()); box.appendChild(copy); box.appendChild(close); modal.appendChild(box); document.body.appendChild(modal); }
  function renderLogs(){ const logsArea = document.getElementById('mt-logs'); if(!logsArea) return; logsArea.innerHTML = state.logs.slice(-40).map(l=>`<div><strong>${l.level}</strong> ${l.info.time} - ${escapeHtml(l.info.message||'')}</div>`).join(''); }

  /* MAIN INTERFACE */
  function openMainInterface(){ const w = window.open('', '_blank', 'width=920,height=700'); if(!w) return alert('Popup blocked'); w.document.title='MultiTool - Main'; const root = w.document.createElement('div'); root.style.padding='12px'; root.innerHTML = `<h2>MultiTool</h2><pre>Settings:\n${escapeHtml(JSON.stringify(state.settings,null,2))}</pre><h3>Logs</h3><div id='mt-main-logs' style='max-height:300px;overflow:auto;background:#eee;padding:8px'></div>`; w.document.body.appendChild(root); const logs = w.document.getElementById('mt-main-logs'); logs.innerText = state.logs.map(l=>`${l.level} ${l.info.time} ${l.info.message}`).join('\n'); }

  /* BOOTSTRAP */
  async function init(userIntegration){
    if(state.initialized) return;
    if(userIntegration) mergeDeep(integration, userIntegration);
    const saved = await integration.loadSettings();
    if(saved) mergeDeep(state.settings, saved);
    state.settings.enabledTools = Object.assign({ai:false,timers:false,inspector:false}, state.settings.enabledTools||{});
    const img = getAttachedImageUrl(); createStyles(img);
    createUI(); renderToolArea(); renderLogs();
    if(state.settings.startup && state.settings.startup.showMenuOnLoad) showStartupMenu();
    state.initialized = true;
    window.addEventListener('error', ev=>{ reportFatal(ev.error || {message:ev.message}); });
    window.addEventListener('unhandledrejection', ev=>{ reportFatal(ev.reason || {message:'Unhandled rejection'}); });
    integration.log('Multitool initialized');
  }

  function showStartupMenu(){ const modal = document.createElement('div'); modal.style.position='fixed'; modal.style.inset='0'; modal.style.background='rgba(0,0,0,0.5)'; modal.style.display='flex'; modal.style.alignItems='center'; modal.style.justifyContent='center'; modal.style.zIndex='1000000'; const box = document.createElement('div'); box.style.background='#121212'; box.style.color='#eee'; box.style.padding='14px'; box.style.borderRadius='8px'; box.style.minWidth='320px'; box.innerHTML=`<h3 style='margin:0 0 8px 0'>MultiTool</h3><div style='margin-bottom:8px'>Tools are OFF by default. Which tools do you want to enable now?</div>`; const aiBtn=document.createElement('button'); aiBtn.textContent='Toggle AI'; aiBtn.addEventListener('click', ()=>{ state.settings.enabledTools.ai = !state.settings.enabledTools.ai; integration.saveSettings(state.settings); renderToolArea(); }); const tBtn=document.createElement('button'); tBtn.textContent='Toggle Timers'; tBtn.style.marginLeft='8px'; tBtn.addEventListener('click', ()=>{ state.settings.enabledTools.timers = !state.settings.enabledTools.timers; integration.saveSettings(state.settings); renderToolArea(); }); const iBtn=document.createElement('button'); iBtn.textContent='Toggle Inspector'; iBtn.style.marginLeft='8px'; iBtn.addEventListener('click', ()=>{ state.settings.enabledTools.inspector = !state.settings.enabledTools.inspector; integration.saveSettings(state.settings); renderToolArea(); }); const close=document.createElement('button'); close.textContent='Close'; close.style.display='block'; close.style.marginTop='10px'; close.addEventListener('click', ()=>{ modal.remove(); }); box.appendChild(aiBtn); box.appendChild(tBtn); box.appendChild(iBtn); box.appendChild(close); modal.appendChild(box); document.body.appendChild(modal); }

  // auto-init
  if(defaultSettings.startup.autoInit) setTimeout(()=>init(), 200);

  // public API
  root.CocreaMultiToolExtension = { init, getState:()=>state, runAiQuery, integration, createTimer, startTimer, stopTimer, resetTimer, popoutElement, reportFatal, reportNonFatal };

})(window);
