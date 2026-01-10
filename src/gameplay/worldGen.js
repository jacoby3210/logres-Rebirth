import { mulberry32, randInt, pick } from './rng.js';
import { UnitType } from './data.js';

// Tile model:
// { kind: 'empty'|'enemy'|'elite'|'boss'|'camp'|'chest'|'shrine'|'ruins'|'anomaly', id, defeated?, opened?, offers?, used? }

export function generateWorld({ cols = 24, rows = 12, seed = Date.now() } = {}) {
  const rng = mulberry32(seed);
  const tiles = {};

  const used = new Set();
  const key = (x, y) => `${x},${y}`;
  const reserve = (x, y) => used.add(key(x, y));
  const isUsed = (x, y) => used.has(key(x, y));

  // Reserve hero start area
  reserve(1, 1);
  reserve(1, 2);
  reserve(2, 1);

  // Boss far corner (prefer lower-right)
  const boss = { x: cols - 2, y: rows - 2 };
  reserve(boss.x, boss.y);
  tiles[key(boss.x, boss.y)] = { kind: 'boss', id: 'boss1', defeated: false };

  // Map filling (denser world). Anomalies are intentionally more frequent.
  const CAMPS = 4;
  const CHESTS = 8;
  const SHRINES = 4;
  const RUINS = 4;
  const ENEMIES = 10;
  const ELITES = 3;
  // 40% more anomalies than other elements (take max of other counts).
  const ANOMALIES = Math.ceil(Math.max(CAMPS, CHESTS, SHRINES, RUINS, ENEMIES, ELITES) * 1.4);

  // Camps
  for (let i = 0; i < CAMPS; i++) {
    const pos = findFree(rng, cols, rows, isUsed);
    reserve(pos.x, pos.y);
    const offers = campOffers(rng);
    tiles[key(pos.x, pos.y)] = { kind: 'camp', id: `camp${i + 1}`, offers };
  }

  // Chests
  for (let i = 0; i < CHESTS; i++) {
    const pos = findFree(rng, cols, rows, isUsed);
    reserve(pos.x, pos.y);
    const gold = randInt(rng, 25, 65);
    tiles[key(pos.x, pos.y)] = { kind: 'chest', id: `chest${i + 1}`, opened: false, gold };
  }

  // Events
  for (let i = 0; i < SHRINES; i++) {
    const pos = findFree(rng, cols, rows, isUsed);
    reserve(pos.x, pos.y);
    tiles[key(pos.x, pos.y)] = { kind: 'shrine', id: `shrine${i + 1}`, used: false };
  }
  for (let i = 0; i < RUINS; i++) {
    const pos = findFree(rng, cols, rows, isUsed);
    reserve(pos.x, pos.y);
    tiles[key(pos.x, pos.y)] = { kind: 'ruins', id: `ruins${i + 1}`, used: false };
  }
  for (let i = 0; i < ANOMALIES; i++) {
    const pos = findFree(rng, cols, rows, isUsed);
    reserve(pos.x, pos.y);
    tiles[key(pos.x, pos.y)] = { kind: 'anomaly', id: `anomaly${i + 1}`, used: false };
  }

  // Enemies (normals)
  for (let i = 0; i < ENEMIES; i++) {
    const pos = findFree(rng, cols, rows, isUsed);
    reserve(pos.x, pos.y);
    tiles[key(pos.x, pos.y)] = { kind: 'enemy', id: `e${i + 1}`, defeated: false };
  }

  // Elites
  for (let i = 0; i < ELITES; i++) {
    const pos = findFree(rng, cols, rows, isUsed);
    reserve(pos.x, pos.y);
    tiles[key(pos.x, pos.y)] = { kind: 'elite', id: `elite${i + 1}`, defeated: false };
  }

  return { cols, rows, tiles, seed };
}

function findFree(rng, cols, rows, isUsed) {
  for (let tries = 0; tries < 500; tries++) {
    const x = randInt(rng, 0, cols - 1);
    const y = randInt(rng, 0, rows - 1);
    if (!isUsed(x, y)) return { x, y };
  }
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) if (!isUsed(x, y)) return { x, y };
  return { x: 0, y: 0 };
}

function campOffers(rng) {
  const pool = [UnitType.SWORDSMAN, UnitType.ARCHER, UnitType.MAGE, UnitType.HEALER];
  const a = pick(rng, pool);
  let b = pick(rng, pool);
  while (b === a) b = pick(rng, pool);
  return [a, b];
}
