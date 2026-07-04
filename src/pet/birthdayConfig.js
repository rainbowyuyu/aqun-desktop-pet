/** 生日礼物 — 可在此调整生日日期与署名 */
export const BIRTHDAY = {
  month: 7,
  day: 4,
  recipient: '阿群',
  creator: 'rainbow鱼',
  creatorNote: '为你写下这封生日信的人',
  subtitle: '七月四日 · 写给你的信',
  titleEn: 'Happy Birthday',
  closing: '愿你此后每一岁，都被好运与温柔轻轻接住。',
  wishes: [
    '又是一年七月四日。生日快乐——愿新一岁平安顺遂，心里有光；那些惦记已久的事，都能在这一年里慢慢落地。',
    '你认真走过的日子，时间都有记住。累了就歇一歇，不必事事完美——能走到今天，本身就已经很了不起。',
    '今天请把主角留给自己：吃想吃的，做想做的，允许自己纯粹地开心一场。新的一岁，愿你明朗、自在，也被世界好好对待 ✦',
  ],
  openGiftLabel: '拆开这份心意',
  skipLabel: '稍后再看',
};

export function isBirthdayToday(date = new Date()) {
  return date.getMonth() + 1 === BIRTHDAY.month && date.getDate() === BIRTHDAY.day;
}

/** 首次启动时播放生日祝福动画（终生仅一次） */
export function shouldPlayBirthdayIntro(_date = new Date(), lastIntroYear = null) {
  return lastIntroYear == null;
}
