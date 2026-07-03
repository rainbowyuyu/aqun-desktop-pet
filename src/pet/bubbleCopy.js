/** 气泡与加载文案 — 支持时段 / 使用时长 / 提醒联动 */

/** @typedef {'dawn'|'morning'|'noon'|'afternoon'|'evening'|'night'|'lateNight'} TimeSlot */

/**
 * @typedef {Object} BubbleContext
 * @property {Date} [now]
 * @property {TimeSlot} [timeSlot]
 * @property {number} [sessionMinutes] 陪伴/启动时长
 * @property {number} [activeMinutes] 近期活跃使用时长
 * @property {string} [dayType] workday | weekend | holiday
 * @property {{ primary?: string|null, labels?: string[] }} [dayMarks]
 * @property {{ title: string, time: string, minutesUntil: number, category?: string }|null} [upcomingReminder]
 * @property {number} [todayReminderCount]
 * @property {boolean} [hasClassToday]
 */

/** 5–8 清晨 · 9–11 上午 · 12–13 午间 · 14–17 下午 · 18–21 傍晚 · 22–23 夜间 · 0–4 凌晨 */
export function getTimeSlot(date = new Date()) {
  const h = date.getHours();
  if (h >= 5 && h < 9) return 'dawn';
  if (h >= 9 && h < 12) return 'morning';
  if (h >= 12 && h < 14) return 'noon';
  if (h >= 14 && h < 18) return 'afternoon';
  if (h >= 18 && h < 22) return 'evening';
  if (h >= 22) return 'night';
  return 'lateNight';
}

const TIME_SLOT_LABEL = {
  dawn: '清晨',
  morning: '上午',
  noon: '午间',
  afternoon: '下午',
  evening: '傍晚',
  night: '夜间',
  lateNight: '凌晨',
};

/** @param {Partial<BubbleContext>} partial */
export function normalizeBubbleContext(partial = {}) {
  const now = partial.now instanceof Date ? partial.now : new Date();
  return {
    now,
    timeSlot: partial.timeSlot || getTimeSlot(now),
    sessionMinutes: Math.max(0, partial.sessionMinutes ?? 0),
    activeMinutes: Math.max(0, partial.activeMinutes ?? 0),
    dayType: partial.dayType || 'workday',
    dayMarks: partial.dayMarks || {},
    upcomingReminder: partial.upcomingReminder ?? null,
    todayReminderCount: partial.todayReminderCount ?? 0,
    hasClassToday: !!partial.hasClassToday,
  };
}

/** @param {object|string} entry @param {BubbleContext} ctx */
function resolveEntry(entry, ctx) {
  if (typeof entry === 'string') return entry;
  if (entry.make) return entry.make(ctx) || '';
  return entry.text || '';
}

/** @param {object|string} entry @param {BubbleContext} ctx */
function entryMatches(entry, ctx) {
  if (typeof entry === 'string') return true;
  if (entry.slots?.length && !entry.slots.includes(ctx.timeSlot)) return false;
  if (entry.exclude?.includes(ctx.timeSlot)) return false;
  if (entry.dayTypes?.length && !entry.dayTypes.includes(ctx.dayType)) return false;
  if (entry.minSession != null && ctx.sessionMinutes < entry.minSession) return false;
  if (entry.minActive != null && ctx.activeMinutes < entry.minActive) return false;
  if (entry.maxActive != null && ctx.activeMinutes > entry.maxActive) return false;
  if (entry.needsUpcoming && !ctx.upcomingReminder) return false;
  if (entry.needsReminders && ctx.todayReminderCount <= 0) return false;
  if (entry.needsClass && !ctx.hasClassToday) return false;
  if (entry.weekendOnly && ctx.dayType === 'workday') return false;
  if (entry.workdayOnly && ctx.dayType !== 'workday') return false;
  return true;
}

/** @param {Array<object|string>} pool @param {BubbleContext} ctx @param {string[]} extras */
function pickFromPool(pool, ctx, extras = []) {
  const weighted = [];
  for (const entry of [...pool, ...extras.map((t) => ({ text: t, weight: 1 }))]) {
    if (!entryMatches(entry, ctx)) continue;
    const text = resolveEntry(entry, ctx);
    if (!text?.trim()) continue;
    const w = typeof entry === 'object' ? (entry.weight ?? 1) : 1;
    for (let i = 0; i < w; i += 1) weighted.push(text);
  }
  if (!weighted.length) return '';
  return weighted[Math.floor(Math.random() * weighted.length)];
}

/** 根据今日提醒生成动态句 */
function buildReminderLines(ctx) {
  const lines = [];
  const { upcomingReminder: u, todayReminderCount: n } = ctx;

  if (u) {
    const mins = u.minutesUntil;
    const who = u.category === 'class' ? '课' : '事';
    if (mins > 0 && mins <= 10) {
      lines.push({
        make: () => `「${u.title}」${u.time} 就到，现在收个尾，比最后狂奔体面`,
        weight: 4,
        needsUpcoming: true,
      });
    } else if (mins > 10 && mins <= 45) {
      lines.push({
        make: () => `还有 ${mins} 分钟：${u.title}。不急，但别把它晾到最后一刻`,
        weight: 3,
        needsUpcoming: true,
      });
    } else if (mins > 45 && mins <= 120) {
      lines.push({
        make: () => `${u.time} 有${who}「${u.title}」——我记着呢，你只管把眼前这一件做完`,
        weight: 2,
        needsUpcoming: true,
      });
    }
  }

  if (n >= 3) {
    lines.push({
      make: () => `今天 ${n} 件事排着队呢，不用全赢，一件件拿下一项就行`,
      weight: 2,
      needsReminders: true,
    });
  }

  if (ctx.hasClassToday && ctx.dayType === 'workday') {
    lines.push({
      text: '有课的日子，课间那口水不是偷懒，是给下半场续命',
      weight: 2,
      needsClass: true,
      dayTypes: ['workday'],
      slots: ['morning', 'noon', 'afternoon'],
    });
  }

  return lines;
}

/** 节日 / 节气轻量联动 */
function buildDayLines(ctx) {
  const lines = [];
  const primary = ctx.dayMarks?.primary;
  const labels = ctx.dayMarks?.labels || [];

  if (primary) {
    lines.push({
      make: () => `${primary}诶——今天可以对自己宽一点，不是放纵，是配得`,
      weight: 2,
    });
  }

  if (ctx.dayType === 'holiday') {
    lines.push({
      text: '放假呢，效率可以请假，心情别跟着旷工',
      weight: 2,
      dayTypes: ['holiday'],
    });
  }

  if (ctx.dayType === 'weekend') {
    lines.push({
      text: '周末诶，先把「必须」从脑子里请出去',
      weight: 2,
      dayTypes: ['weekend'],
    });
  }

  if (labels.includes('调休补班')) {
    lines.push({
      text: '补班日…我懂。今天不求满格，撑过去就算赢',
      weight: 3,
      workdayOnly: true,
    });
  }

  return lines;
}

/** 屏幕 / 陪伴时长 */
function buildUsageLines(ctx) {
  const lines = [];
  const { activeMinutes: a, sessionMinutes: s } = ctx;

  if (a >= 30 && a < 60) {
    lines.push({
      text: '半小时了——眨眨眼，别让屏幕把你也锁进去',
      minActive: 30,
      maxActive: 59,
      weight: 2,
    });
  }
  if (a >= 60 && a < 120) {
    lines.push({
      make: () => `盯了大概 ${a} 分钟了。站起来走两步，算你赢屏幕一局`,
      minActive: 60,
      maxActive: 119,
      weight: 3,
    });
  }
  if (a >= 120) {
    lines.push({
      make: () => `${a} 分钟了…我不是催，是怕你跟椅子焊在一起`,
      minActive: 120,
      weight: 3,
    });
  }
  if (s >= 180 && a < 30) {
    lines.push({
      text: '我陪挺久了——你中间有真正歇过没？诚实回答',
      minSession: 180,
      maxActive: 29,
      weight: 2,
    });
  }

  return lines;
}

const IDLE_POOL = [
  // —— 通用（任意时段）——
  { text: '喝水了没？我不催，但我会一直盯着你' },
  { text: '进度可以慢，别把自己先耗空' },
  { text: '你已经做得很好了——这话不是安慰，是事实' },
  { text: '别硬撑。休息不是认输，是下一轮的前奏' },
  { text: '今天状态一般？那就一般地过，也算过关' },
  { text: '我在这，不催你，但也不会假装没看见你在扛' },
  { text: '卡住了就查，查不到就歇——两种都算负责' },
  { text: '一步一步来。快不快不重要，别丢了自己才重要' },
  { text: '给自己点个赞，不丢人，还挺帅' },
  { text: '对自己温柔一点——你对外已经够客气了' },
  { text: '你值得被好好对待，包括被你自己' },
  { text: '深呼吸，肩膀放下来——听见没，放下来' },
  { text: '伸个懒腰，像猫一样——猫从不会为偷懒道歉' },
  { text: '有什么想聊的，我听着。不想说也行，陪着就够' },
  { text: '小目标没完成没关系，明天还在，你也还在' },
  { text: '外面世界很大，你已经在路上了——这本身就不容易' },
  { text: '会好起来的。不是鸡汤，是概率，也是时间' },
  { text: '今天心情怎么样？不说也行，我看得出来一点' },
  { text: '学习加油，但别拿健康当筹码——筹码会赢，你会输' },
  { text: '生活会变好的，通常在你没察觉、但还在坚持的时候' },
  { text: '有什么烦恼，先喝口水——水解决不了，但能给你三秒缓冲' },
  { text: '平安喜乐，也允许有小波折——波折不等于失败' },
  { text: '你比想象中更能扛，也比想象中更需要被照顾' },
  { text: '在呢。需要帮忙说，不需要就安静陪着' },
  { text: '别给自己太大压力——地球转不靠你一个人推' },
  { text: '今天也要开心。开心不了也没关系，活着已经很难了' },
  { text: '摸摸头，辛苦了——这句我认真说的' },
  { text: '适当发呆，是大脑在存档，不是你在摸鱼' },
  { text: '摸鱼五分钟，说不定比硬撑一小时更清醒' },
  { text: '想偷懒一下？批准了，限时那种，到期记得回来' },
  { text: '适当摸鱼，是高级的时间管理，别学那些不会累的人' },
  { text: '卡住了？先离开屏幕三分钟——回来可能还是卡，但你会少骂自己几句' },
  { text: '眼睛酸了就看远处，我不收咨询费，但希望你听' },
  { text: '久坐会偷袭腰，站起来赢一局——腰会感谢你的' },
  { text: '水果记得吃，别只喝咖啡续命——咖啡是借，身体要还' },
  { text: '你不需要完美出场，只需要还在场' },
  { text: '累了就说累，不丢人，硬撑才最耗人' },
  { text: '有些事急不来，但你可以先对自己好一点' },
  { text: '我不催进度，但我看见你在努力——这就够了' },
  { text: '允许今天只完成一点点，一点点也是向前' },

  // —— 清晨 / 上午 ——
  { text: '早啊——先把自己叫醒，再叫醒手机', slots: ['dawn', 'morning'] },
  { text: '早上好。今天可以慢慢启动，不必一开机就满负荷', slots: ['dawn', 'morning'] },
  { text: '早饭别跳过——空肚子扛不住上午，胃会记仇', slots: ['dawn', 'morning'] },
  { text: '清晨脑子还干净，最难的那件，趁现在下手', slots: ['dawn', 'morning'] },
  { text: '上午效率高，但也别把自己用到透支——下午还要见', slots: ['morning'] },

  // —— 午间 ——
  { text: '午饭别凑合，胃的账迟早要还', slots: ['noon', 'morning'] },
  { text: '该吃饭了，屏幕不会跑，你也不会因为吃饭而落后', slots: ['noon'] },
  { text: '中午眯十分钟，下午能省一小时——这笔账划算', slots: ['noon', 'afternoon'] },

  // —— 下午 ——
  { text: '下午犯困不怪你，怪生物钟——但别拿零食当替身', slots: ['afternoon'] },
  { text: '困是困了，站起来走两步，比第三杯咖啡诚实', slots: ['afternoon'] },
  { text: '起来走两步，椅子可不背锅，但它确实在吸你', slots: ['afternoon', 'noon'] },

  // —— 傍晚 ——
  { text: '忙了一天，允许自己慢下来——慢不是懒，是回收', slots: ['evening'] },
  { text: '晚饭记得吃，别用熬夜换进度——进度换不来睡眠', slots: ['evening'] },
  { text: '天还没全黑，今天已经够长了——你也很长情', slots: ['evening'] },

  // —— 夜间 ——
  { text: '晚上别熬太晚，明天还要见——我不想你带着黑眼圈见我', slots: ['night'], exclude: ['dawn', 'morning', 'noon', 'afternoon'] },
  { text: '该收尾了，明天的事明天也有力气——今天先把自己交还给自己', slots: ['night'] },
  { text: '夜深了，对自己别那么凶——你对别人都没这么严', slots: ['night', 'lateNight'] },

  // —— 凌晨（不说「很晚了」，说人话）——
  { text: '这个点还在…我是担心，不是唠叨——你懂我意思', slots: ['lateNight'] },
  { text: '凌晨了，睡眠是硬通货，别透支——明天还要用', slots: ['lateNight'] },
  { text: '月亮都下班了，你也该轮班了——轮班去睡觉', slots: ['lateNight'] },
  { text: '不是你不努力，是身体要先结账——这账逃不掉', slots: ['lateNight'], exclude: ['morning', 'noon'] },

  // —— 周末 / 假期 ——
  { text: '周末也要好好喘气——喘够了再出发', dayTypes: ['weekend', 'holiday'] },
  { text: '偶尔摆烂，是为了更好地出发——出发之前，先把自己找回来', dayTypes: ['weekend', 'holiday'] },
  { text: '天冷记得加件，别跟身体赌气——赌气赢不了', exclude: ['lateNight'] },

  // —— 工作日 ——
  { text: '工作日拼的是续航，不是爆发——爆发留给周末惊喜', dayTypes: ['workday'], slots: ['morning', 'afternoon'] },
];

const WAVE_BY_SLOT = {
  dawn: ['早呀，今天也请多指教', '醒啦？不着急，慢慢来', '新的一天，我站你这边'],
  morning: ['上午好——今天打算怎么过', '嗨，状态如何，实话说', '又见面了，今天也请多关照'],
  noon: ['中午好，记得吃饭', '歇一下，下午还要并肩', '该吃饭了，我等你回来'],
  afternoon: ['下午好，还撑得住吗', '又见面了——需要打气就说', '下午了，别把自己逼太紧'],
  evening: ['晚上好，今天辛苦了', '忙完啦？先喘口气', '嗨，今天过得怎么样'],
  night: ['还没睡呀——我陪着', '晚上好，别熬太晚', '这个点还在，注意别透支'],
  lateNight: ['还不睡呀…我担心', '怎么这个点还在——身体要紧', '在呢，但睡眠也要在'],
};

export const BUBBLE_LINES = {
  enter: ['收到', '好', '嗯', '明白', 'OK', '行', '懂了', '可以', '没问题', '好嘞'],
  backspace: ['等等', '慢点', '…', '别急', '哎哎哎', '撤回？', '手滑了？', '悠着点'],
  space: ['嗯', '…', '继续', '好', '行', '就这样', '空格也是节奏'],
  poke: [
    '哎呀', '别戳啦', '嗯？在呢', '怎么啦', '干嘛呀',
    '轻点——我会记仇的', '戳我可以，别戳自己太狠', '在的在的', '戳到啦', '干嘛戳我',
  ],
  wave: ['你好呀', '又见面了', '嗨～', '好久不见，想我了没', '招手招手', '在呢在呢'],
  konami: ['彩蛋触发～你有点东西', 'Konami 密码？行家啊', '隐藏关卡已解锁'],
  spin: [
    '转一圈给你看～', '360° 完成！', '晕吗？我不晕', '旋转向你', '展示背面中…',
    '转完还是正面，放心', '小旋风启动', '看我旋转跳跃', '一圈不够再来？',
  ],
  shake: [
    '晃晃～', '摇一摇，醒醒神', '左右晃晃', '别睡着啦', '抖抖精神',
    '轻轻摇，不会散架', '摇摆模式 ON', '跟着节奏晃一晃', '这样够晃吗',
  ],
  jump: [
    '嘿！', '蹦！', '跳一跳，精神好', '起！', '小跳一下',
    '离地五厘米也是跳', '活跃气氛！', '蹦跶蹦跶', '跳完落地稳', '耶～',
  ],
  headTurnLeft: [
    '看左边～', '咦，那边有什么', '左看看', '头往左～', '这边这边',
    '左边风景如何', '转向左侧', '左顾一下', '脖子活动活动',
  ],
  headTurnRight: [
    '看右边～', '右边有什么吗', '右看看', '头往右～', '那边那边',
    '右边也瞧瞧', '转向右侧', '右盼一下', '活动下颈椎',
  ],
  idle: IDLE_POOL.map((e) => (typeof e === 'string' ? e : e.text)).filter(Boolean),
};

export const LOAD_MESSAGES = [
  '正在加载…',
  '模型马上就来…',
  '准备就绪…',
  '马上就好…',
];

/**
 * 按上下文选取气泡文案
 * @param {string} category
 * @param {Partial<BubbleContext>} rawContext
 * @param {string[]} extraPool
 */
export function pickBubbleLine(category, rawContext = {}, extraPool = []) {
  const ctx = normalizeBubbleContext(rawContext);

  if (category === 'idle') {
    const dynamic = [
      ...buildReminderLines(ctx),
      ...buildDayLines(ctx),
      ...buildUsageLines(ctx),
    ];
    const picked = pickFromPool([...IDLE_POOL, ...dynamic], ctx, extraPool);
    if (picked) return picked;
    return '在呢——需要帮忙说，不需要就安静陪着';
  }

  if (category === 'wave') {
    const slotLines = WAVE_BY_SLOT[ctx.timeSlot] || BUBBLE_LINES.wave;
    return pickFromPool(slotLines, ctx, extraPool) || '你好';
  }

  if (BUBBLE_LINES[category]?.length) {
    return pickFromPool(BUBBLE_LINES[category], ctx, extraPool) || '';
  }

  const base = BUBBLE_LINES.idle;
  return pickFromPool(base, ctx, extraPool) || '';
}

/** @deprecated 请用 pickBubbleLine */
export function randomLine(category, extraPool = [], context = {}) {
  return pickBubbleLine(category, context, extraPool);
}

export function loadMessageForProgress(ratio) {
  const idx = Math.min(
    LOAD_MESSAGES.length - 1,
    Math.floor(ratio * LOAD_MESSAGES.length),
  );
  return LOAD_MESSAGES[idx];
}

/** 从今日提醒列表里找最近一项即将发生的（不含已过期） */
export function findUpcomingReminder(reminders, now = new Date()) {
  if (!reminders?.length) return null;

  const dayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const nowMins = now.getHours() * 60 + now.getMinutes();

  let best = null;
  for (const r of reminders) {
    if (r.enabled === false) continue;
    const [hh, mm] = String(r.time || '00:00').split(':').map(Number);
    if (!Number.isFinite(hh)) continue;
    const target = hh * 60 + (mm || 0);
    const diff = target - nowMins;
    if (diff <= 0 || diff > 120) continue;
    if (!best || diff < best.minutesUntil) {
      best = {
        title: r.title || '提醒',
        time: r.time || '',
        minutesUntil: diff,
        category: r.category,
        date: r.date || dayKey,
      };
    }
  }
  return best;
}

export { TIME_SLOT_LABEL };
