const DEFAULT_BACKEND = 'http://localhost:3001';
const SUPPORTED = ['inmuebles24.com', 'vivanuncios.com.mx', 'lamudi.com.mx', 'casasyterrenos.com', 'propiedades.com'];

const $ = (id) => document.getElementById(id);
let captured = null;

function setStatus(msg, kind) {
  const el = $('status');
  el.textContent = msg;
  el.className = `status ${kind}`;
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function isSupported(url) {
  try {
    const host = new URL(url).hostname;
    return SUPPORTED.some((d) => host.includes(d));
  } catch {
    return false;
  }
}

async function scan() {
  captured = null;
  $('send').disabled = true;
  $('status').className = 'status';
  const tab = await getActiveTab();

  if (!tab || !isSupported(tab.url || '')) {
    $('summary').innerHTML =
      'Abre una página de <b>Inmuebles24, Vivanuncios, Lamudi, Casas y Terrenos o Propiedades.com</b> y vuelve a escanear.';
    return;
  }

  $('summary').textContent = 'Analizando la página…';

  let response;
  try {
    response = await chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT' });
  } catch {
    // Content script may not be loaded yet (e.g. installed after page load).
    try {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
      response = await chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT' });
    } catch (err) {
      $('summary').textContent = 'No se pudo leer la página. Recárgala e inténtalo de nuevo.';
      return;
    }
  }

  if (!response || !response.ok) {
    $('summary').textContent = 'No se pudo extraer información de esta página.';
    return;
  }

  captured = response.data;
  const sCount = captured.structured.length;
  const textLen = captured.rawText.length;

  $('summary').innerHTML =
    `Fuente: <b>${captured.source}</b> · Operación: <b>${captured.operation === 'renta' ? '🏷️ Renta' : '🏠 Venta'}</b><br/>` +
    `Anuncios estructurados (JSON-LD): <b>${sCount}</b><br/>` +
    (sCount > 0
      ? 'Se enviarán sin costo de IA.'
      : `Sin JSON-LD. Se enviará el texto (${textLen.toLocaleString()} caracteres) para que la IA lo estructure.`);

  $('send').disabled = sCount === 0 && textLen === 0;
}

async function send() {
  if (!captured) return;
  $('send').disabled = true;
  setStatus('Enviando…', 'ok');

  const backend = ($('backend').value || DEFAULT_BACKEND).replace(/\/+$/, '');
  const payload =
    captured.structured.length > 0
      ? { structured: captured.structured }
      : { rawText: captured.rawText, operation: captured.operation };

  try {
    const res = await fetch(`${backend}/api/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    setStatus(`✓ ${data.added} anuncio(s) en el inbox. Ábrelos en la app → AI Importer → "Importar capturas".`, 'ok');
  } catch (err) {
    setStatus(`Error: ${err.message}. ¿Está corriendo el backend en ${backend}?`, 'err');
    $('send').disabled = false;
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const stored = await chrome.storage.local.get('backendUrl');
  $('backend').value = stored.backendUrl || DEFAULT_BACKEND;
  $('backend').addEventListener('change', () => {
    chrome.storage.local.set({ backendUrl: $('backend').value || DEFAULT_BACKEND });
  });
  $('send').addEventListener('click', send);
  $('rescan').addEventListener('click', scan);
  scan();
});
