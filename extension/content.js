'use strict';

// ─── Configuración ────────────────────────────────────────────────────────────
const API_URL        = 'http://localhost:8000/analyze';
const ANALYZED_ATTR  = 'data-cyberlens-analyzed';
const MIN_TEXT_LEN   = 15;
const MAX_TEXT_LEN   = 2000;
const THROTTLE_MS    = 600;
const MAX_PER_SCAN   = 20;
const SCAN_DRAIN_MS  = 120;

const BRAND_NAME = 'CyberLens';

const EXCLUDED_ANCESTORS = [
  'nav', 'header', 'footer', 'aside', 'script', 'style', 'noscript',
  'button', 'input', 'textarea', 'select', 'label', 'form',
  '[contenteditable="true"]', '[data-cyberlens-wrap]', '.cl-alert',
].join(',');

// Selectores usados en redes, chats y contenido genérico
const TEXT_SELECTORS = [
  '[data-testid="tweetText"]',
  '[data-testid="message-text"]',
  '[data-testid="post-message"]',
  '[data-testid="comment"]',
  '.msg-text',
  '.messageContent',
  '[data-ad-preview="message"]',
  '.feed-shared-update-v2__description',
  'shreddit-post-text',
  '[role="article"] [dir="auto"]',
  '[role="article"] p',
  'article [dir="auto"]',
  'article p',
  'div[dir="auto"]',
  'p',
].join(', ');

// WhatsApp Web: un análisis por burbuja de mensaje (no por cada span suelto)
const WHATSAPP_MSG_SELECTORS = [
  '#main [data-testid="msg-container"]',
  '#main .message-in',
  '#main .message-out',
];

const ALERTS = {
  phishing: {
    iconKey: 'phishing',
    tag:     'PHISHING',
    label:   '¡Alerta de phishing!',
    subtitle: 'Posible estafa o robo de credenciales.',
  },
  toxicidad: {
    iconKey: 'toxicidad',
    tag:     'TOXICIDAD',
    label:   'Contenido tóxico detectado',
    subtitle: 'Lenguaje agresivo, odio o acoso.',
  },
  oversharing: {
    iconKey: 'oversharing',
    tag:     'OVERSHARING',
    label:   'Exposición de datos personales',
    subtitle: 'Información sensible compartida en público.',
  },
  normal: {
    iconKey: 'normal',
    tag:     'SEGURO',
    label:   'Contenido sin riesgo evidente',
    subtitle: 'No se detectaron patrones de riesgo.',
  },
};

const CONFIDENCE_LABELS = {
  alta:     'Confianza alta',
  media:    'Confianza media',
  baja:     'Confianza baja',
  incierta: 'Clasificación incierta',
};

const recentAnchors = new WeakSet();

function isDebugEnabled() {
  try {
    return window.localStorage?.getItem('CyberLensDebug') === '1';
  } catch (_err) {
    return false;
  }
}

function debugLog(event, details = {}) {
  if (!isDebugEnabled()) return;
  console.debug(`[${BRAND_NAME}] ${event}`, details);
}

function emptyScanStats() {
  return {
    matched: 0,
    accepted: 0,
    skipped: {},
    hitLimit: false,
  };
}

function countSkip(stats, reason) {
  stats.skipped[reason] = (stats.skipped[reason] || 0) + 1;
}

function getCandidateIdentity(el) {
  return el.closest(
    'article, [role="article"], [data-testid="cellInnerDiv"], [data-urn], [data-id], [data-message-id]'
  ) || el;
}

function iconHtml(key) {
  if (typeof CyberLensIcons === 'undefined') return '';
  return CyberLensIcons[key] || CyberLensIcons.brand;
}

// ─── Confianza ───────────────────────────────────────────────────────────────
function resolveConfidence(result) {
  const level = result.confidence_level || inferLevel(result.probability, result.margin);
  const pct = Math.round((result.probability || 0) * 100);
  const marginPct = Math.round((result.margin ?? 0) * 100);
  return { level, pct, marginPct, label: CONFIDENCE_LABELS[level] || 'Confianza' };
}

function inferLevel(probability, margin) {
  const p = probability || 0;
  const m = margin ?? 0;
  if (p >= 0.65 && m >= 0.12) return 'alta';
  if (p >= 0.45 && m >= 0.08) return 'media';
  if (p >= 0.28) return 'baja';
  return 'incierta';
}

function confidenceHint(level, marginPct) {
  if (level === 'incierta') return 'El modelo no está seguro — conviene revisar manualmente.';
  if (level === 'baja') return `Diferencia con la 2.ª opción: ${marginPct}%. Alerta preventiva.`;
  if (level === 'media') return `Separación entre clases: ${marginPct}%.`;
  return `Predicción clara (margen ${marginPct}% sobre la 2.ª clase).`;
}

// ─── Detección de bloques de texto (cualquier sitio) ─────────────────────────
function isWhatsAppWeb() {
  return /web\.whatsapp\.com$/i.test(location.hostname);
}

function isWhatsAppMessageBubble(anchor) {
  if (!isWhatsAppWeb()) return false;
  return (
    anchor.getAttribute('data-testid') === 'msg-container' ||
    anchor.classList.contains('message-in') ||
    anchor.classList.contains('message-out')
  );
}

function isInsideComposer(el) {
  return !!el.closest(
    '[contenteditable="true"], [data-lexical-editor="true"], [title="Type a message"]'
  );
}

function isInsideWhatsAppSidebar(el) {
  return !!el.closest('#side, [data-testid="drawer-left"], header');
}

function isExcluded(el) {
  if (!el || !(el instanceof Element)) return true;
  if (el.closest(EXCLUDED_ANCESTORS)) return true;
  if (isInsideComposer(el)) return true;
  if (isWhatsAppWeb() && isInsideWhatsAppSidebar(el)) return true;
  const tag = el.tagName;
  if (tag === 'HTML' || tag === 'BODY' || tag === 'HEAD') return true;
  return false;
}

function isGenericTag(el) {
  const tag = el.tagName;
  return tag === 'P' || (tag === 'DIV' && el.getAttribute('dir') === 'auto');
}

function isLeafTextNode(el, text) {
  const matches = el.querySelectorAll(TEXT_SELECTORS);
  for (const child of matches) {
    if (child === el) continue;
    const childText = child.innerText?.trim();
    if (childText && childText.length >= MIN_TEXT_LEN) {
      if (childText === text || text.startsWith(childText) || childText.startsWith(text)) {
        return false;
      }
    }
  }
  return true;
}

function isValidCandidate(el) {
  if (el.hasAttribute(ANALYZED_ATTR)) {
    debugLog('discarded candidate', { reason: 'already-analyzed' });
    return false;
  }
  if (isExcluded(el)) {
    debugLog('discarded candidate', { reason: 'excluded-ancestor-or-composer' });
    return false;
  }

  const text = el.innerText?.trim();
  if (!text) {
    debugLog('discarded candidate', { reason: 'empty-text' });
    return false;
  }
  if (text.length < MIN_TEXT_LEN) {
    debugLog('discarded candidate', { reason: 'text-too-short', text });
    return false;
  }
  if (text.length > MAX_TEXT_LEN) {
    debugLog('discarded candidate', { reason: 'text-too-long', length: text.length });
    return false;
  }

  if (el.children.length > 12) {
    debugLog('discarded candidate', { reason: 'too-many-children', text: text.slice(0, 120) });
    return false;
  }
  if (!isLeafTextNode(el, text)) {
    debugLog('discarded candidate', { reason: 'not-leaf-text-node', text: text.slice(0, 120) });
    return false;
  }

  // En páginas genéricas, solo párrafos dentro de artículos o dir=auto
  if (isGenericTag(el)) {
    const inArticle = el.closest('article, [role="article"], [role="feed"], main, [role="main"]');
    const hasDirAuto = el.getAttribute('dir') === 'auto' || el.closest('[dir="auto"]');
    const hasPlatformAttr = el.closest('[data-testid], .messageContent, .msg-text');
    if (!inArticle && !hasDirAuto && !hasPlatformAttr) {
      debugLog('discarded candidate', { reason: 'generic-text-outside-content', text: text.slice(0, 120) });
      return false;
    }
  }

  if (isWhatsAppWeb() && !el.closest('#main')) {
    debugLog('discarded candidate', { reason: 'whatsapp-outside-main', text: text.slice(0, 120) });
    return false;
  }

  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
    debugLog('discarded candidate', { reason: 'hidden-by-css', text: text.slice(0, 120) });
    return false;
  }

  return true;
}

function collectTextElements() {
  const seen = new Set();
  const candidates = [];
  const stats = emptyScanStats();

  for (const el of document.querySelectorAll(TEXT_SELECTORS)) {
    stats.matched += 1;
    if (!isValidCandidate(el)) {
      countSkip(stats, 'invalid-candidate');
      continue;
    }

    const key = getCandidateIdentity(el);
    if (seen.has(key)) {
      countSkip(stats, 'duplicate-node-in-scan');
      continue;
    }
    seen.add(key);

    candidates.push(el);
    stats.accepted = candidates.length;
    if (candidates.length >= MAX_PER_SCAN) {
      stats.hitLimit = true;
      break;
    }
  }

  return { candidates, stats };
}

function collectWhatsAppMessages() {
  const seen = new Set();
  const candidates = [];
  const stats = emptyScanStats();

  for (const anchor of document.querySelectorAll(WHATSAPP_MSG_SELECTORS.join(', '))) {
    stats.matched += 1;
    if (anchor.hasAttribute(ANALYZED_ATTR)) {
      countSkip(stats, 'already-analyzed');
      continue;
    }
    if (isInsideComposer(anchor) || isInsideWhatsAppSidebar(anchor)) {
      countSkip(stats, 'excluded-ancestor-or-composer');
      continue;
    }

    const text = anchor.innerText?.trim();
    if (!text) {
      countSkip(stats, 'empty-text');
      continue;
    }
    if (text.length < MIN_TEXT_LEN) {
      countSkip(stats, 'text-too-short');
      continue;
    }
    if (text.length > MAX_TEXT_LEN) {
      countSkip(stats, 'text-too-long');
      continue;
    }

    const key = getCandidateIdentity(anchor);
    if (seen.has(key)) {
      countSkip(stats, 'duplicate-node-in-scan');
      continue;
    }
    seen.add(key);

    candidates.push({ anchor, text });
    stats.accepted = candidates.length;
    if (candidates.length >= MAX_PER_SCAN) {
      stats.hitLimit = true;
      break;
    }
  }

  return { candidates, stats };
}

// ─── API ─────────────────────────────────────────────────────────────────────
async function analyzeText(text) {
  try {
    const response = await fetch(API_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ text }),
    });
    if (!response.ok) {
      debugLog('api error', { status: response.status, text: text.slice(0, 120) });
      return null;
    }
    const result = await response.json();
    debugLog('api result', { category: result.category, text: text.slice(0, 120) });
    return result;
  } catch (err) {
    debugLog('api exception', { message: err.message, text: text.slice(0, 120) });
    return null;
  }
}

// ─── UI ──────────────────────────────────────────────────────────────────────
function buildAlertHTML(category, conf, config) {
  const isRisk = category !== 'normal';
  const riskClass = isRisk ? ' cl-alert--risk' : '';
  const svg = iconHtml(config.iconKey);

  return `
    <div class="cl-alert cl-alert--${category}${riskClass} cl-conf--${conf.level}" data-risk-alert="${category}">
      <div class="cl-alert__header">
        <div class="cl-alert__brand">
          <span class="cl-alert__brand-icon">${CyberLensIcons.brand}</span>
          ${BRAND_NAME}
        </div>
        <span class="cl-alert__badge">${config.tag}</span>
      </div>
      <div class="cl-alert__body">
        <div class="cl-alert__row">
          <div class="cl-alert__icon">${svg}</div>
          <div>
            <p class="cl-alert__title">${config.label}</p>
            <p class="cl-alert__subtitle">${config.subtitle}</p>
          </div>
        </div>
        <div class="cl-alert__confidence">
          <div class="cl-alert__conf-label">
            <span>${conf.label}</span>
            <span class="cl-alert__conf-pct">${conf.pct}%</span>
          </div>
          <div class="cl-alert__bar-track">
            <div class="cl-alert__bar-fill" style="width: ${conf.pct}%"></div>
          </div>
          <p class="cl-alert__conf-hint">${confidenceHint(conf.level, conf.marginPct)}</p>
        </div>
      </div>
    </div>
  `;
}

function buildApiErrorHTML() {
  return `
    <div class="cl-alert cl-alert--loading" data-risk-alert="error">
      <div class="cl-alert__header">
        <div class="cl-alert__brand">
          <span class="cl-alert__brand-icon">${iconHtml('scan')}</span>
          ${BRAND_NAME}
        </div>
        <span class="cl-alert__badge">SIN API</span>
      </div>
      <div class="cl-alert__body">
        <div class="cl-alert__row">
          <div class="cl-alert__icon">${iconHtml('toxicidad')}</div>
          <div>
            <p class="cl-alert__title">Servidor no disponible</p>
            <p class="cl-alert__subtitle">Inicia: uvicorn main:app --reload --port 8000</p>
          </div>
        </div>
      </div>
    </div>
  `;
}

function buildLoadingHTML() {
  return `
    <div class="cl-alert cl-alert--loading cl-loading-bar">
      <div class="cl-alert__header">
        <div class="cl-alert__brand">
          <span class="cl-alert__brand-icon">${CyberLensIcons.brand}</span>
          ${BRAND_NAME}
        </div>
        <span class="cl-alert__badge">ANALIZANDO</span>
      </div>
      <div class="cl-alert__body">
        <div class="cl-alert__row">
          <div class="cl-alert__icon">${iconHtml('scan')}</div>
          <div>
            <p class="cl-alert__title">Escaneando contenido…</p>
            <p class="cl-alert__subtitle">NLP + Machine Learning en proceso</p>
          </div>
        </div>
        <div class="cl-alert__confidence">
          <div class="cl-alert__bar-track">
            <div class="cl-alert__bar-fill"></div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function getAlertContainer(anchor) {
  const isBubble = isWhatsAppMessageBubble(anchor);
  // En burbujas de WhatsApp el wrap va DENTRO del anchor; en el resto, como hermano.
  const container = isBubble ? anchor : anchor.parentElement;

  let wrap = null;
  if (container) {
    const wraps = container.querySelectorAll(':scope > [data-cyberlens-wrap]');
    wraps.forEach((existing, i) => {
      if (i === 0) wrap = existing;
      else existing.remove();
    });
  }

  if (!wrap) {
    wrap = document.createElement('div');
    wrap.setAttribute('data-cyberlens-wrap', '1');
    wrap.style.cssText =
      'width:100%;max-width:min(100%,440px);margin-top:8px;clear:both;position:relative;z-index:99999;';
    if (isBubble) {
      anchor.appendChild(wrap);
    } else {
      anchor.insertAdjacentElement('afterend', wrap);
    }
  }
  return wrap;
}

function injectAlert(textElement, result) {
  const config = ALERTS[result.category];
  if (!config) {
    debugLog('render skipped', { reason: 'unknown-category', result });
    return;
  }
  const wrap = getAlertContainer(textElement);
  wrap.innerHTML = buildAlertHTML(result.category, resolveConfidence(result), config);
  debugLog('rendered alert', { category: result.category, text: textElement.innerText?.trim().slice(0, 120) });
}

function injectLoading(textElement) {
  getAlertContainer(textElement).innerHTML = buildLoadingHTML();
}

async function processAnchor(anchor, text) {
  if (anchor.hasAttribute(ANALYZED_ATTR)) return;
  if (anchor.dataset.riskAnalyzed === 'true') return;
  if (!text || text.length < MIN_TEXT_LEN) return;

  if (recentAnchors.has(anchor)) return;
  recentAnchors.add(anchor);
  setTimeout(() => recentAnchors.delete(anchor), THROTTLE_MS);

  anchor.dataset.riskAnalyzed = 'true';
  anchor.setAttribute(ANALYZED_ATTR, 'pending');
  injectLoading(anchor);

  const result = await analyzeText(text);

  if (!result) {
    anchor.setAttribute(ANALYZED_ATTR, 'api-error');
    getAlertContainer(anchor).innerHTML = buildApiErrorHTML();
    return;
  }

  anchor.setAttribute(ANALYZED_ATTR, result.category);
  injectAlert(anchor, result);
}

async function processTextElement(textEl) {
  const text = textEl.innerText?.trim();
  await processAnchor(textEl, text);
}

function scanForContent() {
  if (isWhatsAppWeb()) {
    const { candidates, stats } = collectWhatsAppMessages();
    debugLog('scan result', { mode: 'whatsapp', ...stats, rendering: candidates.length });
    candidates.forEach(({ anchor, text }) => {
      setTimeout(() => processAnchor(anchor, text), 0);
    });
    return stats.hitLimit;
  }

  const { candidates, stats } = collectTextElements();
  debugLog('scan result', { mode: 'generic', ...stats, rendering: candidates.length });
  candidates.forEach((el) => {
    setTimeout(() => processTextElement(el), 0);
  });
  return stats.hitLimit;
}

let scanScheduled = false;
function scheduleScan() {
  if (scanScheduled) return;
  scanScheduled = true;
  requestAnimationFrame(() => {
    scanScheduled = false;
    const shouldContinue = scanForContent();
    if (shouldContinue) {
      setTimeout(scheduleScan, SCAN_DRAIN_MS);
    }
  });
}

function isOwnAlertNode(node) {
  if (!node) return false;
  const el = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
  if (!el || typeof el.closest !== 'function') return false;
  if (el.classList && el.classList.contains('cl-alert')) return true;
  return !!el.closest('[data-cyberlens-wrap], .cl-alert');
}

const observer = new MutationObserver((mutations) => {
  const hasUserContent = mutations.some((m) =>
    Array.from(m.addedNodes).some((node) => !isOwnAlertNode(node))
  );
  if (hasUserContent) scheduleScan();
});

observer.observe(document.body, { childList: true, subtree: true });
scheduleScan();
