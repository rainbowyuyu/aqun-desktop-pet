import { BIRTHDAY } from './birthdayConfig.js';
import { APP_VERSION_LABEL } from './releaseNotes.js';

/** 界面文案 */
export const UI_COPY = {
  appTitle: '桌面模型',
  loading: '正在加载模型…',
  navTitle: '桌面模型',
  aboutTitle: '关于',
  aboutSub: '模型说明',
  aboutTag: '7 月 4 日 · 桌面小伙伴',
  aboutBio:
    '这是一个放在桌面上的 3D 模型：会跟随鼠标转动视线，响应键盘操作，并提供日历、课表、天气、常用站点与小工具。',
  cardGift: '版本',
  cardGiftValue: APP_VERSION_LABEL,
  cardFrom: '功能',
  cardFromValue: '日历 · 课表 · 天气 · 工具 · 站点',
  hintTitle: '使用说明',
  hintList: [
    '左键拖动 · 调整模型窗口位置',
    '右键左右滑 · 调整模型窗口大小',
    '单击 · 互动 · 双击挥手 · 三击转圈',
    '打开「常用站点」· 学习与生活链接',
    '日历可导入课表 · 定位查看天气',
  ],
  creatorLine: `维护 · ${APP_VERSION_LABEL} · ${BIRTHDAY.recipient}`,
  modelHint: '点击卡片切换模型',
  ctxHide: '暂时隐藏',
  ctxShow: '重新显示',
  ctxQuit: '退出',
  trayTip: `${BIRTHDAY.recipient} · 桌面小伙伴`,
  appearanceSub: '模型、大小与透明度',
};

export const SECRET_REACTIONS = {
  aqun: ['你好呀，今天也要开心', '在呢，一直都在', '记得喝口水休息一下'],
  ty: ['TY 在呢～', '今天也要元气满满', '收到，继续加油'],
  happy: ['心情不错呢', '保持这份好状态', '今天也要顺顺利利'],
  birthday: ['生日快乐！今天你是主角', '庆祝一下～', '愿今天充满惊喜'],
  bday: ['生日快乐，今天你是主角', '限定惊喜来啦', '又长大一岁啦，要对自己好一点'],
  love: ['有人一直记得你', '谢谢你的陪伴', '被记得的感觉，很好'],
  kaixin: ['开心就好～', '保持这份好心情', '今天也要笑一笑'],
  kuaile: ['快乐加载中 ✦', '愿你一直这么快乐', '好心情会传染的'],
  shengri: ['生日快乐！', '今天值得庆祝', '又长大一岁，要对自己好一点'],
  xingfu: ['要幸福呀', '愿你被温柔以待', '幸福就在小事里'],
  party: ['派对时间！', '庆祝模式 ON', '来，撒个花'],
  cake: ['想吃蛋糕了？', '甜蜜时刻', '生日蛋糕安排上'],
  gift: ['有礼物吗？', '心意最重要', '拆开看看～'],
  kx: ['开心！', 'KX 收到～', '保持好状态'],
  kl: ['快乐！', '今天也要 KL', '元气满满'],
  sr: ['生日快乐！', 'SR 彩蛋触发', '今天值得庆祝'],
  xf: ['要幸福哦', 'XF～', '愿你被温柔对待'],
  konami: ['隐藏彩蛋被你找到了', '不错嘛，真有你的', '秘密通道已开启 ✦'],
  avatar: ['你发现了生日限定彩蛋', '认真的人，会有回报', '生日快乐，今天特别为你'],
  pokeStorm: ['好啦好啦，知道了', '再戳就要转圈圈了', '收到收到～'],
  today: [
    '今天是你的日子，生日快乐 🎂',
    '七月四日快乐——愿你被世界温柔对待',
    '又长大一岁啦，今天请对自己偏心一点',
    '生日限定问候：愿你心想事成',
  ],
};

export function randomSecret(category) {
  const list = SECRET_REACTIONS[category] || SECRET_REACTIONS.happy;
  return list[Math.floor(Math.random() * list.length)];
}
