'use strict';

const API_BASE = 'http://localhost:8000';
const CATEGORIES = ['seguro', 'phishing', 'toxicidad', 'oversharing'];
const STORAGE_KEYS = [
  'total', 'seguro', 'phishing', 'toxicidad', 'oversharing',
  'ultima_categoria', 'api_status', 'daily_date', 'daily_total', 'paused',
];

const statusPill   = document.getElementById('statusPill');
const apiText      = document.getElementById('apiText');
const todayCount   = document.getElementById('todayCount');
const emptyState   = document.getElementById('emptyState');
const statsEl      = document.getElementById('stats');
const btnDashboard = document.getElementById('btnDashboard');
const btnRescan    = document.getElementById('btnRescan');
const btnPause     = document.getElementById('btnPause');

let isPaused = false;

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function setPill(state, label) {
  statusPill.className = `pill ${state}`;
  statusPill.textContent = label;
}

function setApiText(text) {
  apiText.textContent = text;
}

function updatePauseButton() {
  const tt = window.i18n ? window.i18n.t : (k) => k;
  if (isPaused) {
    btnPause.textContent = tt('popup.btn.resume');
    btnPause.classList.add('resume');
  } else {
    btnPause.textContent = tt('popup.btn.pause');
    btnPause.classList.remove('resume');
  }
}

function renderStats(data) {
  const today = todayKey();
  const totalToday = data.daily_date === today ? (data.daily_total || 0) : 0;
  todayCount.textContent = totalToday;

  const total = data.total || 0;
  const counts = {
    seguro:      data.seguro      || 0,
    phishing:    data.phishing    || 0,
    toxicidad:   data.toxicidad   || 0,
    oversharing: data.oversharing || 0,
  };

  emptyState.hidden = total > 0;
  statsEl.style.opacity = total > 0 ? '1' : '0.35';

  for (const cat of CATEGORIES) {
    const count = counts[cat];
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
    statsEl.querySelector(`[data-bar="${cat}"]`).style.width  = `${pct}%`;
    statsEl.querySelector(`[data-pct="${cat}"]`).textContent  = `${pct}%`;
    statsEl.querySelector(`[data-count="${cat}"]`).textContent = ` · ${count}`;
  }
}

function tt(key, params) {
  return window.i18n ? window.i18n.t(key, params) : key;
}

function loadCounters() {
  if (!chrome?.storage?.local) {
    renderStats({});
    return;
  }
  chrome.storage.local.get(STORAGE_KEYS, (data) => {
    isPaused = !!data.paused;
    updatePauseButton();
    renderStats(data);

    if (isPaused) {
      setPill('paused', tt('pill.paused'));
      setApiText(tt('api.paused'));
    } else if (data.api_status === 'connected') {
      setPill('active', tt('pill.connected'));
      setApiText(tt('pill.connected'));
    } else if (data.api_status === 'disconnected') {
      setPill('error', tt('pill.disconnected'));
      setApiText(tt('pill.disconnected'));
    }
  });
}

async function pingApi() {
  if (isPaused) return;
  try {
    const res = await fetch(`${API_BASE}/`, { method: 'GET' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    setPill('active', tt('pill.connected'));
    setApiText(tt('api.connected.full', { n: data.samples || 0 }));
    chrome.storage?.local?.set({ api_status: 'connected' });
  } catch (_e) {
    setPill('error', tt('pill.disconnected'));
    setApiText(tt('api.disconnected.hint'));
    chrome.storage?.local?.set({ api_status: 'disconnected' });
  }
}

function withActiveTab(callback) {
  if (!chrome?.tabs?.query) return;
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs && tabs[0];
    if (tab) callback(tab);
  });
}

btnDashboard.addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
});

btnRescan.addEventListener('click', () => {
  withActiveTab((tab) => {
    chrome.tabs.sendMessage(tab.id, { type: 'rescan' }, () => {
      // Ignorar lastError: pestañas internas o sin content script.
      void chrome.runtime.lastError;
    });
  });
});

btnPause.addEventListener('click', () => {
  isPaused = !isPaused;
  updatePauseButton();
  chrome.storage?.local?.set({ paused: isPaused });
  withActiveTab((tab) => {
    chrome.tabs.sendMessage(tab.id, { type: 'setPaused', paused: isPaused }, () => {
      void chrome.runtime.lastError;
    });
  });
  if (isPaused) {
    setPill('paused', tt('pill.paused'));
    setApiText(tt('api.paused'));
  } else {
    pingApi();
  }
});

if (window.i18n) {
  window.i18n.onChange(() => {
    updatePauseButton();
    loadCounters();
  });
}

// Repintar cuando el content script actualice contadores en vivo.
if (chrome?.storage?.onChanged) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    const relevant = STORAGE_KEYS.some((k) => k in changes);
    if (relevant) loadCounters();
  });
}

loadCounters();
pingApi();
