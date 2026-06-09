'use strict';

const API_GROUP = '/api/group/chat';
const API_AUTONOMOUS = '/api/group/autonomous';
const API_STATUS = '/api/status';
const API_PERSONAS = '/api/personas';
const API_ROOM = '/api/room';

/** 80 % más rápido: los tiempos de espera se dividen por este factor. */
const CHAT_SPEED_BOOST = 1.8;

const MESSAGES_EL = document.getElementById('chat-messages');
const FORM = document.getElementById('chat-form');
const INPUT = document.getElementById('chat-input');
const BTN_SEND = document.getElementById('btn-send');
const PROVIDER_STATUS = document.getElementById('provider-status');
const GROUP_STATUS = document.getElementById('group-status');
const MEMBER_LIST = document.getElementById('member-list');
const INFO_PANEL = document.getElementById('group-info');
const BTN_INFO = document.getElementById('btn-info');
const BTN_CLOSE_INFO = document.getElementById('btn-close-info');
const BTN_CLOSE_DRAWER = document.getElementById('btn-close-drawer');
const INFO_BACKDROP = document.getElementById('info-backdrop');
const CHAT_TOGGLE = document.getElementById('chat-toggle');
const BTN_THEME = document.getElementById('btn-theme');
const THEME_PANEL = document.getElementById('theme-panel');
const THEME_GRID = document.getElementById('theme-grid');
const BTN_CLOSE_THEME = document.getElementById('btn-close-theme');
const BTN_SCROLL_BOTTOM = document.getElementById('btn-scroll-bottom');

const THEMES = [
  { id: 'dark', label: 'Oscuro', bg: '#0f172a', bubbleIn: '#1e293b', bubbleOut: '#0f766e' },
  { id: 'light', label: 'Claro', bg: '#e5ddd5', bubbleIn: '#ffffff', bubbleOut: '#d9fdd3' },
  { id: 'rose', label: 'Rosa', bg: '#2a1220', bubbleIn: '#3d1f30', bubbleOut: '#ec4899' },
  { id: 'ocean', label: 'Océano', bg: '#0c1929', bubbleIn: '#152a40', bubbleOut: '#0ea5e9' },
  { id: 'lavender', label: 'Lavanda', bg: '#1a1530', bubbleIn: '#2a2348', bubbleOut: '#8b5cf6' },
  { id: 'sunset', label: 'Atardecer', bg: '#261508', bubbleIn: '#3d2818', bubbleOut: '#f97316' },
];

const CAT_LABELS = {
  normal: 'Seguro / normal',
  phishing: 'Phishing',
  toxicidad: 'Toxicidad',
  oversharing: 'Oversharing',
};

const PROVIDER_LABELS = { groq: 'IA Groq', gemini: 'IA Gemini', templates: 'Plantillas' };

const PERSONA_COLORS = {
  ana: '#10b981',
  carlos: '#f43f5e',
  diana: '#a78bfa',
  eduardo: '#fbbf24',
};

const WELCOME_TEXT = 'Hola a todos, bienvenidos al grupo. Aquí estamos Ana, Carlos, Diana y Eduardo.';

let history = [];
let isBusy = false;
let chatActive = false;
let autonomousTimer = null;
let personas = [];
let audioCtx = null;
let lastRoomId = 0;
let chatGeneration = 0;
let userQueue = [];
let drainingUserQueue = false;
let roomSyncTimer = null;
let roomPollMs = 3500;
const renderedRoomIds = new Set();
const processedBotForUserIds = new Set();

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function scaleDelay(ms) {
  return Math.max(40, Math.round(ms / CHAT_SPEED_BOOST));
}

function readingDelay(text) {
  const words = (text || '').split(/\s+/).filter(Boolean).length;
  return scaleDelay(Math.min(5000, 700 + words * 110 + Math.random() * 500));
}

function typingDelay(text) {
  const chars = (text || '').length;
  return scaleDelay(Math.min(7000, 1000 + chars * 42 + Math.random() * 700));
}

function pauseBetweenMessages() {
  return scaleDelay(1800 + Math.random() * 3200);
}

function autonomousIdleDelay() {
  return scaleDelay(16000 + Math.random() * 20000);
}

function getAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

function playTone(freq, duration, volume = 0.06) {
  try {
    const ctx = getAudio();
    if (ctx.state === 'suspended') ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  } catch (_e) { /* sin audio */ }
}

function playSendSound() {
  playTone(380, 0.07, 0.05);
}

function playReceiveSound() {
  playTone(520, 0.09, 0.045);
  setTimeout(() => playTone(660, 0.08, 0.035), 70);
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function nowTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function buildBubble({ role, speakerId, speakerName, text, typing }) {
  const isUser = role === 'user';
  const article = document.createElement('article');
  article.className = `msg ${isUser ? 'msg--out' : 'msg--in'}${typing ? ' msg--typing' : ''}`;
  article.setAttribute('role', 'article');
  if (speakerId) article.setAttribute('data-speaker', speakerId);

  const avatarColor = PERSONA_COLORS[speakerId] || '#64748b';
  const initial = speakerName ? speakerName[0].toUpperCase() : '?';

  const authorHtml = isUser ? '' : `<span class="msg__author">${escapeHtml(speakerName || '')}</span>`;
  const avatarHtml = isUser ? '' : `<div class="msg__avatar" style="background:${avatarColor}">${initial}</div>`;

  let bodyHtml;
  if (typing) {
    bodyHtml = `<span class="msg__text"><span class="msg__typing-dots" aria-hidden="true"><span></span><span></span><span></span></span></span>`;
  } else {
    bodyHtml = `<p class="msg__text" data-testid="message-text">${escapeHtml(text)}</p>`;
  }

  article.innerHTML = `
    ${avatarHtml}
    <div class="msg__bubble">
      ${authorHtml}
      ${bodyHtml}
      ${typing ? '' : `<time class="msg__time">${nowTime()}</time>`}
    </div>
  `;

  return article;
}

function scrollToBottom(smooth = true) {
  MESSAGES_EL.scrollTo({
    top: MESSAGES_EL.scrollHeight,
    behavior: smooth ? 'smooth' : 'auto',
  });
}

function isNearBottom(threshold = 120) {
  const { scrollTop, scrollHeight, clientHeight } = MESSAGES_EL;
  return scrollHeight - scrollTop - clientHeight < threshold;
}

function updateScrollFab() {
  if (!BTN_SCROLL_BOTTOM) return;
  BTN_SCROLL_BOTTOM.hidden = isNearBottom();
}

function applyTheme(themeId) {
  const theme = THEMES.find((t) => t.id === themeId) || THEMES[0];
  document.documentElement.setAttribute('data-theme', theme.id);
  localStorage.setItem('cyberchat-theme', theme.id);
  THEME_GRID?.querySelectorAll('.theme-card').forEach((card) => {
    card.classList.toggle('theme-card--active', card.dataset.theme === theme.id);
  });
}

function renderThemeGrid() {
  if (!THEME_GRID) return;
  const current = localStorage.getItem('cyberchat-theme') || 'dark';
  THEME_GRID.innerHTML = THEMES.map((t) => `
    <button type="button" class="theme-card${t.id === current ? ' theme-card--active' : ''}"
            data-theme="${t.id}" role="option" aria-selected="${t.id === current}"
            style="--theme-preview-bg: ${t.bg}">
      <div class="theme-card__preview">
        <div class="theme-card__bubble" style="background:${t.bubbleIn}"></div>
        <div class="theme-card__bubble theme-card__bubble--out" style="background:${t.bubbleOut}"></div>
      </div>
      <span class="theme-card__label">${escapeHtml(t.label)}</span>
      <span class="theme-card__check" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 6 9 17l-5-5"/>
        </svg>
      </span>
    </button>
  `).join('');

  THEME_GRID.querySelectorAll('.theme-card').forEach((card) => {
    card.addEventListener('click', () => {
      applyTheme(card.dataset.theme);
    });
  });
}

function appendBubble(opts, { silent = false } = {}) {
  const el = buildBubble(opts);
  MESSAGES_EL.appendChild(el);
  scrollToBottom(!opts.typing);
  if (!silent && opts.role !== 'user' && !opts.typing) playReceiveSound();
  updateScrollFab();
  return el;
}

function showTyping(speakerName, speakerId) {
  hideTyping();
  const el = buildBubble({ role: 'assistant', speakerId, speakerName, typing: true });
  el.id = 'typing-indicator';
  MESSAGES_EL.appendChild(el);
  scrollToBottom(true);
}

function hideTyping() {
  document.getElementById('typing-indicator')?.remove();
}

/** Interrumpe autochat, animación "escribiendo…" y reproducción de bots en curso. */
function abortChatActivity() {
  chatGeneration += 1;
  clearTimeout(autonomousTimer);
  autonomousTimer = null;
  hideTyping();
}

function isUserTurnPending() {
  return drainingUserQueue || userQueue.length > 0;
}

function updateChatToggleUI() {
  if (!CHAT_TOGGLE) return;
  CHAT_TOGGLE.checked = chatActive;
  document.body.classList.toggle('chat-paused', !chatActive);
}

function setChatActive(active) {
  chatActive = !!active;
  localStorage.setItem('cyberchat-active', chatActive ? '1' : '0');
  updateChatToggleUI();
  if (chatActive) scheduleAutonomous();
  else {
    clearTimeout(autonomousTimer);
    autonomousTimer = null;
    hideTyping();
  }
}

function scheduleAutonomous() {
  clearTimeout(autonomousTimer);
  if (!chatActive || isBusy || isUserTurnPending()) return;
  autonomousTimer = setTimeout(async () => {
    if (!chatActive || isBusy || isUserTurnPending()) return;
    await runAutonomous();
    scheduleAutonomous();
  }, autonomousIdleDelay());
}

async function playMessagesSequentially(messages, { source = 'host' } = {}) {
  const generation = chatGeneration;
  for (let i = 0; i < messages.length; i++) {
    if (generation !== chatGeneration) return;
    if (!chatActive && i > 0) break;
    const msg = messages[i];
    if (i > 0) {
      await delay(pauseBetweenMessages());
      if (generation !== chatGeneration || !chatActive) return;
    }
    showTyping(msg.speaker_name, msg.speaker_id);
    await delay(typingDelay(msg.text));
    if (generation !== chatGeneration) return;
    hideTyping();
    try {
      const posted = await postRoomMessage({
        role: 'assistant',
        speaker_id: msg.speaker_id,
        speaker_name: msg.speaker_name,
        content: msg.text,
        source,
      });
      renderFromRoom(posted);
    } catch (_err) {
      appendBubble({
        role: 'assistant',
        speakerId: msg.speaker_id,
        speakerName: msg.speaker_name,
        text: msg.text,
      });
      history.push({
        role: 'assistant',
        speaker: msg.speaker_id,
        speaker_name: msg.speaker_name,
        content: msg.text,
      });
    }
  }
}

async function fetchMessages(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Error ${res.status}`);
  }
  return res.json();
}

async function runAutonomous() {
  if (!chatActive || isBusy || isUserTurnPending() || history.length < 1) return;
  const generation = chatGeneration;
  isBusy = true;
  const lastMsg = history[history.length - 1]?.content || '';
  try {
    await delay(readingDelay(lastMsg));
    if (generation !== chatGeneration || isUserTurnPending()) return;
    const pick = personas.length
      ? personas[Math.floor(Math.random() * personas.length)]
      : { id: 'ana', name: 'Ana' };
    showTyping(pick.name, pick.id);
    const data = await fetchMessages(API_AUTONOMOUS, { history });
    if (generation !== chatGeneration) return;
    hideTyping();
    if (data.messages?.length) await playMessagesSequentially(data.messages, { source: 'autochat' });
  } catch (_err) {
    hideTyping();
  } finally {
    isBusy = false;
    if (chatActive && !isUserTurnPending()) scheduleAutonomous();
  }
}

async function publishUserBubble(trimmed, speakerName = 'Tu', speakerId = 'user', source = 'host') {
  try {
    const posted = await postRoomMessage({
      role: 'user',
      speaker_id: speakerId,
      speaker_name: speakerName,
      content: trimmed,
      source,
    });
    renderFromRoom(posted);
  } catch (_err) {
    appendBubble({ role: 'user', text: trimmed });
    history.push({ role: 'user', speaker: speakerId, speaker_name: speakerName, content: trimmed });
  }
}

async function requestBotReplies(trimmed, historyBeforeUser) {
  const generation = chatGeneration;
  await delay(readingDelay(trimmed));
  if (generation !== chatGeneration) return;

  const first = personas[0] || { id: 'ana', name: 'Ana' };
  showTyping(first.name, first.id);
  const data = await fetchMessages(API_GROUP, {
    message: trimmed,
    history: historyBeforeUser,
  });
  if (generation !== chatGeneration) return;
  hideTyping();
  if (data.messages?.length) {
    await playMessagesSequentially(data.messages);
  }
  loadProviderStatus();
}

async function handleUserMessage(trimmed, meta = {}) {
  const {
    speakerName = 'Tu',
    speakerId = 'user',
    source = 'host',
    skipPublish = false,
  } = meta;

  abortChatActivity();
  isBusy = true;
  BTN_SEND.disabled = true;

  if (!skipPublish) playSendSound();

  if (!skipPublish) {
    await publishUserBubble(trimmed, speakerName, speakerId, source);
  }
  const historyForApi = history.slice(0, -1);

  try {
    await requestBotReplies(trimmed, historyForApi);
  } catch (err) {
    hideTyping();
    appendBubble({
      role: 'assistant',
      speakerId: 'ana',
      speakerName: 'Ana',
      text: `No pude conectar (${err.message})`,
    });
  } finally {
    isBusy = false;
    BTN_SEND.disabled = false;
    INPUT.focus();
    if (chatActive && !isUserTurnPending()) scheduleAutonomous();
  }
}

async function drainUserQueue() {
  if (drainingUserQueue) return;
  drainingUserQueue = true;
  while (userQueue.length > 0) {
    const job = userQueue.shift();
    await handleUserMessage(job.text, job.meta || {});
  }
  drainingUserQueue = false;
  if (chatActive && !isBusy) scheduleAutonomous();
}

function sendMessage(text) {
  if (!text.trim()) return;
  userQueue.push({ text: text.trim(), meta: {} });
  drainUserQueue();
}

function renderMembers() {
  if (!MEMBER_LIST) return;
  MEMBER_LIST.innerHTML = personas.map((p) => `
    <li class="member">
      <div class="member__avatar" style="background:${p.color}">${p.emoji}</div>
      <div>
        <div class="member__name">${escapeHtml(p.name)}</div>
        <div class="member__cat">${CAT_LABELS[p.category] || p.category}</div>
      </div>
    </li>
  `).join('');
}

async function loadPersonas() {
  try {
    const res = await fetch(API_PERSONAS);
    if (res.ok) { personas = await res.json(); renderMembers(); }
  } catch (_err) { /* ignore */ }
}

async function loadProviderStatus() {
  if (!PROVIDER_STATUS) return;
  try {
    const res = await fetch(API_STATUS);
    if (!res.ok) return;
    const data = await res.json();
    PROVIDER_STATUS.textContent = PROVIDER_LABELS[data.active] || data.active;
    PROVIDER_STATUS.title = data.hint || '';
    PROVIDER_STATUS.className = `badge badge--${data.active}`;
    if (GROUP_STATUS) {
      const names = 'Ana, Carlos, Diana, Eduardo';
      GROUP_STATUS.textContent = data.groq_working ? `${names} · ${data.model}` : names;
    }
  } catch (_err) {
    PROVIDER_STATUS.textContent = 'Sin servidor';
  }
}

function historyItemFromRoom(msg) {
  return {
    role: msg.role,
    speaker: msg.speaker_id || msg.speaker || (msg.role === 'user' ? 'user' : 'ana'),
    speaker_name: msg.speaker_name || (msg.role === 'user' ? 'Tu' : 'Ana'),
    content: msg.content,
  };
}

function renderFromRoom(msg, { silent = false } = {}) {
  if (renderedRoomIds.has(msg.id)) return;
  renderedRoomIds.add(msg.id);
  lastRoomId = Math.max(lastRoomId, msg.id);

  const isUser = msg.role === 'user';
  appendBubble({
    role: isUser ? 'user' : 'assistant',
    speakerId: msg.speaker_id || undefined,
    speakerName: msg.speaker_name || (isUser ? 'Visitante' : 'Ana'),
    text: msg.content,
  }, { silent });
  history.push(historyItemFromRoom(msg));
}

async function postRoomMessage(payload) {
  const res = await fetch(API_ROOM, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Room ${res.status}`);
  return res.json();
}

function scheduleRoomSync() {
  clearTimeout(roomSyncTimer);
  roomSyncTimer = setTimeout(async () => {
    const hadNew = await syncRoom();
    roomPollMs = hadNew ? 2000 : Math.min(6000, roomPollMs + 400);
    scheduleRoomSync();
  }, roomPollMs);
}

async function syncRoom() {
  let hadNew = false;
  try {
    const res = await fetch(`${API_ROOM}?after=${lastRoomId}`);
    if (!res.ok) return false;
    const data = await res.json();
    for (const msg of data.messages || []) {
      if (renderedRoomIds.has(msg.id)) continue;
      hadNew = true;
      const isMobileUser = msg.role === 'user' && msg.source === 'mobile';
      if (isMobileUser && !processedBotForUserIds.has(msg.id)) {
        processedBotForUserIds.add(msg.id);
        userQueue.push({
          text: msg.content,
          meta: {
            speakerName: msg.speaker_name || 'Visitante',
            speakerId: 'mobile',
            source: 'mobile',
            skipPublish: true,
          },
        });
        renderFromRoom(msg);
        drainUserQueue();
        continue;
      }
      renderFromRoom(msg);
    }
    if (data.last_id) lastRoomId = Math.max(lastRoomId, data.last_id);
  } catch (_err) { /* sin red */ }
  return hadNew;
}

async function initWelcome() {
  const welcome = {
    role: 'assistant',
    speaker_id: 'ana',
    speaker_name: 'Ana',
    content: WELCOME_TEXT,
    source: 'host',
  };
  try {
    const posted = await postRoomMessage(welcome);
    renderFromRoom(posted, { silent: true });
  } catch (_err) {
    appendBubble({
      role: 'assistant',
      speakerId: 'ana',
      speakerName: 'Ana',
      text: WELCOME_TEXT,
    }, { silent: true });
    history.push({
      role: 'assistant',
      speaker: 'ana',
      speaker_name: 'Ana',
      content: WELCOME_TEXT,
    });
  }
}

async function bootstrapRoom() {
  try {
    const res = await fetch(`${API_ROOM}?after=0`);
    if (!res.ok) throw new Error('room');
    const data = await res.json();
    if (!data.messages?.length) {
      await initWelcome();
    } else {
      for (const msg of data.messages) renderFromRoom(msg, { silent: true });
      lastRoomId = data.last_id || 0;
      for (const msg of data.messages) {
        if (msg.role === 'user' && msg.source === 'mobile') {
          processedBotForUserIds.add(msg.id);
        }
      }
    }
  } catch (_err) {
    await initWelcome();
  }
  scheduleRoomSync();
}

function toggleInfo(e) {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }
  if (INFO_PANEL?.classList.contains('drawer--open')) {
    closeInfo();
  } else {
    openInfo();
  }
}

function openInfo() {
  closeTheme();
  INFO_PANEL?.classList.add('drawer--open');
  INFO_BACKDROP?.classList.add('overlay--open');
  INFO_PANEL?.setAttribute('aria-hidden', 'false');
}

function closeInfo() {
  INFO_PANEL?.classList.remove('drawer--open');
  INFO_PANEL?.setAttribute('aria-hidden', 'true');
  if (!THEME_PANEL?.classList.contains('drawer--open')) {
    INFO_BACKDROP?.classList.remove('overlay--open');
  }
}

function toggleTheme(e) {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }
  if (THEME_PANEL?.classList.contains('drawer--open')) {
    closeTheme();
  } else {
    openTheme();
  }
}

function openTheme() {
  closeInfo();
  THEME_PANEL?.classList.add('drawer--open');
  THEME_PANEL?.setAttribute('aria-hidden', 'false');
  INFO_BACKDROP?.classList.add('overlay--open');
}

function closeTheme() {
  THEME_PANEL?.classList.remove('drawer--open');
  THEME_PANEL?.setAttribute('aria-hidden', 'true');
  if (!INFO_PANEL?.classList.contains('drawer--open')) {
    INFO_BACKDROP?.classList.remove('overlay--open');
  }
}

function closeAllPanels() {
  closeInfo();
  closeTheme();
}

function autoResize() {
  INPUT.style.height = 'auto';
  INPUT.style.height = `${Math.min(INPUT.scrollHeight, 120)}px`;
}

FORM.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = INPUT.value;
  INPUT.value = '';
  autoResize();
  sendMessage(text);
});

INPUT.addEventListener('input', autoResize);
INPUT.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); FORM.requestSubmit(); }
});

CHAT_TOGGLE?.addEventListener('change', () => setChatActive(CHAT_TOGGLE.checked));
BTN_INFO?.addEventListener('click', toggleInfo);
BTN_CLOSE_INFO?.addEventListener('click', closeInfo);
BTN_CLOSE_DRAWER?.addEventListener('click', closeInfo);
BTN_THEME?.addEventListener('click', toggleTheme);
BTN_CLOSE_THEME?.addEventListener('click', closeTheme);
INFO_BACKDROP?.addEventListener('click', closeAllPanels);
BTN_SCROLL_BOTTOM?.addEventListener('click', () => scrollToBottom(true));
MESSAGES_EL?.addEventListener('scroll', updateScrollFab, { passive: true });

applyTheme(localStorage.getItem('cyberchat-theme') || 'dark');
renderThemeGrid();

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeAllPanels();
});

document.body.addEventListener('click', () => {
  if (audioCtx?.state === 'suspended') audioCtx.resume();
}, { once: true });

bootstrapRoom();
chatActive = localStorage.getItem('cyberchat-active') === '1';
updateChatToggleUI();
loadPersonas();
loadProviderStatus();
INPUT.focus();
if (chatActive) scheduleAutonomous();
