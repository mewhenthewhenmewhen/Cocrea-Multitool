# Cocrea MultiTool — modular skeleton

Place files as:
- `index.html`
- `main.js`
- `tools/ai-tool.js`
- `tools/timer-tool.js`
- `tools/inspector-tool.js`

Open `index.html` (or publish via GitHub Pages). Click the top-right **MultiTool** button to load and open tool panels.

Notes:
- Tools are ES modules; `main.js` imports `./tools/*.js`.
- Each tool exports `default async function init(core)` and should call `core.registerTool(name, api)`.
- Core exposes a small API for timers and events: `createTimer`, `startTimer`, `stopTimer`, `resetTimer`, `on`, `emit`.
