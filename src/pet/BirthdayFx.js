const CONFETTI_COLORS = [
  '#e898a8',
  '#f0c878',
  '#98c0e8',
  '#a8e8c8',
  '#e8c898',
  '#f8d0e8',
  '#c8e8f8',
  '#ffd8e8',
  '#d4b8f0',
];

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
      const shape = i % 5 === 0 ? 'is-star' : i % 4 === 0 ? 'is-heart' : i % 3 === 0 ? 'is-ring' : '';
      piece.className = ['birthday-confetti', shape].filter(Boolean).join(' ');
      piece.style.left = `${Math.random() * 100}%`;
      piece.style.background = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
      piece.style.animationDuration = `${2 + Math.random() * 1.8}s`;
      piece.style.animationDelay = `${Math.random() * 0.45}s`;
      piece.style.setProperty('--drift', `${-50 + Math.random() * 100}px`);
      piece.style.setProperty('--spin', `${180 + Math.random() * 720}deg`);
      piece.style.setProperty('--sway', `${-1 + Math.random() * 2}`);
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
    }, 2200);
  }

  dispose() {
    clearTimeout(this._confettiTimer);
    clearTimeout(this._flashTimer);
    this._confettiLayer?.remove();
  }
}
