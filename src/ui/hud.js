export class HUD {
  constructor(root) {
    this.root = root;

    // Separate layers: cards + modal.
    this.cardsRoot = document.createElement('div');
    this.cardsRoot.className = 'hud-cards';

    this.modalOverlay = document.createElement('div');
    this.modalOverlay.className = 'hud-modal-overlay hidden';
    this.modalOverlay.innerHTML = `
      <div class="hud-modal" data-role="modal">
        <div class="hud-modal-content" data-role="content"></div>
      </div>
    `;

    this.toastEl = document.createElement('div');
    this.toastEl.className = 'hud-toast';
    this.toastEl.setAttribute('aria-live', 'polite');

    this.root.innerHTML = '';
    this.root.appendChild(this.cardsRoot);
    document.body.appendChild(this.modalOverlay);
    document.body.appendChild(this.toastEl);

    this.cards = new Map();
    this._modalHandlers = [];

    this._toastTimer = null;
  }

  clear() {
    // Keep global pinned card (help/settings) across state transitions.
    for (const [id, el] of Array.from(this.cards.entries())) {
      if (id === 'global') continue;
      try { el.remove(); } catch {}
      this.cards.delete(id);
    }
  }

  setCard(id, html) {
    let el = this.cards.get(id);
    if (!el) {
      el = document.createElement('div');
      el.className = 'hud-card';
      // Global card should be first.
      if (id === 'global' && this.cardsRoot.firstChild) this.cardsRoot.insertBefore(el, this.cardsRoot.firstChild);
      else this.cardsRoot.appendChild(el);
      this.cards.set(id, el);
    }
    el.innerHTML = html;
  }

  removeCard(id) {
    const el = this.cards.get(id);
    if (el) el.remove();
    this.cards.delete(id);
  }

  on(id, event, selector, handler) {
    const el = this.cards.get(id);
    if (!el) return;
    el.addEventListener(event, (e) => {
      const target = safeClosest(e.target, selector);
      if (target) handler(e, target);
    });
  }

  // --- Modal overlay ---
  get modalRoot() {
    return this.modalOverlay.querySelector('[data-role="modal"]');
  }

  isModalOpen() {
    return !this.modalOverlay.classList.contains('hidden');
  }

  showModal(html) {
    const content = this.modalOverlay.querySelector('[data-role="content"]');
    content.innerHTML = html;
    this.modalOverlay.classList.remove('hidden');
  }

  hideModal() {
    this.modalOverlay.classList.add('hidden');
    const content = this.modalOverlay.querySelector('[data-role="content"]');
    content.innerHTML = '';
  }

  onModal(event, selector, handler) {
    const listener = (e) => {
      if (this.modalOverlay.classList.contains('hidden')) return;
      const target = safeClosest(e.target, selector);
      if (target) handler(e, target);
    };
    this.modalOverlay.addEventListener(event, listener);
    this._modalHandlers.push({ event, listener });
  }

  // --- Toasts ---
  toast(text, ms = 2400) {
    const msg = String(text || '').trim();
    if (!msg) return;

    this.toastEl.textContent = msg;
    this.toastEl.classList.add('show');

    if (this._toastTimer) clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      this.toastEl.classList.remove('show');
      this._toastTimer = null;
    }, ms);
  }

  clearToast() {
    if (this._toastTimer) clearTimeout(this._toastTimer);
    this._toastTimer = null;
    this.toastEl.classList.remove('show');
    this.toastEl.textContent = '';
  }
}


function safeClosest(node, selector) {
  // In rare cases event.target may be a Text node; Element.closest would crash.
  let el = node;
  while (el && el.nodeType !== 1) el = el.parentElement || el.parentNode;
  if (!el || !el.closest) return null;
  return el.closest(selector);
}
