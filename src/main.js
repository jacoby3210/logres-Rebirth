import { Game } from './core/game.js';

const canvas = document.getElementById('game');
const hudRoot = document.getElementById('hud');
const stage = document.getElementById('stage');

const game = new Game({ canvas, hudRoot });
game.start();

// Responsive scaling: keep internal resolution (for deterministic gameplay), scale visually via CSS.
function resizeCanvas() {
  // Scale to the available stage area (excluding sidebar).
  // Use clientWidth/Height so padding/scrollbars are handled correctly.
  const w = Math.max(320, stage.clientWidth);
  const h = Math.max(240, stage.clientHeight);
  const sx = w / canvas.width;
  const sy = h / canvas.height;
  const scale = Math.min(sx, sy, 1.5);

  // Round down and clamp to avoid any overflow that could visually overlap the sidebar.
  const cw = Math.min(w, Math.floor(canvas.width * scale));
  const ch = Math.min(h, Math.floor(canvas.height * scale));
  canvas.style.width = cw + 'px';
  canvas.style.height = ch + 'px';
}
window.addEventListener('resize', resizeCanvas);
if (window.visualViewport) window.visualViewport.addEventListener('resize', resizeCanvas);
resizeCanvas();

window.__game = game; // debug handle
