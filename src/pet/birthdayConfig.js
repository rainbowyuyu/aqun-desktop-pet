/** 生日礼物 — 可在此调整生日日期与署名 */
export const BIRTHDAY = {
  month: 7,
  day: 4,
  recipient: '阿群',
  creator: 'Rainbow 鱼工作室',
  creatorNote: '为你写下这封生日信的人',
  subtitle: '七月四日 · 写给你的信',
  titleEn: 'Happy Birthday',
  closing: '愿你被温柔环绕，被幸运偏爱。',
  wishes: [
    '又是一年七月四日。谢谢你来到这个世界，也谢谢你来到我的桌面——往后的每一天，请继续在屏幕里发亮。',
    '新的一岁，愿你想要的慢慢靠近，拥有的都握得稳；偶尔疲惫时，也别忘了：你已经很棒了。',
    '今天不必完美，只要在属于你的节奏里，把这一岁过成值得回忆的样子。请允许自己被偏爱一次 ✦',
  ],
  openGiftLabel: '拆开这份心意',
  skipLabel: '稍后再看',
};

export function isBirthdayToday(date = new Date()) {
  return date.getMonth() + 1 === BIRTHDAY.month && date.getDate() === BIRTHDAY.day;
}

/** 每年生日当天首次启动时播放开箱动画 */
export function shouldPlayBirthdayIntro(date = new Date(), lastIntroYear = null) {
  if (!isBirthdayToday(date)) return false;
  return lastIntroYear !== date.getFullYear();
}
