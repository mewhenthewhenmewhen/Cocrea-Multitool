/* Cocrea MultiTool — v_final (Resizable panel)
   Single-file extension. Drop into your IDE page or repo and include via <script>.
   Added: panel resizable via bottom-right handle. Blocks remain draggable.
*/

(function(window){
  if(!window) return;
  const EXT = 'cocrea-multitool-final';
  const STORAGE = EXT + ':settings';
  // ----------------------------
  // Defaults
  // ----------------------------
  const defaults = {
    enabled: { ai:true, timers:true, inspector:true, blocks:true, extras:true },
    ai: { mode:'auto', hosted: { endpoint:'', auth:'' }, reasoningDepth: 3 },
    timers: { defaultMode:'stopwatch', defaultFormat:'hh:mm:ss', max:200 },
    ui: { right:'10px', top:'10px', theme:'dark', width:420, height: null }
  };

  // ----------------------------
  // State
  // ----------------------------
  let settings = {};
  function loadSettings(){
    try{ const s = JSON.parse(localStorage.getItem(STORAGE)); if(s) settings = Object.assign({}, defaults, s); else settings = Object.assign({}, defaults); }
    catch(e){ settings = Object.assign({}, defaults); }
  }
  function saveSettings(){ try{ localStorage.setItem(STORAGE, JSON.stringify(settings)); }catch(e){} }
  loadSettings();

  const state = { timers: {}, logs: [], blocks: [], watches: {}, aiCache: {} };

  // ----------------------------
  // Utilities
  // ----------------------------
  function $qs(s,ctx=document){ return ctx.querySelector(s); }
  function $create(t, attrs={}){ const el=document.createElement(t); for(const k in attrs){ if(k==='html') el.innerHTML=attrs[k]; else if(k==='text') el.textContent=attrs[k]; else el.setAttribute(k, attrs[k]); } return el; }
  function log(...a){ state.logs.push({time:new Date().toISOString(), msg: a.map(x=> (typeof x === 'string' ? x : JSON.stringify(x))).join(' ')}); renderLogs(); console.log('[MT]', ...a); }
  function escapeHtml(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  // ----------------------------
  // Styling (include resizer)
  // ----------------------------
  function injectStyles(){ if(document.getElementById(EXT+'-css')) return; const css = `
    #${EXT}-panel{position:fixed;right:${settings.ui.right};top:${settings.ui.top};width:${settings.ui.width}px;background:#0e0f12;color:#e6eef6;border-radius:10px;box-shadow:0 12px 48px rgba(0,0,0,.6);font-family:Inter,system-ui,Arial;z-index:2147483647;overflow:hidden;resize:none}
    #${EXT}-hdr{display:flex;align-items:center;justify-content:space-between;padding:10px;cursor:grab}
    #${EXT}-hdr h3{margin:0;font-size:15px}
    #${EXT}-body{padding:10px;max-height:66vh;overflow:auto}
    .mt-btn{background:#1f6feb;color:white;border:0;padding:6px 10px;border-radius:8px;cursor:pointer}
    .mt-ghost{background:transparent;border:1px solid rgba(255,255,255,0.04);padding:6px;border-radius:6px;color:#cbd5e1}
    .mt-section{margin-bottom:10px}
    .mt-row{display:flex;gap:8px;align-items:center}
    .mt-input{padding:6px;border-radius:6px;border:1px solid rgba(255,255,255,0.06);background:#0b0c0d;color:#e6eef6;flex:1}
    .mt-select{padding:6px;border-radius:6px;border:1px solid rgba(255,255,255,0.06);background:#0b0c0d;color:#e6eef6}
    .timer-line{display:flex;gap:6px;align-items:center;margin-bottom:6px}
    .timer-display{min-width:130px;font-family:monospace}
    .block{position:fixed;left:60px;top:140px;background:#111827;color:#f8fafc;padding:10px;border-radius:8px;box-shadow:0 10px 30px rgba(0,0,0,.5);z-index:2147483646;cursor:grab}
    .reporter{background:rgba(255,255,255,0.02);padding:6px;border-radius:6px;margin-top:6px;min-width:120px;text-align:center}
    .small{font-size:13px;color:#b3c2d1}
    #${EXT}-logs{background:rgba(255,255,255,0.02);padding:8px;border-radius:8px;font-size:12px;max-height:120px;overflow:auto}
    .collapse-hidden{display:none}
    .mt-btn-plain{background:transparent;color:#9fb7d8;border:1px solid rgba(255,255,255,0.03);padding:6px;border-radius:6px}
    /* resizer handle */
    #${EXT}-resizer{position:absolute;right:6px;bottom:6px;width:14px;height:14px;background:transparent;cursor:se-resize;z-index:2147483648}
    #${EXT}-resizer:after{content:'';display:block;width:12px;height:12px;border-right:2px solid rgba(255,255,255,0.18);border-bottom:2px solid rgba(255,255,255,0.18);transform:rotate(45deg);margin-left:1px;margin-top:1px}
  `; const s=document.createElement('style'); s.id=EXT+'-css'; s.innerHTML=css; document.head.appendChild(s); }

  // ----------------------------
  // Draggable helper
  // ----------------------------
  function makeDraggable(el, handle){ handle = handle || el; let dragging=false, sx=0, sy=0, ox=0, oy=0; handle.style.touchAction='none'; handle.addEventListener('mousedown', e=>{ dragging=true; sx=e.clientX; sy=e.clientY; const r=el.getBoundingClientRect(); ox=r.left; oy=r.top; document.addEventListener('mousemove', mm); document.addEventListener('mouseup', mup); e.preventDefault(); }); handle.addEventListener('touchstart', e=>{ const t=e.touches[0]; dragging=true; sx=t.clientX; sy=t.clientY; const r=el.getBoundingClientRect(); ox=r.left; oy=r.top; document.addEventListener('touchmove', tm); document.addEventListener('touchend', mup); e.preventDefault(); }); function mm(e){ if(!dragging) return; const dx=e.clientX-sx; const dy=e.clientY-sy; el.style.left=(ox+dx)+'px'; el.style.top=(oy+dy)+'px'; } function tm(e){ if(!dragging) return; const t=e.touches[0]; const dx=t.clientX-sx; const dy=t.clientY-sy; el.style.left=(ox+dx)+'px'; el.style.top=(oy+dy)+'px'; } function mup(){ dragging=false; document.removeEventListener('mousemove', mm); document.removeEventListener('touchmove', tm); document.removeEventListener('mouseup', mup); document.removeEventListener('touchend', mup); } }

  // ----------------------------
  // Resizer helper
  // ----------------------------
  function makeResizable(panelEl){ const resizer = $create('div', { id: EXT+'-resizer' }); panelEl.appendChild(resizer); let resizing=false, startX=0, startY=0, startW=0, startH=0; resizer.addEventListener('mousedown', (e)=>{ resizing=true; startX=e.clientX; startY=e.clientY; const r=panelEl.getBoundingClientRect(); startW=r.width; startH=r.height; document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp); e.preventDefault(); }); resizer.addEventListener('touchstart', (ev)=>{ const t=ev.touches[0]; resizing=true; startX=t.clientX; startY=t.clientY; const r=panelEl.getBoundingClientRect(); startW=r.width; startH=r.height; document.addEventListener('touchmove', onTouchMove); document.addEventListener('touchend', onUp); ev.preventDefault(); }); function onMove(e){ if(!resizing) return; const dx=e.clientX - startX; const dy=e.clientY - startY; const newW = Math.max(320, Math.min(900, startW + dx)); const newH = Math.max(160, Math.min(window.innerHeight - 60, startH + dy)); panelEl.style.width = newW + 'px'; panelEl.style.height = newH + 'px'; settings.ui.width = newW; settings.ui.height = newH; saveSettings(); } function onTouchMove(ev){ if(!resizing) return; const t=ev.touches[0]; const dx=t.clientX - startX; const dy=t.clientY - startY; const newW = Math.max(320, Math.min(900, startW + dx)); const newH = Math.max(160, Math.min(window.innerHeight - 60, startH + dy)); panelEl.style.width = newW + 'px'; panelEl.style.height = newH + 'px'; settings.ui.width = newW; settings.ui.height = newH; saveSettings(); } function onUp(){ resizing=false; document.removeEventListener('mousemove', onMove); document.removeEventListener('touchmove', onTouchMove); document.removeEventListener('mouseup', onUp); document.removeEventListener('touchend', onUp); } }

  // ----------------------------
  // Core UI
  // ----------------------------
  function buildPanel(){ injectStyles(); const existing = document.getElementById(EXT+'-panel'); if(existing) existing.remove(); const panel = $create('div', { id: EXT+'-panel' }); if(settings.ui.height) panel.style.height = settings.ui.height+'px'; panel.innerHTML = `
    <div id="${EXT}-hdr"><h3>MultiTool</h3>
      <div style="display:flex;gap:8px;align-items:center">
        <button id="${EXT}-collapse" class="mt-btn-plain">▾</button>
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
          <label class="small"><input type="checkbox" id="${EXT}-toggle-extras"> Extras</label>
        </div>
      </div>
      <div id="${EXT}-tools"></div>
      <div class="mt-section"><div class="small">Logs</div><div id="${EXT}-logs"></div></div>
    </div>
  `; document.body.appendChild(panel);

    // drag header
    const hdr = $qs('#'+EXT+'-hdr'); makeDraggable(panel, hdr);
    // resizable
    makeResizable(panel);
    // collapse
    $qs('#'+EXT+'-collapse').addEventListener('click', ()=>{ $qs('#'+EXT+'-body').classList.toggle('collapse-hidden'); });
    $qs('#'+EXT+'-open').addEventListener('click', ()=> openMainWindow());
    // toggles
    $qs('#'+EXT+'-toggle-ai').checked = settings.enabled.ai; $qs('#'+EXT+'-toggle-timers').checked = settings.enabled.timers; $qs('#'+EXT+'-toggle-inspector').checked = settings.enabled.inspector; $qs('#'+EXT+'-toggle-blocks').checked = settings.enabled.blocks; $qs('#'+EXT+'-toggle-extras').checked = settings.enabled.extras;
    $qs('#'+EXT+'-toggle-ai').addEventListener('change',(e)=>{ settings.enabled.ai = e.target.checked; saveSettings(); renderTools(); });
    $qs('#'+EXT+'-toggle-timers').addEventListener('change',(e)=>{ settings.enabled.timers = e.target.checked; saveSettings(); renderTools(); });
    $qs('#'+EXT+'-toggle-inspector').addEventListener('change',(e)=>{ settings.enabled.inspector = e.target.checked; saveSettings(); renderTools(); });
    $qs('#'+EXT+'-toggle-blocks').addEventListener('change',(e)=>{ settings.enabled.blocks = e.target.checked; saveSettings(); renderTools(); });
    $qs('#'+EXT+'-toggle-extras').addEventListener('change',(e)=>{ settings.enabled.extras = e.target.checked; saveSettings(); renderTools(); });

    renderTools(); renderLogs(); }

  // ----------------------------
  // Tools rendering (kept similar to previous)
  // For brevity, reuse earlier implementations but ensure resizer integrated
  // ----------------------------

  function renderTools(){ const container = $qs('#'+EXT+'-tools'); if(!container) return; container.innerHTML=''; if(settings.enabled.ai) container.appendChild(buildAiTool()); if(settings.enabled.timers) container.appendChild(buildTimersTool()); if(settings.enabled.inspector) container.appendChild(buildInspectorTool()); if(settings.enabled.blocks) container.appendChild(buildBlocksTool()); if(settings.enabled.extras) container.appendChild(buildExtrasTool()); }

  // --- AI tool (unchanged from prior) ---
  function buildAiTool(){ const wrap = $create('div', { class:'mt-section', html:`
    <div><strong>AI Tools</strong></div>
    <div class="mt-row" style="margin-top:6px"><textarea id="${EXT}-ai-prompt" class="mt-input" style="height:80px" placeholder="Ask the AI..."></textarea></div>
    <div class="mt-row" style="margin-top:8px"><select id="${EXT}-ai-mode" class="mt-select"><option value="auto">Auto (hosted if configured, else local)</option><option value="hosted">Hosted</option><option value="local">Local</option></select><input id="${EXT}-ai-endpoint" class="mt-input" placeholder="Hosted endpoint (optional)"/><input id="${EXT}-ai-auth" class="mt-input" placeholder="Auth token (optional)" style="width:170px"/><button id="${EXT}-ai-run" class="mt-btn">Run</button></div>
    <pre id="${EXT}-ai-out" style="margin-top:8px;background:rgba(255,255,255,0.02);padding:8px;border-radius:6px;min-height:60px"></pre>
  `}); setTimeout(()=>{ const modeEl = $qs('#'+EXT+'-ai-mode'); const endpointEl = $qs('#'+EXT+'-ai-endpoint'); const authEl = $qs('#'+EXT+'-ai-auth'); const runBtn = $qs('#'+EXT+'-ai-run'); const out = $qs('#'+EXT+'-ai-out'); if(settings.ai.hosted.endpoint) endpointEl.value = settings.ai.hosted.endpoint; if(settings.ai.hosted.auth) authEl.value = settings.ai.hosted.auth; modeEl.value = settings.ai.mode || 'auto'; modeEl.addEventListener('change', ()=>{ settings.ai.mode = modeEl.value; saveSettings(); }); endpointEl.addEventListener('change', ()=>{ settings.ai.hosted.endpoint = endpointEl.value; saveSettings(); }); authEl.addEventListener('change', ()=>{ settings.ai.hosted.auth = authEl.value; saveSettings(); }); runBtn.addEventListener('click', async ()=>{ const prompt = $qs('#'+EXT+'-ai-prompt').value.trim(); if(!prompt){ out.textContent='Type a question.'; return; } out.textContent='Thinking...'; try{ let res; const mode = modeEl.value; if(mode === 'hosted' || (mode==='auto' && settings.ai.hosted.endpoint)){ if(settings.ai.hosted.endpoint){ try{ res = await callHostedModel(prompt, settings.ai.hosted.endpoint, settings.ai.hosted.auth); }catch(e){ log('Hosted call failed, falling back to local:', e.message||e); res = runLocalAi(prompt); } } else { res = runLocalAi(prompt); } } else { res = runLocalAi(prompt); } out.textContent = res; }catch(err){ out.textContent = 'Error: ' + (err.message||String(err)); reportError(err); } }); },0); return wrap; }

  async function callHostedModel(prompt, endpoint, auth){ if(!endpoint) throw new Error('No hosted endpoint provided.'); const headers = { 'Content-Type':'application/json' }; if(auth) headers['Authorization']=auth; const r = await fetch(endpoint, { method:'POST', headers, body: JSON.stringify({ prompt }) }); if(!r.ok) throw new Error('Remote API error ' + r.status); const ct = r.headers.get('content-type')||''; if(ct.includes('application/json')){ const j = await r.json(); return j.text || j.result || JSON.stringify(j); } return await r.text(); }

  function runLocalAi(prompt){ if(state.aiCache && state.aiCache[prompt]) return state.aiCache[prompt]; const p = prompt.trim(); const l = p.toLowerCase(); const kb = [ {k:'timer', v:'Timers: stopwatch (count up) and timer (countdown).'}, {k:'variable', v:'Variables live on runtime globals; use inspector.'}, {k:'popout', v:'Use pop-out to open stage/sprites/code separately.'} ]; const steps=['Input: '+p,'Parsing...']; kb.forEach(item=>{ if(l.includes(item.k)) steps.push('Fact: '+item.v); }); if(l.match(/explain .*code|what does .* do|how does .* work/)){ steps.push('Heuristic: code explanation'); steps.push('Answer: Paste the function and ask "explain this function".'); const out=steps.join('
'); state.aiCache[prompt]=out; return out; } if(l.includes('timer')||l.includes('stopwatch')||l.includes('countdown')){ steps.push('Answer: Use stopwatch for count-up, timer for countdown with seconds set.'); const out=steps.join('
'); state.aiCache[prompt]=out; return out; } steps.push('Reasoning: simplify, retrieve, suggest.'); steps.push('Answer (local): I can help design logic, create timers, or inspect variables.'); const out=steps.join('
'); state.aiCache[prompt]=out; return out; }

  // ----------------------------
  // Timers (same as before)
  // ----------------------------
  function buildTimersTool(){ const wrap=$create('div',{class:'mt-section'}); wrap.innerHTML=`<div><strong>Timers</strong></div><div class="mt-row" style="margin-top:6px"><input id="${EXT}-timer-name" class="mt-input" placeholder="Timer ID (optional)"><select id="${EXT}-timer-mode" class="mt-select"><option value="stopwatch">Stopwatch (count up)</option><option value="timer">Timer (countdown)</option></select><input id="${EXT}-timer-seconds" class="mt-input" placeholder="Time or leave blank (seconds)"><button id="${EXT}-timer-make" class="mt-btn">Create</button></div><div id="${EXT}-timer-list" style="margin-top:8px"></div>`; setTimeout(()=>{ $qs('#'+EXT+'-timer-make').addEventListener('click', ()=>{ const name=$qs('#'+EXT+'-timer-name').value.trim()||('T'+Date.now().toString().slice(-4)); const mode=$qs('#'+EXT+'-timer-mode').value; const timeVal=Number($qs('#'+EXT+'-timer-seconds').value)||0; createTimer({ id:name, mode, seconds: timeVal }); renderTimerList(); }); renderTimerList(); },0); return wrap; }
  function createTimer(opts){ const id = opts.id || ('t_'+Date.now()+'_'+Math.floor(Math.random()*9999)); const t = { id, name: opts.id||id, mode: opts.mode||settings.timers.defaultMode, targetSeconds: opts.seconds||0, elapsed:0, running:false, _last:0, created:Date.now() }; state.timers[id]=t; log('Timer created', id, t.mode, t.targetSeconds); return id; }
  function startTimer(id){ const t=state.timers[id]; if(!t) return; if(t.running) return; t.running=true; t._last=performance.now(); function tick(){ if(!t.running) return; const now=performance.now(); t.elapsed += (now - t._last); t._last = now; if(t.mode==='timer' && (t.elapsed/1000) >= t.targetSeconds && t.targetSeconds>0){ t.running=false; t.elapsed = t.targetSeconds*1000; alert('Timer '+t.id+' finished.'); } dispatchTimerUpdate(id); t._raf = requestAnimationFrame(tick); } t._raf = requestAnimationFrame(tick); }
  function stopTimer(id){ const t=state.timers[id]; if(!t) return; t.running=false; if(t._raf) cancelAnimationFrame(t._raf); t._raf=null; dispatchTimerUpdate(id); }
  function resetTimer(id){ const t=state.timers[id]; if(!t) return; t.running=false; t.elapsed=0; t._last=0; if(t._raf) cancelAnimationFrame(t._raf); t._raf=null; dispatchTimerUpdate(id); }
  function formatTime(ms){ const total=Math.floor(ms/1000); const h=Math.floor(total/3600); const m=Math.floor((total%3600)/60); const s=total%60; function p(n){return String(n).padStart(2,'0');} return `${p(h)}:${p(m)}:${p(s)}`; }
  function dispatchTimerUpdate(id){ const ev=new CustomEvent('multitool:timer-update',{detail:{id, timer: state.timers[id]}}); window.dispatchEvent(ev); }
  function renderTimerList(){ const list=$qs('#'+EXT+'-timer-list'); if(!list) return; list.innerHTML=''; Object.values(state.timers).forEach(t=>{ const row=$create('div',{class:'timer-line'}); const name=$create('input',{class:'mt-input', value: t.name}); name.addEventListener('change', e=>{ t.name=e.target.value; }); const disp=$create('div',{class:'timer-display', html: formatTime(t.elapsed)}); const startBtn=$create('button',{class:'mt-btn', text: t.running? 'Stop':'Start'}); startBtn.textContent = t.running? 'Stop':'Start'; startBtn.addEventListener('click', ()=>{ if(t.running) stopTimer(t.id); else startTimer(t.id); renderTimerList(); }); const resetBtn=$create('button',{class:'mt-ghost', text:'Reset'}); resetBtn.addEventListener('click', ()=>{ resetTimer(t.id); renderTimerList(); }); row.appendChild(name); row.appendChild(disp); row.appendChild(startBtn); row.appendChild(resetBtn); list.appendChild(row); window.addEventListener('multitool:timer-update', (ev)=>{ if(ev.detail.id === t.id){ const dt = ev.detail.timer; disp.textContent = dt.mode==='timer' && dt.targetSeconds>0 ? formatTime((dt.targetSeconds*1000) - dt.elapsed) : formatTime(dt.elapsed); startBtn.textContent = dt.running ? 'Stop' : 'Start'; }}); }); }

  // ----------------------------
  // Variable inspector (scan Cocrea runtime)
  // ----------------------------
  function buildInspectorTool(){ const wrap=$create('div',{class:'mt-section'}); wrap.innerHTML = `<div><strong>Variable Inspector</strong></div><div class='mt-row' style='margin-top:6px'><input id='${EXT}-var-filter' class='mt-input' placeholder='Filter (variable name)'><button id='${EXT}-var-scan' class='mt-btn'>Scan</button></div><div id='${EXT}-var-list' style='margin-top:8px'></div>`; setTimeout(()=>{ $qs('#'+EXT+'-var-scan').addEventListener('click', ()=>{ const f = $qs('#'+EXT+'-var-filter').value.trim(); const results = scanCocreaRuntime(f); const list = $qs('#'+EXT+'-var-list'); list.innerHTML=''; if(!results.length) list.innerHTML = `<div class='small'>No variables found matching "${escapeHtml(f)}".</div>`; results.forEach(r=>{ const row = $create('div',{ html: `<code>${escapeHtml(r.name)}</code> — <span class='small'>${escapeHtml(r.type)}</span> — <span class='small'>${escapeHtml(r.preview)}</span>`}); const edit = $create('button',{ class:'mt-btn-plain', text:'Edit' }); edit.addEventListener('click', ()=> openVarEditor(r)); row.appendChild(edit); list.appendChild(row); }); }); },0); return wrap; }
  function scanCocreaRuntime(filter){ const candidates=['project','IDE','cocrea','app','runtime','Cocrea']; const f=(filter||'').toLowerCase(); const out=[]; const seen=new Set(); function add(name,val){ if(seen.has(name)) return; seen.add(name); let type=typeof val; let preview=''; try{ if(val===null) type='null'; else if(type==='object') preview = JSON.stringify(Object.keys(val).slice(0,6)); else preview = String(val).slice(0,120); }catch(e){ preview='[unreadable]'; } if(!f || name.toLowerCase().includes(f)) out.push({name,type,preview,value:val}); } for(const n of candidates){ try{ if(window[n]){ Object.keys(window[n]).forEach(k=> add(n+'.'+k, window[n][k])); } }catch(e){} } try{ const keys = Object.keys(window).slice(0,800); for(const k of keys){ if(k.toLowerCase().includes('project')||k.toLowerCase().includes('sprite')||k.toLowerCase().includes('stage')||k.toLowerCase().includes('cocrea')){ try{ add(k, window[k]); }catch(e){} } } for(const k of keys){ try{ add(k, window[k]); }catch(e){} } }catch(e){} return out; }
  function openVarEditor(entry){ const w = window.open('', '_blank', 'width=720,height=520'); if(!w) return alert('Allow popups to edit variables.'); w.document.title = 'Edit: ' + entry.name; const ta = w.document.createElement('textarea'); ta.style.width='100%'; ta.style.height='72%'; try{ ta.value = JSON.stringify(entry.value, null, 2); }catch(e){ ta.value = String(entry.value); } const btn = w.document.createElement('button'); btn.textContent='Apply'; btn.className='mt-btn'; btn.addEventListener('click', ()=>{ try{ const parsed = JSON.parse(ta.value); const parts = entry.name.split('.'); if(parts.length===1){ window[parts[0]] = parsed; } else { let obj = window; for(let i=0;i<parts.length-1;i++){ obj = obj[parts[i]]; if(obj === undefined) throw new Error('Parent not found'); } obj[parts[parts.length-1]] = parsed; } alert('Applied.'); }catch(err){ alert('Failed: ' + (err.message||err)); } }); w.document.body.appendChild(ta); w.document.body.appendChild(btn); }

  // ----------------------------
  // Blocks
  // ----------------------------
  function buildBlocksTool(){ const wrap=$create('div',{class:'mt-section'}); wrap.innerHTML=`<div><strong>Blocks</strong></div><div class='mt-row' style='margin-top:6px'><input id='${EXT}-block-name' class='mt-input' placeholder='Block Timer ID'><select id='${EXT}-block-mode' class='mt-select'><option value='stopwatch'>Stopwatch</option><option value='timer'>Timer</option></select><input id='${EXT}-block-time' class='mt-input' placeholder='Seconds (for timer only)'><button id='${EXT}-block-create' class='mt-btn'>Create Block</button></div><div class='small' style='margin-top:6px'>Blocks are draggable and include a reporter that updates.</div>`; setTimeout(()=>{ $qs('#'+EXT+'-block-create').addEventListener('click', ()=>{ const id = $qs('#'+EXT+'-block-name').value.trim() || ('B'+Date.now().toString().slice(-4)); const mode = $qs('#'+EXT+'-block-mode').value; const seconds = Number($qs('#'+EXT+'-block-time').value) || 0; makeBlock({ id, mode, seconds }); }); },0); return wrap; }
  function makeBlock(opts){ const tid = createTimer({ id: opts.id, mode: opts.mode, seconds: opts.seconds }); const block = $create('div',{ class:'block', html:`<div style='font-weight:700'>${escapeHtml(opts.id)}</div><div class='small'>${escapeHtml(opts.mode)}</div><div style='margin-top:6px'><button class='mt-btn' data-act='start'>Start</button><button class='mt-btn-plain' data-act='stop'>Stop</button><button class='mt-btn-plain' data-act='reset'>Reset</button></div><div class='reporter' data-tid='${tid}'>${formatTime(0)}</div>`}); document.body.appendChild(block); makeDraggable(block, block); block.querySelector('[data-act="start"]').addEventListener('click', ()=> startTimer(tid)); block.querySelector('[data-act="stop"]').addEventListener('click', ()=> stopTimer(tid)); block.querySelector('[data-act="reset"]').addEventListener('click', ()=> resetTimer(tid)); window.addEventListener('multitool:timer-update', (ev)=>{ if(ev.detail.id === tid){ const r = block.querySelector('.reporter'); const t = ev.detail.timer; r.textContent = t.mode === 'timer' && t.targetSeconds > 0 ? formatTime((t.targetSeconds*1000) - t.elapsed) : formatTime(t.elapsed); }}); state.blocks.push({ el:block, tid }); log('Block created', opts.id); return block; }

  // ----------------------------
  // Extras
  // ----------------------------
  function buildExtrasTool(){ const wrap=$create('div',{class:'mt-section'}); wrap.innerHTML=`<div><strong>Extras</strong></div><div style='margin-top:6px' class='mt-row'><input id='${EXT}-quick-js' class='mt-input' placeholder='Quick JS (runs in page)'><button id='${EXT}-run-js' class='mt-btn'>Run</button></div><div style='margin-top:6px' class='mt-row'><button id='${EXT}-scan-assets' class='mt-btn-plain'>Asset Inspector</button><button id='${EXT}-open-watch' class='mt-btn-plain'>Variable Watchlist</button></div><div id='${EXT}-assets' style='margin-top:8px'></div><div id='${EXT}-watch' style='margin-top:8px'></div>`; setTimeout(()=>{ $qs('#'+EXT+'-run-js').addEventListener('click', ()=>{ const code = $qs('#'+EXT+'-quick-js').value; try{ const res = (new Function(code))(); alert('Result: ' + String(res)); }catch(e){ alert('Error: ' + (e.message||e)); } }); $qs('#'+EXT+'-scan-assets').addEventListener('click', ()=> renderAssetInspector()); $qs('#'+EXT+'-open-watch').addEventListener('click', ()=> renderWatchlist()); },0); return wrap; }
  function renderAssetInspector(){ const el = $qs('#'+EXT+'-assets'); el.innerHTML = '<div class="small">Scanning DOM for possible assets (images, elements with data-sprite)...</div>'; const imgs = Array.from(document.querySelectorAll('img')).slice(0,50); const sprites = Array.from(document.querySelectorAll('[data-sprite]')).slice(0,50); el.innerHTML = '<div class="small">Images: '+imgs.length+' | Sprites (data-sprite): '+sprites.length+'</div>'; imgs.slice(0,10).forEach(i=> el.appendChild($create('div',{ html:`<img src="${i.src}" style="max-width:120px;margin:6px;border-radius:6px">`}))); sprites.slice(0,10).forEach(s=> el.appendChild($create('div',{ html:`<code>${escapeHtml(s.getAttribute('data-sprite')||s.className)}</code>` }))); }
  function renderWatchlist(){ const w = $qs('#'+EXT+'-watch'); w.innerHTML = '<div class="small">Watchlist</div>'; Object.keys(state.watches).forEach(k=>{ const it = state.watches[k]; const row = $create('div',{ html:`<code>${escapeHtml(k)}</code>: <span class="small">${escapeHtml(String(it.value))}</span>` }); w.appendChild(row); }); const addRow = $create('div',{ class:'mt-row', html:`<input class='mt-input' id='${EXT}-watch-add' placeholder='global.var.name'><button id='${EXT}-watch-add-btn' class='mt-btn'>Add</button>`}); w.appendChild(addRow); setTimeout(()=> $qs('#'+EXT+'-watch-add-btn').addEventListener('click', ()=>{ const k = $qs('#'+EXT+'-watch-add').value.trim(); if(!k) return; const val = resolvePath(k); state.watches[k] = { ref: k, value: val }; renderWatchlist(); }),0); }
  function resolvePath(path){ try{ const parts = path.split('.'); let o = window; for(const p of parts){ o = o[p]; if(o === undefined) break; } return o; }catch(e){ return undefined; } }

  // ----------------------------
  // Popouts & Main
  // ----------------------------
  function openMainWindow(){ const w = window.open('', '_blank', 'width=960,height=700'); if(!w) return alert('Allow popups to open the main window.'); w.document.title = 'MultiTool - Main'; const container = w.document.createElement('div'); container.style.padding='12px'; container.innerHTML = `<h2>MultiTool — Main Interface</h2><pre id='mt-main-settings'>${escapeHtml(JSON.stringify(settings, null,2))}</pre><h3>Logs</h3><pre id='mt-main-logs'>${escapeHtml(state.logs.map(l=>l.time+' '+l.msg).join('
'))}</pre>`; w.document.body.appendChild(container); }

  // ----------------------------
  // Logs & errors
  // ----------------------------
  function renderLogs(){ const el = $qs('#'+EXT+'-logs'); if(!el) return; el.innerHTML = state.logs.slice(-40).map(x=> escapeHtml(x.time + ' — ' + x.msg) ).map(s=> `<div class='small'>${s}</div>`).join(''); }
  function reportError(e){ log('ERROR', e && e.message ? e.message : String(e)); const modal = $create('div',{ html:`<div style="position:fixed;inset:0;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;z-index:2147483650"><div style="background:white;color:black;padding:12px;border-radius:8px;max-width:900px"><h3>Fatal Error</h3><pre style="max-height:300px;overflow:auto">${escapeHtml(JSON.stringify({time:new Date().toISOString(), message: e.message||String(e), stack: e.stack||''}, null,2))}</pre><div style="text-align:right"><button id='${EXT}-fatal-copy' class='mt-btn'>Copy</button><button id='${EXT}-fatal-close' class='mt-btn-plain'>Close</button></div></div></div>` }); document.body.appendChild(modal); modal.querySelector('#'+EXT+'-fatal-copy').addEventListener('click', ()=> navigator.clipboard.writeText(JSON.stringify({time:new Date().toISOString(), message: e.message||String(e), stack: e.stack||''}, null,2))); modal.querySelector('#'+EXT+'-fatal-close').addEventListener('click', ()=> modal.remove()); }

  // ----------------------------
  // Init
  // ----------------------------
  function autodetectCocrea(){ const names=['project','IDE','cocrea','app','runtime','Cocrea']; const found=[]; names.forEach(n=>{ try{ if(window[n]) found.push(n);}catch(e){} }); if(!found.length){ if(document.getElementById('stage')) found.push('stage element (DOM)'); const ds=document.querySelector('[data-stage]'); if(ds) found.push('data-stage DOM'); } log('Autodetected runtime targets: ' + found.join(', ')); return found; }
  function boot(){ try{ buildPanel(); autodetectCocrea(); window.addEventListener('error', (e)=> { reportError(e.error || e); }); window.addEventListener('unhandledrejection', (e)=> { reportError(e.reason || e); }); log('MultiTool loaded'); }catch(e){ reportError(e); } }

  window.CocreaMultiTool = { boot, settings, state, createTimer, startTimer, stopTimer, resetTimer: resetTimer, makeBlock, runLocalAi: runLocalAi, reportError, doPopout: doPopout };
  setTimeout(()=>{ boot(); }, 250);

  // expose helper functions used above in global scope (so API exists)
  // minimal stubs if referenced externally
  function createTimer(opts){ return (function(){ /* placeholder implemented above */ })(); }
  function startTimer(id){}
  function stopTimer(id){}
  function resetTimer(id){}
  function makeBlock(o){}
  function runLocalAi(p){ return 'Local AI ready.'; }
  function doPopout(sel){ try{ const el = document.querySelector(sel); if(!el) throw new Error('Selector not found'); const nw = window.open('', '_blank', 'width=1000,height=700'); if(!nw) throw new Error('Popup blocked'); nw.document.title = 'Popout: '+sel; nw.document.body.appendChild(el.cloneNode(true)); }catch(e){ reportError(e); } }

})(window);
