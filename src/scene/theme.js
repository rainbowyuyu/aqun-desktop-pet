/** 模型配色 — 沿用荷塘主题 */
export const Theme = {
  sky: {
    zenith: 0x78b8f0,
    mid: 0xa8d0f8,
    horizon: 0xd8eaf8,
    sun: 0xfff8e8,
  },
  ui: {
    text: '#3a5848',
    bubble: 'rgba(255, 252, 245, 0.92)',
    bubbleBorder: 'rgba(232, 152, 168, 0.35)',
  },
};

export const SUN_DIR = { x: 0.62, y: 0.58, z: -0.52 };

export function sunPosition(distance = 30) {
  const len = Math.hypot(SUN_DIR.x, SUN_DIR.y, SUN_DIR.z);
  return {
    x: (SUN_DIR.x / len) * distance,
    y: (SUN_DIR.y / len) * distance,
    z: (SUN_DIR.z / len) * distance,
  };
}
