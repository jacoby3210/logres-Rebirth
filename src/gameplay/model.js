import { UnitType, makeStack } from './data.js';

export function newModel({ seed, world }) {
  return {
    version: 2,
    seed,
    world,
    settings: {
      difficulty: 'normal',
      hints: true,
      reducedMotion: false,
    },
    hero: {
      x: 1,
      y: 1,
      mp: 6,
      mpMax: 6,
    },
    res: {
      gold: 120,
      ve: 0,
      veMax: 100,
    },
    progression: {
      turns: 1,
      wins: 0,
      majorWins: 0,
      bossDefeated: false,
      anomalyThreat: 0,
    },
    echo: {
      summonNextBattle: false,
    },
    buffs: {
      nextBattleSpeedPlus: 0,
      nextBattleDamagePlus: 0,
    },
    army: [
      makeStack(UnitType.SWORDSMAN, 12),
      makeStack(UnitType.ARCHER, 8),
      makeStack(UnitType.HEALER, 5),
    ],
    lastBattle: null,
  };
}

export function armySummary(army) {
  return army.map(s => `${s.name}: ${s.count}/${s.maxCount}`).join(' • ');
}

export function normalizeLoadedModel(model) {
  if (!model || typeof model !== 'object') return null;

  model.version ??= 1;
  model.seed ??= Date.now();
  model.world ??= { cols: 24, rows: 12, tiles: {} };

  // Defensive normalization for corrupted / partial saves.
  // Keep the overworld wider; older saves may expand with empty extra columns.
  model.world.cols = clampInt(model.world.cols, 18, 18, 60);
  model.world.rows = clampInt(model.world.rows, 12, 1, 40);
  if (!model.world.tiles || typeof model.world.tiles !== 'object' || Array.isArray(model.world.tiles)) model.world.tiles = {};

  model.settings ??= { difficulty: 'normal', hints: true, reducedMotion: false };
  model.settings.difficulty ??= 'normal';
  model.settings.hints ??= true;
  model.settings.reducedMotion ??= false;

  model.res ??= { gold: 0, ve: 0, veMax: 100 };
  model.res.veMax ??= 100;
  model.res.veMax = clampInt(model.res.veMax, 100, 1, 1000);
  model.res.gold = clampInt(model.res.gold, 0, 0, 999999);
  model.res.ve = clampInt(model.res.ve, 0, 0, model.res.veMax);

  model.progression ??= { turns: 1, wins: 0, majorWins: 0, bossDefeated: false, anomalyThreat: 0 };
  model.progression.turns ??= 1;
  model.progression.wins ??= 0;
  model.progression.majorWins ??= 0;
  model.progression.bossDefeated ??= false;
  model.progression.anomalyThreat ??= 0;

  model.echo ??= { summonNextBattle: false };
  model.echo.summonNextBattle ??= false;

  model.buffs ??= { nextBattleSpeedPlus: 0, nextBattleDamagePlus: 0 };
  model.buffs.nextBattleSpeedPlus ??= 0;
  model.buffs.nextBattleDamagePlus ??= 0;

  model.hero ??= { x: 1, y: 1, mp: 6, mpMax: 6 };
  model.hero.x ??= 1;
  model.hero.y ??= 1;
  model.hero.mp ??= 6;
  model.hero.mpMax ??= 6;

  const cols = model.world.cols || 18;
  const rows = model.world.rows || 12;
  model.hero.x = clampInt(model.hero.x, 1, 0, cols - 1);
  model.hero.y = clampInt(model.hero.y, 1, 0, rows - 1);
  model.hero.mpMax = clampInt(model.hero.mpMax, 6, 0, 99);
  model.hero.mp = clampInt(model.hero.mp, model.hero.mpMax, 0, model.hero.mpMax);

  if (!Array.isArray(model.army)) model.army = [];
  model.army = model.army.filter(s => s && typeof s === 'object' && typeof s.type === 'string');
  for (const s of model.army) {
    s.count = clampInt(s.count, 0, 0, 999999);
    if (s.maxCount == null) s.maxCount = s.count;
    s.maxCount = clampInt(s.maxCount, s.count, 0, 999999);
    if (s.count > s.maxCount) s.count = s.maxCount;

    if (s.name == null) s.name = String(s.type);

    // Guard battle math against NaNs/zeros.
    s.hpPerUnit = clampInt(s.hpPerUnit, 10, 1, 999999);
    s.dmg = clampInt(s.dmg, 1, 0, 999999);
    s.range = clampInt(s.range, 1, 0, 99);
    s.speed = clampInt(s.speed, 1, 0, 99);

    if (s.heal == null) s.heal = 0;
    if (s.splash == null) s.splash = 0;
    s.heal = Number.isFinite(Number(s.heal)) ? Number(s.heal) : 0;
    s.splash = Number.isFinite(Number(s.splash)) ? Number(s.splash) : 0;
  }

  return model;
}

function clampInt(v, def, min, max) {
  let n = Number(v);
  if (!Number.isFinite(n)) n = Number(def);
  if (!Number.isFinite(n)) n = 0;
  n = Math.floor(n);
  if (min != null) n = Math.max(min, n);
  if (max != null) n = Math.min(max, n);
  return n;
}
