/* =========================================================================
   Cocrea Multitool - Main Core Script (with built-in timer API)
   ========================================================================= */

window.CocreaMultiToolCore = (function(){
  const core = {
    tools: {},
    logs: [],
    _listeners: {}
  };

  core.log = function(msg){
    console.log('[MT]', msg);
    this.logs.push({ t: new Date().toISOString(), m: msg });
  };

  // event emitter
  core.on = function(ev, fn){ this._listeners[ev] = this._listeners[ev] || []; this._listeners[ev].push(fn); };
  core.off = function(ev, fn){ if(!this._listeners[ev]) return; this._listeners[ev] = this._listeners[ev].filter(f=>f!==fn); };
  core.emit = function(ev, data){ (this._listeners[ev]||[]).forEach(f=>{ try{ f(data); }catch(e){ console.warn('event handler error', e); } }); };

  // timers storage + API
  core.timers = {};

  core.createTimer = function({ id=null, mode='stopwatch', seconds=0 } = {}){
    const tid = id || `t_${Date.now()}_${Math.floor(Math.random()*9000)}`;
    const t = { id: tid, mode, targetSeconds: Number(seconds)||0, elapsed:0, running:false, _last:0, _raf:null };
    this.timers[tid] = t;
    this.emit('timer:create', t);
    this.log('createTimer: ' + tid);
    return tid;
  };

  function _tick(t){
    if(!t.running) return;
    const now = performance.now();
    t.elapsed += (now - t._last);
    t._last = now;
    core.emit('timer:update', t);
    t._raf = requestAnimationFrame(()=> _tick(t));
    if(t.mode === 'timer' && t.targetSeconds>0 && (t.elapsed/1000) >= t.targetSeconds){
      t.running = false;
      if(t._raf) { cancelAnimationFrame(t._raf); t._raf = null; }
      core.emit('timer:finished', t);
    }
  }

  core.startTimer = function(id){
    const t = this.timers[id];
    if(!t) { this.log('startTimer: unknown id ' + id); return; }
    if(t.running) return;
    t.running = true; t._last = performance.now();
    _tick(t);
    this.emit('timer:start', t);
  };

  core.stopTimer = function(id){
    const t = this.timers[id];
    if(!t) return;
    t.running = false;
    if(t._raf) { cancelAnimationFrame(t._raf); t._raf = null; }
    this.emit('timer:stop', t);
  };

  core.resetTimer = function(id){
    const t = this.timers[id];
    if(!t) return;
    t.running = false;
    if(t._raf) { cancelAnimationFrame(t._raf); t._raf = null; }
    t.elapsed = 0; t._last = 0;
    this.emit('timer:reset', t);
  };

  /* ------------------------------------------------------------
     Dynamic tool loader (paths list)
  ------------------------------------------------------------ */
  const TOOLS = [
    './tools/timer-tool.js',
    './tools/ai-tool.js'
  ];

  core.loadAllTools = async function(){
    this.log('Loading tools...');
    for(const path of TOOLS){
      try{
        const mod = await import(path);
        if(mod?.default){
          await mod.default(this);
          this.log('Loaded tool: ' + path);
        }else{
          this.log('No default export in ' + path);
        }
      }catch(e){
        console.error('Error loading tool', path, e);
        this.log('❌ Failed to load ' + path + ': ' + (e.message || e));
      }
    }
    this.log('All tools attempted to load.');
  };

  core.registerTool = function(name, api){
    this.tools[name] = api;
    this.log('Tool registered: ' + name);
    return this.tools[name];
  };

  core.openToolPanel = async function(name){
    const tool = this.tools[name];
    if(tool && typeof tool.openPanel === 'function'){
      try { return tool.openPanel(); } catch(e){ console.warn('tool.openPanel threw', e); alert('Tool panel failed to open: ' + (e.message||e)); return; }
    }

    // find module path
    const path = TOOLS.find(p => p.endsWith('/' + name) || p.endsWith(name));
    if(!path){ alert('Tool panel not exposed by ' + name + ' (no path found)'); return; }

    try{
      const m = await import(path);
      if(typeof m?.default === 'function') await m.default(this);
    }catch(e){
      console.error('Failed to import tool module', path, e);
      alert('Failed to load tool ' + name + ': ' + (e.message||e));
      return;
    }

    const toolAfter = this.tools[name];
    if(toolAfter && typeof toolAfter.openPanel === 'function'){
      try { return toolAfter.openPanel(); } catch(e){ console.warn('tool.openPanel threw after import', e); alert('Tool panel failed to open: ' + (e.message||e)); return; }
    }

    alert('Tool panel not exposed by ' + name);
  };

  /* ------------------------------------------------------------
     Small dashboard UI to open tool panels
  ------------------------------------------------------------ */
  core.showDashboard = function(){
    if(this._dash) return;
    const dash = document.createElement('div');
    dash.id = 'mt-dashboard';
    Object.assign(dash.style, { position:'fixed', right:'12px', top:'12px', width:'220px', background:'#0f1724', color:'#e6eef6', padding:'10px', borderRadius:'8px', boxShadow:'0 12px 30px rgba(0,0,0,.6)', zIndex:2147483647 });
    dash.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center"><strong>MultiTool</strong><button id="mt-close" style="background:transparent;border:0;color:#9fb7d8">×</button></div>
      <div style="margin-top:8px"><button id="mt-open-timer" style="width:100%;margin-bottom:6px">⏱️ Timer Tool</button><button id="mt-open-ai" style="width:100%;">🤖 AI Tool</button></div>`;
    document.body.appendChild(dash);
    dash.querySelector('#mt-close').addEventListener('click', ()=> { dash.remove(); this._dash = null; });
    dash.querySelector('#mt-open-timer').addEventListener('click', ()=> this.openToolPanel('timer-tool.js'));
    dash.querySelector('#mt-open-ai').addEventListener('click', ()=> this.openToolPanel('ai-tool.js'));
    this._dash = dash;
  };

  core.start = async function(){
    this.log('Booting Multitool Core...');
    await this.loadAllTools();
    this.showDashboard();
    this.log('Dashboard displayed.');
  };

  return core;
})();

// auto start after DOM ready
document.addEventListener('DOMContentLoaded', () => {
  if(window.CocreaMultiToolCore && typeof window.CocreaMultiToolCore.start === 'function'){
    window.CocreaMultiToolCore.start();
  } else {
    console.warn('Multitool core missing start()');
  }
});
