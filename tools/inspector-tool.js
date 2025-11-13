// tools/inspector-tool.js
// Minimal inspector: scans likely runtime globals and shows a small list
export default async function init(core){
  const NAME = 'inspector-tool.js';
  let panel = null;

  function openPanel(){
    if(panel){ panel.remove(); panel = null; return; }
    panel = document.createElement('div');
    Object.assign(panel.style, { position:'fixed', right:'12px', bottom:'12px', width:'380px', background:'#061426', color:'#e6eef6', padding:'10px', borderRadius:'8px', boxShadow:'0 8px 30px rgba(0,0,0,.6)', zIndex:2147483649 });
    panel.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center"><strong>Inspector</strong><button id="ins-close" style="background:transparent;border:0;color:#9fb7d8">×</button></div>
      <div style="margin-top:8px;display:flex;gap:8px"><input id="ins-filter" placeholder="filter (e.g., project)" style="flex:1;padding:6px;border-radius:6px;background:#041021;color:#e6eef6;border:1px solid rgba(255,255,255,0.04)"><button id="ins-scan" style="background:#1f6feb;color:#fff;border:none;padding:6px 8px;border-radius:6px;cursor:pointer">Scan</button></div>
      <div id="ins-list" style="margin-top:8px;max-height:260px;overflow:auto"></div>`;
    document.body.appendChild(panel);
    panel.querySelector('#ins-close').addEventListener('click', ()=>{ panel.remove(); panel=null; });
    panel.querySelector('#ins-scan').addEventListener('click', ()=> renderList());
  }

  function renderList(){
    if(!panel) return;
    const dst = panel.querySelector('#ins-list'); dst.innerHTML = '';
    const filter = (panel.querySelector('#ins-filter').value||'').toLowerCase();
    const names = ['project','IDE','cocrea','app','runtime','Cocrea'];
    const found = [];
    for(const n of names) try{ if(window[n]) found.push(n); }catch(e){}
    // also scan window keys heuristically
    try{
      Object.keys(window).slice(0,500).forEach(k=>{
        if(k.toLowerCase().includes('project')||k.toLowerCase().includes('sprite')||k.toLowerCase().includes('stage')||k.toLowerCase().includes('cocrea')) found.push(k);
      });
    }catch(e){}
    const uniq = Array.from(new Set(found)).filter(n => !filter || n.toLowerCase().includes(filter));
    if(!uniq.length) { dst.innerHTML = '<div class="small">No runtime candidates found.</div>'; return; }
    uniq.forEach(n=>{
      const val = window[n];
      const row = document.createElement('div'); row.style.padding='6px 0'; row.style.borderBottom='1px solid rgba(255,255,255,0.03)';
      const title = document.createElement('div'); title.innerHTML = `<strong>${n}</strong> <span style="color:#9fb7d8;font-size:12px">${typeof val}</span>`;
      const preview = document.createElement('div'); try{ if(typeof val==='object' && val !== null) preview.textContent = Object.keys(val).slice(0,8).join(', '); else preview.textContent = String(val).slice(0,120); }catch(e){ preview.textContent = '[unreadable]'; }
      const btn = document.createElement('button'); btn.textContent = 'Open'; btn.style.marginTop='6px'; btn.addEventListener('click', ()=> {
        // open small editor popup
        const w = window.open('', '_blank', 'width=640,height=480'); if(!w) return alert('Allow popups'); w.document.body.style.padding='8px'; const ta = w.document.createElement('textarea'); ta.style.width='100%'; ta.style.height='70%'; try{ ta.value = JSON.stringify(val, null, 2); }catch(e){ ta.value = String(val); } const apply = w.document.createElement('button'); apply.textContent = 'Apply'; apply.style.marginTop='8px'; apply.addEventListener('click', ()=> {
          try{
            const parsed = JSON.parse(ta.value);
            window[n] = parsed;
            alert('Applied to ' + n);
          }catch(err){ alert('Failed: '+err.message); }
        }); w.document.body.appendChild(ta); w.document.body.appendChild(apply);
      });
      row.appendChild(title); row.appendChild(preview); row.appendChild(btn); dst.appendChild(row);
    });
  }

  core.registerTool(NAME, { openPanel });
}
