/** 气泡与加载文案 */
export const BUBBLE_LINES = {
  enter: ['收到', '好', '嗯', '明白', 'OK'],
  backspace: ['等等', '慢点', '…', '别急'],
  space: ['', ' ', ''],
  idle: [
    '记得喝水',
    '别坐太久，起来动动',
    '中午好好吃饭',
    '晚上别熬太晚',
    '天冷加件衣服',
    '今天心情怎么样',
    '累了就歇一会儿',
    '周末也要好好休息',
    '多晒晒太阳',
    '眼睛酸了就看看远处',
    '今天也要开心',
    '在呢，需要帮忙就说',
    '适当摸鱼也是生产力',
    '该休息就休息，别硬撑',
    '保持好状态',
    '学习加油',
    '生活也会慢慢变好的',
    '有问题就查一查',
    '今天也要对自己好一点',
    '你已经很棒了',
    '深呼吸，放轻松',
    '伸个懒腰吧',
    '今天也要好好吃饭',
    '别给自己太大压力',
    '一步一步来就好',
    '记得吃水果',
    '久坐不好，站起来走走',
    '晚上早点睡，明天更有精神',
    '今天也要元气满满',
    '有什么想聊的吗',
    '我在呢',
    '摸摸头',
    '会好起来的',
    '你已经很努力了',
    '偶尔发呆也没关系',
    '今天也要对自己温柔一点',
    '别忘记微笑',
    '小目标完成了吗',
    '给自己点个赞',
    '今天也要保持好心情',
    '想偷懒一下也可以',
    '记得按时吃饭哦',
    '外面世界很大，慢慢来',
    '今天也要加油呀',
    '有什么烦恼可以歇一歇',
    '你值得被好好对待',
    '今天也要平安喜乐',
  ],
  poke: ['哎呀', '别戳啦', '嗯？', '在呢', '怎么啦', '干嘛呀', '轻点轻点'],
  wave: ['你好', '又见面了', '今天怎么样', '嗨～', '好久不见'],
  konami: ['彩蛋触发～'],
  typing: ['', ''],
};

export const LOAD_MESSAGES = [
  '正在加载…',
  '阿群马上就来…',
  '准备就绪…',
  '马上就好…',
];

export function randomLine(category, extraPool = []) {
  const base = BUBBLE_LINES[category] || BUBBLE_LINES.idle;
  const list = extraPool.length ? [...base, ...extraPool] : base;
  return list[Math.floor(Math.random() * list.length)];
}

export function loadMessageForProgress(ratio) {
  const idx = Math.min(
    LOAD_MESSAGES.length - 1,
    Math.floor(ratio * LOAD_MESSAGES.length),
  );
  return LOAD_MESSAGES[idx];
}
