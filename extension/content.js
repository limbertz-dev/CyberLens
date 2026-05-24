'use strict';

// ─── Configuración ────────────────────────────────────────────────────────────
const API_URL      = 'http://localhost:8000/analyze';
const ANALYZED_ATTR = 'data-risk-analyzed';
const MIN_TEXT_LEN  = 15;       // Ignorar textos muy cortos
const THROTTLE_MS   = 600;      // Tiempo mínimo entre requests del mismo texto

// ─── Configuración visual por categoría ──────────────────────────────────────
const ALERTS = {
  phishing: {
    borderColor: '#dc2626',
    bgColor:     '#fef2f2',
    textColor:   '#991b1b',
    icon:        '⚠',
    label:       'Riesgo de phishing detectado',
  },
  desinformacion: {
    borderColor: '#d97706',
    bgColor:     '#fffbeb',
    textColor:   '#92400e',
    icon:        '⚠',
    label:       'Posible desinformación detectada',
  },
  oversharing: {
    borderColor: '#ea580c',
    bgColor:     '#fff7ed',
    textColor:   '#9a3412',
    icon:        '⚠',
    label:       'Posible exposición de datos personales',
  },
  seguro: {
    borderColor: '#16a34a',
    bgColor:     '#f0fdf4',
    textColor:   '#14532d',
    icon:        '✓',
    label:       'Contenido sin riesgo evidente',
  },
};

// ─── Control de duplicados ────────────────────────────────────────────────────
const recentTexts = new Map();

// ─── Llamada a la API ─────────────────────────────────────────────────────────
async function analyzeText(text) {
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (!response.ok) return null;
    return await response.json();
  } catch (_err) {
    // La API no está disponible — no interrumpir la navegación
    return null;
  }
}

// ─── Inyección del indicador visual ──────────────────────────────────────────
function injectAlert(textElement, result) {
  const config = ALERTS[result.category];
  if (!config) return;

  // Eliminar alerta previa si existe (para re-análisis)
  const prev = textElement.parentElement?.querySelector('[data-risk-alert]');
  if (prev) prev.remove();

  const alertEl = document.createElement('div');
  alertEl.setAttribute('data-risk-alert', result.category);
  alertEl.style.cssText = [
    'display: inline-flex',
    'align-items: center',
    'gap: 6px',
    'margin-top: 8px',
    'padding: 5px 10px',
    'border-radius: 4px',
    `border-left: 3px solid ${config.borderColor}`,
    `background-color: ${config.bgColor}`,
    `color: ${config.textColor}`,
    'font-size: 12px',
    'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    'line-height: 1.4',
    'max-width: 100%',
    'box-sizing: border-box',
    'pointer-events: none',
    'z-index: 9999',
  ].join('; ');

  const pct = Math.round(result.probability * 100);

  alertEl.innerHTML =
    `<span style="font-weight:600">${config.icon} ${config.label}</span>` +
    `<span style="opacity:0.65;font-size:11px">${pct}% confianza</span>`;

  // Insertar justo después del elemento de texto
  textElement.insertAdjacentElement('afterend', alertEl);
}

// ─── Procesamiento de un elemento de texto ────────────────────────────────────
async function processTextElement(textEl) {
  // Evitar reprocesar
  if (textEl.hasAttribute(ANALYZED_ATTR)) return;

  const text = textEl.innerText?.trim();
  if (!text || text.length < MIN_TEXT_LEN) return;

  // Throttle por contenido
  const key = text.slice(0, 60);
  if (recentTexts.has(key)) return;
  recentTexts.set(key, true);
  setTimeout(() => recentTexts.delete(key), THROTTLE_MS);

  // Marcar como "en proceso" para evitar llamadas duplicadas
  textEl.setAttribute(ANALYZED_ATTR, 'pending');

  const result = await analyzeText(text);

  if (!result) {
    // La API falló — quitar el marcador para poder reintentar
    textEl.removeAttribute(ANALYZED_ATTR);
    return;
  }

  textEl.setAttribute(ANALYZED_ATTR, result.category);
  injectAlert(textEl, result);
}

// ─── Escaneo del DOM ──────────────────────────────────────────────────────────
function scanForTweets() {
  // X usa data-testid="tweetText" para el texto de cada publicación
  const selector = `[data-testid="tweetText"]:not([${ANALYZED_ATTR}])`;
  const elements = document.querySelectorAll(selector);
  elements.forEach((el) => {
    // Usar setTimeout(0) para no bloquear el hilo principal
    setTimeout(() => processTextElement(el), 0);
  });
}

// ─── Observer: detecta publicaciones nuevas al hacer scroll ──────────────────
const observer = new MutationObserver((mutations) => {
  let hasNewNodes = false;
  for (const m of mutations) {
    if (m.addedNodes.length > 0) {
      hasNewNodes = true;
      break;
    }
  }
  if (hasNewNodes) scanForTweets();
});

observer.observe(document.body, {
  childList: true,
  subtree:   true,
});

// ─── Escaneo inicial al cargar la página ─────────────────────────────────────
scanForTweets();
