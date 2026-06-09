'use strict';

const DASHBOARD_URL = chrome.runtime.getURL('dashboard.html');

function openDashboard() {
  chrome.tabs.create({ url: DASHBOARD_URL });
}

function setupContextMenus() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'cl-dashboard',
      title: 'Abrir dashboard de estadísticas',
      contexts: ['action'],
    });
    chrome.contextMenus.create({
      id: 'cl-welcome',
      title: 'Guía de inicio',
      contexts: ['action'],
    });
  });
}

chrome.runtime.onInstalled.addListener((details) => {
  setupContextMenus();

  if (details.reason !== 'install') return;

  chrome.storage.local.get(['welcome_seen'], (data) => {
    if (data.welcome_seen) return;
    chrome.tabs.create({ url: chrome.runtime.getURL('welcome.html') });
  });
});

chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId === 'cl-dashboard') openDashboard();
  if (info.menuItemId === 'cl-welcome') {
    chrome.tabs.create({ url: chrome.runtime.getURL('welcome.html') });
  }
});
