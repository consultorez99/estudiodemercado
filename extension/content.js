// Runs inside the real estate portal page (your own browser session), so there
// is no bot IP/fingerprint to block. Extracts structured listings from JSON-LD
// when present, and always returns a raw-text fallback for Gemini.

const RE_TYPES = [
  'Product',
  'Residence',
  'Apartment',
  'House',
  'SingleFamilyResidence',
  'RealEstateListing',
  'Offer',
  'Place',
  'Accommodation',
];

function collectJsonLd() {
  const out = [];
  for (const node of document.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const data = JSON.parse(node.textContent);
      const arr = Array.isArray(data) ? data : data['@graph'] ? data['@graph'] : [data];
      for (const item of arr) out.push(item);
    } catch {
      /* ignore malformed blocks */
    }
  }
  return out;
}

function typeMatches(item) {
  const t = item && item['@type'];
  const types = Array.isArray(t) ? t : [t];
  if (types.some((x) => RE_TYPES.includes(x))) return true;
  return Boolean(item && (item.price || (item.offers && (item.offers.price || item.offers.lowPrice))));
}

function num(v) {
  if (v == null) return 0;
  const n = Number(String(v).replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function mapJsonLd(item) {
  const offers = Array.isArray(item.offers) ? item.offers[0] : item.offers;
  const price = num(item.price ?? (offers && (offers.price ?? offers.lowPrice)));
  const addr = item.address || {};
  const locationRaw =
    item.addressLocality ||
    addr.addressLocality ||
    addr.streetAddress ||
    addr.addressRegion ||
    addr.addressCountry ||
    '';
  const fs = item.floorSize || item.size || {};
  const area = num(fs.value ?? fs ?? item.area);
  let amenities = [];
  if (Array.isArray(item.amenityFeature)) {
    amenities = item.amenityFeature.map((a) => a && (a.name || a.value)).filter(Boolean);
  }
  return {
    project: (item.name || '').toString().trim(),
    location: (typeof locationRaw === 'string' ? locationRaw : '').trim(),
    price,
    area,
    amenities,
    status: null, // not reliably present in JSON-LD; Gemini handles it for rawText
    daysOnMarket: null,
    url: (typeof item.url === 'string' && item.url) || window.location.href,
  };
}

// --- Navent adapter (Inmuebles24 / Vivanuncios) ----------------------------
// These portals leave their JSON-LD empty as anti-scraping; the real data is in
// the rendered posting cards. Reading the DOM here costs zero Gemini tokens.

function cardText(card, qa) {
  const el = card.querySelector(`[data-qa="${qa}"]`);
  return el ? (el.innerText || '').replace(/\s+/g, ' ').trim() : '';
}

function firstNumber(s) {
  const m = (s || '').match(/([\d][\d.,]*)/);
  return m ? Math.round(Number(m[1].replace(/[.,]/g, ''))) : 0;
}

// Features look like "144 m² lote 3 rec. 2 baños 2 estac."; prefer covered/
// construction area when several m² values are present, else the first.
function areaFromFeatures(s) {
  const matches = [...(s || '').matchAll(/([\d.,]+)\s*m²\s*([^\d]*)/gi)];
  if (!matches.length) return 0;
  const preferred = matches.find((m) => /cubierta|const|construc/i.test(m[2]));
  const chosen = preferred || matches[0];
  return Math.round(Number(chosen[1].replace(/[.,]/g, '')));
}

function statusFromText(text) {
  const t = (text || '').toLowerCase();
  if (t.includes('preventa')) return 'Preventa';
  if (t.includes('estrenar') || t.includes('nuevo')) return 'Nuevo';
  return null;
}

// Pull a count like "3 rec." / "2 baños" / "2 estac." from the features string.
function countFrom(s, re) {
  const m = (s || '').match(re);
  return m ? Number(m[1]) : null;
}

// Collect posting cards that are inside a "Recomendaciones" section so we can
// exclude them — those are cross-sell widgets, not the page's main listings.
function getRecommendedCards() {
  const excluded = new Set();
  for (const heading of document.querySelectorAll('h2, h3, h4, [class*="title"], [class*="heading"], p')) {
    if (!/recomend/i.test(heading.textContent)) continue;
    let container = heading.parentElement;
    while (container && container !== document.body) {
      const cards = container.querySelectorAll('[data-qa^="posting "]');
      if (cards.length > 0) {
        cards.forEach((c) => excluded.add(c));
        break;
      }
      container = container.parentElement;
    }
  }
  return excluded;
}

function parseNaventCards() {
  const out = [];
  const recommended = getRecommendedCards();
  for (const card of document.querySelectorAll('[data-qa^="posting "]')) {
    if (recommended.has(card)) continue;
    const priceText = cardText(card, 'POSTING_CARD_PRICE');
    if (!priceText) continue;
    // Skip non-peso prices so they don't distort MXN price/m² averages.
    if (/us\$|usd|u\$s|d[oó]lares|dlls/i.test(priceText)) continue;
    const price = firstNumber(priceText);
    if (price <= 0) continue;

    const features = cardText(card, 'POSTING_CARD_FEATURES');
    const gallery = cardText(card, 'POSTING_CARD_GALLERY');
    const description = cardText(card, 'POSTING_CARD_DESCRIPTION');

    let url = card.dataset.toPosting || '';
    try {
      url = new URL(url, location.origin).href;
    } catch {
      /* keep relative */
    }

    out.push({
      project: '', // Navent cards have no project name → backend defaults to "Private Listing"
      location: cardText(card, 'POSTING_CARD_LOCATION'),
      price,
      area: areaFromFeatures(features),
      bedrooms: countFrom(features, /(\d+)\s*rec/i),
      bathrooms: countFrom(features, /(\d+)\s*baño/i),
      parking: countFrom(features, /(\d+)\s*estac/i),
      amenities: [], // not reliably structured in the search-results card (see detail page)
      status: statusFromText(`${description} ${gallery}`),
      daysOnMarket: null,
      url: url || undefined,
    });
  }
  return out;
}

// Sale vs rent: the operation type isn't in the card, but it's reliable from
// the URL / page title (".../casas-en-renta-en-...", "Casas en renta").
function detectOperation() {
  const hay = `${location.href} ${document.title}`.toLowerCase();
  if (/\b(renta|alquiler|arrendamiento|rentar)\b/.test(hay)) return 'renta';
  return 'venta';
}

function extract() {
  const host = location.hostname;
  const operation = detectOperation();
  let structured = [];

  // Portal-specific fast path (no Gemini cost).
  if (/inmuebles24\.com|vivanuncios\.com\.mx/.test(host)) {
    structured = parseNaventCards();
  }

  // Generic schema.org path for portals that expose real JSON-LD.
  if (structured.length === 0) {
    structured = collectJsonLd()
      .filter(typeMatches)
      .map(mapJsonLd)
      .filter((p) => p.price > 0);
  }

  // Tag every row with the detected operation so the app can keep rent and
  // sale comps in separate stores.
  structured = structured.map((s) => ({ ...s, operation }));

  // Raw-text fallback: main content (capped) so the backend can use Gemini
  // when neither structured path yields anything.
  const main = document.querySelector('main') || document.body;
  const rawText = (main.innerText || '').replace(/\n{3,}/g, '\n\n').trim().slice(0, 12000);

  return {
    structured,
    rawText,
    operation,
    source: host,
    pageUrl: location.href,
  };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message && message.type === 'EXTRACT') {
    try {
      sendResponse({ ok: true, data: extract() });
    } catch (err) {
      sendResponse({ ok: false, error: String(err) });
    }
  }
  return true; // keep the message channel open for the async-style response
});
