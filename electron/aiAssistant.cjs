/** 全局按键 → 文本缓冲 → 阿里云通义千问 → 桌面宠物建议气泡 */
const https = require('https');
const { clipboard } = require('electron');

const BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
const MODEL = 'qwen-turbo';
const IDLE_MS = 2200;
const MIN_CHARS = 4;
const COOLDOWN_MS = 12000;
const MAX_BUFFER = 480;
const MAX_EDIT_LOG = 28;
const REQUEST_TIMEOUT_MS = 12000;

const SHIFT_CHARS = {
  '`': '~', '1': '!', '2': '@', '3': '#', '4': '$', '5': '%', '6': '^', '7': '&', '8': '*', '9': '(', '0': ')',
  '-': '_', '=': '+', '[': '{', ']': '}', '\\': '|', ';': ':', "'": '"', ',': '<', '.': '>', '/': '?',
};

let buffer = '';
let shiftDown = false;
let ctrlDown = false;
let capsLock = false;
let idleTimer = null;
let lastSuggestAt = 0;
let pending = false;
let getSettings = () => ({});
let sendSuggestion = () => {};
/** @type {Array<{ op: 'add'|'del'|'paste'|'clear', ch?: string, len?: number }>} */
let editLog = [];

function resolveApiKey() {
  try {
    const embedded = require('./aiSecrets.local.cjs');
    if (embedded?.apiKey) return String(embedded.apiKey).trim();
  } catch {
    /* 打包时需存在 electron/aiSecrets.local.cjs（gitignore） */
  }
  return '';
}

function normalizeName(name) {
  return String(name || '').toUpperCase().trim();
}

function isShiftKey(name) {
  const n = normalizeName(name);
  return n === 'LEFT SHIFT' || n === 'RIGHT SHIFT';
}

function isCtrlKey(name) {
  const n = normalizeName(name);
  return n === 'LEFT CTRL' || n === 'RIGHT CTRL';
}

function keyToChar(name, shift) {
  const n = normalizeName(name);
  if (n === 'SPACE') return ' ';
  if (n === 'ENTER' || n === 'RETURN') return '\n';
  if (n === 'TAB') return '\t';

  const letterMatch = n.match(/^([A-Z])$/);
  if (letterMatch) {
    const ch = letterMatch[1];
    const upper = shift !== capsLock;
    return upper ? ch : ch.toLowerCase();
  }

  const digitMatch = n.match(/^([0-9])$/);
  if (digitMatch) {
    const d = digitMatch[1];
    return shift ? (SHIFT_CHARS[d] || d) : d;
  }

  const punct = {
    GRAVE: '`', MINUS: '-', EQUALS: '=', 'LEFT BRACKET': '[', 'RIGHT BRACKET': ']',
    BACKSLASH: '\\', SEMICOLON: ';', QUOTE: "'", COMMA: ',', PERIOD: '.', SLASH: '/',
  };
  const base = punct[n];
  if (base) return shift ? (SHIFT_CHARS[base] || base) : base;

  const numpad = {
    'NUMPAD 0': '0', 'NUMPAD 1': '1', 'NUMPAD 2': '2', 'NUMPAD 3': '3', 'NUMPAD 4': '4',
    'NUMPAD 5': '5', 'NUMPAD 6': '6', 'NUMPAD 7': '7', 'NUMPAD 8': '8', 'NUMPAD 9': '9',
    'NUMPAD ADD': '+', 'NUMPAD SUBTRACT': '-', 'NUMPAD MULTIPLY': '*', 'NUMPAD DIVIDE': '/',
    'NUMPAD DECIMAL': '.',
  };
  if (numpad[n]) return numpad[n];

  return null;
}

function pushEdit(entry) {
  editLog.push(entry);
  if (editLog.length > MAX_EDIT_LOG) {
    editLog = editLog.slice(-MAX_EDIT_LOG);
  }
}

function summarizeEdits() {
  if (!editLog.length) return '';
  const tail = editLog.slice(-14);
  const delCount = tail.filter((e) => e.op === 'del').length;
  const parts = tail.map((e) => {
    if (e.op === 'del') return '⌫';
    if (e.op === 'paste') return `[粘贴${e.len}字]`;
    if (e.op === 'clear') return '[清空]';
    if (e.op === 'add' && e.ch === '\n') return '↵';
    if (e.op === 'add' && e.ch === ' ') return '·';
    return e.ch || '';
  });
  let hint = parts.join('');
  if (delCount >= 3) hint += '（用户在改错/重写）';
  return hint;
}

function trimBuffer() {
  if (buffer.length > MAX_BUFFER) {
    buffer = buffer.slice(-MAX_BUFFER);
  }
}

function clearIdleTimer() {
  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
}

function scheduleAnalyze(force = false) {
  clearIdleTimer();
  const delay = force ? 100 : IDLE_MS;
  idleTimer = setTimeout(() => {
    idleTimer = null;
    analyzeBuffer(force).catch(() => {});
  }, delay);
}

function postJson(url, headers, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const data = JSON.stringify(body);
    const req = https.request({
      hostname: u.hostname,
      path: `${u.pathname}${u.search}`,
      method: 'POST',
      headers: {
        ...headers,
        'Content-Length': Buffer.byteLength(data),
      },
    }, (res) => {
      let chunks = '';
      res.on('data', (chunk) => { chunks += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, json: JSON.parse(chunks || '{}') });
        } catch (err) {
          reject(err);
        }
      });
    });
    req.setTimeout(REQUEST_TIMEOUT_MS, () => {
      req.destroy(new Error('AI request timeout'));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function buildPrompt(text, modelId) {
  const pet = modelId === 'ty' || modelId === 'ty_rig' ? 'TY' : '阿群';
  const editHint = summarizeEdits();
  const lines = [
    `你是桌面宠物「${pet}」，用户正在电脑上打字。`,
    '根据用户最近输入的文本片段，猜测用户可能要写什么、正在做什么，并给出 1～2 句简短、口语化的建议或补全思路。',
    '注意：全局键盘只能捕获物理按键，中文可能是拼音（如 kaixin、kuaile、shengri）；退格表示用户在改字。',
    '要求：总字数不超过 60 字；像朋友聊天；不要说「作为 AI」；不要重复用户原文；可猜测意图并给实用小建议。',
    '',
    `用户当前输入：「${text.slice(-300)}」`,
  ];
  if (editHint) {
    lines.push(`最近按键轨迹：${editHint}`);
  }
  return lines.join('\n');
}

async function callQwen(apiKey, userText, modelId) {
  const { status, json } = await postJson(
    BASE_URL,
    {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    {
      model: MODEL,
      messages: [
        { role: 'system', content: '你是可爱、简洁的桌面宠物助手，只输出给用户看的中文短句，不要 markdown。' },
        { role: 'user', content: buildPrompt(userText, modelId) },
      ],
      temperature: 0.78,
      max_tokens: 120,
    },
  );

  if (status === 401 || status === 403) {
    return { ok: false, error: 'invalid_key', message: 'API Key 无效或已过期' };
  }
  if (status !== 200) {
    const msg = json?.error?.message || json?.message || `HTTP ${status}`;
    return { ok: false, error: 'api_error', message: msg };
  }

  const content = String(json?.choices?.[0]?.message?.content || '').trim();
  if (!content) {
    return { ok: false, error: 'empty', message: '模型未返回内容' };
  }
  return { ok: true, text: content.replace(/^["「]|["」]$/g, '').trim() };
}

async function analyzeBuffer(force = false) {
  const settings = getSettings();
  if (!settings.aiEnabled) return;
  if (settings.keyboardPaused) return;

  const snippet = buffer.replace(/\s+/g, ' ').trim();
  if (snippet.length < MIN_CHARS) return;
  if (!force && Date.now() - lastSuggestAt < COOLDOWN_MS) return;
  if (pending) return;

  const apiKey = resolveApiKey();
  if (!apiKey) return;

  pending = true;
  const snapshot = snippet;
  try {
    const result = await callQwen(apiKey, snapshot, settings.petModelId || 'aqun_rig');
    if (!result.ok) {
      if (result.error === 'invalid_key') {
        sendSuggestion({ error: result.error, message: result.message });
      }
      return;
    }
    lastSuggestAt = Date.now();
    sendSuggestion({
      text: result.text,
      inputPreview: snapshot.slice(-56),
    });
  } catch {
    /* 静默失败，不影响打字 */
  } finally {
    pending = false;
  }
}

function appendText(text) {
  if (!text) return;
  const chunk = String(text).replace(/\r\n/g, '\n').slice(0, 240);
  buffer += chunk;
  pushEdit({ op: 'paste', len: chunk.length });
  trimBuffer();
  scheduleAnalyze(false);
}

function onKeyEvent(payload) {
  const settings = getSettings();
  if (!settings.aiEnabled || settings.keyboardPaused) return;
  if (!payload) return;

  const name = payload.name || '';
  if (isShiftKey(name)) {
    shiftDown = payload.type === 'down';
    return;
  }
  if (isCtrlKey(name)) {
    ctrlDown = payload.type === 'down';
    return;
  }
  if (payload.type !== 'down') return;

  const n = normalizeName(name);
  if (n === 'CAPS LOCK') {
    capsLock = !capsLock;
    return;
  }

  if (ctrlDown && n === 'V') {
    try {
      appendText(clipboard.readText());
    } catch {
      /* ignore */
    }
    return;
  }

  if (n === 'BACKSPACE') {
    if (buffer.length > 0) {
      buffer = buffer.slice(0, -1);
      pushEdit({ op: 'del' });
    }
    scheduleAnalyze(false);
    return;
  }
  if (n === 'DELETE') {
    if (buffer.length > 0) {
      buffer = buffer.slice(0, -1);
      pushEdit({ op: 'del' });
    }
    scheduleAnalyze(false);
    return;
  }
  if (n === 'ESCAPE') {
    buffer = '';
    editLog = [];
    pushEdit({ op: 'clear' });
    clearIdleTimer();
    return;
  }

  const ch = keyToChar(name, shiftDown);
  if (ch == null) return;

  if (ch === '\n') {
    scheduleAnalyze(true);
    return;
  }

  buffer += ch;
  pushEdit({ op: 'add', ch });
  trimBuffer();
  scheduleAnalyze(false);
}

function configure({ getSettingsFn, onSuggestion }) {
  getSettings = getSettingsFn || (() => ({}));
  sendSuggestion = onSuggestion || (() => {});
}

function resetBuffer() {
  buffer = '';
  editLog = [];
  clearIdleTimer();
}

function getStatus() {
  const settings = getSettings();
  const ready = !!resolveApiKey();
  return {
    enabled: !!settings.aiEnabled,
    ready,
  };
}

module.exports = {
  configure,
  onKeyEvent,
  resetBuffer,
  getStatus,
  resolveApiKey,
};
