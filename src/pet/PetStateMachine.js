import { classifyKey, KonamiDetector } from './KeyReactionMap.js';
import { keyBodySide, keyIntensity } from './keySide.js';



const IDLE_TIMEOUT_MS = 4500;

const TYPING_COOLDOWN_MS = 120;

const CHATTY_BUBBLE_CATEGORIES = new Set(['enter', 'backspace', 'space']);
const CHATTY_BUBBLE_COOLDOWN_MS = 9000;
const CHATTY_BUBBLE_CHANCE = 0.4;



const STATE_PRIORITY = {

  hologram: 90,

  poke: 80,

  surprised: 70,

  jump: 60,

  nod: 55,

  headTurnLeft: 48,
  headTurnRight: 48,
  wave: 50,

  spin: 50,

  shake: 48,

  bounce: 46,

  lean: 40,

  focus: 35,

  typing: 30,

  idle: 0,

};



export class PetStateMachine {

  constructor({
    animations,
    modelLoader = null,
    onBubble,
    onHologram,
    onStateChange,
    onMoodChange,
    getIdleChatter,
    onKonami,
    onPoke,
    onKeyEvent,
  }) {

    this.animations = animations;
    this.modelLoader = modelLoader;

    this.onBubble = onBubble;

    this.onHologram = onHologram;

    this.onStateChange = onStateChange;

    this.onMoodChange = onMoodChange;

    this.getIdleChatter = getIdleChatter || (() => true);

    this.onKonami = onKonami;

    this.onPoke = onPoke;

    this.onKeyEvent = onKeyEvent;



    this.state = 'idle';

    this._lastKeyAt = Date.now();

    this._keyTimestamps = [];

    this._konami = new KonamiDetector(() => this._triggerKonami());

    this._idleTimer = null;

    this._typingDecayTimer = null;

    this._lastReactionAt = 0;

    this._lastChattyBubbleAt = 0;

    this.typingSpeed = 0;

  }

  _maybeBubble(category) {
    if (!category) return;
    if (CHATTY_BUBBLE_CATEGORIES.has(category)) {
      const now = Date.now();
      if (now - this._lastChattyBubbleAt < CHATTY_BUBBLE_COOLDOWN_MS) return;
      if (Math.random() > CHATTY_BUBBLE_CHANCE) return;
      this._lastChattyBubbleAt = now;
    }
    this.onBubble?.(category);
  }

  _playClipOr(name, fallback) {
    const result = this.modelLoader?.playClipOnce?.(name);
    if (result?.queued) return 'queued';
    if (result) return 'played';
    if (this.modelLoader?.isGestureBlocking?.()) return 'blocked';
    if (this.animations?.isBodyGesturePlaying?.()) {
      return this.animations.queueBodyGesture(name, fallback) ? 'queued' : 'blocked';
    }
    fallback?.();
    return 'played';
  }

  _tryPlayGesture(name, fallback, onPlay) {
    if (this.modelLoader?.isGestureBlocking?.()) {
      this.modelLoader.playClipOnce(name);
      return false;
    }
    if (this.animations?.isBodyGesturePlaying?.()) {
      this.animations.queueBodyGesture(name, fallback);
      return false;
    }
    const status = this._playClipOr(name, fallback);
    if (status === 'played') onPlay?.();
    return status === 'played';
  }

  start() {

    this.animations.startIdleBreath();

    this._scheduleIdleCheck();

    this.onMoodChange?.('idle');

  }



  handleKeyEvent({ code, type, timestamp, name }) {

    this._konami.feed(code, type);

    this.onKeyEvent?.({ code, type, timestamp, name });

    if (type !== 'down') return;



    this._lastKeyAt = timestamp || Date.now();

    this._keyTimestamps.push(this._lastKeyAt);

    this._keyTimestamps = this._keyTimestamps.filter((t) => this._lastKeyAt - t < 3000);

    this.typingSpeed = this._keyTimestamps.length / 3;



    const reaction = classifyKey(code, type, name);

    const now = this._lastKeyAt;



    if (reaction.kind === 'typing' || reaction.kind === 'generic') {

      if (now - this._lastReactionAt < TYPING_COOLDOWN_MS) return;

    }

    this._lastReactionAt = now;

    this.animations.setTypingEnergy(Math.min(1, this.typingSpeed / 2.2));

    this._applyReaction(reaction, name);

    this._scheduleIdleCheck();

    this.onMoodChange?.('typing');

  }



  _applyReaction(reaction, name = '') {
    const side = keyBodySide(name);
    const strike = keyIntensity(name, this.typingSpeed);

    switch (reaction.kind) {

      case 'jump':

        this._setState('jump');

        this.animations.playKeyStrike('center', 0.95);

        this.animations.playJump();

        this.onBubble?.('jump');

        break;

      case 'sway':

        this._setState('typing');

        if (!this._tryPlayGesture('sway', () => this.animations.playSpaceSway(reaction.intensity ?? 0.75))) {
          break;
        }

        this._maybeBubble('space');

        break;

      case 'nod':

        if (!this._tryPlayGesture('nod', () => this.animations.playNod(), () => {
          this._setState('nod');
          this.animations.playKeyStrike('center', 0.7);
        })) break;

        this._maybeBubble(reaction.bubble);

        break;

      case 'surprised':

        this._setState('surprised');

        this.animations.playKeyStrike('center', 0.8);

        this.animations.playSurprised();

        this._maybeBubble(reaction.bubble);

        break;

      case 'lean':

        this._setState('lean');

        this.animations.playLean(reaction.direction);

        clearTimeout(this._typingDecayTimer);

        this._typingDecayTimer = setTimeout(() => this.animations.resetLean(), 380);

        break;

      case 'focus':

        this._setState('focus');

        this.animations.playFocus();

        break;

      case 'function':

        this._setState('typing');

        this.animations.playKeyStrike('center', reaction.intensity || 0.8);

        this.animations.playFunction(reaction.intensity || 1);

        break;

      case 'numpad':

        this._setState('typing');

        this.animations.playKeyStrike('right', 0.65);

        this.animations.playNumpad();

        break;

      case 'typing':

        this._setState('typing');

        break;

      case 'generic':

        this._setState('typing');

        break;

      default:

        this._setState('typing');

        break;

    }

  }



  poke() {

    if (!this._canOverride('poke')) return;

    if (!this._tryPlayGesture('poke', () => this.animations.playPoke(), () => {
      this.onPoke?.();
      this._setState('poke');
    })) return;

    this.onBubble?.('poke');

    this._scheduleIdleCheck();

  }



  wave() {

    if (!this._canOverride('wave')) return;

    if (!this._tryPlayGesture('wave', () => this.animations.playWave(), () => {
      this._setState('wave');
    })) return;

    this.onBubble?.('wave');

    this._scheduleIdleCheck();

  }



  spin() {

    if (!this._canOverride('spin')) return;

    this._setState('spin');

    this.animations.playSpin();

    this.onBubble?.('spin');

    this._scheduleIdleCheck();

  }



  shortcutAction(actionId) {

    switch (actionId) {

      case 'spin':

        this.spin();

        return;

      case 'shake':

        if (!this._canOverride('shake')) return;

        this._setState('shake');

        this.animations.playShake();

        this.onBubble?.('shake');

        this._scheduleIdleCheck();

        return;

      case 'wave':

        this.wave();

        return;

      case 'headTurnLeft':

        if (!this._canOverride('headTurnLeft')) return;

        this._setState('headTurnLeft');

        this.animations.playHeadTurnLeft();

        this.onBubble?.('headTurnLeft');

        this._scheduleIdleCheck();

        return;

      case 'headTurnRight':

        if (!this._canOverride('headTurnRight')) return;

        this._setState('headTurnRight');

        this.animations.playHeadTurnRight();

        this.onBubble?.('headTurnRight');

        this._scheduleIdleCheck();

        return;

      case 'nod':

        if (!this._canOverride('nod')) return;

        if (!this._tryPlayGesture('nod', () => this.animations.playNod(), () => {

          this._setState('nod');

        })) return;

        this._maybeBubble('enter');

        this._scheduleIdleCheck();

        return;

      case 'bounce':

        if (!this._canOverride('bounce')) return;

        this._setState('bounce');

        this.animations.playJump();

        this.onBubble?.('jump');

        this._scheduleIdleCheck();

        return;

      default:

        break;

    }

  }



  lookAt(x, y, w, h) {

    if (this.state === 'hologram' || this.state === 'spin') return;

    this.animations.lookAt(x, y, w, h);

  }



  lookAtNorm(nx, ny) {

    if (this.state === 'hologram' || this.state === 'spin') return;

    this.animations.lookAtNorm(nx, ny);

  }



  resetLook() {

    this.animations.resetLook();

  }



  _triggerKonami() {

    this.onKonami?.();

    this._setState('hologram');

    this.onHologram?.(true);

    this.onMoodChange?.('hologram');

    this.onBubble?.('konami');

    this.animations.playHologramFlash(

      () => this.onHologram?.(true),

      () => {

        this.onHologram?.(false);

        this._setState('idle');

        this.animations.startIdleBreath();

        this.onMoodChange?.('idle');

      }

    );

  }



  _canOverride(next) {

    return STATE_PRIORITY[next] >= (STATE_PRIORITY[this.state] || 0);

  }



  _setState(next) {

    if (this.state === next) return;

    this.state = next;

    this.onStateChange?.(next);

  }



  _scheduleIdleCheck() {

    clearTimeout(this._idleTimer);

    this._idleTimer = setTimeout(() => this._goIdle(), IDLE_TIMEOUT_MS);

  }



  _goIdle() {

    if (Date.now() - this._lastKeyAt < IDLE_TIMEOUT_MS) return;

    this._setState('idle');

    this.animations.resetLean(0.5);

    this.animations.setTypingEnergy(0);

    this.animations.startIdleBreath();

    this.onMoodChange?.('idle');



    const roll = Math.random();

    if (this.getIdleChatter() && roll < 0.22) {

      this.onBubble?.('idle');

    } else if (roll < 0.32) {

      this.animations.playStretch();

    } else if (roll < 0.38) {

      this._tryPlayGesture('wave', () => this.animations.playWave(), () => {
        this._setState('wave');
      });

    }

  }



  dispose() {

    clearTimeout(this._idleTimer);

    clearTimeout(this._typingDecayTimer);

    this.animations.dispose?.();

  }

}

