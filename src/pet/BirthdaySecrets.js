import { BirthdayKeyDetector } from './BirthdayKeyDetector.js';
import { BirthdayFx } from './BirthdayFx.js';
import { randomSecret } from './birthdayCopy.js';
import { isBirthdayToday } from './birthdayConfig.js';

const AVATAR_CLICKS = 7;
const POKE_STORM_COUNT = 8;
const POKE_STORM_MS = 4500;
const TODAY_KEY = 'aqun-birthday-greeted';

/** 生日礼物隐藏彩蛋 */
export class BirthdaySecrets {
  constructor({ fsm, bubble, fx, getSettingsPanelOpen, getShowBubble }) {
    this.fsm = fsm;
    this.bubble = bubble;
    this.fx = fx;
    this.getSettingsPanelOpen = getSettingsPanelOpen || (() => false);
    this.getShowBubble = getShowBubble || (() => true);

    this._avatarClicks = 0;
    this._avatarTimer = null;
    this._pokeTimes = [];
    this._keyDetector = new BirthdayKeyDetector((id) => this._onSecretKey(id));
  }

  bindAboutPage(aboutAvatar) {
    aboutAvatar?.addEventListener('click', () => {
      if (this.getSettingsPanelOpen()) return;

      this._avatarClicks += 1;
      clearTimeout(this._avatarTimer);
      this._avatarTimer = setTimeout(() => {
        this._avatarClicks = 0;
      }, 3200);

      if (this._avatarClicks >= AVATAR_CLICKS) {
        this._avatarClicks = 0;
        this.fx.burstConfetti({ count: 64, duration: 3.2 });
        this.fx.flashRainbowRing();
        this.bubble.showText(randomSecret('avatar'));
        this.fsm.wave();
      } else if (this._avatarClicks === 3) {
        this.bubble.showText('再点几下，有惊喜等着你');
      }
    });

    aboutAvatar?.querySelector('.aq-about-ring')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.fx.flashRainbowRing();
      this.bubble.showText('生日限定光环 ✦');
    });
  }

  onKeyEvent(payload) {
    this._keyDetector.feed(payload.code, payload.type, payload.name);
  }

  onPoke() {
    const now = Date.now();
    this._pokeTimes.push(now);
    this._pokeTimes = this._pokeTimes.filter((t) => now - t < POKE_STORM_MS);

    if (this._pokeTimes.length >= POKE_STORM_COUNT) {
      this._pokeTimes = [];
      this.fx.burstConfetti({ count: 36, duration: 2.2 });
      this.bubble.showText(randomSecret('pokeStorm'));
      this.fsm.spin();
    }
  }

  onKonami() {
    this.fx.burstConfetti({ count: 72, duration: 3.6 });
    this.fx.flashRainbowRing();
    this.bubble.showText(randomSecret('konami'));
  }

  maybeGreetToday() {
    if (!isBirthdayToday()) return;
    if (localStorage.getItem(TODAY_KEY) === new Date().toDateString()) return;
    localStorage.setItem(TODAY_KEY, new Date().toDateString());

    setTimeout(() => {
      this.fx.burstConfetti({ count: 56, duration: 3 });
      this.bubble.showText(randomSecret('today'));
      this.fsm.wave();
    }, 1200);
  }

  _onSecretKey(id) {
    if (this.getSettingsPanelOpen()) return;

    const celebrate = {
      happy: { count: 80, duration: 3.4, spin: true },
      birthday: { count: 88, duration: 3.6, ring: true, wave: true },
      bday: { count: 52, duration: 2.8, ring: true, wave: true },
      love: { count: 44, duration: 2.6, wave: true },
      kaixin: { count: 72, duration: 3.2, spin: true },
      kuaile: { count: 72, duration: 3.2, spin: true },
      shengri: { count: 96, duration: 3.8, ring: true, wave: true },
      xingfu: { count: 56, duration: 3, wave: true },
      party: { count: 64, duration: 3.2, spin: true },
      cake: { count: 48, duration: 2.8, wave: true },
      gift: { count: 52, duration: 2.8, wave: true },
      aqun: { count: 40, duration: 2.4, wave: true },
      ty: { count: 48, duration: 2.6, wave: true },
      kx: { count: 56, duration: 2.8, spin: true },
      kl: { count: 56, duration: 2.8, spin: true },
      sr: { count: 88, duration: 3.6, ring: true, wave: true },
      xf: { count: 48, duration: 2.6, wave: true },
    };

    const fx = celebrate[id] || { count: 48, duration: 2.8, wave: true };
    this.fx.burstConfetti({ count: fx.count, duration: fx.duration });
    if (fx.ring) this.fx.flashRainbowRing();
    if (fx.spin) this.fsm.spin();
    else if (fx.wave) this.fsm.wave();

    this.bubble.showText(randomSecret(id));
  }
}
