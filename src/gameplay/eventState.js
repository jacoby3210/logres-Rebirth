import { saveGame } from './storage.js';
import { clampResources } from './economy.js';

export class EventState {
  constructor(services, payload) {
    this.s = services;
    this.payload = payload; // { tile:{x,y}, tileId, tileKind }
    this.msg = '';
    this.t = 0;
    this._flash = 0;
  }

  enter() {
    this.s.hud.clear();
    this.renderCard();

    // Bind handlers once per state instance.
    if (this._bound) return;
    this._bound = true;

    this.s.hud.on('event', 'click', 'button[data-action="back"]', () => {
      this.s.audio?.play('click');
      this.s.game.sm.go('overworld');
    });

    this.s.hud.on('event', 'click', 'button[data-action="take"]', () => this.apply('take'));
    this.s.hud.on('event', 'click', 'button[data-action="risk"]', () => this.apply('risk'));
    this.s.hud.on('event', 'click', 'button[data-action="stabilize"]', () => this.apply('stabilize'));
  }

  exit() { this.s.hud.clear(); }
  update(dt) {
    this.t += dt;
    this._flash = Math.max(0, this._flash - dt * 2.2);
  }

  render() {
    const { ctx, canvas } = this.s;
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Animated illustration for shrine/ruins/anomaly (pure canvas, no assets).
    const kind = this.payload.tileKind;
    if (kind === 'shrine') drawShrine(ctx, canvas, this.t);
    else if (kind === 'ruins') drawRuins(ctx, canvas, this.t);
    else drawAnomaly(ctx, canvas, this.t);

    if (this._flash > 0.01) {
      ctx.fillStyle = `rgba(255,255,255,${0.20 * this._flash})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    ctx.fillStyle = 'rgba(255,255,255,0.88)';
    ctx.font = '22px system-ui';
    ctx.fillText('Событие', 30, 64);
  }

  getTile() {
    const m = this.s.game.model;
    const key = `${this.payload.tile.x},${this.payload.tile.y}`;
    return m.world.tiles?.[key] || null;
  }

  renderBody(kind) {
    if (kind === 'shrine') return 'Тёплое сияние восстанавливает силы. Можно забрать благословение.';
    if (kind === 'ruins') return 'В руинах спрятаны трофеи. Возможно, удастся усилить один из отрядов.';
    return 'Временная аномалия. Можно рискнуть ради награды или стабилизировать за золото.';
  }

  renderButtons(kind, tileUsed) {
    if (tileUsed) return `<button data-action="back">Назад</button>`;

    if (kind === 'shrine') {
      return `<button data-action="take">Получить благословение</button><button data-action="back">Назад</button>`;
    }
    if (kind === 'ruins') {
      return `<button data-action="take">Обыскать руины</button><button data-action="back">Назад</button>`;
    }
    // anomaly
    return `<button data-action="risk">Рискнуть</button><button data-action="stabilize">Стабилизировать (-35G)</button><button data-action="back">Уйти</button>`;
  }

  renderCard() {
    const m = this.s.game.model;
    const kind = this.payload.tileKind;
    const t = this.getTile();
    const used = !!t?.used;

    const title = kind === 'shrine' ? 'Алтарь' : kind === 'ruins' ? 'Руины' : 'Аномалия';

    const body = this.renderBody(kind);
    const msg = used
      ? (this.msg || 'Это событие уже использовано.')
      : (this.msg || '');

    this.s.hud.setCard('event', `
      <div style="max-width:420px">
        <div style="font-size:18px;font-weight:700;margin-bottom:4px">${title}</div>
        <div class="small" style="margin-bottom:10px">${body}</div>
        ${msg ? `<div class="small" style="margin-bottom:10px">${msg}</div>` : ''}
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          ${this.renderButtons(kind, used)}
        </div>
      </div>
    `);
  }

  apply(action) {
    const m = this.s.game.model;
    const kind = this.payload.tileKind;
    const audio = this.s.audio;

    const t = this.getTile();
    if (!t || t.used) {
      this.msg = 'Это событие уже использовано.';
      this.renderCard();
      return;
    }

    if (kind === 'shrine' && action === 'take') {
      const veGain = 10;
      m.res.ve = Math.min(m.res.veMax ?? 100, m.res.ve + veGain);
      for (const st of m.army) {
        const max = st.maxCount ?? st.count;
        if (st.count < max) st.count = Math.min(max, st.count + 1);
      }
      t.used = true;
      clampResources(m);
      saveGame(m);
      audio?.play('echo');
      this._flash = 1.0;
      this.s.hud.toast(`Алтарь: +${veGain} VE и небольшое восстановление.`);
      this.s.game.sm.go('overworld');
      return;
    }

    if (kind === 'ruins' && action === 'take') {
      const rng = this.s.rng || Math.random;
      const gold = 45 + Math.floor(rng() * 35);
      m.res.gold += gold;

      if (rng() < 0.4 && m.army.length) {
        const st = m.army[Math.floor(rng() * m.army.length)];
        st.maxCount = (st.maxCount ?? st.count) + 1;
        st.count = Math.min(st.maxCount, st.count + 1);
        this.s.hud.toast(`Руины: +${gold}G, удача! ${st.name} +1 к лимиту.`);
      } else {
        this.s.hud.toast(`Руины: +${gold} золота.`);
      }

      t.used = true;
      clampResources(m);
      saveGame(m);
      audio?.play('chest');
      this._flash = 0.85;
      this.s.game.sm.go('overworld');
      return;
    }

    if (kind === 'anomaly') {
      const rng = this.s.rng || Math.random;

      if (action === 'risk') {
        const gold = 35 + Math.floor(rng() * 30);
        const ve = 8 + Math.floor(rng() * 6);
        m.res.gold += gold;
        m.res.ve = Math.min(m.res.veMax ?? 100, m.res.ve + ve);
        m.progression.anomalyThreat = (m.progression.anomalyThreat ?? 0) + 1;

        t.used = true;
        clampResources(m);
        saveGame(m);
        audio?.play('echo');
        this._flash = 0.65;
        this.s.hud.toast(`Аномалия: +${gold}G, +${ve}VE. Следующий бой сложнее.`);
        this.s.game.sm.go('overworld');
        return;
      }

      if (action === 'stabilize') {
        if (m.res.gold < 35) {
          this.msg = 'Недостаточно золота для стабилизации.';
          audio?.play('click');
          this.renderCard();
          return;
        }
        m.res.gold -= 35;
        t.used = true;
        clampResources(m);
        saveGame(m);
        audio?.play('click');
        this._flash = 0.45;
        this.s.hud.toast('Аномалия стабилизирована.');
        this.s.game.sm.go('overworld');
        return;
      }
    }

    // Unknown action
    audio?.play('click');
  }
}

function drawShrine(ctx, canvas, t) {
  const cx = canvas.width * 0.5;
  const cy = canvas.height * 0.55;
  const glow = 0.55 + 0.25 * Math.sin(t * 2.4);

  // Soft vignette
  ctx.fillStyle = 'rgba(0,0,0,0.30)';
  ctx.beginPath();
  ctx.ellipse(cx, cy, canvas.width * 0.52, canvas.height * 0.40, 0, 0, Math.PI * 2);
  ctx.fill();

  // Ground
  ctx.fillStyle = 'rgba(255,255,255,0.04)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 120, 260, 80, 0, 0, Math.PI * 2);
  ctx.fill();

  // Obelisk
  ctx.fillStyle = `rgba(140,220,255,${0.14 + 0.10 * glow})`;
  ctx.strokeStyle = 'rgba(140,220,255,0.35)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - 46, cy + 110);
  ctx.lineTo(cx - 18, cy - 110);
  ctx.lineTo(cx + 18, cy - 110);
  ctx.lineTo(cx + 46, cy + 110);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Core glow
  const grad = ctx.createRadialGradient(cx, cy - 30, 10, cx, cy - 30, 160);
  grad.addColorStop(0, `rgba(140,220,255,${0.30 + 0.22 * glow})`);
  grad.addColorStop(1, 'rgba(140,220,255,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy - 30, 160, 0, Math.PI * 2);
  ctx.fill();

  // Particles
  ctx.strokeStyle = `rgba(200,245,255,${0.25 + 0.20 * glow})`;
  ctx.lineWidth = 1.4;
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2 + t * 0.55;
    const rr = 36 + (i % 6) * 18;
    const x = cx + Math.cos(a) * rr;
    const y = (cy - 30) + Math.sin(a) * (rr * 0.6);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y - 10 - (i % 3) * 4);
    ctx.stroke();
  }
}

function drawRuins(ctx, canvas, t) {
  const cx = canvas.width * 0.5;
  const cy = canvas.height * 0.58;
  const dust = 0.5 + 0.5 * Math.sin(t * 1.6);

  // Ground
  ctx.fillStyle = 'rgba(255,255,255,0.03)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 120, 300, 90, 0, 0, Math.PI * 2);
  ctx.fill();

  // Broken columns
  ctx.fillStyle = 'rgba(210,210,210,0.08)';
  ctx.strokeStyle = 'rgba(210,210,210,0.22)';
  ctx.lineWidth = 2;

  const rrPath = (x, y, w, h, r) => {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  };

  const col = (x, y, h) => {
    ctx.beginPath();
    rrPath(x - 28, y - h, 56, h, 12);
    ctx.fill();
    ctx.stroke();
    // Crack
    ctx.strokeStyle = 'rgba(0,0,0,0.22)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x - 10, y - h * 0.6);
    ctx.lineTo(x + 6, y - h * 0.35);
    ctx.lineTo(x - 4, y - h * 0.15);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(210,210,210,0.22)';
    ctx.lineWidth = 2;
  };

  col(cx - 120, cy + 120, 170);
  col(cx + 110, cy + 120, 210);
  col(cx - 10, cy + 120, 130);

  // Rubble pile
  ctx.fillStyle = 'rgba(210,210,210,0.06)';
  ctx.strokeStyle = 'rgba(255,255,255,0.10)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(cx - 180, cy + 140);
  ctx.lineTo(cx - 70, cy + 95);
  ctx.lineTo(cx + 40, cy + 135);
  ctx.lineTo(cx + 190, cy + 150);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Dust motes
  ctx.fillStyle = `rgba(255,255,255,${0.06 + 0.06 * dust})`;
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2 + t * 0.25;
    const rr = 140 + (i % 7) * 18;
    const x = cx + Math.cos(a) * rr;
    const y = (cy - 30) + Math.sin(a) * (rr * 0.45);
    ctx.beginPath();
    ctx.arc(x, y, 2 + (i % 3) * 0.7, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawAnomaly(ctx, canvas, t) {
  const cx = canvas.width * 0.5;
  const cy = canvas.height * 0.55;
  const pulse = 0.55 + 0.25 * Math.sin(t * 2.2);

  const grad = ctx.createRadialGradient(cx, cy, 10, cx, cy, 220);
  grad.addColorStop(0, `rgba(190,120,255,${0.18 + 0.12 * pulse})`);
  grad.addColorStop(0.55, `rgba(140,220,255,${0.08 + 0.06 * pulse})`);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, 220, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = `rgba(190,120,255,${0.22 + 0.16 * pulse})`;
  ctx.lineWidth = 2;
  for (let i = 0; i < 5; i++) {
    const r = 50 + i * 26 + Math.sin(t * 1.5 + i) * 4;
    ctx.beginPath();
    ctx.ellipse(cx, cy, r, r * 0.62, t * 0.4 + i * 0.5, 0, Math.PI * 2);
    ctx.stroke();
  }
}
