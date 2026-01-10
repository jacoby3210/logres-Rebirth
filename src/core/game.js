import { Input } from './input.js';
import { StateMachine } from './stateMachine.js';
import { HUD } from '../ui/hud.js';

import { TitleState } from '../ui/titleState.js';
import { OverworldState } from '../gameplay/overworldState.js';
import { BattleState } from '../gameplay/battleState.js';
import { PostBattleState } from '../gameplay/postBattleState.js';
import { EchoState } from '../gameplay/echoState.js';
import { CampState } from '../gameplay/campState.js';
import { GameOverState } from '../ui/gameOverState.js';
import { VictoryState } from '../ui/victoryState.js';
import { EventState } from '../gameplay/eventState.js';

import { generateWorld } from '../gameplay/worldGen.js';
import { newModel, normalizeLoadedModel } from '../gameplay/model.js';
import { loadGame, saveGame } from '../gameplay/storage.js';
import { loadPrefs, savePrefs } from '../gameplay/prefs.js';
import { AudioManager } from './audio.js';
import { helpHtml, settingsHtml, bindSettingsHandlers } from '../ui/overlays.js';

export class Game {
  constructor({ canvas, hudRoot }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.hud = new HUD(hudRoot);
    this.input = new Input(canvas);
    this.sm = new StateMachine();

    this.prefsRef = { current: loadPrefs() };
    this.audio = new AudioManager();
    this.audio.applySettings({ sound: this.prefsRef.current.sound, volume: this.prefsRef.current.volume });
    window.addEventListener('pointerdown', () => this.audio.unlock(), { once: true });

    // Shared services
    this.services = {
      game: this,
      ctx: this.ctx,
      canvas: this.canvas,
      input: this.input,
      hud: this.hud,
      rng: Math.random,
      now: () => performance.now(),
      audio: this.audio,
      prefsRef: this.prefsRef,
      openHelp: () => this.openHelp(),
      openSettings: () => this.openSettings(),
      syncSettings: () => this.syncSettings(),
    };

    this.model = null;

    this.sm.register('title', () => new TitleState(this.services));
    this.sm.register('overworld', () => new OverworldState(this.services));
    this.sm.register('battle', (payload) => new BattleState(this.services, payload));
    this.sm.register('postBattle', (payload) => new PostBattleState(this.services, payload));
    this.sm.register('echo', (payload) => new EchoState(this.services, payload));
    this.sm.register('camp', (payload) => new CampState(this.services, payload));
    this.sm.register('event', (payload) => new EventState(this.services, payload));
    this.sm.register('gameOver', (payload) => new GameOverState(this.services, payload));
    this.sm.register('victory', () => new VictoryState(this.services));

    this.lastT = 0;
    this.running = false;

    this._overlayBound = false;
    this._globalBound = false;
    this._settingsBound = false;
  }

  start() {
    this.running = true;
    this.tryLoadSave();

    // Global HUD (help/settings always available)
    this.renderGlobalHUD();

    // Bind modal handlers once
    if (!this._overlayBound) {
      this._overlayBound = true;
      // Close modal by clicking on overlay background
      this.hud.modalOverlay.addEventListener('click', (e) => {
        if (e.target === this.hud.modalOverlay) this.hud.hideModal();
      });
    }

    this.input.beginFrame();
    this.sm.go('title');
    requestAnimationFrame((t) => this.loop(t));
  }

  renderGlobalHUD() {
    const p = this.prefsRef.current;
    const diffLabel = p.difficulty;
    this.hud.setCard('global', `
      <div style="display:flex;align-items:center;gap:8px">
        <div class="small" style="opacity:.9">Сложность: <b>${diffLabel}</b></div>
        <button data-action="help" title="Справка (H/F1)">Help</button>
        <button data-action="settings" title="Настройки (P)">Settings</button>
      </div>
    `);

    if (!this._globalBound) {
      this._globalBound = true;
      this.hud.on('global', 'click', 'button[data-action="help"]', () => {
        this.audio.unlock();
        this.audio.play('click');
        this.openHelp();
      });
      this.hud.on('global', 'click', 'button[data-action="settings"]', () => {
        this.audio.unlock();
        this.audio.play('click');
        this.openSettings();
      });
    }
  }

  syncSettings() {
    const p = this.prefsRef.current;
    this.audio.applySettings({ sound: p.sound, volume: p.volume });

    if (this.model) {
      this.model.settings ??= {};
      this.model.settings.difficulty = p.difficulty;
      this.model.settings.reducedMotion = p.reducedMotion;
      this.model.settings.hints = p.hints;
      saveGame(this.model);
    }

    this.renderGlobalHUD();
  }

  openHelp() {
    // toggle
    if (this.hud.isModalOpen()) {
      this.hud.hideModal();
      return;
    }
    this.hud.showModal(helpHtml());
  }

  openSettings() {
    const p = this.prefsRef.current;
    this.hud.showModal(settingsHtml(p));

    if (!this._settingsBound) {
      this._settingsBound = true;
      bindSettingsHandlers({
        hud: this.hud,
        prefsRef: this.prefsRef,
        onChange: (prefs) => {
          savePrefs(prefs);
          this.syncSettings();
        },
      });
    }
  }

  tryLoadSave() {
    const loaded = normalizeLoadedModel(loadGame());
    if (loaded) {
      this.model = loaded;
      this.syncSettings();
      return true;
    }
    return false;
  }

  startNewGame() {
    const seed = Date.now();
    // Wider overworld: more exploration space without increasing height.
    const world = generateWorld({ cols: 18, rows: 12, seed });
    this.model = newModel({ seed, world });
    this.syncSettings();
    saveGame(this.model);
  }

  loop(t) {
    if (!this.running) return;
    const dt = Math.min(0.05, (t - this.lastT) / 1000 || 0);
    this.lastT = t;

    this.processGlobalHotkeys();

    this.sm.update(dt);
    this.render();

    // clear one-frame flags at end
    this.input.beginFrame();

    requestAnimationFrame((tt) => this.loop(tt));
  }

  processGlobalHotkeys() {
    const i = this.input;
    if (i.isKeyPressed('F1') || i.isKeyPressed('KeyH')) {
      this.audio.play('click');
      if (this.hud.isModalOpen()) this.hud.hideModal();
      else this.openHelp();
    }
    if (i.isKeyPressed('KeyP')) {
      this.audio.play('click');
      if (this.hud.isModalOpen()) this.hud.hideModal();
      else this.openSettings();
    }
    if (i.isKeyPressed('Escape')) {
      if (this.hud.isModalOpen()) {
        this.audio.play('click');
        this.hud.hideModal();
      }
    }
  }

  render() {
    const { ctx, canvas } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    this.sm.render();
  }
}
