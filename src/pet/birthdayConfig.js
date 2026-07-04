/** 生日礼物 — 可在此调整生日日期与署名 */
export const BIRTHDAY = {
  month: 7,
  day: 4,
  recipient: '阿群',
  creator: 'rainbow鱼',
  creatorNote: '为你写下这封生日信的人',
  subtitle: '写给你的信 · 一份特别的心意',
  titleEn: 'For You',
  closing: '愿你此后每一岁，都被好运与温柔轻轻接住。',
  wishes: [
    '这是为你准备的一份小礼物。愿你在打开它的这一刻，感到被惦记、被祝福——那些想说的话，都藏在这封信里。',
    '你认真走过的日子，时间都有记住。累了就歇一歇，不必事事完美——能走到今天，本身就已经很了不起。',
    '今天请把主角留给自己：吃想吃的，做想做的，允许自己纯粹地开心一场。愿你明朗、自在，也被世界好好对待 ✦',
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
