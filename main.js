/* =========================================================================
   Cocrea Multitool - Main Core Script
   -------------------------------------------------------------------------
   Purpose: Central manager that dynamically loads all tool modules.
   Each tool file is in /tools/ and exports a default init(core) function.
   ========================================================================= */

window.CocreaMultiToolCore = {
  tools: {},   // Registered tools
  logs: [],    // Log messages
  dashboard: null,

  /* ------------------------------------------------------------
     Utility log helper
  ------------------------------------------------------------ */
  log(msg) {
    console.log('[MT]', msg);
    this.logs.push({ t: new Date().toISOString(), m: msg });
  },

  /* ------------------------------------------------------------
     Initialize all tools listed below
  ------------------------------------------------------------ */
  async loadAllTools() {
    this.log('Loading tools...');
    // Add new tool file paths here ↓
    const TOOLS = [
      './tools/timer-tool.js',
      './tools/ai-tool.js',
    ];

    for (const path of TOOLS) {
      try {
        const mod = await import(path);
        if (mod?.default) {
          await mod.default(this);
          this.log('Loaded tool: ' + path);
        } else {
          this.log('No default export in ' + path);
        }
      } catch (e) {
        console.error('Error loading tool', path, e);
        this.log('❌ Failed to load ' + path + ': ' + e.message);
      }
    }

    this.log('All tools attempted to load.');
  },

  /* ------------------------------------------------------------
     Register a tool (called by each tool file)
  ------------------------------------------------------------ */
  registerTool(name, api) {
    this.tools[name] = api;
    this.log(`Tool registered: ${name}`);
  },

  /* ------------------------------------------------------------
     Open a tool’s panel (lazy import + init if needed)
  ------------------------------------------------------------ */
  async openToolPanel(name) {
    const tool = this.tools[name];
    if (tool && typeof tool.openPanel === 'function') {
      try {
        return tool.openPanel();
      } catch (e) {
        console.warn('tool.openPanel threw', e);
        alert('Tool panel failed to open: ' + (e.message || e));
        return;
      }
    }

    // Try to find a matching module path for this tool
    const TOOLS = [
      './tools/timer-tool.js',
      './tools/ai-tool.js',
    ];
    const path = TOOLS.find(p => p.endsWith('/' + name) || p.endsWith(name));
    if (!path) {
      alert('Tool panel not exposed by ' + name + ' (no path found)');
      return;
    }

    // Attempt dynamic import and re-init
    try {
      const m = await import(path);
      if (typeof m?.default === 'function') await m.default(this);
    } catch (e) {
      console.error('Failed to import tool module', path, e);
      alert('Failed to load tool ' + name + ': ' + (e.message || e));
      return;
    }

    // Try again
    const toolAfter = this.tools[name];
    if (toolAfter && typeof toolAfter.openPanel === 'function') {
      try {
        return toolAfter.openPanel();
      } catch (e) {
        console.warn('tool.openPanel threw after import', e);
        alert('Tool panel failed to open: ' + (e.message || e));
        return;
      }
    }

    alert('Tool panel not exposed by ' + name);
  },

  /* ------------------------------------------------------------
     Dashboard UI
  ------------------------------------------------------------ */
  showDashboard() {
    if (this.dashboard) return;

    const dash = document.createElement('div');
    dash.id = 'mt-dashboard';
    dash.innerHTML = `
      <div style="background:#1e1e1e;color:white;padding:10px;
                  position:fixed;top:20px;left:20px;width:250px;
                  border-radius:10px;z-index:9999;box-shadow:0 0 10px #000;">
        <h3 style="margin-top:0;">🛠️ Multitool</h3>
        <button id="mt-btn-timer" style="width:100%;margin-bottom:5px;">⏱️ Timer Tool</button>
        <button id="mt-btn-ai" style="width:100%;margin-bottom:5px;">🤖 AI Tool</button>
        <hr>
        <button id="mt-close" style="width:100%;background:#a33;">Close</button>
      </div>
    `;
    document.body.appendChild(dash);
    this.dashboard = dash;

    dash.querySelector('#mt-btn-timer').onclick = () => this.openToolPanel('timer-tool.js');
    dash.querySelector('#mt-btn-ai').onclick = () => this.openToolPanel('ai-tool.js');
    dash.querySelector('#mt-close').onclick = () => {
      dash.remove();
      this.dashboard = null;
    };
  },

  /* ------------------------------------------------------------
     Boot
  ------------------------------------------------------------ */
  async start() {
    this.log('Booting Multitool Core...');
    await this.loadAllTools();
    this.showDashboard();
    this.log('Dashboard displayed.');
  },
};

// Auto-run once DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.CocreaMultiToolCore.start();
});
