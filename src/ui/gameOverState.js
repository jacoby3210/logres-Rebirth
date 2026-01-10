import { clearSave } from '../gameplay/storage.js';

export class GameOverState {
  constructor(services, payload) {
    this.s = services;
    this.payload = payload;
  }

  enter() {
    this.s.hud.clear();
    this.s.hud.setCard('go', `
      <div style="max-width:360px">
        <div style="font-size:18px;font-weight:700;margin-bottom:4px">Поражение</div>
        <div class="small" style="margin-bottom:12px">Ваш герой пал. Можно начать новую сессию.</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button data-action="restart">Новая игра</button>
          <button data-action="menu">В меню</button>
        </div>
      </div>
    `);
    this.s.hud.on('go', 'click', 'button[data-action="restart"]', () => {
      clearSave();
      this.s.game.startNewGame();
      this.s.game.sm.go('overworld');
    });
    this.s.hud.on('go', 'click', 'button[data-action="menu"]', () => this.s.game.sm.go('title'));
  }

  exit() { this.s.hud.clear(); }
  update() {}
  render() {
    const { ctx, canvas } = this.s;
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = '28px system-ui';
    ctx.fillText('Game Over', 30, 70);
  }
}
