'use strict';

const API_BASE = 'http://localhost:8000';
const $ = (id) => document.getElementById(id);
const tt = (k, p) => (window.i18n ? window.i18n.t(k, p) : k);

const apiStatus     = $('apiStatus');
const apiStatusText = $('apiStatusText');
const apiCmd        = $('apiCmd');
const btnStart      = $('btnStart');
const btnDashboard  = $('btnDashboard');

let lastApiState = 'checking';
let lastSamples  = 0;

function applyApiText() {
  if (lastApiState === 'ok') {
    apiStatusText.textContent = tt('welcome.api.ok', { n: lastSamples });
  } else if (lastApiState === 'fail') {
    apiStatusText.textContent = tt('welcome.api.fail');
  } else {
    apiStatusText.textContent = tt('welcome.api.checking');
  }
}

async function checkApi() {
  apiStatus.setAttribute('data-state', 'checking');
  lastApiState = 'checking';
  applyApiText();
  apiCmd.hidden = true;

  try {
    const res = await fetch(`${API_BASE}/`, { method: 'GET' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    lastSamples = data.samples || 0;
    lastApiState = 'ok';
    apiStatus.setAttribute('data-state', 'ok');
    apiCmd.hidden = true;
  } catch (_err) {
    lastApiState = 'fail';
    apiStatus.setAttribute('data-state', 'fail');
    apiCmd.hidden = false;
  }
  applyApiText();
}

function markSeen() {
  if (chrome?.storage?.local) {
    chrome.storage.local.set({ welcome_seen: true });
  }
}

btnStart.addEventListener('click', () => {
  markSeen();
  if (chrome?.tabs?.getCurrent && chrome?.tabs?.remove) {
    chrome.tabs.getCurrent((tab) => {
      if (tab?.id) chrome.tabs.remove(tab.id);
      else window.close();
    });
  } else {
    window.close();
  }
});

btnDashboard.addEventListener('click', () => {
  markSeen();
  // Dashboard se abre en pestaña nueva: el usuario aún puede volver a la bienvenida.
  if (chrome?.tabs?.create) {
    chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
  } else {
    window.open('dashboard.html', '_blank');
  }
});

if (window.i18n) {
  window.i18n.onChange(applyApiText);
}

checkApi();
