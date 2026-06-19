import { useState, useEffect, useMemo } from 'react';
import { Percent, AlertCircle, TrendingUp } from 'lucide-react';

const parsePrice = (s: string) => Number((s || '').replace(/[^0-9.-]+/g, ''));
const parseSqm = (s: string) => Number((s || '').replace(/[^0-9.-]+/g, ''));

const cleanLocation = (loc: string) =>
  (loc || '').replace(/,\s*Aguascalientes/gi, '').replace(/Fraccionamiento\s+/gi, '').trim();

const median = (nums: number[]): number => {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

// Build a map zone -> median price/m² from a list of listings.
function pricePerSqmByZone(properties: any[]): Map<string, { values: number[]; count: number }> {
  const map = new Map<string, { values: number[]; count: number }>();
  (properties || []).forEach((p: any) => {
    const price = parsePrice(p.price);
    const sqm = parseSqm(p.sqm);
    if (price > 0 && sqm > 0) {
      const zone = cleanLocation(p.location) || 'Sin zona';
      const entry = map.get(zone) ?? { values: [], count: 0 };
      entry.values.push(price / sqm);
      entry.count += 1;
      map.set(zone, entry);
    }
  });
  return map;
}

const DEFAULTS = { expenseRatio: '25', vacancy: '5' };

export default function CapRateEstimator({ data }: { data: any }) {
  const [rentalData, setRentalData] = useState<any[]>([]);
  const [assumptions, setAssumptions] = useState(DEFAULTS);

  const loadRental = () => {
    const raw = localStorage.getItem('rental_data');
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        setRentalData(Array.isArray(parsed.properties) ? parsed.properties : []);
      } catch {
        setRentalData([]);
      }
    } else {
      setRentalData([]);
    }
  };

  useEffect(() => {
    loadRental();
    const saved = localStorage.getItem('caprate_assumptions');
    if (saved) {
      try {
        setAssumptions({ ...DEFAULTS, ...JSON.parse(saved) });
      } catch {
        /* ignore */
      }
    }
    window.addEventListener('rental_data_updated', loadRental);
    return () => window.removeEventListener('rental_data_updated', loadRental);
  }, []);

  const update = (key: keyof typeof DEFAULTS, value: string) => {
    setAssumptions((prev) => {
      const next = { ...prev, [key]: value };
      localStorage.setItem('caprate_assumptions', JSON.stringify(next));
      return next;
    });
  };

  const expenseRatio = (Number(assumptions.expenseRatio) || 0) / 100;
  const vacancy = (Number(assumptions.vacancy) || 0) / 100;
  const noiFactor = Math.max(0, (1 - vacancy) * (1 - expenseRatio));

  const rows = useMemo(() => {
    const saleZones = pricePerSqmByZone(data?.properties || []);
    const rentZones = pricePerSqmByZone(rentalData);

    const result: {
      zone: string;
      salePerSqm: number;
      rentPerSqm: number;
      grossYield: number;
      netCapRate: number;
      paybackYears: number;
      saleN: number;
      rentN: number;
    }[] = [];

    rentZones.forEach((rent, zone) => {
      const sale = saleZones.get(zone);
      if (!sale) return; // need both rent and sale comps in the zone
      const salePerSqm = median(sale.values);
      const rentPerSqm = median(rent.values); // monthly
      if (salePerSqm <= 0 || rentPerSqm <= 0) return;
      const grossYield = (rentPerSqm * 12) / salePerSqm;
      const netCapRate = grossYield * noiFactor;
      result.push({
        zone,
        salePerSqm,
        rentPerSqm,
        grossYield,
        netCapRate,
        paybackYears: grossYield > 0 ? 1 / grossYield : 0,
        saleN: sale.count,
        rentN: rent.count,
      });
    });

    return result.sort((a, b) => b.netCapRate - a.netCapRate);
  }, [data, rentalData, noiFactor]);

  const marketCapRate = rows.length > 0 ? median(rows.map((r) => r.netCapRate)) : 0;
  const hasRental = rentalData.length > 0;

  const fmtMXN0 = (v: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(v);
  const inputCls = 'w-full bg-surface-container-lowest border border-stone-200 rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-[#00423c]/50';

  return (
    <div className="flex-1 p-8 bg-surface overflow-y-auto">
      <div className="mb-8">
        <h2 className="font-headline font-bold text-3xl text-on-surface flex items-center gap-3">
          <Percent className="text-[#00423c]" size={30} /> Estimador de Renta & Cap Rate
        </h2>
        <p className="text-on-surface-variant mt-2">Rendimiento de inversión por zona: cruza precio de venta vs. renta de mercado.</p>
      </div>

      {/* Assumptions */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
          <div>
            <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Gastos operativos (% renta)</label>
            <input type="number" className={inputCls} value={assumptions.expenseRatio} onChange={(e) => update('expenseRatio', e.target.value)} />
            <p className="text-[11px] text-stone-400 mt-1">Predial, mantenimiento, administración, seguro</p>
          </div>
          <div>
            <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Vacancia (%)</label>
            <input type="number" className={inputCls} value={assumptions.vacancy} onChange={(e) => update('vacancy', e.target.value)} />
            <p className="text-[11px] text-stone-400 mt-1">Meses sin rentar al año</p>
          </div>
          <div className="p-4 rounded-xl bg-[#00423c]/5 border border-[#00423c]/10">
            <p className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">Cap rate neto de mercado (mediana)</p>
            <p className="text-3xl font-headline font-extrabold text-[#00423c]">{rows.length > 0 ? `${(marketCapRate * 100).toFixed(1)}%` : '—'}</p>
          </div>
        </div>
      </div>

      {!hasRental ? (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-8 flex flex-col items-center text-center">
          <AlertCircle className="text-amber-500 mb-4" size={48} />
          <h3 className="text-xl font-bold text-amber-800 mb-2">Faltan comparables de renta</h3>
          <p className="text-amber-700 max-w-lg">
            Navega la sección de <b>renta</b> del portal (p. ej. "casas/departamentos en renta") y captura con la extensión.
            Se guardan en un almacén aparte y aquí se cruzan con tus precios de venta para calcular el cap rate por zona.
          </p>
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-8 text-center text-amber-700">
          Tienes {rentalData.length} comparables de renta, pero ninguna zona coincide con tus datos de venta. Captura venta y renta de las mismas colonias.
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-stone-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[760px]">
              <thead>
                <tr className="border-b border-stone-100">
                  {['Zona', 'Venta $/m²', 'Renta $/m²·mes', 'Yield bruto', 'Cap rate neto', 'Años de renta'].map((h) => (
                    <th key={h} className="py-4 px-6 text-xs font-bold uppercase tracking-widest text-stone-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {rows.map((r) => (
                  <tr key={r.zone} className="hover:bg-stone-50/50">
                    <td className="py-4 px-6 font-bold text-on-surface">
                      {r.zone}
                      <span className="block text-[10px] font-medium text-stone-400">venta n={r.saleN} · renta n={r.rentN}</span>
                    </td>
                    <td className="py-4 px-6 text-sm text-stone-600">{fmtMXN0(r.salePerSqm)}</td>
                    <td className="py-4 px-6 text-sm text-stone-600">{fmtMXN0(r.rentPerSqm)}</td>
                    <td className="py-4 px-6 text-sm font-semibold text-stone-700">{(r.grossYield * 100).toFixed(1)}%</td>
                    <td className="py-4 px-6">
                      <span className={`inline-flex items-center gap-1 font-headline font-extrabold ${r.netCapRate >= 0.06 ? 'text-green-600' : r.netCapRate >= 0.045 ? 'text-[#00423c]' : 'text-red-600'}`}>
                        {r.netCapRate >= 0.06 && <TrendingUp size={15} />}
                        {(r.netCapRate * 100).toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-4 px-6 text-sm text-stone-600">{r.paybackYears.toFixed(0)} años</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-4 bg-stone-50 border-t border-stone-100 text-xs text-stone-400">
            Cap rate neto = (renta anual × {(noiFactor * 100).toFixed(0)}% tras vacancia y gastos) ÷ precio de venta. Verde ≥ 6% · rojo &lt; 4.5%.
          </div>
        </div>
      )}
    </div>
  );
}
