import { hexToPixel, drawHex, pointInHex, HEX_SIZE } from '../render/hexMath.js';
import { drawStackSprite } from '../render/unitSprites.js';
import { cloneStack } from './data.js';
import { battleRewards, makePlayerBattleArmy, applyBattleOutcomeToArmy, makeEchoSummonStack } from './worldRules.js';
import { saveGame, clearSave } from './storage.js';

const DIRS = [
  { dq: 1, dr: 0 }, { dq: 1, dr: -1 }, { dq: 0, dr: -1 },
  { dq: -1, dr: 0 }, { dq: -1, dr: 1 }, { dq: 0, dr: 1 },
];

function distHex(a, b) {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  const ds = (-a.q - a.r) - (-b.q - b.r);
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(ds)) / 2;
}

function keyQR(q, r) { return `${q},${r}`; }

export class BattleState {
  constructor(services, payload) {
    this.s = services;
    this.payload = payload; // { tile:{x,y}, tileId, tileKind, enemyArmy }

    this.board = { cols: 7, rows: 5, origin: { x: 170, y: 120 } };
    this.units = []; // {id, stack, fx, drawPos?}

    this.turnOrder = [];
    this.turnIndex = 0;
    this.activeId = null;

    this.result = null; // 'win'|'lose'|null
    this.msg = '';
    this.log = [];

    this.hoverId = null;
    this.hoverHex = null;

    this.floats = []; // {x,y,text,ttl}
    this.reducedMotion = false;

    // Turn-based action flags for the active unit.
    this.turn = { moved: false, acted: false };

    // Animation pipeline.
    this.time = 0;
    this.anim = null;     // { kind:'move', unitId, path, seg, t, dur, fromPx, toPx, pending }
    this.pending = null;  // { kind:'attack'|'heal', fromId, toId }

    this._lock = 0;
    this._aiDelay = 0;

    // End-of-battle win animation (short delay before PostBattle screen).
    this.endFx = null;       // { t, dur, parts: [{a, spd, rot, seed}], cx, cy }
    this._postPayload = null; // payload for PostBattle after the animation

    // Cached reachable tiles for current active unit.
    this._reachCache = { id: null, q: 0, r: 0, moved: false, cells: new Set(), prev: new Map() };
  }

  enter() {
    const m = this.s.game.model;
    this.reducedMotion = !!(m.settings?.reducedMotion || this.s.prefsRef?.current?.reducedMotion);

    // Center the battle board inside the (now wider) canvas.
    const { canvas } = this.s;
    const size = HEX_SIZE;
    const maxX = size * Math.sqrt(3) * ((this.board.cols - 1) + (this.board.rows - 1) / 2);
    const maxY = size * 1.5 * (this.board.rows - 1);
    const boardW = maxX + size * 2;
    const boardH = maxY + size * 2;
    const mx = Math.floor((canvas.width - boardW) / 2);
    const my = Math.floor((canvas.height - boardH) / 2);
    this.board.origin.x = mx + size;
    this.board.origin.y = my + size;

    // Consume anomaly threat once a battle starts.
    if (m.progression?.anomalyThreat) {
      m.progression.anomalyThreat = 0;
      saveGame(m);
    }

    // Build armies
    const playerArmy = makePlayerBattleArmy(m);

    // Apply one-battle buffs.
    const sp = m.buffs?.nextBattleSpeedPlus || 0;
    const dp = m.buffs?.nextBattleDamagePlus || 0;
    if (sp || dp) {
      for (const st of playerArmy) {
        if (sp) st.speed += sp;
        if (dp) st.dmg += dp;
      }
      m.buffs.nextBattleSpeedPlus = 0;
      m.buffs.nextBattleDamagePlus = 0;
      saveGame(m);
    }

    if (m.echo.summonNextBattle) {
      playerArmy.push(makeEchoSummonStack());
      m.echo.summonNextBattle = false;
      saveGame(m);
    }

    const enemyArmy = (this.payload.enemyArmy || []).map(cloneStack);

    // Place units
    this.units = [];
    let idc = 1;
    const placeLine = (army, side, qStart) => {
      let r = 0;
      for (const st of army) {
        const stack = cloneStack(st);
        stack.side = side;
        stack.q = qStart;
        stack.r = r;
        const u = { id: `${side[0]}${idc++}`, stack, fx: { flash: 0, shake: 0, phase: 'idle', phaseT: 0 } };
        this.units.push(u);
        r = (r + 1) % this.board.rows;
      }
    };

    placeLine(playerArmy, 'player', 1);
    placeLine(enemyArmy, 'enemy', 5);

    this.result = null;
    this.msg = '';
    this.log = [];
    this.floats = [];
    this.hoverId = null;
    this.hoverHex = null;
    this.anim = null;
    this.pending = null;
    this.time = 0;

    // Strict turn order: higher speed first, stable with a small random tie-breaker.
    const rng = Math.random;
    this.turnOrder = this.units
      .slice()
      .sort((a, b) => (b.stack.speed - a.stack.speed) || ((rng() - 0.5) * 0.01))
      .map(u => u.id);
    this.turnIndex = 0;
    this.activeId = this.turnOrder[0] || null;
    this.resetTurnFlags();

    this._lock = 0;
    this._aiDelay = 0.25;

    this.s.hud.clear();
    this.renderHUD();

    this.s.hud.on('bt', 'click', 'button[data-action="skip"]', () => this.skipTurn());
    this.s.hud.on('bt', 'click', 'button[data-action="retreat"]', () => this.finish('lose'));
  }

  exit() {
    this.s.hud.clear();
  }

  isAlive(id) {
    const u = this.units.find(x => x.id === id);
    return !!(u && u.stack.count > 0);
  }

  activeUnit() {
    return this.units.find(u => u.id === this.activeId) || null;
  }

  resetTurnFlags() {
    this.turn.moved = false;
    this.turn.acted = false;
    this.invalidateReachCache();
  }

  invalidateReachCache() {
    this._reachCache.id = null;
    this._reachCache.cells = new Set();
    this._reachCache.prev = new Map();
  }

  skipTurn() {
    if (this.result) return;
    const a = this.activeUnit();
    if (!a) return;
    if (a.stack.side !== 'player') return;
    if (this._lock > 0 || this.anim) return;
    this.msg = `${a.stack.name}: пропуск хода.`;
    this.pushLog(`${a.stack.name}: пропуск`);
    this.s.audio?.play('click');
    this.endTurn();
  }

  update(dt) {
    const { input, hud } = this.s;
    this.time += dt;

    // FX decay
    for (const u of this.units) {
      u.fx.flash = Math.max(0, u.fx.flash - dt * 4);
      u.fx.shake = Math.max(0, u.fx.shake - dt * 6);
      u.fx.phaseT = Math.max(0, u.fx.phaseT - dt);
      if (u.fx.phaseT <= 0) u.fx.phase = 'idle';
    }
    this.floats = this.floats
      .map(f => ({ ...f, ttl: f.ttl - dt }))
      .filter(f => f.ttl > 0);

    if (this._lock > 0) this._lock = Math.max(0, this._lock - dt);

    // Hover tooltip (unit)
    const hover = this.pickUnit(input.pointer.x, input.pointer.y);
    const hid = hover?.id || null;
    if (hid !== this.hoverId) {
      this.hoverId = hid;
      this.renderHUD();
    }

    // Hover hex
    const hh = this.pickHex(input.pointer.x, input.pointer.y);
    const hhk = hh ? keyQR(hh.q, hh.r) : null;
    const prevhk = this.hoverHex ? keyQR(this.hoverHex.q, this.hoverHex.r) : null;
    if (hhk !== prevhk) this.hoverHex = hh;

    if (this.result) return;
    if (hud.isModalOpen()) return;

    // Hotkeys
    if (input.isKeyPressed('Escape')) { this.finish('lose'); return; }
    if (input.isKeyPressed('Space') || input.isKeyPressed('Enter')) {
      const a = this.activeUnit();
      if (a && a.stack.side === 'player') this.skipTurn();
      return;
    }

    // Process animations (movement / queued action)
    if (this.anim) {
      this.stepAnimation(dt);
      return;
    }

    // Ensure we always have a valid active unit.
    this.ensureActive();
    const active = this.activeUnit();
    if (!active) return;

    // Enemy AI turn
    if (active.stack.side === 'enemy') {
      if (this._lock > 0) return;
      this._aiDelay -= dt;
      if (this._aiDelay > 0) return;
      this._aiDelay = 0.25;

      this.aiTurn(active);
      this._lock = 0.18;
      return;
    }

    // Player turn
    if (this._lock > 0) return;
    if (!input.pointer.pressed) return;

    const clickedUnit = this.pickUnit(input.pointer.x, input.pointer.y);
    if (clickedUnit) {
      const ok = this.resolvePlayerTarget(active, clickedUnit);
      if (ok) this._lock = 0.12;
      return;
    }

    const hex = this.pickHex(input.pointer.x, input.pointer.y);
    if (!hex) return;
    this.tryPlayerMove(active, hex);
  }

  stepAnimation(dt) {
    const a = this.anim;
    if (!a) return;
    const unit = this.units.find(u => u.id === a.unitId);
    if (!unit) { this.anim = null; this.pending = null; return; }

    a.t += dt;
    const p = Math.min(1, a.t / a.dur);
    const ease = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
    unit.drawPos = {
      x: a.fromPx.x + (a.toPx.x - a.fromPx.x) * ease,
      y: a.fromPx.y + (a.toPx.y - a.fromPx.y) * ease,
    };

    if (p < 1) return;

    // Segment complete
    unit.stack.q = a.path[a.seg].q;
    unit.stack.r = a.path[a.seg].r;
    unit.drawPos = null;

    a.seg += 1;
    if (a.seg >= a.path.length) {
      // Movement done
      this.anim = null;
      this.turn.moved = true;
      this.invalidateReachCache();

      if (a.pending) {
        this.pending = a.pending;
        a.pending = null;
        this.resolvePendingAction();
      } else {
        this.msg = `${unit.stack.name}: ход выполнен — можно атаковать.`;
        this.renderHUD();
      }
      return;
    }

    // Prepare next segment
    const next = a.path[a.seg];
    const fromPx = hexToPixel(unit.stack.q, unit.stack.r, this.board.origin.x, this.board.origin.y);
    const toPx = hexToPixel(next.q, next.r, this.board.origin.x, this.board.origin.y);
    a.fromPx = fromPx;
    a.toPx = toPx;
    a.t = 0;
  }

  resolvePendingAction() {
    if (!this.pending) return;
    const { kind, fromId, toId } = this.pending;
    this.pending = null;
    const from = this.units.find(u => u.id === fromId);
    const to = this.units.find(u => u.id === toId);
    if (!from || !to) { this.cleanupAndCheck(); this.endTurn(); return; }

    if (kind === 'attack') {
      if (this.canAttack(from.stack, to.stack)) {
        this.attack(from, to);
        this.turn.acted = true;
        this.cleanupAndCheck();
        if (!this.result) this.endTurn();
      } else {
        this.msg = `${from.stack.name}: цель вне дальности после хода.`;
        this.renderHUD();
      }
      return;
    }

    if (kind === 'heal') {
      if (this.canAttack(from.stack, to.stack)) {
        this.heal(from, to);
        this.turn.acted = true;
        this.cleanupAndCheck();
        if (!this.result) this.endTurn();
      } else {
        this.msg = `${from.stack.name}: цель лечения вне дальности.`;
        this.renderHUD();
      }
    }
  }

  resolvePlayerTarget(active, hit) {
    if (this.result) return false;
    if (active.id === hit.id) {
      this.msg = `${active.stack.name}: выберите клетку для хода или цель.`;
      this.renderHUD();
      return false;
    }

    if (this.turn.acted) {
      this.msg = `${active.stack.name}: действие уже использовано. Space/Enter — пропуск.`;
      this.s.audio?.play('click');
      this.renderHUD();
      return false;
    }

    // Heal ally
    if (hit.stack.side === active.stack.side) {
      if (active.stack.role !== 'support') {
        this.msg = `${active.stack.name}: лечить может только целитель.`;
        this.s.audio?.play('click');
        this.renderHUD();
        return false;
      }
      if (!this.canAttack(active.stack, hit.stack)) {
        this.msg = `${active.stack.name}: цель лечения вне дальности. Сначала ход.`;
        this.s.audio?.play('click');
        this.renderHUD();
        return false;
      }
      const did = this.tryHeal(active, hit);
      if (!did) {
        this.s.audio?.play('click');
        this.renderHUD();
        return false;
      }
      this.turn.acted = true;
      this.cleanupAndCheck();
      if (!this.result) this.endTurn();
      return true;
    }

    // Attack enemy
    if (!this.canAttack(active.stack, hit.stack)) {
      this.msg = `${active.stack.name}: цель вне дальности. Можно сначала сходить.`;
      this.s.audio?.play('click');
      this.renderHUD();
      return false;
    }

    this.attack(active, hit);
    this.turn.acted = true;
    this.cleanupAndCheck();
    if (!this.result) this.endTurn();
    return true;
  }

  tryPlayerMove(active, hex) {
    if (this.turn.acted) {
      this.msg = `${active.stack.name}: после действия ход невозможен (только пропуск).`;
      this.s.audio?.play('click');
      this.renderHUD();
      return false;
    }
    if (this.turn.moved) {
      this.msg = `${active.stack.name}: ход уже выполнен (можно атаковать).`;
      this.s.audio?.play('click');
      this.renderHUD();
      return false;
    }

    // Can't move onto occupied
    if (this.isOccupied(hex.q, hex.r)) {
      this.msg = 'Клетка занята.';
      this.s.audio?.play('click');
      this.renderHUD();
      return false;
    }

    const reachable = this.getReachable(active);
    const k = keyQR(hex.q, hex.r);
    if (!reachable.cells.has(k)) {
      this.msg = 'Слишком далеко для хода.';
      this.s.audio?.play('click');
      this.renderHUD();
      return false;
    }

    const path = this.buildPath(active.stack, hex, reachable.prev);
    if (!path.length) {
      this.msg = 'Невозможно построить путь.';
      this.s.audio?.play('click');
      this.renderHUD();
      return false;
    }

    this.startMoveAnim(active, path);
    this.msg = `${active.stack.name}: движение...`;
    this.renderHUD();
    this.s.audio?.play('step');
    return true;
  }

  ensureActive() {
    if (this.activeId && this.isAlive(this.activeId)) return;
    this.endTurn(true);
  }

  endTurn(silent = false) {
    // advance to next alive unit in order
    if (!this.turnOrder.length) return;

    for (let i = 0; i < this.turnOrder.length; i++) {
      this.turnIndex = (this.turnIndex + 1) % this.turnOrder.length;
      const id = this.turnOrder[this.turnIndex];
      if (this.isAlive(id)) {
        this.activeId = id;
        break;
      }
    }

    this.resetTurnFlags();
    if (!silent) this.renderHUD();
  }

  inBounds(q, r) {
    return q >= 0 && q < this.board.cols && r >= 0 && r < this.board.rows;
  }

  isOccupied(q, r, exceptId = null) {
    return this.units.some(u => u.stack.count > 0 && u.id !== exceptId && u.stack.q === q && u.stack.r === r);
  }

  canAttack(a, b) {
    return distHex(a, b) <= (a.range ?? 1);
  }

  getReachable(active) {
    const id = active.id;
    const q = active.stack.q;
    const r = active.stack.r;
    if (this._reachCache.id === id && this._reachCache.q === q && this._reachCache.r === r && this._reachCache.moved === this.turn.moved) {
      return this._reachCache;
    }

    const maxSteps = Math.max(0, Math.floor(active.stack.speed || 0));
    const start = { q, r };
    const cells = new Set();
    const prev = new Map();

    // BFS within maxSteps
    const q0 = [{ q, r, d: 0 }];
    const seen = new Set([keyQR(q, r)]);
    while (q0.length) {
      const cur = q0.shift();
      if (cur.d >= maxSteps) continue;
      for (const d of DIRS) {
        const nq = cur.q + d.dq;
        const nr = cur.r + d.dr;
        if (!this.inBounds(nq, nr)) continue;
        const nk = keyQR(nq, nr);
        if (seen.has(nk)) continue;
        if (this.isOccupied(nq, nr, id)) continue;
        seen.add(nk);
        prev.set(nk, keyQR(cur.q, cur.r));
        cells.add(nk);
        q0.push({ q: nq, r: nr, d: cur.d + 1 });
      }
    }

    this._reachCache = { id, q, r, moved: this.turn.moved, cells, prev };
    return this._reachCache;
  }

  buildPath(stack, dest, prevMap) {
    const startK = keyQR(stack.q, stack.r);
    const goalK = keyQR(dest.q, dest.r);
    if (startK === goalK) return [];
    const pathKeys = [goalK];
    let cur = goalK;
    let guard = 0;
    while (cur !== startK && guard++ < 200) {
      const p = prevMap.get(cur);
      if (!p) return [];
      pathKeys.push(p);
      cur = p;
    }
    pathKeys.reverse();
    // convert to coords, skip the first (start)
    return pathKeys.slice(1).map(k => {
      const [q, r] = k.split(',').map(Number);
      return { q, r };
    });
  }

  startMoveAnim(unit, path, pending = null) {
    if (!path.length) return;
    const first = path[0];
    const fromPx = hexToPixel(unit.stack.q, unit.stack.r, this.board.origin.x, this.board.origin.y);
    const toPx = hexToPixel(first.q, first.r, this.board.origin.x, this.board.origin.y);
    unit.fx.phase = 'move';
    unit.fx.phaseT = 0.25;
    this.anim = {
      kind: 'move',
      unitId: unit.id,
      path,
      seg: 0,
      t: 0,
      dur: this.reducedMotion ? 0.01 : 0.12,
      fromPx,
      toPx,
      pending,
    };
  }

  aiTurn(active) {
    // Strictly turn-based: at most 1 move + 1 action.
    const s = active.stack;
    const allies = this.units.filter(x => x.stack.side === s.side);
    const enemies = this.units.filter(x => x.stack.side !== s.side);
    if (!enemies.length) return;

    // Support tries to heal.
    if (s.role === 'support') {
      const candidate = allies
        .map(a => {
          const max = a.stack.maxCount ?? a.stack.count;
          const missing = Math.max(0, max - a.stack.count);
          const d = distHex(s, a.stack);
          const missPct = max > 0 ? missing / max : 0;
          return { u: a, missing, score: missPct * 100 - d * 2 };
        })
        .filter(x => x.missing > 0)
        .sort((a, b) => b.score - a.score)[0]?.u || null;

      if (candidate) {
        if (this.canAttack(s, candidate.stack)) {
          this.heal(active, candidate);
          this.turn.acted = true;
          this.cleanupAndCheck();
          if (!this.result) this.endTurn();
          return;
        }

        // Move closer to heal range
        const moveTo = this.bestMoveToward(active, candidate.stack);
        if (moveTo) {
          const reach = this.getReachable(active);
          const path = this.buildPath(active.stack, moveTo, reach.prev);
          this.startMoveAnim(active, path, { kind: 'heal', fromId: active.id, toId: candidate.id });
          return;
        }
      }
    }

    // Attack logic
    const scoreRole = (st) => {
      if (st.role === 'support') return 50;
      if (st.type === 'mage') return 35;
      if (st.role === 'ranged') return 25;
      return 10;
    };

    const scored = enemies.map(e => {
      const d = distHex(s, e.stack);
      const hpWeight = Math.max(0, 10 - e.stack.count);
      const score = scoreRole(e.stack) + hpWeight - d * 3;
      return { u: e, d, score };
    }).sort((a, b) => b.score - a.score);

    const target = scored[0]?.u || null;
    if (!target) return;

    if (this.canAttack(s, target.stack)) {
      this.attack(active, target);
      this.turn.acted = true;
      this.cleanupAndCheck();
      if (!this.result) this.endTurn();
      return;
    }

    const moveTo = this.bestMoveToward(active, target.stack);
    if (moveTo) {
      const reach = this.getReachable(active);
      const path = this.buildPath(active.stack, moveTo, reach.prev);
      this.startMoveAnim(active, path, { kind: 'attack', fromId: active.id, toId: target.id });
      return;
    }

    // No move possible, skip.
    this.pushLog(`${s.name}: пропуск (нет хода)`);
    this.endTurn();
  }

  bestMoveToward(unit, targetStack) {
    const reach = this.getReachable(unit);
    if (!reach.cells.size) return null;
    let best = null;
    for (const k of reach.cells) {
      const [q, r] = k.split(',').map(Number);
      const d = distHex({ q, r }, targetStack);
      const score = -d;
      if (!best || score > best.score) best = { q, r, score };
    }
    if (!best) return null;
    return { q: best.q, r: best.r };
  }

  tryHeal(healer, target) {
    const h = healer.stack;
    const t = target.stack;
    const max = t.maxCount ?? t.count;
    const missing = Math.max(0, max - t.count);
    if (missing <= 0) {
      this.msg = `${t.name}: нет потерь для лечения.`;
      return false;
    }
    this.heal(healer, target);
    this.msg = `${h.name}: лечение ${t.name}.`;
    return true;
  }

  attack(attacker, defender) {
    const a = attacker.stack;
    const d = defender.stack;

    attacker.fx.phase = 'attack';
    attacker.fx.phaseT = 0.18;

    const totalDmg = a.count * a.dmg;
    const unitsKilled = Math.floor(totalDmg / d.hpPerUnit);
    const kill = Math.max(1, unitsKilled);

    d.count = Math.max(0, d.count - kill);

    this.pushLog(`${a.name} → ${d.name}: -${kill}`);
    this.s.audio?.play('hit');

    this.flash(defender);
    this.floatAt(defender, `-${kill}`);

    // Mage splash
    if (a.splash > 0 && d.count > 0) {
      const splashTargets = this.units
        .filter(u => u.stack.side !== a.side && u.id !== defender.id)
        .filter(u => distHex(u.stack, d) <= 1)
        .slice(0, 2);

      for (const t of splashTargets) {
        const dmg2 = Math.floor((totalDmg * a.splash) / t.stack.hpPerUnit);
        const kill2 = Math.max(1, dmg2);
        t.stack.count = Math.max(0, t.stack.count - kill2);
        this.pushLog(`  ↳ всплеск по ${t.stack.name}: -${kill2}`);
        this.flash(t);
        this.floatAt(t, `-${kill2}`);
      }
    }
  }

  heal(healer, target) {
    const h = healer.stack;
    const t = target.stack;
    const max = t.maxCount ?? t.count;
    const missing = Math.max(0, max - t.count);
    if (missing <= 0) return;

    healer.fx.phase = 'heal';
    healer.fx.phaseT = 0.22;

    const totalHeal = h.count * Math.max(1, h.heal || 2);
    const unitsRestored = Math.max(1, Math.floor(totalHeal / t.hpPerUnit));
    const restore = Math.min(missing, unitsRestored);

    t.count = Math.min(max, t.count + restore);
    this.pushLog(`${h.name} → ${t.name}: +${restore}`);

    this.s.audio?.play('heal');
    this.flash(target, true);
    this.floatAt(target, `+${restore}`);
  }

  flash(unit, good = false) {
    if (this.reducedMotion) return;
    unit.fx.flash = good ? 1.0 : 0.9;
    unit.fx.shake = 0.6;
  }

  floatAt(unit, text) {
    const { x, y } = hexToPixel(unit.stack.q, unit.stack.r, this.board.origin.x, this.board.origin.y);
    this.floats.push({ x, y, text, ttl: 0.75 });
  }

  pushLog(line) {
    this.log.push(line);
    if (this.log.length > 12) this.log = this.log.slice(this.log.length - 12);
  }

  cleanupAndCheck() {
    // Remove dead stacks from the board.
    this.units = this.units.filter(u => u.stack.count > 0);

    const anyPlayer = this.units.some(u => u.stack.side === 'player');
    const anyEnemy = this.units.some(u => u.stack.side === 'enemy');
    if (!anyEnemy) this.finish('win');
    if (!anyPlayer) this.finish('lose');
  }

  pickUnit(px, py) {
    // Prefer unit hit when pointer is near the center.
    for (const u of this.units) {
      const pos = u.drawPos || hexToPixel(u.stack.q, u.stack.r, this.board.origin.x, this.board.origin.y);
      if (pointInHex(px, py, pos.x, pos.y, HEX_SIZE * 0.70)) return u;
    }
    return null;
  }

  pickHex(px, py) {
    // Small board: brute-force test.
    for (let r = 0; r < this.board.rows; r++) {
      for (let q = 0; q < this.board.cols; q++) {
        const { x, y } = hexToPixel(q, r, this.board.origin.x, this.board.origin.y);
        if (pointInHex(px, py, x, y, HEX_SIZE * 0.92)) return { q, r };
      }
    }
    return null;
  }

  renderHUD() {
    const active = this.activeUnit();
    const status = this.result ? (this.result === 'win' ? 'Победа!' : 'Поражение') : 'Бой';
    const hover = this.units.find(u => u.id === this.hoverId);

    const activeText = active
      ? `${active.stack.side === 'player' ? 'Ваш' : 'Враг'}: ${active.stack.name} (${active.stack.count}/${active.stack.maxCount ?? active.stack.count})`
      : '—';

    const hoverText = hover
      ? `${hover.stack.side === 'player' ? 'Союзник' : 'Враг'}: ${hover.stack.name} (${hover.stack.count}/${hover.stack.maxCount ?? hover.stack.count})`
      : '';

    const hint = this.msg || (active?.stack.side === 'player'
      ? `Ваш ход: клик по клетке — движение (радиус подсвечен). Клик по врагу — атака. Целитель: клик по союзнику — лечение. Space/Enter — пропуск. Esc — отступить.`
      : 'Ход врага...');

    const turnInfo = active?.stack.side === 'player'
      ? `<div class="small" style="margin-top:6px;opacity:.9">Ход: ${this.turn.moved ? '✔ ход' : '— ход'} • ${this.turn.acted ? '✔ действие' : '— действие'}</div>`
      : '';

    const logHtml = this.log.length
      ? `<div class="small" style="margin-top:8px;max-height:160px;overflow:auto;border:1px solid rgba(255,255,255,0.1);padding:6px;border-radius:10px">
          <div style="font-weight:600;margin-bottom:6px;display:flex;align-items:center;justify-content:space-between">
            <span>Лог боя</span>
            <span style="opacity:.7">⚔ атака • ✚ лечение • ☄ всплеск</span>
          </div>
          <div class="battle-log">
            ${this.log.map(l => formatLogLine(l)).join('')}
          </div>
        </div>`
      : '';

    this.s.hud.setCard('bt', `
      <div>
        <div style="font-weight:700;margin-bottom:6px">${status} • ${String(this.payload.tileKind || '').toUpperCase()}</div>
        <div class="small">Активный: <b>${escapeHtml(activeText)}</b></div>
        ${turnInfo}
        ${hoverText ? `<div class="small" style="margin-top:4px">${escapeHtml(hoverText)}</div>` : ''}
        <div class="small" style="margin:8px 0 10px">${escapeHtml(hint)}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button data-action="skip" title="Пропустить ход активного отряда (Space/Enter)">Пропуск</button>
          <button data-action="retreat" title="Сдаться и закончить забег">Отступить</button>
        </div>
        ${logHtml}
      </div>
    `);
  }

  render() {
    const { ctx, canvas } = this.s;
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const active = this.activeUnit();

    // Movement radius for active player unit.
    let reach = null;
    if (!this.result && active && active.stack.side === 'player' && !this.turn.moved && !this.anim) {
      reach = this.getReachable(active);
    }

    // board
    for (let r = 0; r < this.board.rows; r++) {
      for (let q = 0; q < this.board.cols; q++) {
        const { x, y } = hexToPixel(q, r, this.board.origin.x, this.board.origin.y);

        // Soft grass tile fill + edge.
        const alt = (q + r) % 2;
        const baseFill = alt ? 'rgba(120,190,255,0.025)' : 'rgba(255,255,255,0.018)';
        drawHex(ctx, x, y, HEX_SIZE, 'rgba(255,255,255,0.08)', baseFill);

        if (reach && reach.cells.has(keyQR(q, r))) {
          drawHex(ctx, x, y, HEX_SIZE * 0.96, 'rgba(120,190,255,0.16)', 'rgba(120,190,255,0.06)');
        }
      }
    }

    // Hover outline
    if (this.hoverHex) {
      const { x, y } = hexToPixel(this.hoverHex.q, this.hoverHex.r, this.board.origin.x, this.board.origin.y);
      drawHex(ctx, x, y, HEX_SIZE * 0.98, 'rgba(255,255,255,0.14)', null);
    }

    // units
    for (const u of this.units) {
      const pos = u.drawPos || hexToPixel(u.stack.q, u.stack.r, this.board.origin.x, this.board.origin.y);
      const isActive = active && u.id === active.id;
      const phase = u.fx.phase || 'idle';
      const spriteSize = Math.round(HEX_SIZE * 1.25);
      drawStackSprite(ctx, u.stack, pos.x, pos.y, spriteSize, {
        t: this.time,
        active: isActive,
        facing: u.stack.side === 'player' ? 1 : -1,
        fxFlash: u.fx.flash,
        fxShake: this.reducedMotion ? 0 : u.fx.shake,
        phase,
      });
    }

    // floating text
    ctx.font = '14px system-ui';
    ctx.textAlign = 'center';
    for (const f of this.floats) {
      const k = Math.min(1, Math.max(0, f.ttl / 0.75));
      const dy = (1 - k) * 18;
      const alpha = Math.min(1, k * 1.2);
      ctx.fillStyle = `rgba(255,255,255,${alpha})`;
      ctx.fillText(f.text, f.x, f.y - 26 - dy);
    }
    ctx.textAlign = 'left';

  }

  startWinFx() {
    const { canvas } = this.s;
    const cx = Math.floor(canvas.width * 0.50);
    const cy = Math.floor(canvas.height * 0.42);
    const nMotes = this.reducedMotion ? 18 : 46;
    const nStreaks = this.reducedMotion ? 10 : 22;
    const motes = [];
    const streaks = [];
    for (let i = 0; i < nMotes; i++) {
      const a = Math.random() * Math.PI * 2;
      const rr = 60 + Math.random() * 170;
      const spd = 0.6 + Math.random() * 1.6;
      const s = 1.8 + Math.random() * 2.6;
      motes.push({ a, rr, spd, s, seed: Math.random() });
    }
    for (let i = 0; i < nStreaks; i++) {
      const a = Math.random() * Math.PI * 2;
      const rr = 30 + Math.random() * 150;
      const len = 10 + Math.random() * 26;
      const wob = 0.4 + Math.random() * 1.2;
      streaks.push({ a, rr, len, wob, seed: Math.random() });
    }
    this.endFx = { t: 0, dur: 1.25, motes, streaks, cx, cy, seed: Math.random() };
  }

  renderWinFx(ctx) {
    const fx = this.endFx;
    if (!fx) return;
    const p = Math.max(0, Math.min(1, fx.t / fx.dur));
    const ease = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
    const cx = fx.cx, cy = fx.cy;

    // "Painted" victory flourish (same vibe as shrine/ruins/anomaly scenes).
    const pulse = 0.55 + 0.25 * Math.sin(fx.t * 3.0 + fx.seed * 3.1);
    const w = this.s.canvas.width;
    const h = this.s.canvas.height;

    ctx.save();
    // Soft vignette ellipse
    ctx.fillStyle = `rgba(0,0,0,${0.24 * ease})`;
    ctx.beginPath();
    ctx.ellipse(w * 0.5, h * 0.55, w * 0.55, h * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();

    // Ground glow
    ctx.fillStyle = `rgba(255,255,255,${0.03 + 0.05 * pulse})`;
    ctx.beginPath();
    ctx.ellipse(cx, cy + 150, 320, 92, 0, 0, Math.PI * 2);
    ctx.fill();

    // Core portal-like glow
    const grad = ctx.createRadialGradient(cx, cy, 10, cx, cy, 260);
    grad.addColorStop(0, `rgba(255,220,160,${0.22 + 0.14 * pulse})`);
    grad.addColorStop(0.45, `rgba(140,220,255,${0.10 + 0.06 * pulse})`);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, 260, 0, Math.PI * 2);
    ctx.fill();

    // Swirling rings (hand-drawn ellipses)
    ctx.strokeStyle = `rgba(255,230,190,${0.20 + 0.16 * pulse})`;
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
      const r = 70 + i * 32 + Math.sin(fx.t * 1.7 + i) * 4;
      ctx.beginPath();
      ctx.ellipse(cx, cy, r, r * 0.62, fx.t * 0.55 + i * 0.6, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Brush rays
    ctx.strokeStyle = `rgba(255,255,255,${0.10 + 0.12 * (1 - p)})`;
    ctx.lineWidth = 1.6;
    const rays = this.reducedMotion ? 10 : 18;
    const rr0 = 70;
    const rr1 = 210 + 60 * ease;
    for (let i = 0; i < rays; i++) {
      const a = (i / rays) * Math.PI * 2 + fx.t * 0.35;
      const wob = 0.10 * Math.sin(fx.t * 2.4 + i * 1.7);
      const x0 = cx + Math.cos(a + wob) * rr0;
      const y0 = cy + Math.sin(a + wob) * (rr0 * 0.7);
      const x1 = cx + Math.cos(a - wob) * rr1;
      const y1 = cy + Math.sin(a - wob) * (rr1 * 0.7);
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
    }

    // Motes
    ctx.fillStyle = `rgba(255,255,255,${0.05 + 0.08 * pulse})`;
    for (const m of fx.motes) {
      const a = m.a + fx.t * m.spd;
      const rr = m.rr + 10 * Math.sin(fx.t * 2.0 + m.seed * 10);
      const x = cx + Math.cos(a) * rr;
      const y = cy + Math.sin(a) * (rr * 0.55);
      const alpha = (1 - p) * (0.55 + 0.45 * Math.sin(m.seed * 12));
      ctx.fillStyle = `rgba(255,245,230,${0.08 * alpha})`;
      ctx.beginPath();
      ctx.arc(x, y, m.s, 0, Math.PI * 2);
      ctx.fill();
    }

    // Streak particles
    ctx.strokeStyle = `rgba(200,245,255,${0.12 + 0.10 * pulse})`;
    ctx.lineWidth = 1.4;
    for (const s of fx.streaks) {
      const a = s.a + fx.t * (0.25 + s.wob);
      const rr = s.rr + 16 * Math.sin(fx.t * 1.8 + s.seed * 9);
      const x = cx + Math.cos(a) * rr;
      const y = cy + Math.sin(a) * (rr * 0.6);
      const len = s.len * (0.75 + 0.35 * (1 - p));
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y - len);
      ctx.stroke();
    }

    // Text with soft glow
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 44px system-ui';
    ctx.fillStyle = `rgba(255,240,210,${0.35 + 0.55 * ease})`;
    ctx.fillText('Победа', cx, cy - 10);
    ctx.font = '14px system-ui';
    ctx.fillStyle = `rgba(255,255,255,${0.35 + 0.25 * (1 - p)})`;
    ctx.fillText('добыча...', cx, cy + 28);

    ctx.restore();
  }

  finish(result) {
    if (this.result) return;
    this.result = result;

    const m = this.s.game.model;
    const tileKey = `${this.payload.tile.x},${this.payload.tile.y}`;
    const tile = m.world.tiles?.[tileKey];

    const playerAfter = this.units
      .filter(u => u.stack.side === 'player')
      .map(u => {
        const s = cloneStack(u.stack);
        delete s.q; delete s.r; delete s.side;
        return s;
      });

    // Loss report
    const losses = [];
    const startByType = new Map();
    for (const st of m.army) startByType.set(st.type, st.count);
    const afterByType = new Map();
    for (const st of playerAfter) afterByType.set(st.type, st.count);
    for (const [type, startCount] of startByType.entries()) {
      const afterCount = afterByType.get(type) ?? 0;
      const lost = Math.max(0, startCount - afterCount);
      if (lost > 0) losses.push({ type, name: m.army.find(s => s.type === type)?.name || type, lost });
    }

    if (result === 'win') {
      if (tile) tile.defeated = true;
      applyBattleOutcomeToArmy(m, playerAfter);

      const rewards = battleRewards(m, this.payload.tileKind);
      const report = { battleType: this.payload.tileKind, losses };
      saveGame(m);

      // Win: go to PostBattle; victory animation is rendered there (not inside battle).
      this.s.audio?.play('win');
      this.s.game.sm.go('postBattle', { result: 'win', battleType: this.payload.tileKind, rewards, report });
      return;
    }

    // lose
    m.lastBattle = { battleType: this.payload.tileKind, losses };
    saveGame(m);
    clearSave();

    this.s.audio?.play('lose');
    this.s.game.sm.go('gameOver');
  }
}

function escapeHtml(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function formatLogLine(line) {
  const raw = String(line);
  const isSplash = raw.includes('всплеск') || raw.includes('↳');

  // Parse "A → B: -3" / "+2" patterns.
  const m = raw.match(/^\s*(.+?)\s*→\s*(.+?):\s*([+-])(\d+)\s*$/);
  if (m) {
    const a = escapeHtml(m[1]);
    const b = escapeHtml(m[2]);
    const sign = m[3];
    const n = m[4];
    const icon = isSplash ? '☄' : (sign === '+' ? '✚' : '⚔');
    const cls = sign === '+' ? 'log-heal' : (isSplash ? 'log-splash' : 'log-hit');
    return `<div class="log-line ${cls}"><span class="log-ico">${icon}</span><span class="log-a">${a}</span> → <span class="log-b">${b}</span>: <span class="log-amt">${sign}${n}</span></div>`;
  }

  return `<div class="log-line log-muted"><span class="log-ico">•</span><span>${escapeHtml(raw)}</span></div>`;
}
