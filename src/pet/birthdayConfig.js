/** 生日礼物 — 可在此调整生日日期与署名 */
export const BIRTHDAY = {
  month: 7,
  day: 4,
  recipient: '阿群',
  creator: '开发者和软件作者',
  wishes: [
    '愿新的一岁，健康平安，所遇皆温柔，所行皆坦途。',
    '学习有进步，生活有惊喜，每一天都值得被好好对待。',
    '谢谢你来到这个世界，也谢谢你来到我的桌面 —— 以后也请多多关照 ✦',
  ],
};

export function isBirthdayToday(date = new Date()) {
  return date.getMonth() + 1 === BIRTHDAY.month && date.getDate() === BIRTHDAY.day;
}

/** 每年生日当天首次启动时播放开箱动画 */
export function shouldPlayBirthdayIntro(date = new Date(), lastIntroYear = null) {
  if (!isBirthdayToday(date)) return false;
  return lastIntroYear !== date.getFullYear();
}
