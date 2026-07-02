const CONFETTI_COLORS = ['#e898a8', '#98c0e8', '#a8e8c8', '#e8c898', '#f8d0e8', '#c8e8f8'];

export class BirthdayFx {
  constructor({ appRoot }) {
    this.appRoot = appRoot;
    this._confettiLayer = null;
  }

  burstConfetti({ count = 48, duration = 2.8 } = {}) {
    if (!this.appRoot) return;

    if (!this._confettiLayer) {
      this._confettiLayer = document.createElement('div');
      this._confettiLayer.className = 'birthday-confetti-layer';
      this._confettiLayer.setAttribute('aria-hidden', 'true');
      this.appRoot.appendChild(this._confettiLayer);
    }

    this._confettiLayer.replaceChildren();

    for (let i = 0; i < count; i += 1) {
      const piece = document.createElement('span');
      piece.className = 'birthday-confetti';
      piece.style.left = `${Math.random() * 100}%`;
      piece.style.background = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
      piece.style.animationDuration = `${1.6 + Math.random() * 1.4}s`;
      piece.style.animationDelay = `${Math.random() * 0.35}s`;
      piece.style.setProperty('--drift', `${-40 + Math.random() * 80}px`);
      piece.style.setProperty('--spin', `${180 + Math.random() * 540}deg`);
      this._confettiLayer.appendChild(piece);
    }

    clearTimeout(this._confettiTimer);
    this._confettiTimer = setTimeout(() => {
      this._confettiLayer?.replaceChildren();
    }, duration * 1000);
  }

  flashRainbowRing() {
    this.appRoot?.classList.add('birthday-rainbow-flash');
    clearTimeout(this._flashTimer);
    this._flashTimer = setTimeout(() => {
      this.appRoot?.classList.remove('birthday-rainbow-flash');
    }, 1800);
  }

  dispose() {
    clearTimeout(this._confettiTimer);
    clearTimeout(this._flashTimer);
    this._confettiLayer?.remove();
  }
}
