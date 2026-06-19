import { useState, useEffect, useCallback } from 'react';
import { Sparkles, AlertCircle, CheckCircle2, Loader2, DownloadCloud, RefreshCw } from 'lucide-react';

export default function AiMarketImporter({ onUpdateData }: { onUpdateData: (newData: any) => void }) {
  const [inputText, setInputText] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [inboxCount, setInboxCount] = useState(0);
  const [progress, setProgress] = useState(0);
  const [processedChunks, setProcessedChunks] = useState(0);
  const [totalChunks, setTotalChunks] = useState(0);

  // Map a canonical raw listing to the display shape used across the app.
  const toDisplay = (item: any) => {
    let statusColor = 'bg-primary/10 text-primary';
    if (item.status === 'Preventa') statusColor = 'bg-purple-100 text-purple-700';
    if (item.status === 'Nuevo') statusColor = 'bg-blue-100 text-blue-700';
    if (item.status === 'Usado') statusColor = 'bg-orange-100 text-orange-700';

    return {
      project: item.project || 'Private Listing',
      location: item.location || 'Unknown',
      price: new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'MXN',
        maximumFractionDigits: 0,
      }).format(item.price || 0),
      sqm: `${item.area || 0} m²`,
      bedrooms: item.bedrooms ?? null,
      bathrooms: item.bathrooms ?? null,
      parking: item.parking ?? null,
      postalCode: item.postalCode ?? null,
      amenities: item.amenities || [],
      status: item.status || 'Usado',
      statusColor,
      operation: item.operation === 'renta' ? 'renta' : 'venta',
      daysOnMarket: item.daysOnMarket ?? null,
      url: item.url || undefined,
    };
  };

  // Dedupe + merge a batch of display rows into a localStorage store.
  const mergeIntoStore = (storageKey: string, rows: any[]): { added: number; dupes: number; data: { properties: any[] } } => {
    let existing: any[] = [];
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.properties)) existing = parsed.properties;
      } catch (e) {
        console.error(`Error parsing ${storageKey}`, e);
      }
    }

    // URL is the strong identity key; fall back to area+price when absent.
    const fingerprint = (p: any) => (p.url ? `url:${p.url}` : `${p.sqm}-${p.price}`);
    const seen = new Set(existing.map(fingerprint));

    let dupes = 0;
    const unique = rows.filter((p) => {
      const fp = fingerprint(p);
      if (seen.has(fp)) {
        dupes++;
        return false;
      }
      seen.add(fp);
      return true;
    });

    const startId = existing.length > 0 ? Math.max(...existing.map((p: any) => p.id || 0)) : 0;
    const withIds = unique.map((p, idx) => ({ ...p, id: startId + idx + 1 }));
    const data = { properties: [...existing, ...withIds] };
    localStorage.setItem(storageKey, JSON.stringify(data));
    return { added: withIds.length, dupes, data };
  };

  // Split sale vs rent so rent comps never pollute the sale analytics; each
  // lands in its own store. Only the sale store drives the main views.
  const persistRawData = useCallback(
    (allRawData: any[]): { addedVenta: number; addedRenta: number; dupes: number } => {
      const rows = allRawData.map(toDisplay);
      const venta = rows.filter((p) => p.operation !== 'renta');
      const renta = rows.filter((p) => p.operation === 'renta');

      const v = mergeIntoStore('real_estate_market_data', venta);
      const r = mergeIntoStore('rental_data', renta);

      if (v.added > 0) onUpdateData(v.data);
      window.dispatchEvent(new Event('rental_data_updated'));
      return { addedVenta: v.added, addedRenta: r.added, dupes: v.dupes + r.dupes };
    },
    [onUpdateData],
  );

  const refreshInbox = useCallback(async () => {
    try {
      const res = await fetch('/api/inbox');
      if (!res.ok) return;
      const { properties } = await res.json();
      setInboxCount(Array.isArray(properties) ? properties.length : 0);
    } catch {
      // backend not running — ignore
    }
  }, []);

  useEffect(() => {
    refreshInbox();
  }, [refreshInbox]);

  const handleAnalyze = async () => {
    if (!inputText.trim()) return;

    setError('');
    setSuccess('');
    setIsProcessing(true);
    setProgress(0);
    setProcessedChunks(0);
    setTotalChunks(0);

    try {
      const lines = inputText.split('\n');
      const chunkSize = 30;
      const chunks: string[] = [];
      for (let i = 0; i < lines.length; i += chunkSize) {
        const chunkText = lines.slice(i, i + chunkSize).join('\n').trim();
        if (chunkText) chunks.push(chunkText);
      }

      setTotalChunks(chunks.length);
      let allRawData: any[] = [];
      const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        // Pausa de 1s entre lotes para no exceder el límite de 15 RPM de la cuota gratuita.
        if (i > 0) await sleep(1000);

        try {
          const response = await fetch('/api/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: chunk }),
          });

          if (!response.ok) {
            const errorBody = await response.json().catch(() => ({}));
            console.error(`Error en chunk ${i}:`, errorBody);
            throw new Error(errorBody.error || 'Error en la respuesta del servidor');
          }

          const { properties: chunkData } = await response.json();
          if (Array.isArray(chunkData)) allRawData = [...allRawData, ...chunkData];
        } catch (chunkErr) {
          console.error(`Error procesando chunk ${i}:`, chunkErr);
        }

        setProcessedChunks((prev) => prev + 1);
        setProgress(Math.round(((i + 1) / chunks.length) * 100));
      }

      if (allRawData.length === 0) {
        throw new Error('No se pudo extraer ninguna propiedad válida de los datos proporcionados.');
      }

      const { addedVenta, addedRenta, dupes } = persistRawData(allRawData);
      const rentaMsg = addedRenta > 0 ? ` ${addedRenta} de renta.` : '';
      setSuccess(`Data procesada: ${addedVenta} de venta guardadas.${rentaMsg} ${dupes} duplicados descartados.`);
      setInputText('');
      setProgress(0);
      setProcessedChunks(0);
      setTotalChunks(0);
    } catch (err: any) {
      console.error('Error procesando datos:', err);
      setError(err?.message || 'Error al procesar los datos con la IA.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImportCaptures = async () => {
    setError('');
    setSuccess('');
    setIsImporting(true);
    try {
      const res = await fetch('/api/inbox');
      if (!res.ok) throw new Error('No se pudo leer el inbox del servidor.');
      const { properties } = await res.json();

      if (!Array.isArray(properties) || properties.length === 0) {
        setSuccess('No hay capturas pendientes en el inbox.');
        setInboxCount(0);
        return;
      }

      const { addedVenta, addedRenta, dupes } = persistRawData(properties);
      await fetch('/api/inbox', { method: 'DELETE' });
      setInboxCount(0);
      const rentaMsg = addedRenta > 0 ? ` ${addedRenta} de renta.` : '';
      setSuccess(`Capturas importadas: ${addedVenta} de venta.${rentaMsg} ${dupes} duplicados descartados.`);
    } catch (err: any) {
      console.error('Error importando capturas:', err);
      setError(err?.message || 'Error al importar las capturas del navegador.');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="px-8 py-10 space-y-8 flex-1">
      <div>
        <h1 className="text-4xl font-headline font-extrabold text-on-surface tracking-tight">AI Market Importer</h1>
        <p className="text-on-surface-variant mt-2 max-w-2xl">
          Pega el texto crudo de los anuncios o importa las capturas hechas con la extensión del navegador. La IA
          extrae y estructura los datos automáticamente.
        </p>
      </div>

      {/* Browser capture inbox */}
      <div className="bg-surface-container-lowest p-6 rounded-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <DownloadCloud size={20} />
          </div>
          <div>
            <p className="text-sm font-bold text-on-surface">Capturas del navegador</p>
            <p className="text-xs text-on-surface-variant">
              {inboxCount > 0
                ? `${inboxCount} anuncio${inboxCount === 1 ? '' : 's'} en el inbox listos para importar.`
                : 'Sin capturas pendientes. Usa la extensión en el portal y haz clic en "Capturar".'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={refreshInbox}
            disabled={isImporting}
            className="p-2.5 rounded-full text-on-surface-variant hover:bg-surface-variant transition-colors disabled:opacity-50"
            title="Refrescar inbox"
          >
            <RefreshCw size={18} />
          </button>
          <button
            onClick={handleImportCaptures}
            disabled={isImporting || inboxCount === 0}
            className="flex items-center gap-2 bg-primary text-on-primary px-5 py-2.5 rounded-full font-bold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isImporting ? <Loader2 size={18} className="animate-spin" /> : <DownloadCloud size={18} />}
            Importar capturas{inboxCount > 0 ? ` (${inboxCount})` : ''}
          </button>
        </div>
      </div>

      <div className="bg-surface-container-lowest p-6 rounded-xl border-none shadow-none flex flex-col space-y-4">
        <label className="text-sm font-bold uppercase tracking-widest text-on-surface-variant/60">
          Texto Crudo de Anuncios
        </label>
        <textarea
          className="w-full h-96 p-4 bg-surface rounded-lg border border-outline-variant focus:border-primary focus:ring-1 focus:ring-primary outline-none font-body text-sm resize-none text-on-surface"
          placeholder="Ej: Se vende hermoso departamento en Arroyo El Molino, 140m2, cuenta con área de lavado y estacionamiento techado. Precio: $4,700,000 MXN..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          disabled={isProcessing}
        />

        {error && (
          <div className="flex items-center gap-2 text-error bg-error/10 p-4 rounded-lg">
            <AlertCircle size={20} />
            <span className="text-sm font-medium">{error}</span>
          </div>
        )}

        {success && (
          <div className="flex items-center gap-2 text-primary bg-primary/10 p-4 rounded-lg">
            <CheckCircle2 size={20} />
            <span className="text-sm font-medium">{success}</span>
          </div>
        )}

        <div className="flex justify-end pt-4">
          <button
            onClick={handleAnalyze}
            disabled={!inputText.trim() || isProcessing}
            className="flex items-center gap-2 bg-primary text-on-primary px-6 py-3 rounded-full font-bold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessing ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                {totalChunks > 0 ? `Procesando lote ${processedChunks} de ${totalChunks} (${progress}%)` : 'Procesando...'}
              </>
            ) : (
              <>
                <Sparkles size={20} />
                Analizar Mercado con IA
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
