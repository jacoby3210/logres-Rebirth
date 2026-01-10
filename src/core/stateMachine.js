export class StateMachine {
  constructor() {
    this.factories = new Map();
    this.state = null;
    this.stateId = null;
  }

  register(id, factory) {
    this.factories.set(id, factory);
  }

  go(id, payload) {
    if (!this.factories.has(id)) throw new Error(`State not registered: ${id}`);
    if (this.state?.exit) this.state.exit();
    this.state = this.factories.get(id)(payload);
    this.stateId = id;
    if (this.state?.enter) this.state.enter(payload);
  }

  update(dt) {
    this.state?.update?.(dt);
  }

  render() {
    this.state?.render?.();
  }
}
