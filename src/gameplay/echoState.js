import { saveGame } from './storage.js';
import { clampResources } from './economy.js';

export class EchoState {
  constructor(services, payload) {
    this.s = services;
    this.payload = payload;
    this.msg = '';
  }

  enter() {
    this.s.hud.clear();
    this.renderHUD();

    this.s.hud.on('echo', 'click', 'button[data-action="back"]', () => {
      // Эхо по ТЗ используется в Overworld; после боя возвращаемся туда же.
      this.s.audio?.play('click');
      this.s.game.sm.go('overworld');
    });
    this.s.hud.on('echo', 'click', 'button[data-action="recovery"]', () => this.applyRecovery());
    this.s.hud.on('echo', 'click', 'button[data-action="recoveryG"]', () => this.applyRecovery(true));
    this.s.hud.on('echo', 'click', 'button[data-action="loot"]', () => this.applyLoot());
    this.s.hud.on('echo', 'click', 'button[data-action="summon"]', () => this.applySummon());
  }

  exit() {
    this.s.hud.clear();
  }

  canSpend(cost) {
    return this.s.game.model.res.ve >= cost;
  }

  applyRecovery(useGold = false) {
    const m = this.s.game.model;
    const veCost = 20;
    const goldCost = 60;
    if (useGold) {
      if (m.res.gold < goldCost) {
        this.msg = 'Недостаточно золота для восстановления.';
        this.s.hud.toast(this.msg);
        this.s.audio?.play('click');
        this.renderHUD();
        return;
      }
      m.res.gold -= goldCost;
    } else {
      if (!this.canSpend(veCost)) {
        this.msg = 'Недостаточно VE для восстановления.';
        this.s.hud.toast(this.msg);
        this.s.audio?.play('click');
        this.renderHUD();
        return;
      }
      m.res.ve -= veCost;
    }

    // Strategy: restore 30% of losses from last battle (if known), otherwise heal 20% of missing.
    if (m.lastBattle?.losses?.length) {
      for (const loss of m.lastBattle.losses) {
        const st = m.army.find(x => x.type === loss.type);
        if (!st) continue;
        const restore = Math.max(1, Math.floor(loss.lost * 0.3));
        st.count = Math.min(st.maxCount, st.count + restore);
      }
      this.msg = 'Эхо восстановило часть потерь последней битвы.';
    } else {
      for (const st of m.army) {
        const missing = st.maxCount - st.count;
        const restore = Math.max(0, Math.floor(missing * 0.2));
        st.count = Math.min(st.maxCount, st.count + restore);
      }
      this.msg = 'Эхо восстановило часть армии.';
    }
    clampResources(m);
    saveGame(m);
    this.s.hud.toast(this.msg);
    this.s.audio?.play('echo');
    this.renderHUD();
  }

  applyLoot() {
    const m = this.s.game.model;
    const cost = 15;
    if (!this.canSpend(cost)) {
      this.msg = 'Недостаточно VE для "Отголоска добычи".';
      this.s.hud.toast(this.msg);
      this.s.audio?.play('click');
      this.renderHUD();
      return;
    }
    m.res.ve -= cost;
    const goldGain = 80 + (m.progression.majorWins * 10);
    m.res.gold += goldGain;
    this.msg = `Вы получили +${goldGain} золота из прошлых побед.`;
    clampResources(m);
    saveGame(m);
    this.s.hud.toast(this.msg);
    this.s.audio?.play('echo');
    this.renderHUD();
  }

  applySummon() {
    const m = this.s.game.model;
    const cost = 35;
    if (!this.canSpend(cost)) {
      this.msg = 'Недостаточно VE для призыва павшего героя.';
      this.s.hud.toast(this.msg);
      this.s.audio?.play('click');
      this.renderHUD();
      return;
    }
    if (m.echo.summonNextBattle) {
      this.msg = 'Призыв уже активен и сработает в следующем бою.';
      this.s.hud.toast(this.msg);
      this.s.audio?.play('click');
      this.renderHUD();
      return;
    }
    m.res.ve -= cost;
    m.echo.summonNextBattle = true;
    this.msg = 'Павший герой будет призван как союзник в следующей битве.';
    clampResources(m);
    saveGame(m);
    this.s.hud.toast(this.msg);
    this.s.audio?.play('echo');
    this.renderHUD();
  }

  renderHUD() {
    const m = this.s.game.model;
    const ve = m.res.ve;

    const btn = (action, label, cost, desc) => {
      const disabled = ve < cost ? 'disabled' : '';
      return `
        <div style="margin-top:8px">
          <button data-action="${action}" ${disabled}>${label} (-${cost} VE)</button>
          <div class="small" style="margin-top:4px">${desc}</div>
        </div>
      `;
    };

    this.s.hud.setCard('echo', `
      <div style="min-width:360px">
        <div style="font-weight:700;margin-bottom:6px">Эхо Времени</div>
        <div class="small">VE: <b>${m.res.ve}</b> • Золото: <b>${m.res.gold}</b></div>
        <div class="small" style="margin:8px 0 10px">${this.msg || 'Выберите эффект. Эхо можно использовать в Overworld и после боя.'}</div>

        ${btn('recovery', 'Рывок восстановления', 20, 'Вернуть часть потерь последней битвы (≈30%) или подлечить армию.')}
        <div style="margin-top:6px">
          <button data-action="recoveryG" ${m.res.gold < 60 ? 'disabled' : ''} title="Альтернативная оплата золотом">Восстановление (-60G)</button>
        </div>
        ${btn('loot', 'Отголосок добычи', 15, 'Получить бонусное золото из прошлых побед.')}
        ${btn('summon', 'Призыв павшего героя', 35, `Призвать временного союзника на один следующий бой. Сейчас: <b>${m.echo.summonNextBattle ? 'активен' : 'нет'}</b>.`)}

        <div style="display:flex;gap:8px;margin-top:14px">
          <button data-action="back">Назад</button>
        </div>
      </div>
    `);
  }

  update() {}

  render() {
    const { ctx, canvas } = this.s;
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
}
