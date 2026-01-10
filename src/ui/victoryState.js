import { clearSave } from '../gameplay/storage.js';

export class VictoryState {
  constructor(services) {
    this.s = services;
    this.t = 0;
    this._confetti = null;
  }

  enter() {
    this.t = 0;
    this._confetti = makeConfetti(90, this.s.canvas.width, this.s.canvas.height);
    const m = this.s.game.model;
    this.s.hud.clear();
    this.s.hud.setCard('victory', `
      <div style="max-width:420px">
        <div style="font-size:18px;font-weight:700;margin-bottom:4px">Победа!</div>
        <div class="small" style="margin-bottom:12px">Босс повержен. Сессия завершена.</div>
        <div class="small" style="margin-bottom:10px">
          Ходы: <b>${m.progression.turns}</b> • Победы: <b>${m.progression.wins}</b> • Крупные победы: <b>${m.progression.majorWins}</b>
        </div>
        <div class="small" style="margin-bottom:14px">Итог: Золото <b>${m.res.gold}</b> • VE <b>${m.res.ve}</b></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button data-action="restart">Новая игра</button>
          <button data-action="menu">В меню</button>
        </div>
      </div>
    `);

    this.s.hud.on('victory', 'click', 'button[data-action="restart"]', () => {
      clearSave();
      this.s.game.startNewGame();
      this.s.game.sm.go('overworld');
    });
    this.s.hud.on('victory', 'click', 'button[data-action="menu"]', () => {
      clearSave();
      this.s.game.model = null;
      this.s.game.sm.go('title');
    });
  }

  exit() { this.s.hud.clear(); }
  update(dt) {
    this.t += dt;
    if (this._confetti) {
      for (const c of this._confetti) {
        c.y += c.vy * dt;
        c.x += c.vx * dt;
        c.r += c.vr * dt;
        if (c.y > c.h + 20) {
          c.y = -20;
          c.x = Math.random() * c.w;
        }
      }
    }
  }
  render() {
    const { ctx, canvas } = this.s;
    drawVictoryScene(ctx, canvas, this.t, this._confetti);
  }
}

function makeConfetti(n, w, h) {
  const a = [];
  for (let i = 0; i < n; i++) {
    a.push({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: -12 + Math.random() * 24,
      vy: 40 + Math.random() * 110,
      r: Math.random() * Math.PI * 2,
      vr: -3 + Math.random() * 6,
      s: 3 + Math.random() * 6,
      a: 0.25 + Math.random() * 0.35,
      w, h,
    });
  }
  return a;
}

function drawVictoryScene(ctx, canvas, t, confetti) {
  const w = canvas.width, h = canvas.height;
  const cx = w * 0.55, cy = h * 0.48;
  const pulse = 0.55 + 0.25 * Math.sin(t * 2.0);

  // Dark base
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, 'rgba(10,12,16,1)');
  g.addColorStop(1, 'rgba(6,7,9,1)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // Warm victory glow (same "soft glow" style as events)
  const rg = ctx.createRadialGradient(cx, cy, 20, cx, cy, 420);
  rg.addColorStop(0, `rgba(255,214,120,${0.12 + 0.12 * pulse})`);
  rg.addColorStop(0.55, 'rgba(255,214,120,0.03)');
  rg.addColorStop(1, 'rgba(255,214,120,0)');
  ctx.fillStyle = rg;
  ctx.beginPath();
  ctx.arc(cx, cy, 420, 0, Math.PI * 2);
  ctx.fill();

  // Rays
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(t * 0.15);
  ctx.strokeStyle = `rgba(255,214,120,${0.10 + 0.08 * pulse})`;
  ctx.lineWidth = 2;
  for (let i = 0; i < 14; i++) {
    ctx.rotate((Math.PI * 2) / 14);
    ctx.beginPath();
    ctx.moveTo(90, 0);
    ctx.lineTo(240 + 18 * Math.sin(t * 1.2 + i), 0);
    ctx.stroke();
  }
  ctx.restore();

  // Crown-like emblem
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = `rgba(255,214,120,${0.22 + 0.10 * pulse})`;
  ctx.strokeStyle = 'rgba(255,255,255,0.10)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-66, 40);
  ctx.lineTo(-46, -10);
  ctx.lineTo(-18, 22);
  ctx.lineTo(0, -18);
  ctx.lineTo(18, 22);
  ctx.lineTo(46, -10);
  ctx.lineTo(66, 40);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(0,0,0,0.20)';
  ctx.fillRect(-70, 40, 140, 16);
  ctx.restore();

  // Confetti
  if (confetti) {
    for (const c of confetti) {
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(c.r);
      ctx.fillStyle = `rgba(255,214,120,${c.a})`;
      ctx.fillRect(-c.s * 0.6, -c.s * 0.25, c.s * 1.2, c.s * 0.5);
      ctx.restore();
    }
  }

  // Caption kept subtle (sidebar contains primary text)
  ctx.fillStyle = 'rgba(255,255,255,0.78)';
  ctx.font = '15px system-ui';
  ctx.fillText('Славная победа. Цикл завершён.', 26, 42);

  // Vignette
  ctx.fillStyle = 'rgba(0,0,0,0.26)';
  ctx.beginPath();
  ctx.ellipse(w * 0.5, h * 0.56, w * 0.55, h * 0.46, 0, 0, Math.PI * 2);
  ctx.fill();
}
