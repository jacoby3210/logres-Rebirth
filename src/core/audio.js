// Tiny WebAudio "bleep" sound set (no external assets).
// Safe defaults + user gesture unlock.

export class AudioManager {
  constructor() {
    this.enabled = true;
    this.volume = 0.6;
    this._ctx = null;
    this._unlocked = false;
  }

  applySettings({ sound, volume } = {}) {
    if (sound != null) this.enabled = !!sound;
    if (volume != null && Number.isFinite(volume)) this.volume = Math.max(0, Math.min(1, volume));
  }

  ensure() {
    if (this._ctx) return this._ctx;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    this._ctx = new Ctx();
    return this._ctx;
  }

  unlock() {
    const ctx = this.ensure();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    this._unlocked = true;
  }

  play(name) {
    if (!this.enabled) return;
    const ctx = this.ensure();
    if (!ctx) return;
    if (!this._unlocked) {
      // Will start working after first unlock; don't spam errors.
      return;
    }
    const preset = PRESETS[name] || PRESETS.click;
    const t0 = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = preset.type;
    osc.frequency.setValueAtTime(preset.f0, t0);
    if (preset.f1 != null) osc.frequency.linearRampToValueAtTime(preset.f1, t0 + preset.dur);

    const vol = this.volume * (preset.vol ?? 0.35);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + preset.dur);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(t0);
    osc.stop(t0 + preset.dur + 0.02);
  }
}

const PRESETS = {
  click: { type: 'triangle', f0: 640, f1: 520, dur: 0.06, vol: 0.20 },
  step:  { type: 'sine',     f0: 220, f1: 180, dur: 0.07, vol: 0.18 },
  hit:   { type: 'square',   f0: 160, f1:  90, dur: 0.10, vol: 0.30 },
  heal:  { type: 'sine',     f0: 520, f1: 720, dur: 0.12, vol: 0.22 },
  chest: { type: 'triangle', f0: 520, f1: 980, dur: 0.13, vol: 0.24 },
  echo:  { type: 'sine',     f0: 320, f1: 640, dur: 0.18, vol: 0.26 },
  win:   { type: 'triangle', f0: 440, f1: 880, dur: 0.25, vol: 0.28 },
  lose:  { type: 'square',   f0: 220, f1: 110, dur: 0.25, vol: 0.26 },
};
