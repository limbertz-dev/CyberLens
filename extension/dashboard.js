'use strict';

const API_BASE = 'http://localhost:8000';
const chromeApi = typeof chrome !== 'undefined' ? chrome : null;

const CATEGORIES = [
  { key: 'seguro',      i18n: 'cat.seguro',      color: '#20c9a8', risky: false },
  { key: 'phishing',    i18n: 'cat.phishing',    color: '#ef5350', risky: true  },
  { key: 'toxicidad',   i18n: 'cat.toxicidad',   color: '#c4a2ff', risky: true  },
  { key: 'oversharing', i18n: 'cat.oversharing', color: '#ffb86b', risky: true  },
];

const STORAGE_KEYS = [
  'total', 'seguro', 'phishing', 'toxicidad', 'oversharing',
  'ultima_categoria', 'api_status', 'paused',
  'daily_date', 'daily_total', 'daily_risky',
  'prob_sum', 'prob_count', 'recent_categories', 'site_stats',
];
const STATS_KEYS = STORAGE_KEYS.filter((key) => !['api_status', 'paused'].includes(key));

const $ = (id) => document.getElementById(id);
const tt = (key, params) => (window.i18n ? window.i18n.t(key, params) : key);
const catName = (cat) => tt(cat.i18n || `cat.${cat.key}`);

const els = {
  statusPill: $('statusPill'),
  totalPill: $('totalPill'),
  btnRefresh: $('btnRefresh'),
  btnClearStats: $('btnClearStats'),
  riskBadge: $('riskBadge'),
  riskLevel: $('riskLevel'),
  riskReason: $('riskReason'),
  riskHint: $('riskHint'),
  donut: $('donut'),
  donutTotal: $('donutTotal'),
  legend: $('legend'),
  confValue: $('confValue'),
  confFill: $('confFill'),
  confHint: $('confHint'),
  spark: $('spark'),
  sessTotal: $('sessTotal'),
  sessRisky: $('sessRisky'),
  sessSafe: $('sessSafe'),
  chips: $('chips'),
  siteList: $('siteList'),
  siteDetail: $('siteDetail'),
  kpiTotal: $('kpiTotal'),
  kpiRisky: $('kpiRisky'),
  kpiRiskyPct: $('kpiRiskyPct'),
  kpiSafe: $('kpiSafe'),
  kpiConfidence: $('kpiConfidence'),
  kpiDominant: $('kpiDominant'),
  kpiDominantSub: $('kpiDominantSub'),
};

let activeSiteKey = '__global__';
let lastModelStats = null;

function setPill(state, label) {
  els.statusPill.className = `pill ${state}`;
  els.statusPill.textContent = label;
}

function relativeTime(ts) {
  if (!ts) return '';
  const sec = Math.round((Date.now() - ts) / 1000);
  if (sec < 45) return tt('time.now');
  const min = Math.round(sec / 60);
  if (min < 60) return tt('time.minAgo', { n: min });
  const hr = Math.round(min / 60);
  if (hr < 24) return tt('time.hourAgo', { n: hr });
  return tt('time.dayAgo', { n: Math.round(hr / 24) });
}

function countsFrom(data) {
  return {
    seguro: data.seguro || 0,
    phishing: data.phishing || 0,
    toxicidad: data.toxicidad || 0,
    oversharing: data.oversharing || 0,
  };
}

function riskyCount(counts) {
  return counts.phishing + counts.toxicidad + counts.oversharing;
}

function riskInfo(risky, total) {
  if (!total) {
    return {
      cls: 'sin',
      level: tt('risk.none'),
      reason: tt('dashboard.empty.risk'),
      hint: tt('dashboard.empty.riskHint'),
    };
  }
  const pct = Math.round((risky / total) * 100);
  const reason = tt('dashboard.risk.reason', { risky, total, pct });
  if (pct >= 40) return { cls: 'alto', level: tt('risk.high'), reason, hint: tt('dashboard.risk.hint.high') };
  if (pct >= 15) return { cls: 'medio', level: tt('risk.medium'), reason, hint: tt('dashboard.risk.hint.medium') };
  return { cls: 'bajo', level: tt('risk.low'), reason, hint: tt('dashboard.risk.hint.low') };
}

function renderKpis(counts, total, risky, probSum, probCount) {
  els.kpiTotal.textContent = total;
  els.kpiRisky.textContent = risky;
  els.kpiSafe.textContent = counts.seguro;
  els.kpiRiskyPct.textContent = total
    ? tt('dashboard.kpi.risky.pct', { pct: Math.round((risky / total) * 100) })
    : tt('dashboard.kpi.risky.sub');
  els.kpiConfidence.textContent = probCount ? `${Math.round((probSum / probCount) * 100)}%` : '—';

  let dominant = null;
  for (const cat of CATEGORIES) {
    const count = counts[cat.key] || 0;
    if (!dominant || count > dominant.count) dominant = { ...cat, count };
  }
  if (dominant && dominant.count > 0) {
    els.kpiDominant.textContent = catName(dominant);
    els.kpiDominant.style.color = dominant.color;
    els.kpiDominantSub.textContent = tt('dashboard.kpi.dominant.sub', {
      n: dominant.count,
      pct: Math.round((dominant.count / total) * 100),
    });
  } else {
    els.kpiDominant.textContent = '—';
    els.kpiDominant.style.color = '';
    els.kpiDominantSub.textContent = tt('dashboard.kpi.dominant.empty');
  }
}

function renderDonut(counts, total) {
  const svg = els.donut;
  while (svg.firstChild) svg.removeChild(svg.firstChild);
  els.donutTotal.textContent = total || 0;

  const cx = 90;
  const cy = 90;
  const outer = 78;
  const inner = 52;
  const polar = (r, a) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  const pathFor = (start, end) => {
    const large = end - start > Math.PI ? 1 : 0;
    const [x1, y1] = polar(outer, start);
    const [x2, y2] = polar(outer, end);
    const [x3, y3] = polar(inner, end);
    const [x4, y4] = polar(inner, start);
    return `M ${x1} ${y1} A ${outer} ${outer} 0 ${large} 1 ${x2} ${y2} L ${x3} ${y3} A ${inner} ${inner} 0 ${large} 0 ${x4} ${y4} Z`;
  };

  if (!total) {
    const ring = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    ring.setAttribute('cx', cx);
    ring.setAttribute('cy', cy);
    ring.setAttribute('r', 65);
    ring.setAttribute('fill', 'none');
    ring.setAttribute('stroke', 'rgba(255,255,255,0.16)');
    ring.setAttribute('stroke-width', '26');
    ring.setAttribute('stroke-dasharray', '4 8');
    svg.appendChild(ring);
    return;
  }

  let start = -Math.PI / 2;
  for (const cat of CATEGORIES) {
    const value = counts[cat.key] || 0;
    if (!value) continue;
    const end = start + (value / total) * Math.PI * 2;
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', pathFor(start, end));
    path.setAttribute('fill', cat.color);
    path.setAttribute('opacity', '0.92');
    svg.appendChild(path);
    start = end;
  }
}

function renderLegend(counts, total) {
  els.legend.innerHTML = '';
  for (const cat of CATEGORIES) {
    const count = counts[cat.key] || 0;
    const pct = total ? Math.round((count / total) * 100) : 0;
    const row = document.createElement('div');
    row.className = 'row';
    row.innerHTML = `
      <span class="dot" style="background:${cat.color}"></span>
      <span class="name">${catName(cat)}</span>
      <span class="pct">${pct}%</span>
      <span class="count">· ${count}</span>
    `;
    els.legend.appendChild(row);
  }
}

function renderConfidence(probSum, probCount) {
  if (!probCount) {
    els.confValue.textContent = '—';
    els.confFill.style.width = '0%';
    els.confHint.textContent = tt('dashboard.conf.empty');
    return;
  }
  const pct = Math.round((probSum / probCount) * 100);
  els.confValue.textContent = `${pct}%`;
  els.confFill.style.width = `${pct}%`;
  const key = pct >= 70 ? 'dashboard.conf.high' : pct >= 50 ? 'dashboard.conf.medium' : 'dashboard.conf.low';
  els.confHint.textContent = tt(key, { n: probCount });
}

function renderSpark(recent) {
  els.spark.innerHTML = '';
  if (!recent.length) {
    els.spark.innerHTML = `<div class="spark__empty">${tt('dashboard.empty.session')}</div>`;
    els.sessTotal.textContent = '0';
    els.sessRisky.textContent = '0';
    els.sessSafe.textContent = '0';
    return;
  }
  let risky = 0;
  let safe = 0;
  recent.forEach((item) => {
    const cat = CATEGORIES.find((c) => c.key === item.c) || CATEGORIES[0];
    if (cat.risky) risky += 1; else safe += 1;
    const bar = document.createElement('div');
    bar.className = 'spark__bar';
    bar.style.height = `${Math.max(12, Math.round((item.p || 0.15) * 80))}px`;
    bar.style.background = cat.color;
    bar.title = `${catName(cat)} · ${Math.round((item.p || 0) * 100)}%`;
    els.spark.appendChild(bar);
  });
  els.sessTotal.textContent = recent.length;
  els.sessRisky.textContent = risky;
  els.sessSafe.textContent = safe;
}

function chipHtml(item) {
  const cat = CATEGORIES.find((c) => c.key === item.c) || CATEGORIES[0];
  return `<span class="chip ${cat.key}"><span class="dot"></span>${catName(cat)} <span class="when">${relativeTime(item.t)}</span></span>`;
}

function renderChips(recent) {
  els.chips.innerHTML = recent.length
    ? recent.slice().reverse().map(chipHtml).join('')
    : `<div class="empty-card">${tt('dashboard.empty.chips')}</div>`;
}

function initials(label) {
  return String(label || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('');
}

function normalizeSites(data, counts, total) {
  const sites = data.site_stats && typeof data.site_stats === 'object'
    ? Object.entries(data.site_stats).map(([key, value]) => ({ key, ...value }))
    : [];
  sites.sort((a, b) => (b.total || 0) - (a.total || 0));
  return [{
    key: '__global__',
    host: 'global',
    label: 'Resumen global',
    total,
    ...counts,
    risky: riskyCount(counts),
    prob_sum: data.prob_sum || 0,
    prob_count: data.prob_count || 0,
    recent: Array.isArray(data.recent_categories) ? data.recent_categories : [],
    updated_at: Date.now(),
  }, ...sites];
}

function siteBars(counts, total) {
  return CATEGORIES.map((cat) => {
    const pct = total ? Math.round(((counts[cat.key] || 0) / total) * 100) : 0;
    return `<div class="site-bar"><span>${catName(cat)}</span><span class="track"><span class="fill" style="width:${pct}%;background:${cat.color}"></span></span><strong>${pct}%</strong></div>`;
  }).join('');
}

function renderSiteDetail(site) {
  if (!site || !site.total) {
    els.siteDetail.innerHTML = '<div class="empty-card">Selecciona una página cuando CyberLens recolecte datos.</div>';
    return;
  }
  const counts = countsFrom(site);
  const total = site.total || 0;
  const risky = site.risky ?? riskyCount(counts);
  const avg = site.prob_count ? Math.round(((site.prob_sum || 0) / site.prob_count) * 100) : 0;
  const riskPct = total ? Math.round((risky / total) * 100) : 0;
  const recent = Array.isArray(site.recent) ? site.recent.slice().reverse().slice(0, 8) : [];
  els.siteDetail.innerHTML = `
    <div class="site-detail__head">
      <div><h3>${site.label || site.host}</h3><p>${site.host || 'global'} · ${site.updated_at ? relativeTime(site.updated_at) : 'sin fecha'}</p></div>
      <span class="pill">${riskPct}% riesgo</span>
    </div>
    <div class="site-mini-grid">
      <div class="site-mini"><div class="n">${total}</div><div class="l">Analizados</div></div>
      <div class="site-mini"><div class="n">${risky}</div><div class="l">Riesgos</div></div>
      <div class="site-mini"><div class="n">${counts.seguro || 0}</div><div class="l">Seguros</div></div>
      <div class="site-mini"><div class="n">${avg ? `${avg}%` : '—'}</div><div class="l">Confianza</div></div>
    </div>
    <div class="site-bars">${siteBars(counts, total)}</div>
    <div class="site-recent chips">${recent.length ? recent.map(chipHtml).join('') : '<div class="empty-card">Sin actividad reciente en esta página.</div>'}</div>
  `;
}

function renderSites(data, counts, total) {
  const sites = normalizeSites(data, counts, total);
  if (!sites.some((site) => site.key === activeSiteKey)) activeSiteKey = sites[0].key;
  els.siteList.innerHTML = '';
  if (!total && sites.length === 1) {
    els.siteList.innerHTML = '<div class="empty-card">Aún no hay páginas analizadas.</div>';
    renderSiteDetail(null);
    return;
  }
  sites.forEach((site) => {
    const siteCounts = countsFrom(site);
    const risky = site.risky ?? riskyCount(siteCounts);
    const row = document.createElement('button');
    row.type = 'button';
    row.className = `site-row${site.key === activeSiteKey ? ' active' : ''}`;
    row.innerHTML = `
      <span class="site-icon">${initials(site.label || site.host)}</span>
      <span><strong>${site.label || site.host}</strong><small>${site.total || 0} análisis · ${risky} riesgos</small></span>
      <span class="chev"></span>
    `;
    row.addEventListener('click', () => {
      activeSiteKey = site.key;
      renderSites(data, counts, total);
    });
    els.siteList.appendChild(row);
  });
  renderSiteDetail(sites.find((site) => site.key === activeSiteKey) || sites[0]);
}

function applyPillFromState(data) {
  if (data.paused) setPill('paused', tt('pill.paused'));
  else if (data.api_status === 'connected') setPill('active', tt('pill.connected'));
  else if (data.api_status === 'disconnected') setPill('error', tt('pill.disconnected'));
  else setPill('waiting', tt('pill.checking'));
}

function render(data) {
  applyPillFromState(data);
  const counts = countsFrom(data);
  const total = data.total || Object.values(counts).reduce((sum, value) => sum + value, 0);
  const risky = riskyCount(counts);
  const recent = Array.isArray(data.recent_categories) ? data.recent_categories : [];
  els.totalPill.textContent = tt('dashboard.totalPill', { n: total });
  renderKpis(counts, total, risky, data.prob_sum || 0, data.prob_count || 0);

  const info = riskInfo(risky, total);
  els.riskBadge.className = `risk-banner__badge ${info.cls}`;
  els.riskLevel.textContent = info.level;
  els.riskReason.textContent = info.reason;
  els.riskHint.textContent = info.hint;

  renderDonut(counts, total);
  renderLegend(counts, total);
  renderConfidence(data.prob_sum || 0, data.prob_count || 0);
  renderSpark(recent);
  renderChips(recent);
  renderSites(data, counts, total);
}

function loadAndRender() {
  if (!chromeApi?.storage?.local) {
    render({});
    return;
  }
  chromeApi.storage.local.get(STORAGE_KEYS, (data) => render(data || {}));
}

async function pingApi() {
  try {
    const res = await fetch(`${API_BASE}/`, { method: 'GET' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    chromeApi?.storage?.local?.set({ api_status: 'connected' });
  } catch (_err) {
    chromeApi?.storage?.local?.set({ api_status: 'disconnected' });
  }
}

const MODEL_COLORS = {
  normal: '#20c9a8',
  seguro: '#20c9a8',
  phishing: '#ef5350',
  toxicidad: '#c4a2ff',
  oversharing: '#ffb86b',
};
const clsName = (label) => tt(`cat.${label}`);
const clsColor = (label) => MODEL_COLORS[label] || '#c4a2ff';
const clsFillClass = (label) => `fill--${String(label).replace(/[^a-z]/gi, '').toLowerCase() || 'seguro'}`;

function renderDatasetCounts(container, stats) {
  const counts = stats.label_counts || {};
  const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
  const classes = stats.classes_order || Object.keys(counts);
  container.innerHTML = classes.map((cls) => {
    const n = counts[cls] || 0;
    const pct = Math.round((n / total) * 100);
    return `<div class="row"><span class="name" style="color:${clsColor(cls)}">${clsName(cls)}</span><span class="track"><span class="fill ${clsFillClass(cls)}" style="width:${pct}%"></span></span><span class="val">${n}</span></div>`;
  }).join('');
}

function renderPerClassConfidence(container, stats) {
  const rows = Array.isArray(stats.per_class) ? stats.per_class : [];
  container.innerHTML = rows.length ? rows.map((cls) => {
    const pct = Math.round((cls.avg_confidence || 0) * 100);
    return `<div class="row"><span class="name" style="color:${clsColor(cls.label)}">${clsName(cls.label)}</span><span class="track"><span class="fill ${clsFillClass(cls.label)}" style="width:${pct}%"></span></span><span class="val">${pct}%</span></div>`;
  }).join('') : '<div class="empty-card">Sin métricas disponibles.</div>';
}

function renderModelConfig(stats) {
  const params = stats.vectorizer_params || {};
  $('specVectorizer').textContent = 'TfidfVectorizer';
  $('specMaxFeatures').textContent = params.max_features ?? stats.features ?? '—';
  $('specNgram').textContent = Array.isArray(params.ngram_range)
    ? `(${params.ngram_range[0]}, ${params.ngram_range[1]})`
    : '(1, 2)';
  $('specClassifier').textContent = stats.classifier || 'LogisticRegression';
}

function renderTopTerms(container, stats) {
  const top = stats.top_terms || {};
  const classes = stats.classes_order || Object.keys(top);
  const html = classes.map((cls) => {
    const terms = top[cls];
    if (!Array.isArray(terms) || !terms.length) return '';
    return `
      <div class="terms-col">
        <div class="head" style="color:${clsColor(cls)}"><span class="dot" style="background:${clsColor(cls)}"></span><span>${clsName(cls)}</span></div>
        <div class="terms">${terms.map((t) => `<span class="term"><span>${t.term}</span><span class="w">${(t.weight ?? 0).toFixed(2)}</span></span>`).join('')}</div>
      </div>
    `;
  }).join('');
  container.innerHTML = html || `<div class="empty-card">${tt('dashboard.empty.topTerms')}</div>`;
}

function renderConfusionMatrix(container, stats) {
  const cm = stats.confusion_matrix;
  const classes = stats.classes_order;
  if (!Array.isArray(cm) || !Array.isArray(classes)) {
    container.innerHTML = '<div class="empty-card">Matriz no disponible.</div>';
    return;
  }
  const max = Math.max(1, ...cm.flat());
  const head = classes.map((cls) => `<th style="color:${clsColor(cls)}">${clsName(cls)}</th>`).join('');
  const body = classes.map((rowCls, i) => `
    <tr>
      <th class="row-head" style="color:${clsColor(rowCls)}">${clsName(rowCls)}</th>
      ${classes.map((_colCls, j) => {
        const value = cm[i][j];
        const color = i === j ? '32, 201, 168' : '239, 83, 80';
        return `<td class="${i === j ? 'diag' : ''}" style="background:rgba(${color}, ${0.08 + (value / max) * 0.5})">${value}</td>`;
      }).join('')}
    </tr>
  `).join('');
  container.innerHTML = `
    <div class="cm-wrap">
      <div class="yaxis-label">${tt('dashboard.cm.axis.real')}</div>
      <table class="cm-table"><thead><tr><th></th>${head}</tr></thead><tbody>${body}</tbody></table>
      <div></div><div class="xaxis-label">${tt('dashboard.cm.axis.pred')}</div>
    </div>
  `;
}

function renderModelStats(stats) {
  $('modelSamples').textContent = stats.samples ?? '—';
  $('modelFeatures').textContent = stats.features ?? '—';
  $('modelAccuracy').textContent = stats.ok && typeof stats.accuracy === 'number'
    ? `${Math.round(stats.accuracy * 100)}%`
    : '—';
  $('modelF1').textContent = stats.ok && typeof stats.macro_f1 === 'number' ? stats.macro_f1.toFixed(2) : '—';
  renderModelConfig(stats);
  renderDatasetCounts($('datasetCounts'), stats);
  renderPerClassConfidence($('perClassConf'), stats);
  renderConfusionMatrix($('confusionMatrix'), stats);
  renderTopTerms($('topTerms'), stats);
}

async function loadModelStats() {
  try {
    const res = await fetch(`${API_BASE}/model/stats`, { method: 'GET' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    lastModelStats = await res.json();
    renderModelStats(lastModelStats);
  } catch (_err) {
    lastModelStats = null;
    const empty = document.createElement('div');
    empty.className = 'empty-card';
    empty.textContent = tt('dashboard.error.noApi');
    ['datasetCounts', 'perClassConf', 'confusionMatrix', 'topTerms'].forEach((id) => $(id).replaceChildren(empty.cloneNode(true)));
    ['modelAccuracy', 'modelF1', 'modelSamples', 'modelFeatures', 'specMaxFeatures', 'specNgram'].forEach((id) => { $(id).textContent = '—'; });
  }
}

function initTabs() {
  const links = Array.from(document.querySelectorAll('[data-nav]'));
  const grid = document.querySelector('.grid');
  const items = grid ? Array.from(grid.children) : [];
  const pages = $('view-pages');
  const model = $('view-model');
  const pipeline = $('view-pipeline');
  const settings = $('view-settings');
  const help = $('view-help');
  const modelIndex = items.indexOf(model);
  const pipelineIndex = items.indexOf(pipeline);
  const settingsIndex = items.indexOf(settings);
  const groups = {
    'view-pages': pages ? [pages] : [],
    'view-model': items.filter((el, i) => modelIndex !== -1 && i >= modelIndex && (pipelineIndex === -1 || i < pipelineIndex)),
    'view-pipeline': items.filter((el, i) => pipelineIndex !== -1 && i >= pipelineIndex && (settingsIndex === -1 || i < settingsIndex)),
    'view-settings': settings ? [settings] : [],
    'view-help': help ? [help] : [],
  };
  const all = items;
  const setActive = (id) => {
    links.forEach((link) => link.classList.toggle('active', link.getAttribute('data-nav') === id));
    const visible = new Set(groups[id] || []);
    all.forEach((panel) => panel.classList.toggle('view-hidden', !visible.has(panel)));
    const content = document.querySelector('.content');
    if (content) content.scrollTop = 0;
  };
  links.forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      setActive(link.getAttribute('data-nav'));
    });
  });
  setActive('view-pages');
}

function clearStats() {
  if (!chromeApi?.storage?.local) return;
  if (!window.confirm('¿Limpiar todas las estadísticas recolectadas?')) return;
  activeSiteKey = '__global__';
  chromeApi.storage.local.remove(STATS_KEYS, loadAndRender);
}

els.btnRefresh.addEventListener('click', () => {
  setPill('waiting', tt('pill.updating'));
  Promise.all([pingApi(), loadModelStats()]).then(loadAndRender);
});

els.btnClearStats?.addEventListener('click', () => {
  clearStats();
});

$('btnClearStatsSettings')?.addEventListener('click', () => {
  clearStats();
});

$('btnPingApiSettings')?.addEventListener('click', () => {
  setPill('waiting', tt('pill.updating'));
  pingApi().then(loadAndRender);
});

chromeApi?.storage?.onChanged?.addListener((changes, area) => {
  if (area === 'local' && STORAGE_KEYS.some((key) => key in changes)) loadAndRender();
});

if (window.i18n) {
  window.i18n.onChange(() => {
    loadAndRender();
    if (lastModelStats) renderModelStats(lastModelStats);
  });
}

const UI_THEMES = [
  { id: 'dark',     label: 'Oscuro',     bubbleIn: '#1e293b', bubbleOut: '#0f766e' },
  { id: 'light',    label: 'Claro',      bubbleIn: '#ffffff', bubbleOut: '#d9fdd3' },
  { id: 'rose',     label: 'Rosa',       bubbleIn: '#3d1f30', bubbleOut: '#ec4899' },
  { id: 'ocean',    label: 'Océano',     bubbleIn: '#152a40', bubbleOut: '#0ea5e9' },
  { id: 'lavender', label: 'Lavanda',    bubbleIn: '#2a2348', bubbleOut: '#8b5cf6' },
  { id: 'sunset',   label: 'Atardecer',  bubbleIn: '#3d2818', bubbleOut: '#f97316' },
];

function applyUiTheme(themeId) {
  const theme = UI_THEMES.find((t) => t.id === themeId) || UI_THEMES[0];
  document.documentElement.setAttribute('data-theme', theme.id);
  document.querySelectorAll('.theme-card').forEach((card) => {
    card.classList.toggle('theme-card--active', card.dataset.theme === theme.id);
  });
  chromeApi?.storage?.local?.set({ ui_theme: theme.id });
}

function renderThemeGrid(currentId = 'dark') {
  const grid = $('themeGrid');
  if (!grid) return;
  grid.innerHTML = UI_THEMES.map((t) => `
    <button type="button" class="theme-card${t.id === currentId ? ' theme-card--active' : ''}"
            data-theme="${t.id}">
      <div class="theme-card__preview">
        <div class="theme-card__bubble" style="background:${t.bubbleIn}"></div>
        <div class="theme-card__bubble" style="background:${t.bubbleOut}"></div>
      </div>
      <span class="theme-card__label">${t.label}</span>
    </button>
  `).join('');
  grid.querySelectorAll('.theme-card').forEach((card) => {
    card.addEventListener('click', () => applyUiTheme(card.dataset.theme));
  });
}

function initThemes() {
  const fallback = 'dark';
  if (!chromeApi?.storage?.local) {
    applyUiTheme(fallback);
    renderThemeGrid(fallback);
    return;
  }
  chromeApi.storage.local.get(['ui_theme'], (data) => {
    const themeId = data.ui_theme || fallback;
    applyUiTheme(themeId);
    renderThemeGrid(themeId);
  });
  $('btnTheme')?.addEventListener('click', () => {
    setActive('view-settings');
    $('themeGrid')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
}

initTabs();
initThemes();
loadAndRender();
loadModelStats();
pingApi();
setInterval(loadAndRender, 30_000);
