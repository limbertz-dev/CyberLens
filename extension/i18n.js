'use strict';

/**
 * CyberLens i18n
 * ──────────────
 * Cambia los textos de la INTERFAZ entre español e inglés.
 * El MODELO sigue siendo en español: este selector no traduce el análisis,
 * solo la UI.
 *
 * Uso en HTML:
 *   <span data-i18n="popup.btn.rescan"></span>
 *
 * Uso en JS:
 *   i18n.t('dashboard.risk.reason', { risky: 9, total: 24, pct: 37 });
 *   i18n.onChange(() => rerender());
 *   i18n.setLang('en');
 */

(function () {
  const MESSAGES = {
    es: {
      // Idioma
      'lang.es': 'ES',
      'lang.en': 'EN',
      'lang.toggle.title': 'Cambiar idioma de la interfaz',

      // Categorías
      'cat.seguro': 'Seguro',
      'cat.normal': 'Normal',
      'cat.phishing': 'Phishing',
      'cat.toxicidad': 'Toxicidad',
      'cat.oversharing': 'Oversharing',

      // Nivel de riesgo
      'risk.label': 'Riesgo',
      'risk.low': 'Bajo',
      'risk.medium': 'Medio',
      'risk.high': 'Alto',
      'risk.none': '—',

      // Estado API
      'pill.checking':     'Comprobando…',
      'pill.connected':    'Conectada',
      'pill.disconnected': 'Sin conexión',
      'pill.paused':       'En pausa',
      'pill.updating':     'Actualizando…',
      'api.connected.full':  'OK · {n} ejemplos',
      'api.disconnected.hint':'Inicia uvicorn:8000',
      'api.paused':          'Pausado',

      // Tiempo relativo
      'time.now':      'ahora',
      'time.minAgo':   'hace {n} min',
      'time.hourAgo':  'hace {n} h',
      'time.dayAgo':   'hace {n} d',

      // ── Popup ──────────────────────────────────────────────────────
      'popup.api':                  'API',
      'popup.todayCount':           'Analizados hoy',
      'popup.section.distribution': 'Distribución de riesgos',
      'popup.empty.title':          'Aún no se han analizado mensajes.',
      'popup.empty.hint':           'Abre WhatsApp Web, X u otro sitio para empezar.',
      'popup.btn.dashboard':        'Ver dashboard',
      'popup.btn.rescan':           'Reanalizar página',
      'popup.btn.pause':            'Pausar análisis',
      'popup.btn.resume':           'Reanudar análisis',
      'popup.footer.text':          'Análisis local · <strong>solo contadores</strong>, nunca el contenido de tus mensajes.',
      'popup.about':                'Acerca de CyberLens',

      // ── Dashboard ──────────────────────────────────────────────────
      'dashboard.title':            'Dashboard',
      'dashboard.totalPill':        '{n} análisis',
      'dashboard.btn.refresh':      'Actualizar',

      'dashboard.sidebar.tag':      'Risk NLP',
      'dashboard.sidebar.note':     'Análisis <strong>100% local</strong>.<br />Solo se guardan contadores y etiquetas, nunca el contenido de tus mensajes.',
      'dashboard.nav.overview':     'Resumen',
      'dashboard.nav.model':        'Modelo NLP',
      'dashboard.nav.pipeline':     'Pipeline',
      'dashboard.header.title':     'Dashboard',
      'dashboard.header.subtitle':  'Riesgos digitales · NLP + Machine Learning',

      'dashboard.kpi.total':            'Total analizados',
      'dashboard.kpi.total.sub':        'en este navegador',
      'dashboard.kpi.risky':            'Riesgosos',
      'dashboard.kpi.risky.sub':        'phishing · toxicidad · oversharing',
      'dashboard.kpi.risky.pct':        '{pct}% del total',
      'dashboard.kpi.safe':             'Seguros',
      'dashboard.kpi.safe.sub':         'sin patrón de riesgo',
      'dashboard.kpi.confidence':       'Confianza promedio',
      'dashboard.kpi.confidence.sub':   'predicción del modelo',
      'dashboard.kpi.dominant':         'Categoría dominante',
      'dashboard.kpi.dominant.empty':   'sin datos aún',
      'dashboard.kpi.dominant.sub':     '{n} casos · {pct}% del total',

      'dashboard.section.training':       'Entrenamiento del modelo NLP',
      'dashboard.section.config':         'Configuración del modelo',
      'dashboard.section.topTerms':       'Términos más influyentes por categoría',
      'dashboard.section.topTerms.note':  '(coeficientes del modelo)',
      'dashboard.section.pipeline.flow':  'Texto original → limpieza → tokens → TF-IDF → modelo → predicción',
      'dashboard.config.vectorizer':      'Vectorizador',
      'dashboard.config.maxFeatures':     'max_features',
      'dashboard.config.ngram':           'ngram_range',
      'dashboard.config.classifier':      'Clasificador',
      'dashboard.loading.topTerms':       'Cargando términos…',
      'dashboard.empty.topTerms':         'Sin términos disponibles.',

      'dashboard.section.riskLevel':   'Nivel de riesgo general',
      'dashboard.section.distribution':'Distribución de riesgos',
      'dashboard.section.confidence':  'Confianza promedio',
      'dashboard.section.session':     'Riesgos detectados por sesión',
      'dashboard.section.session.note':'(últimos 30 análisis)',
      'dashboard.section.recent':      'Últimas categorías',
      'dashboard.section.modelDivider':'Modelo & Pipeline NLP',
      'dashboard.section.pipeline':    'Pipeline NLP',
      'dashboard.section.accuracy':    'Precisión del modelo',
      'dashboard.section.dataset':     'Ejemplos por categoría',
      'dashboard.section.perClassConf':'Confianza por categoría',
      'dashboard.section.cm':          'Matriz de confusión',
      'dashboard.section.cm.note':     '(validación cruzada 5-fold)',

      'dashboard.donutCenter.label':  'analizados',
      'dashboard.conf.modelLabel':    'Modelo Logistic Regression',
      'dashboard.session.total':      'En sesión',
      'dashboard.session.risky':      'Riesgosos',
      'dashboard.session.safe':       'Seguros',
      'dashboard.accuracy.label':     'Accuracy (5-fold CV)',
      'dashboard.accuracy.macroF1':   'Macro F1',
      'dashboard.accuracy.samples':   'Ejemplos',
      'dashboard.accuracy.features':  'Features',

      'dashboard.empty.risk':       'Aún no se han analizado mensajes.',
      'dashboard.empty.riskHint':   'Abre WhatsApp Web, X u otra red social para empezar a recolectar datos.',
      'dashboard.empty.session':    'Sin análisis recientes en esta sesión.',
      'dashboard.empty.chips':      'Las últimas categorías aparecerán aquí.',
      'dashboard.loading.dataset':  'Cargando dataset…',
      'dashboard.loading.metrics':  'Cargando métricas…',
      'dashboard.loading.cm':       'Cargando matriz…',

      'dashboard.risk.reason':      '{risky} de {total} textos analizados fueron marcados como riesgosos ({pct}%).',
      'dashboard.risk.hint.high':   'Revisa qué cuentas o sitios estás visitando — predominan mensajes sospechosos.',
      'dashboard.risk.hint.medium': 'Hay una cantidad relevante de contenido riesgoso. Mantente atento a phishing y toxicidad.',
      'dashboard.risk.hint.low':    'La mayor parte del contenido detectado parece seguro. Buen entorno digital por ahora.',

      'dashboard.conf.empty':  'Sin datos todavía.',
      'dashboard.conf.high':   'Promedio sobre {n} análisis. El modelo está clasificando con seguridad.',
      'dashboard.conf.medium': 'Promedio sobre {n} análisis. Confianza moderada.',
      'dashboard.conf.low':    'Promedio sobre {n} análisis. Conviene revisar manualmente los resultados.',

      'dashboard.cm.hint':     'Las filas representan la <strong>etiqueta real</strong>, las columnas la <strong>predicción del modelo</strong>. La diagonal (resaltada) muestra los aciertos.',
      'dashboard.cm.axis.real':'Real ↓',
      'dashboard.cm.axis.pred':'Predicción →',
      'dashboard.error.noApi': 'API sin conexión — inicia uvicorn:8000 para ver métricas.',

      'dashboard.pipe.1.title': 'Texto original', 'dashboard.pipe.1.sub': 'Entrada cruda del usuario',
      'dashboard.pipe.2.title': 'Texto limpio',   'dashboard.pipe.2.sub': 'Normalización a minúsculas',
      'dashboard.pipe.3.title': 'Tokens',         'dashboard.pipe.3.sub': 'NLTK · sin puntuación · sin stopwords',
      'dashboard.pipe.4.title': 'Vector TF-IDF',  'dashboard.pipe.4.sub': '1-gram + 2-gram · 1000 features',
      'dashboard.pipe.5.title': 'Modelo ML',      'dashboard.pipe.5.sub': 'Logistic Regression (sklearn)',
      'dashboard.pipe.6.title': 'Predicción',     'dashboard.pipe.6.sub': 'Categoría + confianza',

      'dashboard.footer.text':  'CyberLens · análisis local de riesgos en redes sociales.<br />Solo se guardan <strong>contadores y etiquetas</strong>, nunca el contenido de tus mensajes.',

      // ── Welcome ────────────────────────────────────────────────────
      'welcome.title':       'Bienvenido a CyberLens',
      'welcome.subtitle':    'Análisis local de riesgos digitales con NLP y Machine Learning.',
      'welcome.intro':       'CyberLens te ayuda a:',
      'welcome.feat.1':      'Detectar posibles riesgos digitales',
      'welcome.feat.1.sub':  'Phishing, toxicidad, oversharing y contenido normal.',
      'welcome.feat.2':      'Visualizar estadísticas de navegación segura',
      'welcome.feat.2.sub':  'Dashboard con distribución de riesgos y confianza del modelo.',
      'welcome.feat.3':      'Entender cómo el texto es procesado con NLP',
      'welcome.feat.3.sub':  'Pipeline visible paso a paso: tokens, TF-IDF, predicción.',
      'welcome.feat.4':      'Recibir alertas sin guardar tus publicaciones',
      'welcome.feat.4.sub':  'Solo se guardan contadores y etiquetas — el contenido nunca sale de tu navegador.',
      'welcome.cta.start':       'Comenzar',
      'welcome.cta.dashboard':   'Ver dashboard',
      'welcome.lang.hint':       'Elige tu idioma de interfaz',
      'welcome.api.title':       'Estado del servidor',
      'welcome.api.checking':    'Comprobando conexión con localhost:8000…',
      'welcome.api.ok':          'API conectada — {n} ejemplos cargados.',
      'welcome.api.fail':        'No detectamos el servidor. Inicia uvicorn antes de usar la extensión:',
      'welcome.footer':          'Proyecto académico SIS-351 · análisis 100% local.',
    },

    en: {
      'lang.es': 'ES',
      'lang.en': 'EN',
      'lang.toggle.title': 'Switch interface language',

      'cat.seguro': 'Safe',
      'cat.normal': 'Normal',
      'cat.phishing': 'Phishing',
      'cat.toxicidad': 'Toxicity',
      'cat.oversharing': 'Oversharing',

      'risk.label': 'Risk',
      'risk.low': 'Low',
      'risk.medium': 'Medium',
      'risk.high': 'High',
      'risk.none': '—',

      'pill.checking':     'Checking…',
      'pill.connected':    'Connected',
      'pill.disconnected': 'Offline',
      'pill.paused':       'Paused',
      'pill.updating':     'Updating…',
      'api.connected.full':  'OK · {n} samples',
      'api.disconnected.hint':'Start uvicorn:8000',
      'api.paused':          'Paused',

      'time.now':      'now',
      'time.minAgo':   '{n} min ago',
      'time.hourAgo':  '{n}h ago',
      'time.dayAgo':   '{n}d ago',

      // ── Popup ──
      'popup.api':                  'API',
      'popup.todayCount':           'Analyzed today',
      'popup.section.distribution': 'Risk distribution',
      'popup.empty.title':          'No messages analyzed yet.',
      'popup.empty.hint':           'Open WhatsApp Web, X or another site to start.',
      'popup.btn.dashboard':        'Open dashboard',
      'popup.btn.rescan':           'Rescan page',
      'popup.btn.pause':            'Pause analysis',
      'popup.btn.resume':           'Resume analysis',
      'popup.footer.text':          'Local analysis · <strong>counters only</strong>, never the content of your messages.',
      'popup.about':                'About CyberLens',

      // ── Dashboard ──
      'dashboard.title':            'Dashboard',
      'dashboard.totalPill':        '{n} analyses',
      'dashboard.btn.refresh':      'Refresh',

      'dashboard.sidebar.tag':      'Risk NLP',
      'dashboard.sidebar.note':     '<strong>100% local</strong> analysis.<br />Only counters and labels are stored, never the content of your messages.',
      'dashboard.nav.overview':     'Overview',
      'dashboard.nav.model':        'NLP Model',
      'dashboard.nav.pipeline':     'Pipeline',
      'dashboard.header.title':     'Dashboard',
      'dashboard.header.subtitle':  'Digital risks · NLP + Machine Learning',

      'dashboard.kpi.total':            'Total analyzed',
      'dashboard.kpi.total.sub':        'in this browser',
      'dashboard.kpi.risky':            'Risky',
      'dashboard.kpi.risky.sub':        'phishing · toxicity · oversharing',
      'dashboard.kpi.risky.pct':        '{pct}% of total',
      'dashboard.kpi.safe':             'Safe',
      'dashboard.kpi.safe.sub':         'no risk pattern',
      'dashboard.kpi.confidence':       'Average confidence',
      'dashboard.kpi.confidence.sub':   'model prediction',
      'dashboard.kpi.dominant':         'Dominant category',
      'dashboard.kpi.dominant.empty':   'no data yet',
      'dashboard.kpi.dominant.sub':     '{n} cases · {pct}% of total',

      'dashboard.section.training':       'NLP model training',
      'dashboard.section.config':         'Model configuration',
      'dashboard.section.topTerms':       'Most influential terms per category',
      'dashboard.section.topTerms.note':  '(model coefficients)',
      'dashboard.section.pipeline.flow':  'Raw text → cleaning → tokens → TF-IDF → model → prediction',
      'dashboard.config.vectorizer':      'Vectorizer',
      'dashboard.config.maxFeatures':     'max_features',
      'dashboard.config.ngram':           'ngram_range',
      'dashboard.config.classifier':      'Classifier',
      'dashboard.loading.topTerms':       'Loading terms…',
      'dashboard.empty.topTerms':         'No terms available.',

      'dashboard.section.riskLevel':   'Overall risk level',
      'dashboard.section.distribution':'Risk distribution',
      'dashboard.section.confidence':  'Average confidence',
      'dashboard.section.session':     'Risks detected in session',
      'dashboard.section.session.note':'(last 30 analyses)',
      'dashboard.section.recent':      'Recent categories',
      'dashboard.section.modelDivider':'Model & NLP Pipeline',
      'dashboard.section.pipeline':    'NLP Pipeline',
      'dashboard.section.accuracy':    'Model accuracy',
      'dashboard.section.dataset':     'Samples per category',
      'dashboard.section.perClassConf':'Confidence per category',
      'dashboard.section.cm':          'Confusion matrix',
      'dashboard.section.cm.note':     '(5-fold cross-validation)',

      'dashboard.donutCenter.label':  'analyzed',
      'dashboard.conf.modelLabel':    'Logistic Regression model',
      'dashboard.session.total':      'In session',
      'dashboard.session.risky':      'Risky',
      'dashboard.session.safe':       'Safe',
      'dashboard.accuracy.label':     'Accuracy (5-fold CV)',
      'dashboard.accuracy.macroF1':   'Macro F1',
      'dashboard.accuracy.samples':   'Samples',
      'dashboard.accuracy.features':  'Features',

      'dashboard.empty.risk':       'No messages analyzed yet.',
      'dashboard.empty.riskHint':   'Open WhatsApp Web, X or another social site to start collecting data.',
      'dashboard.empty.session':    'No recent analyses in this session.',
      'dashboard.empty.chips':      'Recent categories will appear here.',
      'dashboard.loading.dataset':  'Loading dataset…',
      'dashboard.loading.metrics':  'Loading metrics…',
      'dashboard.loading.cm':       'Loading matrix…',

      'dashboard.risk.reason':      '{risky} of {total} analyzed texts were flagged as risky ({pct}%).',
      'dashboard.risk.hint.high':   'Review which accounts or sites you visit — suspicious messages dominate.',
      'dashboard.risk.hint.medium': 'There is a relevant amount of risky content. Stay alert for phishing and toxicity.',
      'dashboard.risk.hint.low':    'Most detected content looks safe. Good digital environment so far.',

      'dashboard.conf.empty':  'No data yet.',
      'dashboard.conf.high':   'Average over {n} analyses. The model is classifying confidently.',
      'dashboard.conf.medium': 'Average over {n} analyses. Moderate confidence.',
      'dashboard.conf.low':    'Average over {n} analyses. Consider reviewing results manually.',

      'dashboard.cm.hint':     'Rows represent the <strong>actual label</strong>, columns the <strong>model prediction</strong>. The diagonal (highlighted) shows correct hits.',
      'dashboard.cm.axis.real':'Actual ↓',
      'dashboard.cm.axis.pred':'Predicted →',
      'dashboard.error.noApi': 'API offline — start uvicorn:8000 to see metrics.',

      'dashboard.pipe.1.title': 'Raw text',         'dashboard.pipe.1.sub': 'Raw user input',
      'dashboard.pipe.2.title': 'Normalized text',  'dashboard.pipe.2.sub': 'Lowercase normalization',
      'dashboard.pipe.3.title': 'Tokens',           'dashboard.pipe.3.sub': 'NLTK · no punctuation · no stopwords',
      'dashboard.pipe.4.title': 'TF-IDF vector',    'dashboard.pipe.4.sub': '1-gram + 2-gram · 1000 features',
      'dashboard.pipe.5.title': 'ML Model',         'dashboard.pipe.5.sub': 'Logistic Regression (sklearn)',
      'dashboard.pipe.6.title': 'Prediction',       'dashboard.pipe.6.sub': 'Category + confidence',

      'dashboard.footer.text':  'CyberLens · local analysis of risks on social media.<br />Only <strong>counters and labels</strong> are stored, never the content of your messages.',

      // ── Welcome ──
      'welcome.title':       'Welcome to CyberLens',
      'welcome.subtitle':    'Local analysis of digital risks with NLP and Machine Learning.',
      'welcome.intro':       'CyberLens helps you to:',
      'welcome.feat.1':      'Detect potential digital risks',
      'welcome.feat.1.sub':  'Phishing, toxicity, oversharing and normal content.',
      'welcome.feat.2':      'Visualize safe-browsing statistics',
      'welcome.feat.2.sub':  'Dashboard with risk distribution and model confidence.',
      'welcome.feat.3':      'Understand how text is processed with NLP',
      'welcome.feat.3.sub':  'Visible pipeline step by step: tokens, TF-IDF, prediction.',
      'welcome.feat.4':      'Get alerts without storing your posts',
      'welcome.feat.4.sub':  'Only counters and labels are stored — content never leaves your browser.',
      'welcome.cta.start':       'Get started',
      'welcome.cta.dashboard':   'Open dashboard',
      'welcome.lang.hint':       'Choose your interface language',
      'welcome.api.title':       'Server status',
      'welcome.api.checking':    'Checking connection to localhost:8000…',
      'welcome.api.ok':          'API connected — {n} samples loaded.',
      'welcome.api.fail':        'Server not detected. Start uvicorn before using the extension:',
      'welcome.footer':          'Academic project SIS-351 · 100% local analysis.',
    },
  };

  const DEFAULT_LANG = 'es';
  const VALID = new Set(['es', 'en']);
  let currentLang = DEFAULT_LANG;
  const subscribers = [];

  function t(key, params) {
    const dict = MESSAGES[currentLang] || MESSAGES[DEFAULT_LANG];
    const fallback = MESSAGES[DEFAULT_LANG];
    let str = dict[key];
    if (str == null) str = fallback[key];
    if (str == null) return key;
    if (params) {
      for (const k of Object.keys(params)) {
        str = str.split(`{${k}}`).join(String(params[k]));
      }
    }
    return str;
  }

  function applyI18n(root) {
    root = root || document;
    root.querySelectorAll('[data-i18n]').forEach((el) => {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
    root.querySelectorAll('[data-i18n-html]').forEach((el) => {
      el.innerHTML = t(el.getAttribute('data-i18n-html'));
    });
    root.querySelectorAll('[data-i18n-attr]').forEach((el) => {
      const spec = el.getAttribute('data-i18n-attr') || '';
      spec.split(',').forEach((pair) => {
        const [attr, key] = pair.split(':').map((s) => s && s.trim());
        if (attr && key) el.setAttribute(attr, t(key));
      });
    });
    document.documentElement.lang = currentLang;
    root.querySelectorAll('[data-lang-btn]').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-lang-btn') === currentLang);
    });
  }

  function notify() {
    for (const fn of subscribers) {
      try { fn(currentLang); } catch (_e) { /* ignore */ }
    }
  }

  function setLang(lang) {
    if (!VALID.has(lang) || lang === currentLang) return;
    currentLang = lang;
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ lang });
    }
    applyI18n();
    notify();
  }

  function onChange(fn) {
    if (typeof fn === 'function') subscribers.push(fn);
  }

  function init() {
    applyI18n(); // Aplica el idioma por defecto inmediatamente.

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['lang'], (data) => {
        if (VALID.has(data.lang) && data.lang !== currentLang) {
          currentLang = data.lang;
          applyI18n();
          notify();
        }
      });
      if (chrome.storage.onChanged) {
        chrome.storage.onChanged.addListener((changes, area) => {
          if (area !== 'local' || !changes.lang) return;
          const newLang = changes.lang.newValue;
          if (VALID.has(newLang) && newLang !== currentLang) {
            currentLang = newLang;
            applyI18n();
            notify();
          }
        });
      }
    }

    document.addEventListener('click', (e) => {
      const btn = e.target.closest && e.target.closest('[data-lang-btn]');
      if (!btn) return;
      setLang(btn.getAttribute('data-lang-btn'));
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.i18n = {
    t,
    getLang: () => currentLang,
    setLang,
    onChange,
    applyI18n,
  };
})();
