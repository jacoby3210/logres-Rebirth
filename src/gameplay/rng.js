// Deterministic RNG (seeded) to make reloads stable.
// Mulberry32: small, fast, good enough for procedural placement.

export function mulberry32(seed) {
  let t = seed >>> 0;
  return function next() {
    t += 0x6D2B79F5;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

export function randInt(rng, min, maxInclusive) {
  return Math.floor(rng() * (maxInclusive - min + 1)) + min;
}

export function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}
