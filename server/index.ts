import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { lookupCp } from './cp-table.ts';

// Local dev: load .env.local (AI Studio convention) then .env.
// In production (Cloud Run / AI Studio) the var is injected into process.env directly.
dotenv.config({ path: ['.env.local', '.env'] });

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const API_KEY = process.env.GEMINI_API_KEY;
const MODEL = 'gemini-1.5-flash';

const SYSTEM_PROMPT =
  'Eres un analista de datos. Lee descripciones de anuncios de venta en Aguascalientes y devuelve ' +
  'estrictamente un arreglo JSON. Extrae: "project" (nombre), "location" (texto), "price" (número ' +
  'entero en MXN), "area" (número entero), "amenities" (arreglo de strings), "status" (Clasifica ' +
  'estrictamente como "Preventa", "Nuevo" o "Usado"), "daysOnMarket" (número entero de días en el ' +
  'mercado inferido por la fecha de publicación, o null si no hay dato). Tu respuesta debe ser ' +
  'ÚNICAMENTE el código JSON válido.';

// Canonical raw listing shape consumed by the frontend importer.
interface RawListing {
  project: string;
  location: string;
  price: number; // MXN, integer
  area: number; // m², integer
  bedrooms: number | null;
  bathrooms: number | null;
  parking: number | null;
  postalCode: string | null;
  amenities: string[];
  status: 'Preventa' | 'Nuevo' | 'Usado' | null;
  operation: 'venta' | 'renta';
  daysOnMarket: number | null;
  url?: string;
}

// --- Helpers ---------------------------------------------------------------

const toNumber = (v: unknown): number => {
  if (v == null) return 0;
  const n = Number(String(v).replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? Math.round(n) : 0;
};

const toIntOrNull = (v: unknown): number | null => {
  if (v == null || v === '') return null;
  const n = Number(String(v).replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? Math.round(n) : null;
};

// Tolerant parse: strips code fences and tries to recover a truncated array.
function parseModelJson(rawText: string): any[] {
  const cleaned = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
  try {
    const parsed = JSON.parse(cleaned);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    const lastBrace = cleaned.lastIndexOf('}');
    if (lastBrace !== -1) {
      try {
        const parsed = JSON.parse(cleaned.substring(0, lastBrace + 1) + ']');
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  }
}

// Coerce a Gemini or JSON-LD item into the canonical RawListing shape.
function normalizeListing(item: any): RawListing | null {
  const allowed = ['Preventa', 'Nuevo', 'Usado'];
  const status = allowed.includes(item?.status) ? item.status : null;
  const location = String(item?.location ?? '').trim() || 'Unknown';
  // Prefer an explicit CP (e.g. from a detail-page capture); otherwise derive
  // it from the colonia via the editable lookup table.
  const postalCode = item?.postalCode ? String(item.postalCode).trim() : lookupCp(location);
  const listing: RawListing = {
    project: String(item?.project ?? item?.name ?? '').trim() || 'N/A',
    location,
    price: toNumber(item?.price),
    area: toNumber(item?.area),
    bedrooms: toIntOrNull(item?.bedrooms),
    bathrooms: toIntOrNull(item?.bathrooms),
    parking: toIntOrNull(item?.parking),
    postalCode,
    amenities: Array.isArray(item?.amenities) ? item.amenities.filter(Boolean).map(String) : [],
    status,
    operation: item?.operation === 'renta' ? 'renta' : 'venta',
    daysOnMarket: Number.isFinite(item?.daysOnMarket) ? item.daysOnMarket : null,
    url: item?.url ? String(item.url) : undefined,
  };
  // Drop rows with no usable price — they pollute every average downstream.
  if (listing.price <= 0) return null;
  return listing;
}

// Call Gemini on a batch of raw text and return canonical listings.
async function analyzeText(text: string): Promise<RawListing[]> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ parts: [{ text }] }],
        generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 8192 },
      }),
    },
  );

  if (!response.ok) {
    const details = await response.text();
    console.error('Gemini API error:', details);
    throw new Error('GEMINI_API_ERROR');
  }

  const data: any = await response.json();
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '[]';
  return parseModelJson(rawText)
    .map(normalizeListing)
    .filter((x): x is RawListing => x !== null);
}

// --- Inbox (file-backed) ---------------------------------------------------
// Captures from the browser extension land here until the SPA pulls them.
// Best-effort persistence; on Cloud Run the filesystem is ephemeral, which is
// fine because the capture→import round-trip happens within one session.

const DATA_DIR = path.resolve(__dirname, '../data');
const INBOX_FILE = path.join(DATA_DIR, 'inbox.json');

function readInbox(): RawListing[] {
  try {
    return JSON.parse(fs.readFileSync(INBOX_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

function writeInbox(items: RawListing[]): void {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(INBOX_FILE, JSON.stringify(items, null, 2));
  } catch (err) {
    console.error('No se pudo escribir el inbox:', err);
  }
}

// --- App -------------------------------------------------------------------

const app = express();
app.use(express.json({ limit: '4mb' }));

// Allow Chrome extensions and the SPA to call the API from any origin.
app.use('/api', (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Analyze a single batch of raw listing text and return structured rows.
// The Gemini key lives only here — it is never sent to the browser.
app.post('/api/analyze', async (req, res) => {
  if (!API_KEY) {
    return res.status(500).json({ error: 'GEMINI_API_KEY no está configurada en el servidor.' });
  }
  const { text } = req.body ?? {};
  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'Falta el texto a analizar.' });
  }
  try {
    const properties = await analyzeText(text);
    return res.json({ properties });
  } catch (err) {
    if (err instanceof Error && err.message === 'GEMINI_API_ERROR') {
      return res.status(502).json({ error: 'Error en la respuesta de la API de Gemini.' });
    }
    console.error('Error procesando el lote:', err);
    return res.status(500).json({ error: 'Error procesando el lote con la IA.' });
  }
});

// Ingest captures from the browser extension. Accepts pre-structured listings
// (JSON-LD, no Gemini cost) and/or raw page text (routed through Gemini).
app.post('/api/ingest', async (req, res) => {
  const { structured, rawText, operation } = req.body ?? {};
  const op: 'venta' | 'renta' = operation === 'renta' ? 'renta' : 'venta';
  const collected: RawListing[] = [];

  if (Array.isArray(structured)) {
    for (const item of structured) {
      const norm = normalizeListing(item);
      if (norm) collected.push(norm);
    }
  }

  if (typeof rawText === 'string' && rawText.trim()) {
    if (!API_KEY) {
      return res.status(500).json({ error: 'GEMINI_API_KEY no está configurada en el servidor.' });
    }
    try {
      // Gemini doesn't infer sale vs rent; tag with the page-level operation.
      const fromText = await analyzeText(rawText.slice(0, 12000));
      fromText.forEach((r) => (r.operation = op));
      collected.push(...fromText);
    } catch (err) {
      if (err instanceof Error && err.message === 'GEMINI_API_ERROR') {
        return res.status(502).json({ error: 'Error en la respuesta de la API de Gemini.' });
      }
      console.error('Error analizando rawText:', err);
      return res.status(500).json({ error: 'Error procesando el texto capturado.' });
    }
  }

  if (collected.length === 0) {
    return res.status(422).json({ error: 'No se encontraron anuncios con precio en la página.' });
  }

  const inbox = readInbox();
  inbox.push(...collected);
  writeInbox(inbox);
  return res.json({ added: collected.length, inboxSize: inbox.length });
});

// SPA pulls accumulated captures and (separately) clears them after merging.
app.get('/api/inbox', (_req, res) => {
  res.json({ properties: readInbox() });
});

app.delete('/api/inbox', (_req, res) => {
  writeInbox([]);
  res.json({ ok: true });
});

// In production, serve the built SPA from the same service (Cloud Run model).
const distPath = path.resolve(__dirname, '../dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
}

const PORT = Number(process.env.PORT) || 3001;
app.listen(PORT, () => {
  console.log(`Archivist AI server escuchando en :${PORT}`);
  if (!API_KEY) {
    console.warn('Advertencia: GEMINI_API_KEY no está definida. /api/analyze y rawText responderán 500.');
  }
});
