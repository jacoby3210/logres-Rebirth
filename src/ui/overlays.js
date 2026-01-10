import { savePrefs } from '../gameplay/prefs.js';

export function helpHtml() {
  return `
    <div style="font-size:16px;font-weight:700;margin-bottom:6px">Справка</div>
    <div class="small" style="line-height:1.35">
      <b>Цель:</b> исследовать карту, усилить армию и победить босса.<br/>
      <b>Ходьба:</b> клик по соседней клетке (1 шаг). <b>Конец хода</b> сбрасывает MP.<br/>
      <b>Бой:</b> строго пошаговый. Ходит <b>активный</b> отряд (подсвечен). Клик по врагу — атака, по союзнику (для целителя) — лечение.<br/>
      <b>Целитель:</b> лечит только если у цели есть потери.<br/>
      <b>Эхо Времени:</b> трать VE на эффекты вне боя. <i>Призыв</i> действует только на следующий бой.
      <br/><b>Карта:</b> 🗡️ враг • ⭐ элита • 👑 босс • ⛺ лагерь • 💰 сундук • 🔷 алтарь • 🏛️ руины • 🌀 аномалия.
      <hr style="border:0;border-top:1px solid rgba(255,255,255,0.12);margin:10px 0"/>
      <b>Горячие клавиши</b><br/>
      • Space / Enter — пропуск хода в бою<br/>
      • Enter — конец хода (Overworld)<br/>
      • E — Эхо Времени (Overworld)<br/>
      • S — сохранить (Overworld)<br/>
      • H / F1 — справка<br/>
      • P — настройки<br/>
      • Esc — закрыть модалку / отступить в бою
    </div>
  `;
}

export function settingsHtml(prefs) {
  const diff = prefs.difficulty;
  return `
    <div style="font-size:16px;font-weight:700;margin-bottom:6px">Настройки</div>
    <div class="small" style="line-height:1.35">
      <div style="margin:6px 0"><b>Сложность:</b>
        <label style="margin-left:8px"><input type="radio" name="diff" value="easy" ${diff==='easy'?'checked':''}/> easy</label>
        <label style="margin-left:8px"><input type="radio" name="diff" value="normal" ${diff==='normal'?'checked':''}/> normal</label>
        <label style="margin-left:8px"><input type="radio" name="diff" value="hard" ${diff==='hard'?'checked':''}/> hard</label>
      </div>
      <div style="margin:8px 0">
        <label><input type="checkbox" data-pref="sound" ${prefs.sound?'checked':''}/> Звук</label>
      </div>
      <div style="margin:8px 0">
        <label>Громкость: <input type="range" min="0" max="1" step="0.01" value="${prefs.volume}" data-pref="volume" style="width:180px;vertical-align:middle"/></label>
        <span data-role="volLabel" style="margin-left:8px">${Math.round(prefs.volume*100)}%</span>
      </div>
      <div style="margin:8px 0">
        <label><input type="checkbox" data-pref="hints" ${prefs.hints?'checked':''}/> Подсказки</label>
      </div>
      <div style="margin:8px 0">
        <label><input type="checkbox" data-pref="reducedMotion" ${prefs.reducedMotion?'checked':''}/> Меньше анимаций</label>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
        <button data-action="close">Закрыть</button>
      </div>
    </div>
  `;
}

export function bindSettingsHandlers({ hud, prefsRef, onChange }) {
  // prefsRef: { current }
  hud.onModal('click', 'button[data-action="close"]', () => hud.hideModal());

  hud.onModal('input', 'input[data-pref="volume"]', (e, el) => {
    const v = Number(el.value);
    prefsRef.current.volume = v;
    savePrefs(prefsRef.current);
    const lab = hud.modalRoot.querySelector('[data-role="volLabel"]');
    if (lab) lab.textContent = `${Math.round(v*100)}%`;
    onChange?.(prefsRef.current);
  });

  hud.onModal('change', 'input[data-pref="sound"],input[data-pref="hints"],input[data-pref="reducedMotion"]', (e, el) => {
    const key = el.getAttribute('data-pref');
    prefsRef.current[key] = !!el.checked;
    savePrefs(prefsRef.current);
    onChange?.(prefsRef.current);
  });

  hud.onModal('change', 'input[name="diff"]', (e, el) => {
    prefsRef.current.difficulty = el.value;
    savePrefs(prefsRef.current);
    onChange?.(prefsRef.current);
  });
}
