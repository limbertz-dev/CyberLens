'use strict';

const API_BASE = 'http://localhost:8000';
const statusEl = document.getElementById('status');
const outputEl = document.getElementById('output');
const textEl = document.getElementById('text');
const btn = document.getElementById('btnAnalyze');

function setStatus(type, msg) {
  statusEl.className = `status ${type}`;
  statusEl.textContent = msg;
}

async function checkHealth() {
  try {
    const res = await fetch(`${API_BASE}/`, { method: 'GET' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    setStatus('ok', `API activa · ${data.samples} ejemplos · ${(data.categories || []).join(', ')}`);
    return true;
  } catch (e) {
    setStatus('err', 'API no responde — inicia uvicorn en puerto 8000');
    outputEl.textContent = `Error de conexión:\n${e.message}\n\nLa extensión no puede analizar sin el servidor.`;
    return false;
  }
}

async function analyze() {
  const text = textEl.value.trim();
  if (!text) {
    outputEl.textContent = 'Escribe un texto para analizar.';
    return;
  }

  outputEl.textContent = 'Enviando POST /analyze…';
  btn.disabled = true;

  try {
    const res = await fetch(`${API_BASE}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });

    const raw = await res.text();
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = raw;
    }

    if (!res.ok) {
      outputEl.textContent = `HTTP ${res.status}\n\n${typeof parsed === 'object' ? JSON.stringify(parsed, null, 2) : parsed}`;
      setStatus('err', `Error HTTP ${res.status}`);
      return;
    }

    outputEl.textContent = JSON.stringify(parsed, null, 2);
    setStatus('ok', `OK · ${parsed.category} (${Math.round(parsed.probability * 100)}%)`);
  } catch (e) {
    outputEl.textContent = `No se pudo conectar:\n${e.message}`;
    setStatus('err', 'Sin conexión a localhost:8000');
  } finally {
    btn.disabled = false;
  }
}

btn.addEventListener('click', analyze);
checkHealth();
