import { BIRTHDAY } from './birthdayConfig.js';
import { APP_VERSION_LABEL } from './releaseNotes.js';

/** 界面文案 */
export const UI_COPY = {
  appTitle: '阿群模型',
  loading: '正在加载模型…',
  navTitle: '阿群',
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
  aqun: ['你好呀', '今天也要加油', '记得休息一下'],
  happy: ['心情不错', '保持好状态', '今天也要顺利'],
  bday: ['生日快乐', '今天是个好日子', '又找到一个彩蛋'],
  love: ['有人记得你', '谢谢你的陪伴', '被记得的感觉很好'],
  konami: ['彩蛋触发', '隐藏功能已开启', '不错，被你找到了'],
  avatar: ['你发现了隐藏彩蛋', '认真的人会有回报', '生日快乐'],
  pokeStorm: ['好啦，别戳了', '知道了知道了', '再戳就要转圈了'],
  today: ['今天是你的日子', '生日快乐', '愿今天一切顺利'],
};

export function randomSecret(category) {
  const list = SECRET_REACTIONS[category] || SECRET_REACTIONS.happy;
  return list[Math.floor(Math.random() * list.length)];
}
