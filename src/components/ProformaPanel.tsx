import { useState, useEffect, useMemo } from 'react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ReferenceLine,
} from 'recharts';
import { computeProforma, ProformaInputs } from '../utils/proforma';

interface SubjectForProforma {
  area: number;
  numberOfUnits?: number;
  totalPrice: number;
  constructionCostPerSqm?: number;
}

const DEFAULTS = {
  softCostPct: '12',
  contingencyPct: '8',
  marketingPct: '4',
  constructionMonths: '18',
  salesStartMonth: '6',
  absorptionPerMonth: '2',
  targetIRR: '18',
  landCost: '',
};

const fmtMXN = (v: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(v);
const fmtCompact = (v: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', notation: 'compact', maximumFractionDigits: 1 }).format(v);

export default function ProformaPanel({ subject }: { subject: SubjectForProforma | null }) {
  const [assumptions, setAssumptions] = useState(DEFAULTS);

  useEffect(() => {
    const saved = localStorage.getItem('proforma_assumptions');
    if (saved) {
      try {
        setAssumptions({ ...DEFAULTS, ...JSON.parse(saved) });
      } catch {
        /* ignore */
      }
    }
  }, []);

  const update = (key: keyof typeof DEFAULTS, value: string) => {
    setAssumptions((prev) => {
      const next = { ...prev, [key]: value };
      localStorage.setItem('proforma_assumptions', JSON.stringify(next));
      return next;
    });
  };

  const ready =
    subject != null &&
    subject.area > 0 &&
    subject.totalPrice > 0 &&
    (subject.numberOfUnits ?? 0) > 0 &&
    (subject.constructionCostPerSqm ?? 0) > 0;

  const result = useMemo(() => {
    if (!ready || !subject) return null;
    const inputs: ProformaInputs = {
      units: subject.numberOfUnits!,
      areaPerUnit: subject.area,
      pricePerUnit: subject.totalPrice,
      constructionCostPerSqm: subject.constructionCostPerSqm!,
      softCostPct: Number(assumptions.softCostPct) || 0,
      contingencyPct: Number(assumptions.contingencyPct) || 0,
      marketingPct: Number(assumptions.marketingPct) || 0,
      constructionMonths: Math.max(1, Number(assumptions.constructionMonths) || 1),
      salesStartMonth: Math.max(0, Number(assumptions.salesStartMonth) || 0),
      absorptionPerMonth: Number(assumptions.absorptionPerMonth) || 1,
      annualDiscountRate: (Number(assumptions.targetIRR) || 0) / 100,
      landCost: assumptions.landCost.trim() ? Number(assumptions.landCost) : undefined,
    };
    return computeProforma(inputs);
  }, [ready, subject, assumptions]);

  const chartData = useMemo(
    () => result?.monthlyFlows.map((f) => ({ month: `M${f.month}`, cumulative: Math.round(f.cumulative) })) ?? [],
    [result],
  );

  const inputCls =
    'w-full bg-surface-container-lowest border border-stone-200 rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-[#00423c]/50';
  const labelCls = 'block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2';

  const irrBelowTarget =
    result?.projectIRR != null && result.projectIRR < (Number(assumptions.targetIRR) || 0) / 100;

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100 mb-8 print:break-inside-avoid">
      <h3 className="font-headline font-bold text-lg text-on-surface mb-1">📊 Pro-forma & TIR (Flujo de Caja)</h3>
      <p className="text-sm text-stone-500 mb-5">
        Modelo de flujo de caja en el tiempo con costos completos. Calcula la TIR real del proyecto y el cheque
        máximo por terreno descontado a tu tasa objetivo — no solo el margen contable.
      </p>

      {/* Assumptions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div>
          <label className={labelCls}>Indirectos (% obra)</label>
          <input type="number" className={inputCls} value={assumptions.softCostPct} onChange={(e) => update('softCostPct', e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Contingencia (% obra)</label>
          <input type="number" className={inputCls} value={assumptions.contingencyPct} onChange={(e) => update('contingencyPct', e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Comercialización (% GDV)</label>
          <input type="number" className={inputCls} value={assumptions.marketingPct} onChange={(e) => update('marketingPct', e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>TIR objetivo (%)</label>
          <input type="number" className={inputCls} value={assumptions.targetIRR} onChange={(e) => update('targetIRR', e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Meses de obra</label>
          <input type="number" className={inputCls} value={assumptions.constructionMonths} onChange={(e) => update('constructionMonths', e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Inicio de ventas (mes)</label>
          <input type="number" className={inputCls} value={assumptions.salesStartMonth} onChange={(e) => update('salesStartMonth', e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Absorción (uds/mes)</label>
          <input type="number" className={inputCls} value={assumptions.absorptionPerMonth} onChange={(e) => update('absorptionPerMonth', e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Costo terreno (opcional)</label>
          <input type="number" className={inputCls} placeholder="para calcular TIR" value={assumptions.landCost} onChange={(e) => update('landCost', e.target.value)} />
        </div>
      </div>

      {!ready ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          Completa en el simulador de arriba: <b>Área</b>, <b>Precio Total</b>, <b>Costo de Construcción</b> y <b>Número de Unidades</b> para correr la pro-forma.
        </div>
      ) : result ? (
        <>
          {/* Headline KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="p-4 rounded-xl bg-[#00423c]/5 border border-[#00423c]/10">
              <p className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">Cheque máx. terreno @ {assumptions.targetIRR}%</p>
              <p className="text-2xl font-headline font-extrabold text-[#00423c]">{fmtMXN(result.maxLandAtTargetIRR)}</p>
              <p className="text-[11px] text-stone-400 mt-1">VPN de flujos a la tasa objetivo</p>
            </div>
            <div className={`p-4 rounded-xl border ${irrBelowTarget ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
              <p className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">TIR del proyecto</p>
              <p className={`text-2xl font-headline font-extrabold ${irrBelowTarget ? 'text-red-600' : 'text-green-600'}`}>
                {result.projectIRR != null ? `${(result.projectIRR * 100).toFixed(1)}%` : '—'}
              </p>
              <p className="text-[11px] text-stone-400 mt-1">{result.projectIRR != null ? (irrBelowTarget ? 'Debajo del objetivo' : 'Cumple objetivo') : 'Ingresa costo de terreno'}</p>
            </div>
            <div className="p-4 rounded-xl bg-[#00423c]/5 border border-[#00423c]/10">
              <p className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">Equity pico</p>
              <p className="text-2xl font-headline font-extrabold text-[#00423c]">{fmtMXN(result.peakEquity)}</p>
              <p className="text-[11px] text-stone-400 mt-1">Capital máximo expuesto</p>
            </div>
            <div className="p-4 rounded-xl bg-[#00423c]/5 border border-[#00423c]/10">
              <p className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">Margen s/GDV</p>
              <p className="text-2xl font-headline font-extrabold text-[#00423c]">{(result.marginOnGdv * 100).toFixed(1)}%</p>
              <p className="text-[11px] text-stone-400 mt-1">{result.monthsToSellOut} meses de venta · horizonte {result.horizonMonths}m</p>
            </div>
          </div>

          {/* Cost breakdown */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6 text-center">
            {[
              ['GDV (ventas)', result.gdv],
              ['Obra directa', result.directConstruction],
              ['Indirectos', result.softCosts],
              ['Contingencia', result.contingency],
              ['Comercialización', result.marketing],
              ['Utilidad', result.profit],
            ].map(([label, val]) => (
              <div key={label as string} className="bg-stone-50 rounded-lg p-3 border border-stone-100">
                <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1">{label}</p>
                <p className="text-sm font-bold text-on-surface">{fmtCompact(val as number)}</p>
              </div>
            ))}
          </div>

          {/* Cumulative cash flow */}
          <div>
            <h4 className="font-headline font-bold text-base text-on-surface mb-3">Flujo de Caja Acumulado</h4>
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="cfPos" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00423c" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#00423c" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f5f5f4" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#78716c', fontSize: 11 }} />
                  <YAxis tickFormatter={fmtCompact} axisLine={false} tickLine={false} tick={{ fill: '#78716c', fontSize: 11 }} width={70} />
                  <RechartsTooltip formatter={(v: number) => [fmtMXN(v), 'Acumulado']} contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <ReferenceLine y={0} stroke="#a8a29e" strokeDasharray="4 4" />
                  <Area type="monotone" dataKey="cumulative" stroke="#00423c" strokeWidth={2.5} fill="url(#cfPos)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-stone-400 mt-2">
              El valle (más negativo) marca el capital que necesitas aportar; el cruce a positivo, cuándo el proyecto se autofinancia.
              Asume terreno = {assumptions.landCost.trim() ? fmtMXN(Number(assumptions.landCost)) : 'cheque máx. descontado'}.
            </p>
          </div>
        </>
      ) : null}
    </div>
  );
}
