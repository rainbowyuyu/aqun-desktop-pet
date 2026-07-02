/** 左键 pointer 移动/点击，右键 mouse 水平缩放（Electron 透明窗更可靠） */
const DRAG_THRESHOLD = 6;
const DOUBLE_TAP_MS = 320;
const RESIZE_PX_PER_SCALE = 320;
const SCALE_MIN = 0.6;
const SCALE_MAX = 1.8;

export class Interaction {
  constructor({
    canvas,
    appRoot,
    fsm,
    settingsPanel = null,
    getPositionLocked,
    getScale,
    onScalePreview,
    onContextMenu,
    onDragStart,
    onDragEnd,
    onResizeStart,
    onResizeEnd,
  }) {
    this.canvas = canvas;
    this.appRoot = appRoot;
    this.fsm = fsm;
    this.settingsPanel = settingsPanel;
    this.getPositionLocked = getPositionLocked || (() => false);
    this.getScale = getScale || (() => 1);
    this.onScalePreview = onScalePreview;
    this.onContextMenu = onContextMenu;
    this.onDragStart = onDragStart;
    this.onDragEnd = onDragEnd;
    this.onResizeStart = onResizeStart;
    this.onResizeEnd = onResizeEnd;

    this._clickTimes = [];
    this._lastTapAt = 0;

    this._leftButtonDown = false;
    this._rightButtonDown = false;
    this._leftDragging = false;
    this._leftPointerId = null;
    this._leftStart = null;

    this._rightStart = null;
    this._resizeStartScale = 1;
    this._lastPreviewScale = null;
    this._resizing = false;

    this._windowPointerArmed = false;
    this._rightMouseArmed = false;
    this._dragRaf = null;
    this._resizeRaf = null;
    this._pendingDrag = null;
    this._pendingScale = null;
    this._gestureWasDrag = false;
    this._pointerHandledDown = false;
    this._rightHandledDown = false;
    this._mouseCaptureActive = false;

    this._onPointerDown = (e) => this._handlePointerDown(e);
    this._onPointerMove = (e) => this._handlePointerMove(e);
    this._onPointerUp = (e) => this._handlePointerUp(e);
    this._onMouseDown = (e) => this._handleMouseDown(e);
    this._onMouseMove = (e) => this._handleMouseMove(e);
    this._onMouseUp = (e) => this._handleMouseUp(e);
    this._onMouseMoveLeft = (e) => {
      if (!this._leftButtonDown || this._leftPointerId !== -1) return;
      this._handleLeftMove(e);
    };
    this._onMouseUpLeft = (e) => {
      if (e.button !== 0 || !this._leftButtonDown || this._leftPointerId !== -1) return;
      this._handleLeftUp(e);
    };
    this._onContext = (e) => {
      e.preventDefault();
    };
    this._onCanvasClick = (e) => this._handleCanvasClick(e);

    this.appRoot?.addEventListener('pointerdown', this._onPointerDown);
    this.appRoot?.addEventListener('mousedown', this._onMouseDown);
    this.appRoot?.addEventListener('contextmenu', this._onContext);
    this.canvas?.addEventListener('click', this._onCanvasClick);
  }

  get isDragging() {
    return this._leftDragging;
  }

  get isResizing() {
    return this._resizing;
  }

  get isLeftPressed() {
    return this._leftButtonDown;
  }

  cancelAll() {
    if (this._leftDragging) {
      window.aqunPet?.windowDragEnd?.();
    }
    this._cancelDragFrame();
    this._cancelResizeFrame();
    this._disarmWindowPointer();
    this._disarmRightMouse();
    this._leftButtonDown = false;
    this._rightButtonDown = false;
    this._leftPointerId = null;
    this._leftDragging = false;
    this._leftStart = null;
    this._rightStart = null;
    this._resizing = false;
    this._lastPreviewScale = null;
    this._pendingScale = null;
    this._rightHandledDown = false;
    this.appRoot?.classList.remove('is-dragging', 'is-resizing');
    this._releaseMouseCapture();
    window.aqunPet?.setInteractionMode?.('idle');
  }

  _clampScale(scale) {
    return Math.max(SCALE_MIN, Math.min(SCALE_MAX, scale));
  }

  _ensureMouseCapture() {
    if (this._mouseCaptureActive) return;
    this._mouseCaptureActive = true;
    window.aqunPet?.setIgnoreMouseEvents?.(false);
  }

  _releaseMouseCapture() {
    if (!this._mouseCaptureActive) return;
    this._mouseCaptureActive = false;
  }

  _armWindowPointer() {
    if (this._windowPointerArmed) return;
    this._windowPointerArmed = true;
    window.addEventListener('pointermove', this._onPointerMove);
    window.addEventListener('pointerup', this._onPointerUp);
    window.addEventListener('pointercancel', this._onPointerUp);
    window.addEventListener('mousemove', this._onMouseMoveLeft);
    window.addEventListener('mouseup', this._onMouseUpLeft);
  }

  _disarmWindowPointer() {
    if (!this._windowPointerArmed) return;
    this._windowPointerArmed = false;
    window.removeEventListener('pointermove', this._onPointerMove);
    window.removeEventListener('pointerup', this._onPointerUp);
    window.removeEventListener('pointercancel', this._onPointerUp);
    window.removeEventListener('mousemove', this._onMouseMoveLeft);
    window.removeEventListener('mouseup', this._onMouseUpLeft);
  }

  _armRightMouse() {
    if (this._rightMouseArmed) return;
    this._rightMouseArmed = true;
    window.addEventListener('mousemove', this._onMouseMove);
    window.addEventListener('mouseup', this._onMouseUp);
    window.addEventListener('pointerup', this._onPointerUp);
    window.addEventListener('pointercancel', this._onPointerUp);
  }

  _disarmRightMouse() {
    if (!this._rightMouseArmed) return;
    this._rightMouseArmed = false;
    window.removeEventListener('mousemove', this._onMouseMove);
    window.removeEventListener('mouseup', this._onMouseUp);
    window.removeEventListener('pointerup', this._onPointerUp);
    window.removeEventListener('pointercancel', this._onPointerUp);
  }

  _cancelDragFrame() {
    if (this._dragRaf != null) {
      cancelAnimationFrame(this._dragRaf);
      this._dragRaf = null;
    }
    this._pendingDrag = null;
  }

  _cancelResizeFrame() {
    if (this._resizeRaf != null) {
      cancelAnimationFrame(this._resizeRaf);
      this._resizeRaf = null;
    }
    this._pendingScale = null;
  }

  async _flushScalePreview() {
    if (this._resizeRaf != null) {
      cancelAnimationFrame(this._resizeRaf);
      this._resizeRaf = null;
    }
    if (this._pendingScale == null || !this._resizing) return;
    const scale = this._pendingScale;
    this._pendingScale = null;
    window.aqunPet?.setWindowScaleLive?.(scale);
    this.onScalePreview?.(scale);
  }

  _scheduleDragMove(screenX, screenY) {
    this._pendingDrag = { x: screenX, y: screenY };
    if (this._dragRaf != null) return;
    this._dragRaf = requestAnimationFrame(() => {
      this._dragRaf = null;
      const pos = this._pendingDrag;
      this._pendingDrag = null;
      if (!pos || !this._leftDragging) return;
      window.aqunPet?.windowDragMove?.(pos.x, pos.y);
    });
  }

  _scheduleScalePreview(scale) {
    this._pendingScale = scale;
    if (this._resizeRaf != null) return;
    this._resizeRaf = requestAnimationFrame(() => {
      this._resizeRaf = null;
      const next = this._pendingScale;
      this._pendingScale = null;
      if (next == null || !this._resizing) return;
      window.aqunPet?.setWindowScaleLive?.(next);
    });
  }

  _inSettings(e) {
    return this.settingsPanel?.isOpen?.() && e.target.closest('#settings-panel');
  }

  _inOverlayUI(e) {
    return Boolean(
      e.target.closest(
        '#first-tutorial.is-open, #birthday-intro, [data-ui-overlay]',
      ),
    );
  }

  _inModelZone(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const mx = (clientX - rect.left) / rect.width;
    const my = (clientY - rect.top) / rect.height;
    return mx >= 0.08 && mx <= 0.92 && my >= 0.04 && my <= 0.96;
  }

  _canMove() {
    return !this.getPositionLocked() && !this.settingsPanel?.isOpen() && !this._resizing;
  }

  _handlePointerDown(e) {
    if (this._inSettings(e) || this._inOverlayUI(e)) return;
    if (e.button === 0) {
      this._pointerHandledDown = true;
      this._gestureWasDrag = false;
      this._handleLeftDown(e);
    } else if (e.button === 2) {
      if (this._rightHandledDown) return;
      this._rightHandledDown = true;
      this._handleRightDown(e);
    }
  }

  _handleMouseDown(e) {
    if (this._inSettings(e) || this._inOverlayUI(e)) return;
    if (e.button === 0) {
      if (!this._pointerHandledDown) {
        this._gestureWasDrag = false;
        this._handleLeftDown({ ...e, pointerId: e.pointerId ?? -1 });
      }
    } else if (e.button === 2) {
      if (this._rightHandledDown) return;
      this._rightHandledDown = true;
      this._handleRightDown(e);
    }
  }

  _handleLeftDown(e) {
    if (this._leftButtonDown || this._resizing) return;

    this._ensureMouseCapture();
    this._rightButtonDown = false;
    this._rightStart = null;
    this._resizing = false;
    this._cancelResizeFrame();
    this._disarmRightMouse();
    this.appRoot?.classList.remove('is-resizing');

    this._leftButtonDown = true;
    this._leftPointerId = e.pointerId;
    this._leftDragging = false;
    this._leftStart = { x: e.screenX, y: e.screenY };
    this._armWindowPointer();

    try {
      this.appRoot?.setPointerCapture?.(e.pointerId);
    } catch {
      /* ignore */
    }
  }

  _handleRightDown(e) {
    if (this._leftButtonDown || this._leftDragging) return;
    if (this._rightButtonDown) return;

    e.preventDefault();
    e.stopPropagation();

    this._ensureMouseCapture();
    this._rightButtonDown = true;
    this._resizing = false;
    this._rightStart = { x: e.screenX, y: e.screenY };
    this._resizeStartScale = this.getScale();
    this._lastPreviewScale = this._resizeStartScale;
    this._armRightMouse();

    try {
      if (e.pointerId != null) {
        this.appRoot?.setPointerCapture?.(e.pointerId);
      }
    } catch {
      /* ignore */
    }
  }

  _handlePointerMove(e) {
    if (e.pointerId !== this._leftPointerId || !this._leftButtonDown) return;
    this._handleLeftMove(e);
  }

  _handleMouseMove(e) {
    if (!this._rightButtonDown || this._leftButtonDown || this._leftDragging) return;
    this._handleRightMove(e);
  }

  _handleLeftMove(e) {
    if (!this._leftStart) return;

    if (!this._leftDragging && this._canMove()) {
      const dx = e.screenX - this._leftStart.x;
      const dy = e.screenY - this._leftStart.y;
      if (dx * dx + dy * dy > DRAG_THRESHOLD * DRAG_THRESHOLD) {
        this._leftDragging = true;
        this._gestureWasDrag = true;
        this.appRoot?.classList.add('is-dragging');
        window.aqunPet?.setInteractionMode?.('drag');
        window.aqunPet?.windowDragStart?.(e.screenX, e.screenY);
        window.aqunPet?.windowDragMove?.(e.screenX, e.screenY);
        this.onDragStart?.();
      }
    }

    if (this._leftDragging) {
      this._scheduleDragMove(e.screenX, e.screenY);
    }
  }

  _handleRightMove(e) {
    if (!this._rightStart) return;

    const dx = e.screenX - this._rightStart.x;

    if (!this._resizing && Math.abs(dx) > DRAG_THRESHOLD) {
      this._resizing = true;
      this.appRoot?.classList.add('is-resizing');
      window.aqunPet?.setInteractionMode?.('resize');
      this.onResizeStart?.();
    }

    if (!this._resizing) return;

    const next = this._clampScale(this._resizeStartScale + dx / RESIZE_PX_PER_SCALE);
    if (this._lastPreviewScale != null && Math.abs(next - this._lastPreviewScale) < 0.001) return;

    this._lastPreviewScale = next;
    this.onScalePreview?.(next);
    this._scheduleScalePreview(next);
  }

  _handlePointerUp(e) {
    if (e.button === 2) {
      this._handleRightUp(e);
      setTimeout(() => {
        this._rightHandledDown = false;
      }, 0);
      return;
    }
    if (this._leftPointerId != null && e.pointerId !== this._leftPointerId) return;
    if (e.button !== 0) return;
    this._handleLeftUp(e);
    setTimeout(() => {
      this._pointerHandledDown = false;
    }, 0);
  }

  _handleMouseUp(e) {
    if (e.button !== 2) return;
    this._handleRightUp(e);
  }

  _handleLeftUp(e) {
    if (!this._leftButtonDown) return;

    const wasDragging = this._leftDragging;

    if (this._leftDragging) {
      this._cancelDragFrame();
      window.aqunPet?.windowDragEnd?.();
    }

    this._leftButtonDown = false;
    this._leftPointerId = null;
    this._leftDragging = false;
    this._leftStart = null;
    this.appRoot?.classList.remove('is-dragging');
    if (!this._rightButtonDown && !this._resizing) {
      window.aqunPet?.setInteractionMode?.('idle');
    }

    try {
      this.appRoot?.releasePointerCapture?.(e.pointerId);
    } catch {
      /* ignore */
    }

    if (!this._rightButtonDown) {
      this._disarmWindowPointer();
      this._releaseMouseCapture();
    }

    if (wasDragging) {
      this.onDragEnd?.();
      this._clickTimes = [];
      this._lastTapAt = 0;
    }
  }

  async _handleRightUp(e) {
    if (!this._rightButtonDown) return;

    const wasResizing = this._resizing;

    if (wasResizing) {
      await this._flushScalePreview();
      await window.aqunPet?.commitWindowScale?.();
      this.onResizeEnd?.();
    } else if (!this._leftButtonDown) {
      this.onContextMenu?.(e.clientX, e.clientY, e.screenX, e.screenY);
    }

    this._rightButtonDown = false;
    this._rightHandledDown = false;
    this._resizing = false;
    this._rightStart = null;
    this._lastPreviewScale = null;
    this._pendingScale = null;
    this.appRoot?.classList.remove('is-resizing');
    window.aqunPet?.setInteractionMode?.('idle');
    this._disarmRightMouse();
    this._releaseMouseCapture();

    try {
      if (e.pointerId != null) {
        this.appRoot?.releasePointerCapture?.(e.pointerId);
      }
    } catch {
      /* ignore */
    }

    if (wasResizing) {
      this._clickTimes = [];
      this._lastTapAt = 0;
    }
  }

  _spawnRipple(e) {
    if (!this.appRoot || !this._inModelZone(e.clientX, e.clientY)) return;
    const rect = this.canvas.getBoundingClientRect();
    const ripple = document.createElement('div');
    ripple.className = 'poke-ripple';
    ripple.style.left = `${e.clientX - rect.left}px`;
    ripple.style.top = `${e.clientY - rect.top}px`;
    this.appRoot.appendChild(ripple);
    ripple.addEventListener('animationend', () => ripple.remove(), { once: true });
  }

  _handleCanvasClick(e) {
    if (this._inSettings(e)) return;
    if (this._gestureWasDrag) {
      this._gestureWasDrag = false;
      return;
    }
    this._handleTap(e);
  }

  _handleTap(e) {
    if (!this._inModelZone(e.clientX, e.clientY)) return;

    const now = Date.now();
    const isDouble = now - this._lastTapAt < DOUBLE_TAP_MS;
    this._lastTapAt = now;

    if (isDouble) {
      this._clickTimes = [];
      this.fsm.wave();
      this._spawnRipple(e);
      return;
    }

    this._clickTimes = this._clickTimes.filter((t) => now - t < 500);
    this._clickTimes.push(now);

    if (this._clickTimes.length >= 3) {
      this._clickTimes = [];
      this.fsm.spin();
      this._spawnRipple(e);
      return;
    }

    this.fsm.poke();
    this._spawnRipple(e);
  }

  dispose() {
    this.cancelAll();
    this.appRoot?.removeEventListener('pointerdown', this._onPointerDown);
    this.appRoot?.removeEventListener('mousedown', this._onMouseDown);
    this.appRoot?.removeEventListener('contextmenu', this._onContext);
    this.canvas?.removeEventListener('click', this._onCanvasClick);
  }
}
