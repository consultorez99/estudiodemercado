import { useMemo } from 'react';
import { Clock, AlertTriangle } from 'lucide-react';

const median = (nums: number[]): number => {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

const cleanLocation = (loc: string) =>
  (loc || '')
    .replace(/,\s*Aguascalientes/gi, '')
    .replace(/Fraccionamiento\s+/gi, '')
    .trim();

const STAGNANT_DAYS = 180;

export default function MarketLiquidity({ properties }: { properties: any[] }) {
  const stats = useMemo(() => {
    const withDom = (properties || [])
      .map((p: any) => ({ dom: typeof p.daysOnMarket === 'number' ? p.daysOnMarket : null, location: p.location }))
      .filter((p): p is { dom: number; location: string } => p.dom != null && p.dom >= 0);

    if (withDom.length === 0) return null;

    const all = withDom.map((p) => p.dom);
    const stagnant = all.filter((d) => d > STAGNANT_DAYS).length;

    const byZone: Record<string, number[]> = {};
    withDom.forEach((p) => {
      const z = cleanLocation(p.location) || 'Sin zona';
      (byZone[z] ??= []).push(p.dom);
    });

    const zones = Object.entries(byZone)
      .map(([zone, doms]) => ({ zone, median: Math.round(median(doms)), count: doms.length }))
      .filter((z) => z.count >= 1)
      .sort((a, b) => a.median - b.median);

    return {
      sample: withDom.length,
      medianDom: Math.round(median(all)),
      avgDom: Math.round(all.reduce((a, b) => a + b, 0) / all.length),
      stagnantPct: Math.round((stagnant / all.length) * 100),
      stagnantCount: stagnant,
      zones,
    };
  }, [properties]);

  const maxZoneMedian = stats ? Math.max(...stats.zones.map((z) => z.median), 1) : 1;

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100 mb-8 print:break-inside-avoid">
      <h3 className="font-headline font-bold text-lg text-on-surface mb-1 flex items-center gap-2">
        <Clock size={20} className="text-[#00423c]" /> Liquidez de Mercado — Días en Mercado
      </h3>
      <p className="text-sm text-stone-500 mb-5">
        Qué tan rápido se mueve el inventario. Más días = menor liquidez y mayor costo de acarreo; informa tu velocidad de absorción en la pro-forma.
      </p>

      {!stats ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          Aún no hay datos de días en mercado en el inventario. Se llenan cuando los anuncios traen fecha de
          publicación (vía importación de texto con IA o captura de la ficha de detalle).
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="p-4 rounded-xl bg-[#00423c]/5 border border-[#00423c]/10">
              <p className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">Mediana en mercado</p>
              <p className="text-2xl font-headline font-extrabold text-[#00423c]">{stats.medianDom} <span className="text-base font-medium text-stone-400">días</span></p>
            </div>
            <div className="p-4 rounded-xl bg-[#00423c]/5 border border-[#00423c]/10">
              <p className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">Promedio</p>
              <p className="text-2xl font-headline font-extrabold text-[#00423c]">{stats.avgDom} <span className="text-base font-medium text-stone-400">días</span></p>
            </div>
            <div className={`p-4 rounded-xl border ${stats.stagnantPct >= 30 ? 'bg-red-50 border-red-200' : 'bg-[#00423c]/5 border-[#00423c]/10'}`}>
              <p className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">Estancado (&gt;{STAGNANT_DAYS}d)</p>
              <p className={`text-2xl font-headline font-extrabold ${stats.stagnantPct >= 30 ? 'text-red-600' : 'text-[#00423c]'}`}>
                {stats.stagnantPct}% <span className="text-base font-medium text-stone-400">({stats.stagnantCount})</span>
              </p>
            </div>
            <div className="p-4 rounded-xl bg-[#00423c]/5 border border-[#00423c]/10">
              <p className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">Muestra</p>
              <p className="text-2xl font-headline font-extrabold text-[#00423c]">{stats.sample} <span className="text-base font-medium text-stone-400">anuncios</span></p>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-headline font-bold text-base text-on-surface">Mediana de días por zona</h4>
              <span className="text-xs text-stone-400">menos días = más líquido</span>
            </div>
            <div className="space-y-2.5">
              {stats.zones.slice(0, 8).map((z) => {
                const slow = z.median > STAGNANT_DAYS;
                return (
                  <div key={z.zone} className="flex items-center gap-3">
                    <div className="w-40 text-sm font-medium text-stone-700 truncate" title={z.zone}>{z.zone}</div>
                    <div className="flex-1 h-3 bg-stone-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${slow ? 'bg-red-400' : 'bg-[#8cd4c8]'}`} style={{ width: `${Math.max(4, (z.median / maxZoneMedian) * 100)}%` }} />
                    </div>
                    <div className={`w-24 text-right text-sm font-bold ${slow ? 'text-red-600' : 'text-[#00423c]'}`}>
                      {z.median}d {slow && <AlertTriangle size={13} className="inline -mt-0.5" />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
