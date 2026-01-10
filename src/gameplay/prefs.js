// Lightweight user preferences stored separately from the save.
// Keeps Stage 3 "session" save clean and lets players tweak UX at any time.

const KEY = 'logres_prefs_v1';

export const DEFAULT_PREFS = {
  difficulty: 'normal', // 'easy'|'normal'|'hard'
  sound: true,
  volume: 0.6, // 0..1
  hints: true,
  reducedMotion: false,
  tutorialSeen: false,
};

export function loadPrefs() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    const obj = JSON.parse(raw);
    return sanitizePrefs(obj);
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function savePrefs(prefs) {
  try {
    localStorage.setItem(KEY, JSON.stringify(sanitizePrefs(prefs)));
    return true;
  } catch {
    return false;
  }
}

export function sanitizePrefs(p) {
  const out = { ...DEFAULT_PREFS, ...(p && typeof p === 'object' ? p : {}) };
  if (!['easy', 'normal', 'hard'].includes(out.difficulty)) out.difficulty = 'normal';
  out.sound = !!out.sound;
  out.hints = !!out.hints;
  out.reducedMotion = !!out.reducedMotion;
  out.tutorialSeen = !!out.tutorialSeen;
  out.volume = clamp(Number(out.volume), 0, 1);
  return out;
}

function clamp(v, a, b) {
  if (!Number.isFinite(v)) return a;
  return Math.max(a, Math.min(b, v));
}
