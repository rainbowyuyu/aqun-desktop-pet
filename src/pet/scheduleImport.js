/** 课表导入 — CSV / ICS（常见教务导出格式） */

const WEEKDAY_MAP = {
  0: 0, 7: 0, 日: 0, 天: 0, sun: 0, sunday: 0,
  1: 1, 一: 1, 周一: 1, 星期一: 1, mon: 1, monday: 1,
  2: 2, 二: 2, 周二: 2, 星期二: 2, tue: 2, tuesday: 2,
  3: 3, 三: 3, 周三: 3, 星期三: 3, wed: 3, wednesday: 3,
  4: 4, 四: 4, 周四: 4, 星期四: 4, thu: 4, thursday: 4,
  5: 5, 五: 5, 周五: 5, 星期五: 5, fri: 5, friday: 5,
  6: 6, 六: 6, 周六: 6, 星期六: 6, sat: 6, saturday: 6,
};

const BYDAY = { MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6, SU: 0 };

function pad(n) {
  return String(n).padStart(2, '0');
}

function parseWeekday(raw) {
  const s = String(raw ?? '').trim().toLowerCase();
  if (s in WEEKDAY_MAP) return WEEKDAY_MAP[s];
  const n = Number(s);
  if (Number.isFinite(n) && n >= 0 && n <= 7) return WEEKDAY_MAP[n];
  return null;
}

function parseTime(raw) {
  const s = String(raw || '').trim().replace(/：/g, ':');
  const m = s.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return '09:00';
  return `${pad(Number(m[1]))}:${m[2]}`;
}

function nextDateForWeekday(weekday) {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = (weekday - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + diff);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function splitCsvLine(line) {
  const out = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      q = !q;
      continue;
    }
    if (ch === ',' && !q) {
      out.push(cur.trim());
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur.trim());
  return out;
}

function reminderFromClass({ title, weekday, start, end, location, note }) {
  const wd = parseWeekday(weekday);
  if (wd == null || !title) return null;
  const loc = location ? ` · ${location}` : '';
  const timeRange = end ? `${start}-${end}` : start;
  return {
    title: String(title).trim(),
    note: `[课表] ${timeRange}${loc}${note ? ` · ${note}` : ''}`,
    date: nextDateForWeekday(wd),
    time: parseTime(start),
    repeat: 'weekly',
    enabled: true,
    category: 'class',
  };
}

/** 解析 CSV：支持中英文表头 */
export function parseScheduleCsv(text) {
  const lines = String(text || '')
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];

  const header = splitCsvLine(lines[0]).map((h) => h.toLowerCase());
  const idx = (names) => header.findIndex((h) => names.some((n) => h.includes(n)));

  const iTitle = idx(['课程', '课名', 'title', 'name', '科目']);
  const iWeek = idx(['星期', '周', 'weekday', 'day']);
  const iStart = idx(['开始', 'start', '上课时间']);
  const iEnd = idx(['结束', 'end', '下课']);
  const iLoc = idx(['地点', '教室', 'location', 'room']);
  const iNote = idx(['备注', 'note', '教师', '老师']);

  const items = [];
  for (let li = 1; li < lines.length; li += 1) {
    const cols = splitCsvLine(lines[li]);
    if (cols.length < 3) continue;
    const get = (i, fb) => (i >= 0 ? cols[i] : fb);
    const r = reminderFromClass({
      title: get(iTitle, cols[0]),
      weekday: get(iWeek, cols[1]),
      start: get(iStart, cols[2]),
      end: get(iEnd, cols[3]),
      location: get(iLoc, cols[4]),
      note: get(iNote, cols[5]),
    });
    if (r) items.push(r);
  }
  return items;
}

function parseIcsDate(val) {
  const s = String(val || '').trim();
  const m = s.match(/^(\d{4})(\d{2})(\d{2})T?(\d{2})?(\d{2})?/);
  if (!m) return null;
  return {
    date: `${m[1]}-${m[2]}-${m[3]}`,
    time: m[4] ? `${m[4]}:${m[5] || '00'}` : '09:00',
  };
}

function parseByDay(rrule) {
  const m = String(rrule || '').match(/BYDAY=([A-Z,]+)/i);
  if (!m) return null;
  const days = m[1].split(',').map((d) => BYDAY[d.trim().toUpperCase()]).filter((d) => d != null);
  return days.length ? days[0] : null;
}

/** 简易 ICS 解析 — 支持 VEVENT + 每周 RRULE */
export function parseScheduleIcs(text) {
  const blocks = String(text || '').split(/BEGIN:VEVENT/i).slice(1);
  const items = [];

  blocks.forEach((block) => {
    const lines = block.split(/\r?\n/).map((l) => l.trim());
    let summary = '';
    let dtstart = '';
    let dtend = '';
    let location = '';
    let rrule = '';
    let description = '';

    lines.forEach((line) => {
      const [k, ...rest] = line.split(':');
      const key = k.split(';')[0].toUpperCase();
      const val = rest.join(':');
      if (key === 'SUMMARY') summary = val;
      if (key === 'DTSTART') dtstart = val;
      if (key === 'DTEND') dtend = val;
      if (key === 'LOCATION') location = val;
      if (key === 'RRULE') rrule = val;
      if (key === 'DESCRIPTION') description = val;
    });

    if (!summary) return;
    const start = parseIcsDate(dtstart);
    const end = parseIcsDate(dtend);
    const weekly = /FREQ=WEEKLY/i.test(rrule);
    const byDay = parseByDay(rrule);

    if (weekly && byDay != null) {
      items.push(
        reminderFromClass({
          title: summary,
          weekday: byDay,
          start: start?.time || '09:00',
          end: end?.time,
          location,
          note: description,
        }),
      );
      return;
    }

    if (start) {
      items.push({
        title: summary,
        note: `[课表]${location ? ` ${location}` : ''}${description ? ` · ${description}` : ''}`,
        date: start.date,
        time: parseTime(start.time),
        repeat: weekly ? 'weekly' : 'none',
        enabled: true,
        category: 'class',
      });
    }
  });

  return items;
}

export const SCHEDULE_CSV_TEMPLATE = `课程名,星期,开始,结束,地点,备注
示例·高等数学,1,08:00,09:40,教A101,张教授
示例·英语听说,3,14:00,15:40,外语楼205,
`;

export const SCHEDULE_IMPORT_HINT =
  '支持 CSV 表格与 ICS 日历文件。CSV 星期：1=周一 … 0=周日；也可写「周一」。ICS 支持 Google/Outlook/教务系统导出的 .ics。';
