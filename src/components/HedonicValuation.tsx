import { useState, useEffect, useMemo } from 'react';
import { Calculator, Database, RotateCcw, CheckCircle2, AlertCircle, AlertTriangle, MapPin } from 'lucide-react';
import {
  predict, contributions, calibrate, DEMO_MODEL, NUMERIC_FEATURES,
  type HedonicModel, type NumericFeature, type PropertyFeatures, type TrainingRow,
} from '../utils/hedonic';

const FEATURE_META: Record<NumericFeature, { label: string; unit: string; placeholder: string }> = {
  area: { label: 'Área construida', unit: 'm²', placeholder: '120' },
  edad: { label: 'Edad', unit: 'años', placeholder: '5' },
  pisos: { label: 'Pisos', unit: '', placeholder: '2' },
  banos: { label: 'Baños', unit: '', placeholder: '2' },
  lote: { label: 'Lote', unit: 'm²', placeholder: '160' },
  anio: { label: 'Año (vs base)', unit: '', placeholder: '7' },
};

const fmtMXN = (v: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(v);

const normalizeHeader = (h: string): string =>
  h.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '_');

const HEADER_ALIASES: Record<string, NumericFeature | 'precio' | 'colonia' | 'dist_centro'> = {
  area: 'area', area_construida: 'area', m2: 'area', superficie: 'area',
  edad: 'edad', antiguedad: 'edad',
  pisos: 'pisos', niveles: 'pisos', plantas: 'pisos',
  banos: 'banos', baños: 'banos', wc: 'banos',
  lote: 'lote', terreno: 'lote',
  anio: 'anio', ano: 'anio', year: 'anio',
  colonia: 'colonia', zona: 'colonia', fraccionamiento: 'colonia',
  dist_centro: 'dist_centro', distancia_centro: 'dist_centro', distancia: 'dist_centro',
  precio: 'precio', price: 'precio', valor: 'precio', monto: 'precio',
};

function parseCsv(text: string): { rows: TrainingRow[]; error?: string } {
  const lines = text.trim().split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { rows: [], error: 'Pega al menos un encabezado y una fila de datos.' };
  const delim = lines[0].includes(';') && !lines[0].includes(',') ? ';' : ',';
  const headers = lines[0].split(delim).map((h) => HEADER_ALIASES[normalizeHeader(h)]);
  if (!headers.includes('precio')) return { rows: [], error: 'Falta la columna "precio".' };
  if (!headers.includes('colonia')) return { rows: [], error: 'Falta la columna "colonia" (la zona es ahora la variable de ubicación).' };

  const rows: TrainingRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(delim);
    const row: any = { area: 0, edad: 0, pisos: 0, banos: 0, lote: 0, anio: 0, dist_centro: 0, colonia: '', precio: 0 };
    headers.forEach((key, idx) => {
      if (!key) return;
      const raw = (cells[idx] || '').trim();
      if (key === 'colonia') row.colonia = raw;
      else row[key] = Number(raw.replace(/[^0-9.\-]/g, '')) || 0;
    });
    if (row.precio > 0 && row.colonia) rows.push(row);
  }
  return { rows };
}

const EXAMPLE_CSV = `area,edad,pisos,banos,lote,anio,colonia,precio
120,5,2,2,160,7,Pulgas Pandas,1750000
95,12,1,2,0,7,Centro,1980000
148,2,2,3,0,7,Las Americas,3100000
130,8,2,2,180,7,Lomas del Campestre,3850000
110,3,1,2,150,7,Bosques del Prado,3600000`;

export default function HedonicValuation() {
  const [model, setModel] = useState<HedonicModel>(DEMO_MODEL);
  const [num, setNum] = useState<Record<NumericFeature, string>>({
    area: '120', edad: '5', pisos: '2', banos: '2', lote: '160', anio: '7',
  });
  const [colonia, setColonia] = useState<string>(DEMO_MODEL.colonia_referencia);
  const [dist, setDist] = useState('6');
  const [csv, setCsv] = useState('');
  const [useDistance, setUseDistance] = useState(false);
  const [preview, setPreview] = useState<HedonicModel | null>(null);
  const [calMsg, setCalMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [transactions, setTransactions] = useState<TrainingRow[]>([]);
  const [minPerColonia, setMinPerColonia] = useState('5');
  const [groupSmall, setGroupSmall] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem('hedonic_model');
    if (saved) {
      try {
        const m: HedonicModel = JSON.parse(saved);
        // Ignore models from the old (distance-based) shape — keep the demo.
        if (m && m.coeficientes_numericos && m.ajuste_colonia && m.colonia_referencia) {
          setModel(m);
          setColonia(m.colonia_referencia);
        } else {
          localStorage.removeItem('hedonic_model');
        }
      } catch {
        /* keep demo */
      }
    }
    const tx = localStorage.getItem('hedonic_transactions');
    if (tx) {
      try {
        const parsed = JSON.parse(tx);
        if (Array.isArray(parsed)) setTransactions(parsed);
      } catch {
        /* ignore */
      }
    }
  }, []);

  // Fingerprint to dedupe identical transaction rows.
  const txFingerprint = (r: TrainingRow) =>
    [r.area, r.edad, r.pisos, r.banos, r.lote, r.anio, r.colonia, r.precio].join('|');

  const persistTransactions = (rows: TrainingRow[]) => {
    setTransactions(rows);
    localStorage.setItem('hedonic_transactions', JSON.stringify(rows));
  };

  // Conteo por colonia (n) para mostrar tamaño de muestra y marcar las chicas.
  const coloniaCounts = useMemo(() => {
    const m = new Map<string, number>();
    transactions.forEach((r) => m.set(r.colonia, (m.get(r.colonia) ?? 0) + 1));
    return [...m.entries()].map(([colonia, n]) => ({ colonia, n })).sort((a, b) => b.n - a.n);
  }, [transactions]);

  const coloniaOptions = useMemo(() => Object.keys(model.ajuste_colonia), [model]);

  // Keep the selected colonia valid when the active model changes.
  useEffect(() => {
    if (!coloniaOptions.includes(colonia)) setColonia(model.colonia_referencia);
  }, [coloniaOptions, model.colonia_referencia]); // eslint-disable-line react-hooks/exhaustive-deps

  const propFeatures: PropertyFeatures = useMemo(
    () => ({
      ...(Object.fromEntries(NUMERIC_FEATURES.map((f) => [f, Number(num[f]) || 0])) as Record<NumericFeature, number>),
      colonia,
      dist_centro: Number(dist) || 0,
    }),
    [num, colonia, dist],
  );

  const { precio: estimate, coloniaCalibrada } = predict(propFeatures, model);
  const breakdown = contributions(propFeatures, model);

  const outOfRange = useMemo(() => {
    if (!model.rangos) return [];
    return NUMERIC_FEATURES.filter((f) => {
      const r = model.rangos?.[f];
      const v = propFeatures[f];
      return r && (v < r.min || v > r.max);
    });
  }, [model, propFeatures]);

  // Agrega el CSV a la base acumulada (dedupe), sin recalibrar todavía.
  const appendToBase = () => {
    setCalMsg(null);
    setPreview(null);
    const { rows, error } = parseCsv(csv);
    if (error) return setCalMsg({ kind: 'err', text: error });
    const seen = new Set(transactions.map(txFingerprint));
    let added = 0;
    const merged = [...transactions];
    rows.forEach((r) => {
      const fp = txFingerprint(r);
      if (!seen.has(fp)) {
        seen.add(fp);
        merged.push(r);
        added++;
      }
    });
    persistTransactions(merged);
    setCsv('');
    setCalMsg({ kind: 'ok', text: `Agregadas ${added} transacciones a la base (${rows.length - added} duplicadas). Total: ${merged.length}.` });
  };

  const clearBase = () => {
    persistTransactions([]);
    setPreview(null);
    setCalMsg({ kind: 'ok', text: 'Base de transacciones vaciada.' });
  };

  // Recalibra el modelo desde TODA la base acumulada. Opcionalmente agrupa las
  // colonias con muestra chica en "Otras" para que sus ajustes no sean inestables.
  const recalibrate = () => {
    setCalMsg(null);
    setPreview(null);
    if (transactions.length === 0) return setCalMsg({ kind: 'err', text: 'La base está vacía. Agrega transacciones primero.' });

    const min = Math.max(1, Number(minPerColonia) || 1);
    let rows = transactions;
    let grouped = 0;
    if (groupSmall) {
      const counts = new Map<string, number>();
      transactions.forEach((r) => counts.set(r.colonia, (counts.get(r.colonia) ?? 0) + 1));
      rows = transactions.map((r) => {
        if ((counts.get(r.colonia) ?? 0) < min) {
          grouped++;
          return { ...r, colonia: 'Otras (muestra chica)' };
        }
        return r;
      });
    }

    const result = calibrate(rows, { usaDistancia: useDistance });
    if ('error' in result) return setCalMsg({ kind: 'err', text: result.error });
    setPreview(result);
    const groupMsg = grouped > 0 ? ` ${grouped} ventas de colonias chicas agrupadas en "Otras".` : '';
    setCalMsg({
      kind: 'ok',
      text: `Recalibrado con ${rows.length} transacciones · ${Object.keys(result.ajuste_colonia).length} colonias (ref: ${result.colonia_referencia}). R²=${result.calidad.r2.toFixed(3)}, MnAPE=${(result.calidad.mnape * 100).toFixed(1)}%.${groupMsg}`,
    });
  };

  const saveModel = () => {
    if (!preview) return;
    localStorage.setItem('hedonic_model', JSON.stringify(preview));
    setModel(preview);
    setColonia(preview.colonia_referencia);
    setPreview(null);
    setCalMsg({ kind: 'ok', text: 'Modelo activo actualizado.' });
  };

  const resetDemo = () => {
    localStorage.removeItem('hedonic_model');
    setModel(DEMO_MODEL);
    setColonia(DEMO_MODEL.colonia_referencia);
    setPreview(null);
    setCalMsg({ kind: 'ok', text: 'Restaurado el modelo demo del documento.' });
  };

  const maxAbs = Math.max(...breakdown.map((b) => Math.abs(b.value)), 1);
  const inputCls = 'w-full bg-surface-container-lowest border border-stone-200 rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-[#00423c]/50';
  const labelCls = 'block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2';

  return (
    <div className="flex-1 p-8 bg-surface overflow-y-auto">
      <div className="mb-8">
        <h2 className="font-headline font-bold text-3xl text-on-surface flex items-center gap-3">
          <Calculator className="text-[#00423c]" size={30} /> Valuación Hedónica (Modelo de Precio)
        </h2>
        <p className="text-on-surface-variant mt-2">Regresión lineal OLS con ajuste por colonia. Transparente y auditable.</p>
      </div>

      {/* Predictor */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-5">
          <h3 className="font-headline font-bold text-lg text-on-surface">Estimar precio</h3>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="px-2 py-1 rounded-full bg-stone-100 text-stone-600 font-bold">v{model.version}</span>
            <span className="px-2 py-1 rounded-full bg-[#00423c]/10 text-[#00423c] font-bold">R² {model.calidad.r2.toFixed(2)}</span>
            <span className="px-2 py-1 rounded-full bg-[#00423c]/10 text-[#00423c] font-bold">MnAPE {(model.calidad.mnape * 100).toFixed(1)}%</span>
            <span className="px-2 py-1 rounded-full bg-stone-100 text-stone-500">año base {model.anio_base}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {NUMERIC_FEATURES.map((f) => (
            <div key={f}>
              <label className={labelCls}>
                {FEATURE_META[f].label} {FEATURE_META[f].unit && <span className="text-stone-400">({FEATURE_META[f].unit})</span>}
              </label>
              <input
                type="number"
                className={`${inputCls} ${outOfRange.includes(f) ? 'border-amber-400 ring-1 ring-amber-300' : ''}`}
                value={num[f]}
                placeholder={FEATURE_META[f].placeholder}
                onChange={(e) => setNum((p) => ({ ...p, [f]: e.target.value }))}
              />
            </div>
          ))}
          {/* Colonia: variable de ubicación (categórica) */}
          <div>
            <label className={labelCls}><MapPin size={11} className="inline -mt-0.5" /> Colonia / Zona</label>
            <select className={inputCls} value={colonia} onChange={(e) => setColonia(e.target.value)}>
              {coloniaOptions.map((c) => (
                <option key={c} value={c}>{c}{c === model.colonia_referencia ? ' (ref.)' : ''}</option>
              ))}
            </select>
          </div>
          {model.usa_distancia && (
            <div>
              <label className={labelCls}>Distancia centro <span className="text-stone-400">(km)</span></label>
              <input type="number" className={inputCls} value={dist} onChange={(e) => setDist(e.target.value)} />
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          <div className="p-5 rounded-xl bg-[#00423c]/5 border border-[#00423c]/10">
            <p className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">Precio estimado</p>
            <p className="text-4xl font-headline font-extrabold text-[#00423c]">{fmtMXN(estimate)}</p>
            {!coloniaCalibrada && (
              <p className="flex items-center gap-2 text-xs text-amber-700 mt-3">
                <AlertTriangle size={14} /> Ubicación no calibrada: se usó la zona de referencia. Baja confianza.
              </p>
            )}
            {outOfRange.length > 0 && (
              <p className="flex items-center gap-2 text-xs text-amber-700 mt-2">
                <AlertTriangle size={14} /> Fuera de rango: {outOfRange.map((f) => FEATURE_META[f].label).join(', ')}.
              </p>
            )}
            {model.calibrado_en && (
              <p className="text-[11px] text-stone-400 mt-2">Calibrado el {new Date(model.calibrado_en).toLocaleDateString('es-MX')} · n={model.calidad.n_observaciones}</p>
            )}
          </div>

          <div>
            <p className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-3">Aporte de cada componente</p>
            <div className="space-y-1.5">
              {breakdown.map((b) => (
                <div key={b.key} className="flex items-center gap-2 text-xs">
                  <span className="w-32 text-stone-600 capitalize shrink-0 truncate" title={b.key}>{b.key}</span>
                  <div className="flex-1 h-4 bg-stone-50 rounded relative overflow-hidden flex items-center">
                    <div className={`h-full ${b.value >= 0 ? 'bg-[#8cd4c8]' : 'bg-red-300'}`} style={{ width: `${(Math.abs(b.value) / maxAbs) * 100}%` }} />
                  </div>
                  <span className={`w-24 text-right font-semibold ${b.value >= 0 ? 'text-[#00423c]' : 'text-red-600'}`}>{fmtMXN(b.value)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Calibration */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100">
        <h3 className="font-headline font-bold text-lg text-on-surface mb-1 flex items-center gap-2">
          <Database size={20} className="text-[#00423c]" /> Base de transacciones & calibración
        </h3>
        <p className="text-sm text-stone-500 mb-4">
          Pega lotes de <b>ventas cerradas</b> y se <b>acumulan</b> en la base. El catálogo de colonias crece con la base.
          Columnas: <code className="text-xs bg-stone-100 px-1 rounded">area, edad, pisos, banos, lote, anio, colonia, precio</code>.
        </p>
        <textarea
          className="w-full h-36 p-3 bg-surface rounded-lg border border-stone-200 focus:border-[#00423c] focus:ring-1 focus:ring-[#00423c] outline-none font-mono text-xs resize-none"
          placeholder={EXAMPLE_CSV}
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
        />
        <div className="flex flex-wrap items-center gap-3 mt-3">
          <button onClick={appendToBase} disabled={!csv.trim()} className="bg-[#00423c] text-white px-5 py-2.5 rounded-lg font-bold text-sm hover:bg-[#00423c]/90 transition-colors disabled:opacity-50">Agregar a la base</button>
          <button onClick={() => setCsv(EXAMPLE_CSV)} className="bg-stone-100 text-stone-700 px-5 py-2.5 rounded-lg font-bold text-sm hover:bg-stone-200 transition-colors">Usar ejemplo</button>
          <button onClick={clearBase} disabled={transactions.length === 0} className="bg-stone-100 text-stone-700 px-5 py-2.5 rounded-lg font-bold text-sm hover:bg-stone-200 transition-colors disabled:opacity-50">Vaciar base</button>
          <button onClick={resetDemo} className="flex items-center gap-2 bg-stone-100 text-stone-700 px-5 py-2.5 rounded-lg font-bold text-sm hover:bg-stone-200 transition-colors"><RotateCcw size={15} /> Restaurar demo</button>
        </div>

        {/* Estado de la base: n por colonia, con bandera de muestra chica */}
        {transactions.length > 0 && (
          <div className="mt-5 p-4 rounded-xl bg-stone-50 border border-stone-100">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <p className="text-sm font-bold text-on-surface">Base: {transactions.length} ventas · {coloniaCounts.length} colonias</p>
              <div className="flex items-center gap-2 text-xs text-stone-500">
                Mín. ventas/colonia:
                <input type="number" value={minPerColonia} onChange={(e) => setMinPerColonia(e.target.value)} className="w-16 bg-white border border-stone-200 rounded px-2 py-1" />
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mb-3">
              {coloniaCounts.map(({ colonia: c, n }) => {
                const small = n < (Number(minPerColonia) || 5);
                return (
                  <span key={c} className={`px-2 py-1 rounded text-xs border ${small ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-white border-stone-200 text-stone-600'}`}>
                    {c}: <b>{n}</b>{small && <AlertTriangle size={11} className="inline ml-1 -mt-0.5" />}
                  </span>
                );
              })}
            </div>
            {coloniaCounts.some(({ n }) => n < (Number(minPerColonia) || 5)) && (
              <p className="text-[11px] text-amber-700 mb-3">⚠ Colonias en ámbar tienen muestra chica: sus ajustes serían inestables. Agrúpalas con la opción de abajo.</p>
            )}
            <div className="flex flex-wrap items-center gap-4 pt-3 border-t border-stone-200">
              <button onClick={recalibrate} className="bg-[#00423c] text-[#FFD700] px-5 py-2.5 rounded-lg font-bold text-sm hover:bg-[#00423c]/90 transition-colors">
                Recalibrar modelo desde la base ({transactions.length})
              </button>
              <label className="flex items-center gap-2 text-xs font-medium text-stone-600 cursor-pointer">
                <input type="checkbox" checked={groupSmall} onChange={(e) => setGroupSmall(e.target.checked)} />
                Agrupar colonias con muestra chica en "Otras"
              </label>
              <label className="flex items-center gap-2 text-xs font-medium text-stone-600 cursor-pointer">
                <input type="checkbox" checked={useDistance} onChange={(e) => setUseDistance(e.target.checked)} />
                Incluir distancia al centro (secundaria)
              </label>
            </div>
          </div>
        )}

        {calMsg && (
          <div className={`flex items-start gap-2 mt-4 p-3 rounded-lg text-sm ${calMsg.kind === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
            {calMsg.kind === 'ok' ? <CheckCircle2 size={18} className="shrink-0 mt-0.5" /> : <AlertCircle size={18} className="shrink-0 mt-0.5" />}
            <span>{calMsg.text}</span>
          </div>
        )}

        {preview && (
          <div className="mt-4 p-4 rounded-xl border border-[#00423c]/15 bg-[#00423c]/5">
            <div className="flex items-center justify-between mb-3">
              <p className="font-bold text-on-surface text-sm">Vista previa del modelo calibrado</p>
              <button onClick={saveModel} className="bg-[#00423c] text-[#FFD700] px-4 py-2 rounded-lg font-bold text-xs hover:bg-[#00423c]/90 transition-colors">Guardar como modelo activo</button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs mb-3">
              <span className="px-2 py-1 rounded bg-white border border-stone-200">R² {preview.calidad.r2.toFixed(3)}</span>
              <span className="px-2 py-1 rounded bg-white border border-stone-200">RMSE {fmtMXN(preview.calidad.rmse)}</span>
              <span className="px-2 py-1 rounded bg-white border border-stone-200">MnAPE {(preview.calidad.mnape * 100).toFixed(1)}%</span>
              <span className="px-2 py-1 rounded bg-white border border-stone-200">n prueba {preview.calidad.n_observaciones}</span>
            </div>
            <p className="text-[11px] font-bold text-stone-500 uppercase tracking-wider mb-1">Ajuste por colonia (vs {preview.colonia_referencia})</p>
            <div className="flex flex-wrap gap-2 mb-3">
              {Object.entries(preview.ajuste_colonia).map(([c, v]: [string, number]) => (
                <span key={c} className="px-2 py-1 rounded bg-white border border-stone-200 text-xs">{c}: <b className={v >= 0 ? 'text-[#00423c]' : 'text-red-600'}>{fmtMXN(v)}</b></span>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              {(['intercepto', ...NUMERIC_FEATURES] as const).map((k) => (
                <span key={k} className="px-2 py-1 rounded bg-white border border-stone-200 capitalize">{k}: <b>{Math.round(preview.coeficientes_numericos[k]).toLocaleString('es-MX')}</b></span>
              ))}
            </div>
          </div>
        )}
      </div>

      <p className="text-xs text-stone-400 mt-4 max-w-3xl">
        Modelo lineal con ubicación categórica (colonia). No captura interacciones ni no-linealidades; es la línea base
        transparente. La evolución natural es Random Forest o red neuronal detrás de un endpoint aparte.
      </p>
    </div>
  );
}
