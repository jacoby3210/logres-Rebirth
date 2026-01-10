const KEY = 'logres_save_v1';

export function saveGame(model) {
  try {
    localStorage.setItem(KEY, JSON.stringify(model));
    return true;
  } catch (e) {
    console.warn('Save failed', e);
    return false;
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    console.warn('Load failed', e);
    return null;
  }
}

export function hasSave() {
  try {
    return !!localStorage.getItem(KEY);
  } catch {
    return false;
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(KEY);
    return true;
  } catch {
    return false;
  }
}
