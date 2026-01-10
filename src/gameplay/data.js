// Data layer: unit types, base stats.
// В Этапе 3 сюда добавятся баланс/таблицы из ТЗ.

export const UnitType = {
  SWORDSMAN: 'swordsman',
  ARCHER: 'archer',
  MAGE: 'mage',
  HEALER: 'healer',
};

export const UNIT_DEFS = {
  [UnitType.SWORDSMAN]: { name: 'Мечники',  hp: 12, dmg: 3, range: 1, speed: 2, role: 'melee',   cost: 8 },
  [UnitType.ARCHER]:    { name: 'Лучники',  hp: 8,  dmg: 2, range: 4, speed: 2, role: 'ranged',  cost: 10 },
  [UnitType.MAGE]:      { name: 'Маги',     hp: 7,  dmg: 4, range: 3, speed: 2, role: 'ranged',  cost: 12, splash: 0.5 },
  [UnitType.HEALER]:    { name: 'Целители', hp: 9,  dmg: 1, range: 2, speed: 2, role: 'support', cost: 11, heal: 3 },
};

export function makeStack(type, count) {
  const def = UNIT_DEFS[type];
  return {
    type,
    name: def.name,
    count,
    maxCount: count,
    hpPerUnit: def.hp,
    dmg: def.dmg,
    heal: def.heal || 0,
    splash: def.splash || 0,
    range: def.range,
    speed: def.speed,
    role: def.role,
    // battle runtime
    q: 0, r: 0,
    cooldown: 0,
    targetId: null,
    side: 'player', // or 'enemy'
  };
}

export function cloneStack(stack) {
  // structuredClone not supported in older browsers; keep this local helper.
  return JSON.parse(JSON.stringify(stack));
}
