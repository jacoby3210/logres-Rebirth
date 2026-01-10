import { drawSquareGrid, screenToGrid } from '../render/gridSquare.js';
import { saveGame } from './storage.js';
import { savePrefs } from './prefs.js';
import { armySummary } from './model.js';
import { makeEnemyArmyForTile } from './worldRules.js';
import { drawTileIcon } from '../render/icons.js';

export class OverworldState {
  constructor(services) {
    this.s = services;
    // Map is wider; use bigger cells (+20%) and compute origin so it fits the canvas.
    this.cell = 43;
    this.origin = { x: 40, y: 28 };
    this.msg = '';
    this.hoverKey = null;
  }

  layout() {
    const m = this.s.game.model;
    if (!m?.world) return;
    const { cols, rows } = m.world;
    const { canvas } = this.s;
    const mapW = cols * this.cell;
    const mapH = rows * this.cell;
    // Center inside the canvas, keep small gutters.
    const ox = Math.floor((canvas.width - mapW) / 2);
    const oy = Math.floor((canvas.height - mapH) / 2);
    this.origin.x = Math.max(12, ox);
    this.origin.y = Math.max(12, oy);
  }

  enter() {
    if (!this.s.game.model) this.s.game.startNewGame();

    this.layout();

    this.s.hud.clear();
    this.renderHUD();

    this.s.hud.on('ow', 'click', 'button[data-action="end"]', () => this.endTurn());
    this.s.hud.on('ow', 'click', 'button[data-action="echo"]', () => this.s.game.sm.go('echo', { from: 'overworld' }));
    this.s.hud.on('ow', 'click', 'button[data-action="save"]', () => this.manualSave());
    this.s.hud.on('ow', 'click', 'button[data-action="menu"]', () => this.s.game.sm.go('title'));

    this.maybeShowTutorial();
  }

  exit() {
    this.s.hud.clear();
  }

  manualSave() {
    const ok = saveGame(this.s.game.model);
    this.msg = ok ? 'Сохранение записано.' : 'Ошибка сохранения (возможно, ограничение браузера).';
    this.s.hud.toast(this.msg);
    this.s.audio?.play('click');
    this.renderHUD();
  }

  endTurn() {
    const m = this.s.game.model;
    m.hero.mp = m.hero.mpMax;
    m.progression.turns += 1;
    this.msg = `Новый ход #${m.progression.turns}.`;
    this.s.hud.toast(this.msg);
    saveGame(m);
    this.s.audio?.play('click');
    this.renderHUD();
  }

  update() {
    const { input, hud } = this.s;
    const m = this.s.game.model;
    const { cols, rows } = m.world;

    // Canvas internal size can differ per build; keep origin centered.
    this.layout();

    // Hover (update HUD only when tile under cursor changes).
    const { gx: hgx, gy: hgy } = screenToGrid(input.pointer.x, input.pointer.y, this.origin.x, this.origin.y, this.cell);
    const hk = (hgx >= 0 && hgy >= 0 && hgx < cols && hgy < rows) ? `${hgx},${hgy}` : null;
    if (hk !== this.hoverKey) {
      this.hoverKey = hk;
      this.renderHUD();
    }

    // Input is on canvas; modal overlay blocks pointer anyway, but keep a safety gate.
    if (hud.isModalOpen()) return;

    // Quality-of-life hotkeys (optional, don't affect balance).
    if (input.isKeyPressed('Enter')) { this.endTurn(); return; }
    if (input.isKeyPressed('KeyE')) { this.s.audio?.play('click'); this.s.game.sm.go('echo', { from: 'overworld' }); return; }
    if (input.isKeyPressed('KeyS')) { this.manualSave(); return; }

    if (input.pointer.pressed) {
      const { gx, gy } = screenToGrid(input.pointer.x, input.pointer.y, this.origin.x, this.origin.y, this.cell);
      if (gx >= 0 && gy >= 0 && gx < cols && gy < rows) {
        const dist = Math.abs(gx - m.hero.x) + Math.abs(gy - m.hero.y);
        if (dist === 1 && m.hero.mp > 0) {
          m.hero.x = gx;
          m.hero.y = gy;
          m.hero.mp -= 1;
          this.s.audio?.play('step');
          this.onEnterTile(gx, gy);
          // State may change inside onEnterTile(); avoid touching HUD after transition.
          saveGame(m);
          if (this.s.game.sm.stateId !== 'overworld') return;
          this.renderHUD();
        } else {
          this.msg = dist !== 1 ? 'Ход только на соседнюю клетку (1 шаг).' : 'Нет очков хода — нажмите "Конец хода".';
          this.s.audio?.play('click');
          this.renderHUD();
        }
      }
    }
  }

  tileAt(x, y) {
    const m = this.s.game.model;
    return m.world.tiles?.[`${x},${y}`] || null;
  }

  onEnterTile(x, y) {
    const m = this.s.game.model;
    const t = this.tileAt(x, y);
    if (!t) {
      this.msg = 'Пустая клетка.';
      return;
    }

    if (t.kind === 'chest' && !t.opened) {
      t.opened = true;
      m.res.gold += t.gold;
      this.msg = `Найден сундук: +${t.gold} золота.`;
      this.s.hud.toast(this.msg);
      this.s.audio?.play('chest');
      return;
    }

    if ((t.kind === 'shrine' || t.kind === 'ruins' || t.kind === 'anomaly') && !t.used) {
      this.msg = 'Событие.';
      this.s.audio?.play('click');
      this.s.game.sm.go('event', { tile: { x, y }, tileId: t.id, tileKind: t.kind });
      return;
    }

    if (t.kind === 'camp') {
      this.msg = 'Лагерь союзников: восстановление и найм.';
      this.s.audio?.play('click');
      this.s.game.sm.go('camp', { campId: t.id });
      return;
    }

    if ((t.kind === 'enemy' || t.kind === 'elite' || t.kind === 'boss') && !t.defeated) {
      const enemyArmy = makeEnemyArmyForTile(m, t);
      this.msg = 'Встречен противник! Переход в бой...';
      this.renderHUD();
      this.s.audio?.play('click');
      this.s.game.sm.go('battle', { tile: { x, y }, tileId: t.id, tileKind: t.kind, enemyArmy });
      return;
    }

    if (t.kind === 'boss' && t.defeated) {
      this.msg = 'Босс побеждён. Карта очищена!';
      return;
    }

    this.msg = 'Ничего интересного.';
  }


  maybeShowTutorial() {
    const prefs = this.s.prefsRef?.current;
    if (!prefs || !prefs.hints || prefs.tutorialSeen) return;

    prefs.tutorialSeen = true;
    savePrefs(prefs);

    // Bind close handler once (delegated on modal overlay).
    if (!this.s.game._tutorialModalBound) {
      this.s.game._tutorialModalBound = true;
      this.s.hud.onModal('click', 'button[data-action="tutorialClose"]', () => {
        this.s.audio?.play('click');
        this.s.hud.hideModal();
      });
    }

    this.s.hud.showModal(`
      <div style="font-size:16px;font-weight:700;margin-bottom:6px">Быстрый старт</div>
      <div class="small" style="line-height:1.35">
        • Клик по <b>соседней клетке</b> — шаг (1 MP).<br/>
        • <b>Конец хода</b> — восстановить MP.<br/>
        • <b>Эхо (E)</b> — потрать VE на эффекты вне боя.<br/>
        • В бою: <b>клик по цели</b> для активного отряда. <b>Space/Enter</b> — пропуск хода, <b>Esc</b> — отступление.
        <hr style="border:0;border-top:1px solid rgba(255,255,255,0.12);margin:10px 0"/>
        Это окно показывается один раз (можно отключить подсказки в Settings).
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
        <button data-action="tutorialClose">Понятно</button>
      </div>
    `);
  }

  renderHUD() {
    const m = this.s.game.model;
    const armyText = armySummary(m.army);

    const counts = countEncounters(m);
    const hoverText = this.hoverKey ? describeTile(m, this.hoverKey) : '';

    const hint = this.msg || (m.progression.turns <= 1 && this.s.prefsRef?.current?.hints
      ? 'Быстрый старт: клик по соседней клетке (1 шаг). Найдите лагерь/сундуки и победите босса.'
      : 'Кликните по соседней клетке, чтобы сделать шаг.'
    );

    this.s.hud.setCard('ow', `
      <div>
        <div style="font-weight:700;margin-bottom:6px">Исследование</div>
        <div class="small">Золото: <b>${m.res.gold}</b> • VE: <b>${m.res.ve}</b>/<b>${m.res.veMax ?? 100}</b> • Ход: <b>${m.hero.mp}</b>/${m.hero.mpMax}</div>
        <div class="small" style="margin-top:4px">
          Враги: <b>${counts.enemiesLeft}</b> • Элита: <b>${counts.elitesLeft}</b> • События: <b>${counts.eventsLeft}</b> • Босс: <b>${counts.bossLeft ? 'жив' : 'побеждён'}</b>
        </div>
        <div class="small" style="margin-top:6px">Армия: ${armyText}</div>
        <div class="card-scroll" style="margin:8px 0 10px">
          <div class="small" style="margin:0 0 6px">${hint}</div>
          ${hoverText ? `<div class="small" style="margin:0;opacity:.85">Наведение: ${hoverText}</div>` : ''}
          <div class="small" style="margin-top:10px;opacity:.85">
            <b>Иконки карты:</b> 🗡️ враг • ⭐ элита • 👑 босс • ⛺ лагерь • 💰 сундук • 🔷 алтарь • 🏛️ руины • 🌀 аномалия
          </div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button data-action="end" title="Сбросить MP и перейти к следующему ходу">Конец хода</button>
          <button data-action="echo" title="Потрать VE на эффекты (доступно в Overworld)">Эхо Времени</button>
          <button data-action="save" title="Записать прогресс в localStorage">Сохранить</button>
          <button data-action="menu" title="Вернуться в меню">Меню</button>
        </div>
      </div>
    `);
  }

  render() {
    const { ctx, canvas } = this.s;
    const m = this.s.game.model;
    const { cols, rows } = m.world;

    this.layout();

    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    drawSquareGrid(ctx, this.origin.x, this.origin.y, cols, rows, this.cell);

    // reachable highlight
    const neigh = [
      { x: m.hero.x + 1, y: m.hero.y },
      { x: m.hero.x - 1, y: m.hero.y },
      { x: m.hero.x, y: m.hero.y + 1 },
      { x: m.hero.x, y: m.hero.y - 1 },
    ].filter(p => p.x >= 0 && p.y >= 0 && p.x < cols && p.y < rows);

    // Always show possible next steps, slightly stronger if MP is available.
    ctx.fillStyle = m.hero.mp > 0 ? 'rgba(120,190,255,0.06)' : 'rgba(120,190,255,0.03)';
    for (const p of neigh) {
      ctx.fillRect(this.origin.x + p.x * this.cell + 1, this.origin.y + p.y * this.cell + 1, this.cell - 2, this.cell - 2);
    }

    // Hover highlight: show whether move is valid (adjacent + MP).
    if (this.hoverKey) {
      const [hx, hy] = this.hoverKey.split(',').map(Number);
      const isNeighbor = neigh.some(p => p.x === hx && p.y === hy);
      const canMove = isNeighbor && m.hero.mp > 0;

      ctx.fillStyle = canMove
        ? 'rgba(120,190,255,0.10)'
        : (isNeighbor ? 'rgba(255,255,255,0.06)' : 'rgba(255,90,90,0.05)');
      ctx.fillRect(this.origin.x + hx * this.cell + 1, this.origin.y + hy * this.cell + 1, this.cell - 2, this.cell - 2);

      // Outline for clarity
      ctx.strokeStyle = canMove
        ? 'rgba(120,190,255,0.35)'
        : (isNeighbor ? 'rgba(255,255,255,0.18)' : 'rgba(255,90,90,0.22)');
      ctx.lineWidth = 2;
      ctx.strokeRect(this.origin.x + hx * this.cell + 2, this.origin.y + hy * this.cell + 2, this.cell - 4, this.cell - 4);
      ctx.lineWidth = 1;
    }

    // tiles
    for (const [k, t] of Object.entries(m.world.tiles || {})) {
      const [xStr, yStr] = k.split(',');
      const x = Number(xStr), y = Number(yStr);
      const cx = this.origin.x + x * this.cell + this.cell / 2;
      const cy = this.origin.y + y * this.cell + this.cell / 2;

      // Hide consumed tiles to keep the map clean.
      if (t.kind === 'enemy' && t.defeated) continue;
      if (t.kind === 'elite' && t.defeated) continue;
      if (t.kind === 'boss' && t.defeated) continue;
      if (t.kind === 'chest' && t.opened) continue;
      if ((t.kind === 'shrine' || t.kind === 'ruins' || t.kind === 'anomaly') && t.used) continue;

      const iconSize = Math.round(this.cell * 0.50);
      drawTileIcon(ctx, t.kind, cx, cy, iconSize, t);
    }

    // hero
    const hx = this.origin.x + m.hero.x * this.cell + this.cell / 2;
    const hy = this.origin.y + m.hero.y * this.cell + this.cell / 2;
    // subtle halo
    ctx.fillStyle = 'rgba(120,190,255,0.10)';
    ctx.beginPath();
    ctx.arc(hx, hy, Math.max(14, Math.round(this.cell * 0.34)), 0, Math.PI * 2);
    ctx.fill();
    drawTileIcon(ctx, 'hero', hx, hy, Math.round(this.cell * 0.56), {});
  }
}

function countEncounters(m) {
  let enemiesLeft = 0;
  let elitesLeft = 0;
  let bossLeft = 0;
  let eventsLeft = 0;
  for (const t of Object.values(m.world.tiles || {})) {
    if (t.kind === 'enemy' && !t.defeated) enemiesLeft++;
    if (t.kind === 'elite' && !t.defeated) elitesLeft++;
    if (t.kind === 'boss' && !t.defeated) bossLeft++;
    if ((t.kind === 'shrine' || t.kind === 'ruins' || t.kind === 'anomaly') && !t.used) eventsLeft++;
  }
  return { enemiesLeft, elitesLeft, bossLeft, eventsLeft };
}

function describeTile(m, key) {
  const t = m.world.tiles?.[key];
  if (!t) return 'пусто';
  if (t.kind === 'chest') return t.opened ? 'сундук (пусто)' : `сундук (+${t.gold} золота)`;
  if (t.kind === 'camp') return 'лагерь союзников';
  if (t.kind === 'shrine') return t.used ? 'алтарь (использован)' : 'алтарь (+VE и восстановление)';
  if (t.kind === 'ruins') return t.used ? 'руины (пусто)' : 'руины (трофеи)';
  if (t.kind === 'anomaly') return t.used ? 'аномалия (стабилизирована)' : 'аномалия (выбор риска)';
  if (t.kind === 'enemy') return t.defeated ? 'враг (побеждён)' : 'враг (обычный бой)';
  if (t.kind === 'elite') return t.defeated ? 'элита (побеждена)' : 'элита (крупная битва)';
  if (t.kind === 'boss') return t.defeated ? 'босс (побеждён)' : 'босс (финальная битва)';
  return t.kind;
}
