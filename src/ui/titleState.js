import { hasSave, clearSave } from '../gameplay/storage.js';

export class TitleState {
  constructor(services) {
    this.s = services;
    this.t = 0;
    this._particles = null;
  }

  enter() {
    this.t = 0;
    this._particles = makeParticles(72, this.s.canvas.width, this.s.canvas.height);
    this.s.hud.clear();
    const hasLocalSave = hasSave();
    const canContinue = !!this.s.game.model;

    this.s.hud.setCard('title', `
      <div style="max-width:320px">
        <div style="font-size:18px;font-weight:700;margin-bottom:4px">Королевства Логреса: Возрождение</div>
        <div class="small" style="margin-bottom:10px">Веб-версия (Этап 3)</div>

        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button data-action="new">Новая игра</button>
          <button data-action="cont" ${canContinue ? '' : 'disabled'} title="Доступно, если удалось загрузить сохранение">Продолжить</button>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
          <button data-action="reset" ${hasLocalSave ? '' : 'disabled'} title="Удалить сохранение из localStorage">Сбросить сохранение</button>
        </div>
        ${hasLocalSave && !canContinue ? `<div class="small" style="margin-top:10px;opacity:.8">Примечание: сохранение найдено, но не удалось загрузить (возможно, повреждено). Нажмите «Сбросить сохранение».</div>` : ''}
      </div>
    `);

    this.s.hud.on('title', 'click', 'button[data-action="new"]', () => {
      if (hasLocalSave) {
        const ok = window.confirm('Начать новую игру? Текущий прогресс будет перезаписан.');
        if (!ok) return;
      }
      this.s.audio?.play('click');
      this.s.game.startNewGame();
      this.s.game.sm.go('overworld');
    });

    this.s.hud.on('title', 'click', 'button[data-action="cont"]', () => {
      this.s.audio?.play('click');
      // model already loaded in Game.start(); fallback: try again.
      if (!this.s.game.model) this.s.game.tryLoadSave();
      if (!this.s.game.model) {
        this.s.hud.toast('Не удалось загрузить сохранение.');
        return;
      }
      this.s.game.sm.go('overworld');
    });

    this.s.hud.on('title', 'click', 'button[data-action="reset"]', () => {
      if (!hasLocalSave) return;
      const ok = window.confirm('Сбросить сохранение? Это действие нельзя отменить.');
      if (!ok) return;
      clearSave();
      this.s.game.model = null;
      this.s.hud.toast('Сохранение удалено.');
      this.s.audio?.play('click');
      this.enter();
    });
  }

  exit() {
    this.s.hud.clear();
  }

  update(dt) {
    this.t += dt;
    // gentle drift
    if (this._particles) {
      for (const p of this._particles) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.x < -30) p.x = p.w + 30;
        if (p.x > p.w + 30) p.x = -30;
        if (p.y < -30) p.y = p.h + 30;
        if (p.y > p.h + 30) p.y = -30;
      }
    }
  }

  render() {
    const { ctx, canvas } = this.s;
    drawTitleScene(ctx, canvas, this.t, this._particles);

    // Subtle caption (kept small so it doesn't compete with sidebar).
    ctx.fillStyle = 'rgba(255,255,255,0.70)';
    ctx.font = '14px system-ui';
    ctx.fillText('Короткие сессии • Тактика • Эхо Времени', 28, 40);
  }
}

function makeParticles(n, w, h) {
  const a = [];
  for (let i = 0; i < n; i++) {
    a.push({
      x: Math.random() * w,
      y: Math.random() * h,
      r: 0.8 + Math.random() * 2.2,
      a: 0.10 + Math.random() * 0.22,
      vx: -6 + Math.random() * 12,
      vy: -4 + Math.random() * 8,
      w, h,
    });
  }
  return a;
}

function drawTitleScene(ctx, canvas, t, particles) {
  const w = canvas.width, h = canvas.height;

  // Background gradient
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, 'rgba(10,14,18,1)');
  g.addColorStop(1, 'rgba(6,8,10,1)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // Misty bloom
  const cx = w * 0.62;
  const cy = h * 0.42;
  const pulse = 0.55 + 0.25 * Math.sin(t * 1.3);
  const rg = ctx.createRadialGradient(cx, cy, 20, cx, cy, 340);
  rg.addColorStop(0, `rgba(130,220,255,${0.10 + 0.10 * pulse})`);
  rg.addColorStop(0.5, 'rgba(130,220,255,0.03)');
  rg.addColorStop(1, 'rgba(130,220,255,0)');
  ctx.fillStyle = rg;
  ctx.beginPath();
  ctx.arc(cx, cy, 340, 0, Math.PI * 2);
  ctx.fill();

  // Distant silhouettes
  ctx.fillStyle = 'rgba(255,255,255,0.035)';
  ctx.beginPath();
  ctx.moveTo(0, h * 0.70);
  for (let x = 0; x <= w; x += 90) {
    const y = h * (0.62 + 0.05 * Math.sin((x * 0.012) + t * 0.3));
    ctx.quadraticCurveTo(x + 45, y - 40, x + 90, y);
  }
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fill();

  // Portal / anomaly ring (same style family as event scenes)
  const pr = 120;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(t * 0.25);
  ctx.strokeStyle = `rgba(130,220,255,${0.26 + 0.10 * pulse})`;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, pr, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 8; i++) {
    ctx.rotate(Math.PI / 4);
    ctx.beginPath();
    ctx.arc(0, 0, pr + 12 + 5 * Math.sin(t * 1.8 + i), -0.6, 0.6);
    ctx.stroke();
  }

  // Core swirl
  const core = ctx.createRadialGradient(0, 0, 12, 0, 0, 120);
  core.addColorStop(0, `rgba(130,220,255,${0.18 + 0.12 * pulse})`);
  core.addColorStop(1, 'rgba(130,220,255,0)');
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(0, 0, 120, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Drifting particles
  if (particles) {
    for (const p of particles) {
      ctx.fillStyle = `rgba(180,235,255,${p.a})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Soft vignette
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(w * 0.5, h * 0.55, w * 0.55, h * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();
}
