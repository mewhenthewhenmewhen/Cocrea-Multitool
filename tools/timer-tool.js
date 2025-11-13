// tools/timer-tool.js
// Timer tool with millisecond precision and window controls (drag, resize, minimize, close).
export default function initTimerTool(core){
  console.log("[MT] Timer tool initializing...");

  // Tool-local timers (keeps UI responsive & isolated)
  const timers = {};

  // Create a panel window with drag, resize, minimize, close
  let panel = null;

  // Helpers: create element, escape
  const $ = (sel, ctx=document) => ctx.querySelector(sel);
  function $c(tag, attrs = {}, html = '') {
    const el = document.createElement(tag);
    for (const k in attrs) {
      if (k === 'style') Object.assign(el.style, attrs[k]);
      else el.setAttribute(k, attrs[k]);
    }
    if (html) el.innerHTML = html;
    return el;
  }
  function escapeHtml(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  // Formatting hh:mm:ss.mmm
  function formatTime(ms){
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    const millis = Math.floor(ms % 1000);
    return `${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}.${String(millis).padStart(3,'0')}`;
  }

  // Timer ops (local)
  function createTimer(id){
    const tid = id || `t${Date.now().toString().slice(-6)}`;
    if(timers[tid]) return timers[tid];
    const t = { id: tid, mode: 'stopwatch', target: 0, elapsed: 0, running: false, startTime: 0, interval: null };
    timers[tid] = t;
    renderList();
    return t;
  }
  function startTimer(id){
    const t = timers[id]; if(!t) return;
    if(t.running) return;
    t.running = true;
    t.startTime = performance.now() - t.elapsed;
    // use setInterval with 10ms for display updates (keeps CPU okay)
    t.interval = setInterval(()=> {
      t.elapsed = performance.now() - t.startTime;
      updateDisplay(id);
    }, 10);
    updateDisplay(id);
  }
  function stopTimer(id){
    const t = timers[id]; if(!t) return;
    if(!t.running) return;
    t.running = false;
    if(t.interval){ clearInterval(t.interval); t.interval = null; }
    t.elapsed = performance.now() - t.startTime;
    updateDisplay(id);
  }
  function resetTimer(id){
    const t = timers[id]; if(!t) return;
    if(t.interval){ clearInterval(t.interval); t.interval = null; }
    t.elapsed = 0;
    t.running = false;
    t.startTime = 0;
    updateDisplay(id);
  }

  // UI helpers: drag and resize
  function makeDraggable(el, handle){
    handle = handle || el;
    handle.style.touchAction = 'none';
    let dragging = false, sx=0, sy=0, ox=0, oy=0;
    handle.addEventListener('mousedown', e=>{
      dragging = true; sx=e.clientX; sy=e.clientY; const r = el.getBoundingClientRect(); ox=r.left; oy=r.top;
      document.addEventListener('mousemove', mm); document.addEventListener('mouseup', mu); e.preventDefault();
    });
    handle.addEventListener('touchstart', e=>{
      const t = e.touches[0]; dragging=true; sx=t.clientX; sy=t.clientY; const r=el.getBoundingClientRect(); ox=r.left; oy=r.top;
      document.addEventListener('touchmove', tm); document.addEventListener('touchend', mu); e.preventDefault();
    });
    function mm(e){ if(!dragging) return; const dx = e.clientX - sx, dy = e.clientY - sy; el.style.left = (ox + dx) + 'px'; el.style.top = (oy + dy) + 'px'; }
    function tm(e){ if(!dragging) return; const t = e.touches[0]; const dx = t.clientX - sx, dy = t.clientY - sy; el.style.left = (ox + dx) + 'px'; el.style.top = (oy + dy) + 'px'; }
    function mu(){ dragging=false; document.removeEventListener('mousemove', mm); document.removeEventListener('touchmove
