import { saveGame } from './storage.js';
import { clampResources } from './economy.js';

export class PostBattleState {
  constructor(services, payload) {
    this.s = services;
    this.payload = payload; // { result, battleType, rewards, report }
  }

  enter() {
    const m = this.s.game.model;
    const p = this.payload;

    let overflowInfo = null;

    if (p.result === 'win') {
      m.res.gold += p.rewards.gold;
      m.res.ve += p.rewards.ve;
      overflowInfo = clampResources(m);
      m.progression.wins += 1;
      if (p.battleType !== 'enemy') m.progression.majorWins += 1;
      if (p.battleType === 'boss') m.progression.bossDefeated = true;
    }

    m.lastBattle = p.report || null;
    saveGame(m);

    this.s.hud.clear();
    this.renderHUD();

    if (p.result === 'win') this.startWinFx();

    this.s.hud.on('pb', 'click', 'button[data-action="cont"]', () => {
      // If boss is defeated, finish the run.
      if (p.result === 'win' && p.battleType === 'boss') {
        this.s.game.sm.go('victory');
      } else {
        this.s.game.sm.go('overworld');
      }
    });
    this.s.hud.on('pb', 'click', 'button[data-action="echo"]', () => {
      this.s.game.sm.go('echo', { from: 'postBattle' });
    });
    this.s.hud.on('pb', 'click', 'button[data-action="menu"]', () => {
      this.s.game.sm.go('title');
    });
  }

  exit() {
    this.s.hud.clear();
  }

  renderHUD() {
    const m = this.s.game.model;
    const p = this.payload;
    const title = p.result === 'win' ? 'Победа!' : 'Поражение';
    const rewardText = p.result === 'win'
      ? `Награда: <b>+${p.rewards.gold}</b> золота • <b>+${p.rewards.ve}</b> VE`
      : 'Армия разбита. Вы можете начать заново.';

    const losses = (p.report?.losses || []).map(l => `${l.name}: -${l.lost}`).join(' • ');
    const lossesText = losses ? `<div class="small" style="margin-top:6px">Потери: ${losses}</div>` : '';

    this.s.hud.setCard('pb', `
      <div style="min-width:340px">
        <div style="font-weight:700;margin-bottom:6px">${title}</div>
        <div class="small">${rewardText}</div>
        ${p.result === 'win' && p.rewards?.ve > 0 ? `<div class="small" style="margin-top:6px">VE копится от боёв, а при переполнении конвертируется в золото.</div>` : ''}
        ${lossesText}
        <div class="small" style="margin:10px 0 10px">VE: <b>${m.res.ve}</b> • Золото: <b>${m.res.gold}</b></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          ${p.result === 'win' ? `<button data-action="cont">${p.battleType === 'boss' ? 'Завершить' : 'Продолжить'}</button>` : '<button data-action="menu">В меню</button>'}
          ${p.result === 'win' ? '<button data-action="echo">Эхо Времени</button>' : ''}
        </div>
      </div>
    `);
  }


  startWinFx() {
    const { canvas } = this.s;
    const cx = Math.floor(canvas.width * 0.50);
    const cy = Math.floor(canvas.height * 0.52);
    const nMotes = (this.s.prefs?.reducedMotion) ? 16 : 38;
    const nStreaks = (this.s.prefs?.reducedMotion) ? 8 : 18;
    const motes = [];
    const streaks = [];
    for (let i = 0; i < nMotes; i++) {
      const a = Math.random() * Math.PI * 2;
      const rr = 70 + Math.random() * 190;
      const spd = 0.45 + Math.random() * 1.25;
      const s = 1.6 + Math.random() * 2.6;
      motes.push({ a, rr, spd, s, seed: Math.random() });
    }
    for (let i = 0; i < nStreaks; i++) {
      const a = Math.random() * Math.PI * 2;
      const rr = 40 + Math.random() * 170;
      const len = 12 + Math.random() * 28;
      const wob = 0.35 + Math.random() * 1.1;
      streaks.push({ a, rr, len, wob, seed: Math.random() });
    }
    this.winFx = { t: 0, dur: 1.8, motes, streaks, cx, cy, seed: Math.random() };
  }

  renderWinFx(ctx) {
    const fx = this.winFx;
    if (!fx) return;
    const p = Math.max(0, Math.min(1, fx.t / fx.dur));
    const ease = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
    const cx = fx.cx, cy = fx.cy;
    const w = this.s.canvas.width;
    const h = this.s.canvas.height;
    const pulse = 0.55 + 0.25 * Math.sin(fx.t * 2.6 + fx.seed * 3.1);

    ctx.save();

    // Soft vignette
    ctx.fillStyle = `rgba(0,0,0,${0.22 * ease})`;
    ctx.beginPath();
    ctx.ellipse(w * 0.5, h * 0.60, w * 0.52, h * 0.40, 0, 0, Math.PI * 2);
    ctx.fill();

    // Ground glow
    ctx.fillStyle = `rgba(255,255,255,${0.02 + 0.05 * pulse})`;
    ctx.beginPath();
    ctx.ellipse(cx, cy + 150, 300, 86, 0, 0, Math.PI * 2);
    ctx.fill();

    // Portal-like glow
    const grad = ctx.createRadialGradient(cx, cy, 10, cx, cy, 250);
    grad.addColorStop(0, `rgba(255,220,160,${0.20 + 0.14 * pulse})`);
    grad.addColorStop(0.42, `rgba(140,220,255,${0.10 + 0.06 * pulse})`);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, 250, 0, Math.PI * 2);
    ctx.fill();

    // Hand-drawn rings
    ctx.strokeStyle = `rgba(255,230,190,${0.18 + 0.16 * pulse})`;
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
      const r = 68 + i * 30 + Math.sin(fx.t * 1.6 + i) * 4;
      ctx.beginPath();
      ctx.ellipse(cx, cy, r, r * 0.62, fx.t * 0.55 + i * 0.6, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Brush rays
    ctx.strokeStyle = `rgba(255,210,160,${0.10 + 0.10 * pulse})`;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    for (const s of fx.streaks) {
      const a = s.a + Math.sin(fx.t * 1.7 + s.seed * 6) * s.wob;
      const rr = s.rr + Math.sin(fx.t * 2.1 + s.seed * 5) * 10;
      const x0 = cx + Math.cos(a) * rr;
      const y0 = cy + Math.sin(a) * rr;
      const x1 = cx + Math.cos(a) * (rr + s.len);
      const y1 = cy + Math.sin(a) * (rr + s.len);
      ctx.globalAlpha = 0.85 * (1 - p) + 0.25;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Motes / particles
    for (const m of fx.motes) {
      const a = m.a + fx.t * m.spd;
      const rr = m.rr + Math.sin(fx.t * 1.9 + m.seed * 6) * 14;
      const x = cx + Math.cos(a) * rr;
      const y = cy + Math.sin(a) * rr * 0.72;
      const alpha = (0.25 + 0.35 * pulse) * (1 - p * 0.35);
      ctx.fillStyle = `rgba(255,255,255,${alpha})`;
      ctx.beginPath();
      ctx.arc(x, y, m.s, 0, Math.PI * 2);
      ctx.fill();
    }

    // Title
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.font = 'bold 34px system-ui,Segoe UI,Roboto,Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Победа!', cx, cy - 18);
    ctx.globalAlpha = 1;

    ctx.restore();
  }

  update(dt) {
    if (this.winFx) {
      this.winFx.t += dt;
      if (this.winFx.t > this.winFx.dur) {
        // Loop softly while the PostBattle window is open.
        this.winFx.t = this.winFx.t % this.winFx.dur;
      }
    }
  }
  render() {
    const { ctx, canvas } = this.s;
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (this.payload?.result === 'win') this.renderWinFx(ctx);
  }
}
