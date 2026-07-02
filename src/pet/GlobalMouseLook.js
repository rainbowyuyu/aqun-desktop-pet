/** 全局鼠标 → 视线（以模型在屏幕上的锚点为原点） */
export class GlobalMouseLook {
  constructor({ fsm, getPaused, onLook }) {
    this.fsm = fsm;
    this.getPaused = getPaused || (() => false);
    this.onLook = onLook;
    this._unsub = null;
    this._lastLookAt = 0;
    this._pending = null;
  }

  start() {
    if (!window.aqunPet?.onGlobalMouse) return;
    this._unsub = window.aqunPet.onGlobalMouse((payload) => {
      this._pending = payload;
    });
    this._raf = requestAnimationFrame(() => this._flush());
  }

  _flush() {
    this._raf = requestAnimationFrame(() => this._flush());
    if (!this._pending) return;
    const now = performance.now();
    if (now - this._lastLookAt < 32) return;
    this._lastLookAt = now;

    const { cursor, bounds, display, buttons } = this._pending;
    this._pending = null;

    if (this.getPaused()) return;
    const { nx, ny } = GlobalMouseLook.toLookNorm(cursor, bounds, display);
    this.fsm.lookAtNorm(nx, ny);
    this.onLook?.({ nx, ny, buttons: buttons || {} });
  }

  static toLookNorm(cursor, bounds, display) {
    const ax = bounds.x + bounds.width * 0.5;
    const ay = bounds.y + bounds.height * 0.5;

    const dx = cursor.x - ax;
    const dy = cursor.y - ay;
    if (Math.hypot(dx, dy) < 8) return { nx: 0, ny: 0 };

    const wa = display || { x: 0, y: 0, width: 1920, height: 1080 };
    const toLeft = ax - wa.x;
    const toRight = wa.x + wa.width - ax;
    const toTop = ay - wa.y;
    const toBottom = wa.y + wa.height - ay;

    const refX = Math.max(toLeft, toRight, 240) * 0.72;
    const refY = Math.max(toTop, toBottom, 240) * 0.72;

    const maxYaw = 1.05;
    const maxPitch = 0.82;
    const nx = clamp(Math.atan2(dx, refX) / maxYaw, -1, 1);
    const ny = clamp(Math.atan2(dy, refY) / maxPitch, -1, 1);

    return { nx, ny };
  }

  clearPending() {
    this._pending = null;
  }

  dispose() {
    cancelAnimationFrame(this._raf);
    this._unsub?.();
  }
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}
