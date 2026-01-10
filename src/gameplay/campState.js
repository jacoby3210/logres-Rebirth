import { UNIT_DEFS, makeStack } from './data.js';
import { saveGame } from './storage.js';

export class CampState {
  constructor(services, payload) {
    this.s = services;
    this.payload = payload; // { campId }
    this.msg = '';
  }

  enter() {
    this.s.hud.clear();
    this.renderHUD();

    this.s.hud.on('camp', 'click', 'button[data-action="back"]', () => this.s.game.sm.go('overworld'));
    this.s.hud.on('camp', 'click', 'button[data-action="heal"]', () => this.healAll());
    this.s.hud.on('camp', 'click', 'button[data-action="recruit"]', (e, btn) => this.recruit(btn.dataset.type));
    this.s.hud.on('camp', 'click', 'button[data-action="buff"]', (e, btn) => this.buyBuff(btn.dataset.buff));
  }

  exit() {
    this.s.hud.clear();
  }

  getCampTile() {
    const m = this.s.game.model;
    const tiles = m.world.tiles || {};
    const camp = Object.values(tiles).find(t => t.kind === 'camp' && t.id === this.payload.campId);
    return camp || null;
  }

  healAll() {
    const m = this.s.game.model;
    const missing = m.army.reduce((sum, st) => sum + Math.max(0, st.maxCount - st.count), 0);
    if (missing <= 0) {
      this.msg = 'Армия уже полностью восстановлена.';
      this.s.hud.toast(this.msg);
      this.s.audio?.play('click');
      this.renderHUD();
      return;
    }
    const cost = missing * 2; // simple tuning
    if (m.res.gold < cost) {
      this.msg = `Не хватает золота. Нужно ${cost}, у вас ${m.res.gold}.`;
      this.s.hud.toast(this.msg);
      this.s.audio?.play('click');
      this.renderHUD();
      return;
    }
    m.res.gold -= cost;
    for (const st of m.army) st.count = st.maxCount;
    this.msg = `Армия восстановлена. Потрачено ${cost} золота.`;
    this.s.hud.toast(this.msg);
    this.s.audio?.play('heal');
    saveGame(m);
    this.renderHUD();
  }

  recruit(type) {
    const m = this.s.game.model;
    const def = UNIT_DEFS[type];
    if (!def) return;

    const cost = def.cost;
    if (m.res.gold < cost) {
      this.msg = `Не хватает золота для найма: нужно ${cost}.`;
      this.s.hud.toast(this.msg);
      this.s.audio?.play('click');
      this.renderHUD();
      return;
    }
    m.res.gold -= cost;
    let st = m.army.find(x => x.type === type);
    if (!st) {
      st = makeStack(type, 0);
      st.count = 0;
      st.maxCount = 0;
      m.army.push(st);
    }
    st.maxCount += 1;
    st.count += 1;
    this.msg = `Нанято: +1 ${def.name} за ${cost} золота.`;
    this.s.hud.toast(this.msg);
    this.s.audio?.play('click');
    saveGame(m);
    this.renderHUD();
  }

  buyBuff(kind) {
    const m = this.s.game.model;
    const shop = {
      speed: { label: '+1 скорость в следующем бою', cost: 40, apply: () => (m.buffs.nextBattleSpeedPlus += 1) },
      damage: { label: '+1 урон в следующем бою', cost: 55, apply: () => (m.buffs.nextBattleDamagePlus += 1) },
    };
    const it = shop[kind];
    if (!it) return;
    if (m.res.gold < it.cost) {
      this.msg = `Не хватает золота: нужно ${it.cost}.`;
      this.s.hud.toast(this.msg);
      this.s.audio?.play('click');
      this.renderHUD();
      return;
    }
    m.res.gold -= it.cost;
    it.apply();
    this.msg = `Куплено: ${it.label}. Сработает в следующей битве.`;
    this.s.hud.toast(this.msg);
    this.s.audio?.play('click');
    saveGame(m);
    this.renderHUD();
  }

  renderHUD() {
    const m = this.s.game.model;
    const camp = this.getCampTile();
    const offers = camp?.offers || [];
    const missing = m.army.reduce((sum, st) => sum + Math.max(0, st.maxCount - st.count), 0);
    const healCost = missing * 2;

    const recruitBtns = offers.map(t => {
      const def = UNIT_DEFS[t];
      const disabled = m.res.gold < def.cost ? 'disabled' : '';
      return `<button data-action="recruit" data-type="${t}" ${disabled}>Нанять ${def.name} (-${def.cost}G)</button>`;
    }).join('');

    const speedCost = 40;
    const dmgCost = 55;
    const speedDisabled = m.res.gold < speedCost ? 'disabled' : '';
    const dmgDisabled = m.res.gold < dmgCost ? 'disabled' : '';

    this.s.hud.setCard('camp', `
      <div style="min-width:360px">
        <div style="font-weight:700;margin-bottom:6px">Лагерь союзников</div>
        <div class="small">Золото: <b>${m.res.gold}</b> • VE: <b>${m.res.ve}</b></div>
        <div class="small" style="margin:8px 0 10px">${this.msg || 'В лагере можно восстановить армию или нанять бойцов.'}</div>

        <div style="margin-top:8px">
          <button data-action="heal" ${missing <= 0 || m.res.gold < healCost ? 'disabled' : ''}>
            Восстановить армию (${missing} недостаёт) (-${healCost}G)
          </button>
          <div class="small" style="margin-top:4px">Цена: 2G за каждого недостающего бойца.</div>
        </div>

        <div style="margin-top:10px">
          <div class="small" style="margin-bottom:6px">Найм (доступно в этом лагере):</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">${recruitBtns || '<span class="small">Нет доступных наймов.</span>'}</div>
        </div>

        <div style="margin-top:12px">
          <div class="small" style="margin-bottom:6px">Бонусы (одноразовые, на следующий бой):</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button data-action="buff" data-buff="speed" ${speedDisabled} title="Применится ко всем вашим отрядам в следующем бою">+1 скорость (-${speedCost}G)</button>
            <button data-action="buff" data-buff="damage" ${dmgDisabled} title="Применится ко всем вашим отрядам в следующем бою">+1 урон (-${dmgCost}G)</button>
          </div>
          <div class="small" style="margin-top:6px">Активные на следующий бой: скорость <b>+${m.buffs.nextBattleSpeedPlus||0}</b>, урон <b>+${m.buffs.nextBattleDamagePlus||0}</b>.</div>
        </div>

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
