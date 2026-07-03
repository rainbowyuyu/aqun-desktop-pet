/** 模型配色 — 沿用荷塘主题 */
export const Theme = {
  sky: {
    zenith: 0x7ab4ec,
    mid: 0xb8d8f8,
    horizon: 0xf0e8dc,
    sun: 0xfff4e0,
  },
  ui: {
    text: '#3a5848',
    bubble: 'rgba(255, 252, 245, 0.92)',
    bubbleBorder: 'rgba(232, 152, 168, 0.35)',
  },
};

export const SUN_DIR = { x: 0.55, y: 0.62, z: -0.48 };

export function sunPosition(distance = 30) {
  const len = Math.hypot(SUN_DIR.x, SUN_DIR.y, SUN_DIR.z);
  return {
    x: (SUN_DIR.x / len) * distance,
    y: (SUN_DIR.y / len) * distance,
    z: (SUN_DIR.z / len) * distance,
  };
}
