export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.pointer = { x: 0, y: 0, down: false, pressed: false, released: false };
    this.keysDown = new Set();
    this.keysPressed = new Set();

    canvas.addEventListener('pointermove', (e) => this.onPointerMove(e));
    canvas.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    window.addEventListener('pointerup', (e) => this.onPointerUp(e));
    window.addEventListener('keydown', (e) => this.onKeyDown(e), { passive: false });
    window.addEventListener('keyup', (e) => this.onKeyUp(e));
  }

  beginFrame() {
    this.pointer.pressed = false;
    this.pointer.released = false;
    this.keysPressed.clear();
  }

  onPointerMove(e) {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = (e.clientX - rect.left) * (this.canvas.width / rect.width);
    this.pointer.y = (e.clientY - rect.top) * (this.canvas.height / rect.height);
  }

  onPointerDown(e) {
    this.onPointerMove(e);
    this.pointer.down = true;
    this.pointer.pressed = true;
  }

  onPointerUp(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (this.canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (this.canvas.height / rect.height);
    if (this.pointer.down) {
      this.pointer.down = false;
      this.pointer.released = true;
      this.pointer.x = x;
      this.pointer.y = y;
    }
  }

  onKeyDown(e) {
    // Don't steal keys when user is interacting with form controls.
    const tag = (e.target && e.target.tagName) ? e.target.tagName.toUpperCase() : '';
    const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

    if (!typing) {
      if (e.code === 'Space' || e.code === 'F1') {
        e.preventDefault();
        e.stopPropagation();
      }
    }

    if (!this.keysDown.has(e.code)) this.keysPressed.add(e.code);
    this.keysDown.add(e.code);
  }

  onKeyUp(e) {
    this.keysDown.delete(e.code);
  }

  isKeyDown(code) { return this.keysDown.has(code); }
  isKeyPressed(code) { return this.keysPressed.has(code); }
}
