// main.js
// Core orchestrator for modular tools. Exposes a small core API to tools.
// Place at repo root and reference from index.html as a module.

const TOOLS = [
  './tools/timer-tool.js',
  './tools/ai-tool.js',
  './tools/inspector-tool.js'
];

class Core {
  constructor(){
    this.tools = {};
    this.timers = {}; // simple timer storage
    this._listeners = {};
    // basic UI root: a top-right launcher button
    this.mountRoot();
    window.CocreaMultiToolCore = this; // expose for debugging
  }

  mountRoot(){
    if(document.getElementById('mt-core-root')) return;
    const root = document.createElement('div');
    root.id = 'mt-core-root';
    Object.assign(root.style, { position:'fixed', right:'12px', top:'12px', zIndex:2147483647 });
    const btn = document.createElement('button');
    btn.textContent = 'MultiTool';
    Object.assign(btn.style, { background:'#1f6feb', color:'#fff', padding:'8px 10px', borderRadius:'8px', border:'none', cursor:'pointer' });
    root.appendChild(btn);
    document.body.appendChild(root);
    btn.addEventListener('click', ()=> this.openDashboard());
  }

  async loadAllTools(){
    // load modules dynamically and call init(core)
    for(const path of TOOLS){
      try{
        const m = await import(path);
        if(typeof m?.default === 'function'){
          const name = path.split('/').pop();
          try{
            await m.default(this);
            this.tools[name] = { path, loaded: true };
            this.log(`Loaded tool: ${name}`);
          }catch(e){
            this.log(`Tool init error ${name}: ${e.message||e}`);
          }
        }else{
          this.log(`Tool ${path} has no default export(init)`);
        }
      }catch(e){
        this.log(`Failed to import ${path}: ${e.message||e}`);
      }
    }
  }

  // simple timer API for tools
  createTimer({ id=null, mode='stopwatch', seconds=0 } = {}){
    const tid = id || `t_${Date.now()}_${Math.floor(Math.random()*9000)}`;
    const t = { id:tid, mode, targetSeconds: Number(seconds)||0, elapsed:0, running:false, _last:0 };
    this.timers[tid] = t;
    this.emit('timer:create', t);
    return tid;
  }
  startTimer(id){
    const t = this.timers[id]; if(!t) return;
    if(t.running) return;
    t.running = true; t._last = performance.now();
    const tick = () => {
      if(!t.running) return;
      const now = performance.now();
      t.elapsed += (now - t._last);
      t._last = now;
      this.emit('timer:update', t);
      t._raf = requestAnimationFrame(tick);
      if(t.mode === 'timer' && t.targetSeconds>0 && (t.elapsed/1000) >= t.targetSeconds){
        t.running = false;
        cancelAnimationFrame(t._raf);
        t._raf = null;
        this.emit('timer:finished', t);
      }
    };
    t._raf = requestAnimationFrame(tick);
    this.emit('timer:start', t);
  }
  stopTimer(id){
    const t = this.timers[id]; if(!t) return;
    t.running = false; if(t._raf) cancelAnimationFrame(t._raf); t._raf = null;
    this.emit('timer:stop', t);
  }
  resetTimer(id){
    const t = this.timers[id]; if(!t) return;
    t.running = false; t.elapsed = 0; t._last = 0; if(t._raf) cancelAnimationFrame(t._raf); t._raf = null;
    this.emit('timer:reset', t);
  }

  // event system
  on(ev, fn){ this._listeners[ev] = this._listeners[ev] || []; this._listeners[ev].push(fn); }
  off(ev, fn){ if(!this._listeners[ev]) return; this._listeners[ev] = this._listeners[ev].filter(f=>f!==fn); }
  emit(ev, data){ (this._listeners[ev]||[]).forEach(f=>{ try{ f(data); }catch(e){ console.warn('event handler error',e); } }); }

  log(msg){ console.log('[MT-Core]', msg); }
  // UI: lightweight dashboard that shows loaded tools and lets user open each tool's panel
  openDashboard(){
    if(this._dash){
      this._dash.remove(); this._dash = null; return;
    }
    const d = document.createElement('div'); this._dash = d;
    Object.assign(d.style, { position:'fixed', right:'12px', top:'56px', width:'380px', background:'#0f1724', color:'#e6eef6', padding:'10px', borderRadius:'8px', boxShadow:'0 12px 40px rgba(0,0,0,.6)', zIndex:2147483648 });
    d.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center"><strong>MultiTool Dashboard</strong><button id="mt-dclose" style="background:transparent;border:0;color:#9fb7d8;cursor:pointer">Close</button></div><div id="mt-tools-list" style="margin-top:8px"></div>`;
    document.body.appendChild(d);
    d.querySelector('#mt-dclose').addEventListener('click', ()=> { d.remove(); this._dash = null; });
    this.renderDashboard();
  }
  renderDashboard(){
    const list = document.getElementById('mt-tools-list');
    if(!list) return;
    list.innerHTML = '';
    for(const p of TOOLS){
      const name = p.split('/').pop();
      const row = document.createElement('div');
      row.style.display='flex'; row.style.justifyContent='space-between'; row.style.padding='6px 0';
      const left = document.createElement('div'); left.textContent = name;
      const right = document.createElement('div');
      const btn = document.createElement('button'); btn.textContent = 'Open'; btn.style.marginLeft='8px';
      btn.addEventListener('click', ()=> this.openToolPanel(name));
      right.appendChild(btn);
      row.appendChild(left); row.appendChild(right);
      list.appendChild(row);
    }
  }

  openToolPanel(name){
    // try to call tool's 'openPanel' if it exposed one during init
    const tool = this.tools[name];
    if(tool && tool.openPanel) return tool.openPanel();
    alert('Tool panel not exposed by '+name);
  }

  // allow tools to register themselves
  registerTool(name, api){
    this.tools[name] = Object.assign({ path: null, loaded: true }, api);
    this.log('Tool registered: ' + name);
    return this.tools[name];
  }
}

const core = new Core();
core.loadAllTools();
export default core;
