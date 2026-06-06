'use strict';

/**
 * Service worker mínimo: abre la pantalla de bienvenida la primera vez
 * que se instala la extensión. No corre en cada apertura del popup.
 *
 * Para volver a verla durante desarrollo, basta con:
 *   chrome.storage.local.remove(['welcome_seen']) y reinstalar,
 *   o abrir manualmente chrome-extension://<id>/welcome.html
 */

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason !== 'install') return;

  chrome.storage.local.get(['welcome_seen'], (data) => {
    if (data.welcome_seen) return;
    chrome.tabs.create({ url: chrome.runtime.getURL('welcome.html') });
  });
});
