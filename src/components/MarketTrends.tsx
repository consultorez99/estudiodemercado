import { useState, useEffect, useMemo } from 'react';
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip 
} from 'recharts';
import { TrendingUp, AlertCircle } from 'lucide-react';

interface SavedStudy {
  id: string;
  name: string;
  date: string;
  data: any;
}

export default function MarketTrends() {
  const [history, setHistory] = useState<SavedStudy[]>([]);

  useEffect(() => {
    const savedHistory = localStorage.getItem('archivist_history');
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error("Failed to parse history", e);
      }
    }
  }, []);

  const parsePrice = (priceStr: string) => Number(priceStr.replace(/[^0-9.-]+/g, ""));
  const parseSqm = (sqmStr: string) => Number(sqmStr.replace(/[^0-9.-]+/g, ""));

  const chartData = useMemo(() => {
    if (history.length === 0) return [];

    // Sort chronologically (oldest first)
    const sortedHistory = [...history].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return sortedHistory.map(study => {
      const properties = study.data?.properties || [];
      let totalPricePerSqm = 0;
      let validCount = 0;

      properties.forEach((p: any) => {
        const price = parsePrice(p.price);
        const sqm = parseSqm(p.sqm);
        if (sqm > 0 && price > 0) {
          totalPricePerSqm += (price / sqm);
          validCount++;
        }
      });

      const avgPricePerSqm = validCount > 0 ? totalPricePerSqm / validCount : 0;

      // Format date for display (e.g., "Mar 2026")
      const dateObj = new Date(study.date);
      const formattedDate = new Intl.DateTimeFormat('es-MX', { month: 'short', year: 'numeric' }).format(dateObj);

      return {
        name: study.name,
        date: formattedDate,
        fullDate: study.date,
        avgPricePerSqm: Math.round(avgPricePerSqm)
      };
    }).filter(d => d.avgPricePerSqm > 0);
  }, [history]);

  const appreciationRate = useMemo(() => {
    if (chartData.length < 2) return null;
    const firstAvg = chartData[0].avgPricePerSqm;
    const lastAvg = chartData[chartData.length - 1].avgPricePerSqm;
    if (firstAvg === 0) return 0;
    return ((lastAvg / firstAvg) - 1) * 100;
  }, [chartData]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      maximumFractionDigits: 0
    }).format(value);
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-4 border border-stone-200 shadow-xl rounded-xl">
          <p className="font-bold text-stone-800 mb-1">{data.name}</p>
          <p className="text-xs text-stone-500 mb-3">{data.date}</p>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#00423c]"></div>
            <p className="font-bold text-[#00423c] text-lg">
              {formatCurrency(data.avgPricePerSqm)}<span className="text-sm font-medium text-stone-500">/m²</span>
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="flex-1 p-8 bg-surface overflow-y-auto">
      <div className="mb-8">
        <h2 className="font-headline font-bold text-3xl text-on-surface flex items-center gap-3">
          <TrendingUp className="text-[#00423c]" size={32} />
          Market Trends
        </h2>
        <p className="text-on-surface-variant mt-2">Historical appreciation analysis based on saved studies</p>
      </div>

      {chartData.length < 2 ? (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-8 flex flex-col items-center justify-center text-center">
          <AlertCircle className="text-amber-500 mb-4" size={48} />
          <h3 className="text-xl font-bold text-amber-800 mb-2">Datos Insuficientes</h3>
          <p className="text-amber-700 max-w-md">
            Se requieren al menos 2 estudios históricos guardados en el Archive para calcular tendencias de plusvalía.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* KPI Card */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100 flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-stone-500 uppercase tracking-wider mb-1">Tasa de Plusvalía Histórica</p>
              <p className="text-xs text-stone-400">Desde {chartData[0].date} hasta {chartData[chartData.length - 1].date}</p>
            </div>
            <div className={`px-6 py-3 rounded-xl flex items-center gap-3 ${appreciationRate && appreciationRate >= 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              <TrendingUp size={24} className={appreciationRate && appreciationRate < 0 ? 'rotate-180 transform' : ''} />
              <span className="text-3xl font-headline font-extrabold">
                {appreciationRate && appreciationRate > 0 ? '+' : ''}{appreciationRate?.toFixed(1)}%
              </span>
            </div>
          </div>

          {/* Chart */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100">
            <h3 className="font-headline font-bold text-lg text-on-surface mb-6">Evolución del Precio Promedio por m²</h3>
            <div className="h-[400px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                  <defs>
                    <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00423c" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#00423c" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f5f5f4" />
                  <XAxis 
                    dataKey="date" 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#78716c', fontSize: 12 }}
                    dy={10}
                  />
                  <YAxis 
                    domain={['auto', 'auto']}
                    tickFormatter={(val) => `$${(val/1000).toFixed(0)}k`}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#78716c', fontSize: 12 }}
                    dx={-10}
                  />
                  <RechartsTooltip content={<CustomTooltip />} />
                  <Area 
                    type="monotone" 
                    dataKey="avgPricePerSqm" 
                    stroke="#00423c" 
                    strokeWidth={3}
                    fillOpacity={1} 
                    fill="url(#colorPrice)" 
                    activeDot={{ r: 8, fill: '#FFD700', stroke: '#00423c', strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
