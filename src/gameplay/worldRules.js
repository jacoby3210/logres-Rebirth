import { UnitType, makeStack, cloneStack } from './data.js';

// Centralized rules (balance lives here).

export function makeEnemyArmyForTile(model, tile) {
  const p = model.progression;
  const diff = model.settings?.difficulty || 'normal';
  const threat = p.anomalyThreat || 0;

  // Base curve: wins mostly, turns slightly.
  let base = 7 + p.wins * 2 + Math.floor(p.turns / 4);

  // Difficulty scalars.
  const dm = diff === 'easy' ? 0.88 : diff === 'hard' ? 1.12 : 1.0;
  base = Math.floor(base * dm) + threat * 3;

  const rng = seededFrom(`${model.seed}|${tile.id}`);
  const hasHealer = rng() < 0.35;
  const hasMage = rng() < 0.45;

  if (tile.kind === 'boss') {
    return [
      makeStack(UnitType.SWORDSMAN, base + 12),
      makeStack(UnitType.ARCHER, Math.max(7, base + 2)),
      makeStack(UnitType.MAGE, Math.max(6, Math.floor(base * 0.8))),
      ...(hasHealer ? [makeStack(UnitType.HEALER, Math.max(4, Math.floor(base * 0.5)))] : []),
    ];
  }

  if (tile.kind === 'elite') {
    return [
      makeStack(UnitType.SWORDSMAN, base + 6),
      ...(hasMage ? [makeStack(UnitType.MAGE, Math.max(4, Math.floor(base * 0.7)))] : [makeStack(UnitType.ARCHER, Math.max(5, Math.floor(base * 0.7)))]),
      ...(hasHealer ? [makeStack(UnitType.HEALER, Math.max(3, Math.floor(base * 0.45)))] : []),
    ];
  }

  return [
    makeStack(UnitType.SWORDSMAN, base),
    makeStack(UnitType.ARCHER, Math.max(4, Math.floor(base * 0.65))),
    ...(hasMage && p.wins >= 2 ? [makeStack(UnitType.MAGE, Math.max(3, Math.floor(base * 0.4)))] : []),
    ...(hasHealer && p.wins >= 3 ? [makeStack(UnitType.HEALER, Math.max(2, Math.floor(base * 0.35)))] : []),
  ];
}

export function battleRewards(model, tileKind) {
  const p = model.progression;
  const diff = model.settings?.difficulty || 'normal';

  const curve = Math.min(6, Math.floor(p.wins / 2));
  let out;
  if (tileKind === 'boss') out = { gold: 140 + curve * 8, ve: 30 + curve * 2 };
  else if (tileKind === 'elite') out = { gold: 85 + curve * 6, ve: 14 + curve * 2 };
  else {
    const ve = Math.max(0, Math.min(5, 2 + Math.floor(p.wins / 4)));
    out = { gold: 50 + curve * 4, ve };
  }

  // Difficulty tuning: hard gives a tiny compensation.
  if (diff === 'easy') out.gold = Math.floor(out.gold * 0.95);
  if (diff === 'hard') out.gold = Math.floor(out.gold * 1.05);

  return out;
}

export function makePlayerBattleArmy(model) {
  return model.army.map(cloneStack);
}

export function applyBattleOutcomeToArmy(model, postBattleArmy) {
  for (const after of postBattleArmy) {
    const st = model.army.find(x => x.type === after.type);
    if (st) st.count = Math.max(0, Math.min(st.maxCount, after.count));
    else model.army.push(after);
  }
  model.army = model.army.filter(s => s.maxCount > 0);
}

export function makeEchoSummonStack() {
  const st = makeStack(UnitType.SWORDSMAN, 6);
  st.name = 'Эхо-герой';
  st.hpPerUnit = 14;
  st.dmg = 4;
  st.maxCount = 6;
  st.range = 1;
  st.role = 'melee';
  return st;
}

// --- internal helpers ---
function seededFrom(seedStr) {
  let h = 2166136261;
  for (let i = 0; i < seedStr.length; i++) {
    h ^= seedStr.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let s = h >>> 0;
  return function rnd() {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return (s & 0xffffffff) / 4294967296;
  };
}
