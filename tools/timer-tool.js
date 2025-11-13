export default function initTimerTool(core){
  console.log("[MT] Timer tool initializing...");

  const timers = {};

  // Utility to format time including milliseconds
  function formatTime(ms){
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    const millis = Math.floor(ms % 1000);
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
  }

  // Create, start, stop, reset
  function createTimer(id){
    if(timers[id]) return timers[id];
    timers[id] = {
      id,
      startTime: null,
      elapsed: 0,
      running: false,
      interval: null,
    };
    renderList();
    return timers[id];
  }

  function startTimer(id){
    const t = timers[id];
    if(!t || t.running) return;
    t.running = true;
    t.startTime = performance.now() - t.elapsed;
    t.interval = setInterval(() => {
      t.elapsed = performance.now() - t.startTime;
      updateDisplay(id);
    }, 10); // update every 10ms
  }

  function stopTimer(id){
    const t = timers[id];
    if(!t || !t.running) return;
    clearInterval(t.interval);
    t.interval = null;
    t.running = false;
    t.elapsed = performance.now() - t.startTime;
    updateDisplay(id);
  }

  function resetTimer(id){
    const t = timers[id];
    if(!t) return;
    clearInterval(t.interval);
    t.elapsed = 0;
    t.running = false;
    updateDisplay(id);
  }

  // UI
  let panel;
  function renderList(){
    if(!panel) return;
    const list = panel.querySelector(".timer-list");
    list.innerHTML = "";
    Object.values(timers).forEach(t => {
      const row = document.createElement("div");
      row.className = "timer-row";
      row.innerHTML = `
        <span class="timer-id">${t.id}</span>
        <span class="timer-time">${formatTime(t.elapsed)}</span>
        <button class="start">▶</button>
        <button class="stop">⏸</button>
        <button class="reset">⟲</button>
      `;
      row.querySelector(".start").onclick = ()=>startTimer(t.id);
      row.querySelector(".stop").onclick = ()=>stopTimer(t.id);
      row.querySelector(".reset").onclick = ()=>resetTimer(t.id);
      list.appendChild(row);
    });
  }

  function updateDisplay(id){
    const row = panel?.querySelector(`.timer-row:has(.timer-id:contains("${id}"))`);
    if(!row) return;
    const t = timers[id];
    row.querySelector(".timer-time").textContent = formatTime(t.elapsed);
  }

  function openPanel(){
    panel = document.createElement("div");
    panel.className = "tool-panel";
    panel.style = `
      position: fixed;
      top: 70px;
      right: 20px;
      width: 280px;
      background: #222;
      color: #fff;
      padding: 10px;
      border-radius: 10px;
      box-shadow: 0 0 10px #0008;
      z-index: 99999;
    `;
    panel.innerHTML = `
      <h3 style="margin-top:0;">⏱ Timer Tool</h3>
      <div>
        <input placeholder="Timer ID" class="timer-id-input" style="width:70%;">
        <button class="add-timer">Add</button>
      </div>
      <div class="timer-list" style="margin-top:10px;"></div>
    `;
    panel.querySelector(".add-timer").onclick = ()=>{
      const id = panel.querySelector(".timer-id-input").value.trim();
      if(id) createTimer(id);
    };
    document.body.appendChild(panel);
    renderList();
  }

  core.registerTool("timer-tool.js", {
    openPanel,
    createTimer,
    startTimer,
    stopTimer,
    resetTimer,
    getTimers: () => timers,
  });

  console.log("[MT] Timer tool ready.");
}
