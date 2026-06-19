import { useState, useMemo, useEffect } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip,
  ScatterChart, Scatter, CartesianGrid, ZAxis, Cell
} from 'recharts';
import ProformaPanel from './ProformaPanel';
import MarketLiquidity from './MarketLiquidity';

interface SubjectProperty {
  name: string;
  area: number;
  totalPrice: number;
  location: string;
  lat?: number;
  lng?: number;
  constructionCostPerSqm?: number;
  targetMargin?: number;
  numberOfUnits?: number;
}

export default function YieldAnalysis({ data }: { data?: any }) {
  const [localData, setLocalData] = useState<any>(data);
  const [subjectInput, setSubjectInput] = useState({ 
    name: '', area: '', totalPrice: '', location: '', lat: '', lng: '',
    constructionCostPerSqm: '', targetMargin: '', numberOfUnits: ''
  });
  const [subjectProperty, setSubjectProperty] = useState<SubjectProperty | null>(null);

  useEffect(() => {
    if (!data) {
      const savedData = localStorage.getItem('real_estate_market_data');
      if (savedData) {
        try {
          setLocalData(JSON.parse(savedData));
        } catch (e) {
          console.error("Failed to parse saved market data", e);
        }
      }
    } else {
      setLocalData(data);
    }
  }, [data]);

  useEffect(() => {
    const savedSubject = localStorage.getItem('subject_property');
    if (savedSubject) {
      try {
        const parsed = JSON.parse(savedSubject);
        setSubjectProperty(parsed);
        setSubjectInput({
          name: parsed.name || '',
          area: parsed.area?.toString() || '',
          totalPrice: parsed.totalPrice?.toString() || '',
          location: parsed.location || '',
          lat: parsed.lat?.toString() || '',
          lng: parsed.lng?.toString() || '',
          constructionCostPerSqm: parsed.constructionCostPerSqm?.toString() || '',
          targetMargin: parsed.targetMargin?.toString() || '',
          numberOfUnits: parsed.numberOfUnits?.toString() || ''
        });
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  const properties = localData?.properties || [];

  const parsePrice = (priceStr: string) => Number(priceStr.replace(/[^0-9.-]+/g, ""));
  const parseSqm = (sqmStr: string) => Number(sqmStr.replace(/[^0-9.-]+/g, ""));

  const cleanLocationName = (loc: string) => {
    if (!loc) return '';
    return loc
      .replace(/,\s*Aguascalientes/gi, '')
      .replace(/Fraccionamiento\s+/gi, '')
      .trim();
  };

  const barData = useMemo(() => {
    const locationStats: Record<string, { totalPricePerSqm: number; count: number }> = {};

    properties.forEach((p: any) => {
      const price = parsePrice(p.price);
      const sqm = parseSqm(p.sqm);
      if (sqm > 0) {
        const pricePerSqm = price / sqm;
        const cleanLoc = cleanLocationName(p.location);
        if (!locationStats[cleanLoc]) {
          locationStats[cleanLoc] = { totalPricePerSqm: 0, count: 0 };
        }
        locationStats[cleanLoc].totalPricePerSqm += pricePerSqm;
        locationStats[cleanLoc].count += 1;
      }
    });

    const data = Object.entries(locationStats).map(([location, stats]) => ({
      location,
      avgPricePerSqm: stats.totalPricePerSqm / stats.count
    })).sort((a, b) => b.avgPricePerSqm - a.avgPricePerSqm);

    if (subjectProperty && subjectProperty.area > 0) {
      data.push({
        location: '✨ PROYECTO: ' + subjectProperty.name,
        avgPricePerSqm: subjectProperty.totalPrice / subjectProperty.area
      });
      data.sort((a, b) => b.avgPricePerSqm - a.avgPricePerSqm);
    }

    return data;
  }, [properties, subjectProperty]);

  const scatterData = useMemo(() => {
    const data = properties.map((p: any) => {
      const area = parseSqm(p.sqm);
      const price = parsePrice(p.price);
      const pricePerSqm = area > 0 ? price / area : 0;
      return {
        name: p.project,
        area: area,
        pricePerSqm: pricePerSqm,
        isSubject: false,
        z: 60
      };
    // Exclude listings without area (price/m² = 0) so they don't sit on the axis.
    }).filter((d: any) => d.pricePerSqm > 0);

    if (subjectProperty && subjectProperty.area > 0) {
      data.push({
        name: subjectProperty.name,
        area: subjectProperty.area,
        pricePerSqm: subjectProperty.totalPrice / subjectProperty.area,
        isSubject: true,
        z: 200
      });
    }

    return data;
  }, [properties, subjectProperty]);

  const macroMetrics = useMemo(() => {
    let totalArea = 0;
    let totalPrice = 0;
    let totalValidSqmCount = 0;
    let totalPricePerSqm = 0;
    
    let minArea = Infinity;
    let maxArea = -Infinity;

    let entryLevelCount = 0;
    let midMarketCount = 0;
    let premiumCount = 0;

    let valueSqmCount = 0;
    let standardSqmCount = 0;
    let luxurySqmCount = 0;

    const amenityCounts: Record<string, number> = {};

    let premiumWithPriceSqmSum = 0;
    let premiumWithCount = 0;
    let premiumWithoutPriceSqmSum = 0;
    let premiumWithoutCount = 0;

    properties.forEach((p: any) => {
      const price = parsePrice(p.price);
      const sqm = parseSqm(p.sqm);
      
      totalPrice += price;

      if (price < 3500000) entryLevelCount++;
      else if (price <= 5500000) midMarketCount++;
      else premiumCount++;

      let hasPremiumAmenity = false;

      if (Array.isArray(p.amenities)) {
        p.amenities.forEach((amenity: string) => {
          const cleanAmenity = amenity.replace(/_/g, ' ').toLowerCase();
          amenityCounts[cleanAmenity] = (amenityCounts[cleanAmenity] || 0) + 1;
          
          if (
            cleanAmenity.includes('roof garden') ||
            cleanAmenity.includes('pool') ||
            cleanAmenity.includes('alberca')
          ) {
            hasPremiumAmenity = true;
          }
        });
      }

      if (sqm > 0) {
        totalArea += sqm;
        totalValidSqmCount++;
        
        if (sqm < minArea) minArea = sqm;
        if (sqm > maxArea) maxArea = sqm;

        const pricePerSqm = price / sqm;
        totalPricePerSqm += pricePerSqm;

        if (pricePerSqm < 25000) valueSqmCount++;
        else if (pricePerSqm <= 35000) standardSqmCount++;
        else luxurySqmCount++;

        if (hasPremiumAmenity) {
          premiumWithPriceSqmSum += pricePerSqm;
          premiumWithCount++;
        } else {
          premiumWithoutPriceSqmSum += pricePerSqm;
          premiumWithoutCount++;
        }
      }
    });

    const totalProperties = properties.length;
    const avgTicket = totalProperties > 0 ? totalPrice / totalProperties : 0;
    const avgArea = totalValidSqmCount > 0 ? totalArea / totalValidSqmCount : 0;
    const avgPricePerSqm = totalValidSqmCount > 0 ? totalPricePerSqm / totalValidSqmCount : 0;
    
    if (minArea === Infinity) minArea = 0;
    if (maxArea === -Infinity) maxArea = 0;

    const topAmenities = Object.entries(amenityCounts)
      .map(([name, count]) => ({
        name,
        count,
        percentage: totalProperties > 0 ? Math.round((count / totalProperties) * 100) : 0
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);

    const avgPremiumWith = premiumWithCount > 0 ? premiumWithPriceSqmSum / premiumWithCount : 0;
    const avgPremiumWithout = premiumWithoutCount > 0 ? premiumWithoutPriceSqmSum / premiumWithoutCount : 0;

    return {
      totalProperties,
      avgTicket,
      avgPricePerSqm,
      avgArea,
      minArea,
      maxArea,
      entryLevelCount,
      midMarketCount,
      premiumCount,
      valueSqmCount,
      standardSqmCount,
      luxurySqmCount,
      topAmenities,
      avgPremiumWith,
      avgPremiumWithout
    };
  }, [properties]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      maximumFractionDigits: 0
    }).format(value);
  };

  const formatCompactCurrency = (value: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      notation: "compact",
      maximumFractionDigits: 1
    }).format(value);
  };

  const CustomScatterTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      if (data.isSubject) {
        return (
          <div className="bg-[#00423c] p-3 border border-[#FFD700] shadow-lg rounded-lg">
            <p className="font-bold text-[#FFD700] mb-1">
              ✨ PROYECTO OBJETIVO: {data.name} | {data.area}m² @ {formatCurrency(data.pricePerSqm)} | VS TENDENCIA
            </p>
          </div>
        );
      }
      return (
        <div className="bg-white p-3 border border-stone-200 shadow-lg rounded-lg">
          <p className="font-bold text-on-surface mb-1">{data.name}</p>
          <p className="text-sm text-stone-600">Área: {data.area} m²</p>
          <p className="text-sm text-stone-600">Precio/m²: {formatCurrency(data.pricePerSqm)}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="flex-1 p-8 bg-surface overflow-y-auto">
      <div className="mb-8">
        <h2 className="font-headline font-bold text-3xl text-on-surface">Market Yield & Pricing Analysis</h2>
        <p className="text-on-surface-variant mt-2">Financial intelligence and market trends</p>
      </div>

      {/* Simulator Panel */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100 mb-8 print:hidden">
        <h3 className="font-headline font-bold text-lg text-on-surface mb-4">✨ Simulador de Proyecto Objetivo</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Nombre del Proyecto</label>
            <input 
              type="text" 
              value={subjectInput.name}
              onChange={e => setSubjectInput({...subjectInput, name: e.target.value})}
              className="w-full bg-surface-container-lowest border border-stone-200 rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-[#00423c]/50"
              placeholder="Ej. Torre ABA"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Área (m²)</label>
            <input 
              type="number" 
              value={subjectInput.area}
              onChange={e => setSubjectInput({...subjectInput, area: e.target.value})}
              className="w-full bg-surface-container-lowest border border-stone-200 rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-[#00423c]/50"
              placeholder="Ej. 120"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Precio Total ($)</label>
            <input 
              type="number" 
              value={subjectInput.totalPrice}
              onChange={e => setSubjectInput({...subjectInput, totalPrice: e.target.value})}
              className="w-full bg-surface-container-lowest border border-stone-200 rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-[#00423c]/50"
              placeholder="Ej. 4500000"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Zona (Ubicación)</label>
            <input 
              type="text" 
              value={subjectInput.location}
              onChange={e => setSubjectInput({...subjectInput, location: e.target.value})}
              className="w-full bg-surface-container-lowest border border-stone-200 rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-[#00423c]/50"
              placeholder="Ej. San Telmo"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Latitud (Opcional)</label>
            <input 
              type="number" 
              value={subjectInput.lat}
              onChange={e => setSubjectInput({...subjectInput, lat: e.target.value})}
              className="w-full bg-surface-container-lowest border border-stone-200 rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-[#00423c]/50"
              placeholder="Ej. 21.928"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Longitud (Opcional)</label>
            <input 
              type="number" 
              value={subjectInput.lng}
              onChange={e => setSubjectInput({...subjectInput, lng: e.target.value})}
              className="w-full bg-surface-container-lowest border border-stone-200 rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-[#00423c]/50"
              placeholder="Ej. -102.296"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Costo Directo de Construcción ($/m²)</label>
            <input 
              type="number" 
              value={subjectInput.constructionCostPerSqm}
              onChange={e => setSubjectInput({...subjectInput, constructionCostPerSqm: e.target.value})}
              className="w-full bg-surface-container-lowest border border-stone-200 rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-[#00423c]/50"
              placeholder="Ej. 15000"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Margen de Utilidad Esperado (%)</label>
            <input 
              type="number" 
              value={subjectInput.targetMargin}
              onChange={e => setSubjectInput({...subjectInput, targetMargin: e.target.value})}
              className="w-full bg-surface-container-lowest border border-stone-200 rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-[#00423c]/50"
              placeholder="Ej. 20"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Número de Unidades</label>
            <input 
              type="number" 
              value={subjectInput.numberOfUnits}
              onChange={e => setSubjectInput({...subjectInput, numberOfUnits: e.target.value})}
              className="w-full bg-surface-container-lowest border border-stone-200 rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-[#00423c]/50"
              placeholder="Ej. 25"
            />
          </div>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={() => {
              if (subjectInput.name && subjectInput.area && subjectInput.totalPrice) {
                const newSubject = {
                  name: subjectInput.name,
                  area: Number(subjectInput.area),
                  totalPrice: Number(subjectInput.totalPrice),
                  location: subjectInput.location,
                  lat: subjectInput.lat ? Number(subjectInput.lat) : undefined,
                  lng: subjectInput.lng ? Number(subjectInput.lng) : undefined,
                  constructionCostPerSqm: subjectInput.constructionCostPerSqm ? Number(subjectInput.constructionCostPerSqm) : undefined,
                  targetMargin: subjectInput.targetMargin ? Number(subjectInput.targetMargin) : undefined,
                  numberOfUnits: subjectInput.numberOfUnits ? Number(subjectInput.numberOfUnits) : undefined
                };
                setSubjectProperty(newSubject);
                localStorage.setItem('subject_property', JSON.stringify(newSubject));
                window.dispatchEvent(new Event('subject_property_updated'));
              }
            }}
            className="bg-[#00423c] text-[#FFD700] px-6 py-2 rounded-lg font-bold text-sm hover:bg-[#00423c]/90 transition-colors h-[38px]"
          >
            Simular / Superponer
          </button>
          <button 
            onClick={() => {
              setSubjectProperty(null);
              setSubjectInput({ name: '', area: '', totalPrice: '', location: '', lat: '', lng: '', constructionCostPerSqm: '', targetMargin: '', numberOfUnits: '' });
              localStorage.removeItem('subject_property');
              window.dispatchEvent(new Event('subject_property_updated'));
            }}
            className="bg-stone-200 text-stone-700 px-6 py-2 rounded-lg font-bold text-sm hover:bg-stone-300 transition-colors h-[38px]"
          >
            Limpiar Simulación
          </button>
        </div>
        {subjectProperty && subjectProperty.area > 0 && (
          <div className="mt-6 space-y-4">
            <div className="p-4 bg-[#00423c]/5 rounded-xl border border-[#00423c]/10 flex items-center gap-4">
              <span className="text-sm font-bold text-stone-600 uppercase tracking-wider">Precio/m² Calculado:</span>
              <span className="text-2xl font-headline font-extrabold text-[#00423c]">
                {formatCurrency(subjectProperty.totalPrice / subjectProperty.area)}
              </span>
            </div>

            {subjectProperty.constructionCostPerSqm && subjectProperty.targetMargin && subjectProperty.numberOfUnits && (
              (() => {
                const totalConstructionCost = subjectProperty.constructionCostPerSqm * subjectProperty.area;
                const targetProfit = subjectProperty.totalPrice * (subjectProperty.targetMargin / 100);
                const unitResidualLandValue = subjectProperty.totalPrice - totalConstructionCost - targetProfit;
                const totalProjectResidualValue = unitResidualLandValue * subjectProperty.numberOfUnits;
                const totalGDV = subjectProperty.totalPrice * subjectProperty.numberOfUnits;
                const landIncidence = (unitResidualLandValue / subjectProperty.totalPrice) * 100;

                let incidenceColorClass = "text-[#00423c]";
                let incidenceBgClass = "bg-[#00423c]/5 border-[#00423c]/10";
                
                if (landIncidence > 25) {
                  incidenceColorClass = "text-red-600";
                  incidenceBgClass = "bg-red-50 border-red-200";
                } else if (landIncidence < 20) {
                  incidenceColorClass = "text-green-600";
                  incidenceBgClass = "bg-green-50 border-green-200";
                }

                return (
                  <div className={`p-6 rounded-xl border ${incidenceBgClass}`}>
                    <h4 className="font-headline font-bold text-lg text-on-surface mb-4">Termómetro de Viabilidad (Visión Proyecto)</h4>
                    
                    {unitResidualLandValue < 0 ? (
                      <div className="text-red-600 font-bold text-lg">
                        ⚠️ Proyecto Inviable a este Precio/Costo
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                          <span className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">Cheque Máximo por Terreno</span>
                          <span className={`text-4xl font-headline font-extrabold ${incidenceColorClass}`}>
                            {formatCurrency(totalProjectResidualValue)}
                          </span>
                        </div>
                        <div>
                          <span className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">Ventas Totales (GDV)</span>
                          <span className={`text-4xl font-headline font-extrabold ${incidenceColorClass}`}>
                            {formatCurrency(totalGDV)}
                          </span>
                        </div>
                        <div>
                          <span className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">Incidencia de Tierra</span>
                          <span className={`text-4xl font-headline font-extrabold ${incidenceColorClass}`}>
                            {landIncidence.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()
            )}
          </div>
        )}
      </div>

      {/* Pro-forma & TIR — cash-flow model for the simulated project */}
      <ProformaPanel
        subject={
          subjectProperty
            ? {
                area: subjectProperty.area,
                numberOfUnits: subjectProperty.numberOfUnits,
                totalPrice: subjectProperty.totalPrice,
                constructionCostPerSqm: subjectProperty.constructionCostPerSqm,
              }
            : null
        }
      />

      {/* Market liquidity — days on market */}
      <MarketLiquidity properties={properties} />

      {/* Row 1: Macro Metrics & Areas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6 print:break-inside-avoid">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100">
          <p className="text-sm font-bold text-stone-500 uppercase tracking-wider mb-2">Total Properties</p>
          <p className="text-3xl font-headline font-extrabold text-[#00423c]">{macroMetrics.totalProperties}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100">
          <p className="text-sm font-bold text-stone-500 uppercase tracking-wider mb-2">Avg Ticket</p>
          <p className="text-3xl font-headline font-extrabold text-[#00423c]">
            {formatCurrency(macroMetrics.avgTicket)}
          </p>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100">
          <p className="text-sm font-bold text-stone-500 uppercase tracking-wider mb-2">Avg Price per m²</p>
          <p className="text-3xl font-headline font-extrabold text-[#00423c]">
            {formatCurrency(macroMetrics.avgPricePerSqm)}
          </p>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100">
          <p className="text-sm font-bold text-stone-500 uppercase tracking-wider mb-2">Average Area</p>
          <p className="text-3xl font-headline font-extrabold text-[#00423c]">
            {Math.round(macroMetrics.avgArea)} m²
          </p>
          <p className="text-xs text-stone-400 mt-1 font-medium">
            Min: {Math.round(macroMetrics.minArea)} m² - Max: {Math.round(macroMetrics.maxArea)} m²
          </p>
        </div>
      </div>

      {/* Row 2: Total Ticket Segmentation */}
      <div className="mb-6 print:break-inside-avoid">
        <h3 className="font-headline font-bold text-lg text-on-surface mb-4">Total Ticket Segmentation</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100">
            <p className="text-sm font-bold text-stone-500 uppercase tracking-wider mb-2">Entry Level</p>
            <p className="text-xs text-stone-400 mb-2">&lt; $3.5M MXN</p>
            <p className="text-4xl font-headline font-extrabold text-[#00423c]">{macroMetrics.entryLevelCount}</p>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100">
            <p className="text-sm font-bold text-stone-500 uppercase tracking-wider mb-2">Mid Market</p>
            <p className="text-xs text-stone-400 mb-2">$3.5M - $5.5M MXN</p>
            <p className="text-4xl font-headline font-extrabold text-[#00423c]">{macroMetrics.midMarketCount}</p>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100">
            <p className="text-sm font-bold text-stone-500 uppercase tracking-wider mb-2">Premium</p>
            <p className="text-xs text-stone-400 mb-2">&gt; $5.5M MXN</p>
            <p className="text-4xl font-headline font-extrabold text-[#00423c]">{macroMetrics.premiumCount}</p>
          </div>
        </div>
      </div>

      {/* Row 3: Price per m² Segmentation */}
      <div className="mb-6 print:break-inside-avoid">
        <h3 className="font-headline font-bold text-lg text-on-surface mb-4">Price per m² Segmentation</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100">
            <p className="text-sm font-bold text-stone-500 uppercase tracking-wider mb-2">Value m²</p>
            <p className="text-xs text-stone-400 mb-2">&lt; $25,000/m²</p>
            <p className="text-4xl font-headline font-extrabold text-[#00423c]">{macroMetrics.valueSqmCount}</p>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100">
            <p className="text-sm font-bold text-stone-500 uppercase tracking-wider mb-2">Standard m²</p>
            <p className="text-xs text-stone-400 mb-2">$25,000 - $35,000/m²</p>
            <p className="text-4xl font-headline font-extrabold text-[#00423c]">{macroMetrics.standardSqmCount}</p>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100">
            <p className="text-sm font-bold text-stone-500 uppercase tracking-wider mb-2">Luxury m²</p>
            <p className="text-xs text-stone-400 mb-2">&gt; $35,000/m²</p>
            <p className="text-4xl font-headline font-extrabold text-[#00423c]">{macroMetrics.luxurySqmCount}</p>
          </div>
        </div>
      </div>

      {/* Row 4: Amenity Intelligence */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 print:break-inside-avoid">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100">
          <h3 className="font-headline font-bold text-lg text-on-surface mb-6">Top Amenities Coverage</h3>
          <div className="space-y-4">
            {macroMetrics.topAmenities.map((amenity, index) => (
              <div key={index} className="flex items-center gap-4">
                <div className="w-32 text-sm font-semibold text-stone-700 truncate capitalize">
                  {amenity.name}
                </div>
                <div className="flex-1 h-3 bg-stone-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-[#8cd4c8] rounded-full" 
                    style={{ width: `${amenity.percentage}%` }}
                  />
                </div>
                <div className="w-12 text-right text-sm font-bold text-[#00423c]">
                  {amenity.percentage}%
                </div>
              </div>
            ))}
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100">
          <h3 className="font-headline font-bold text-lg text-on-surface mb-6">Premium Indicator</h3>
          <p className="text-sm text-stone-500 mb-4">Impact of Roof Garden or Alberca on Price/m²</p>
          
          <div className="space-y-6">
            <div>
              <p className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-1">With Premium Amenities</p>
              <p className="text-2xl font-headline font-extrabold text-[#00423c]">
                {formatCurrency(macroMetrics.avgPremiumWith)}<span className="text-lg font-medium text-stone-500">/m²</span>
              </p>
            </div>
            <div className="h-px bg-stone-100 w-full"></div>
            <div>
              <p className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-1">Without Premium Amenities</p>
              <p className="text-2xl font-headline font-extrabold text-[#00423c]">
                {formatCurrency(macroMetrics.avgPremiumWithout)}<span className="text-lg font-medium text-stone-500">/m²</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Bar Chart Card */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100 print:break-inside-avoid">
          <h3 className="font-headline font-bold text-lg text-on-surface mb-6">Precio Promedio por m² por Zona</h3>
          <div className="h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={barData} margin={{ top: 20, right: 30, left: 40, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} vertical={true} stroke="#f5f5f4" />
                <XAxis 
                  type="number"
                  tickFormatter={formatCompactCurrency}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#78716c', fontSize: 12 }}
                />
                <YAxis 
                  type="category"
                  dataKey="location" 
                  width={120}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#78716c', fontSize: 12 }}
                />
                <RechartsTooltip 
                  formatter={(value: number) => [formatCurrency(value), 'Precio/m²']}
                  cursor={{ fill: '#f5f5f4' }}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="avgPricePerSqm" radius={[0, 4, 4, 0]}>
                  {barData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.location.includes('✨ PROYECTO') ? '#FFD700' : '#044e45'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Scatter Chart Card */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100 print:break-inside-avoid">
          <h3 className="font-headline font-bold text-lg text-on-surface mb-6">Tendencia de Mercado: Área vs Precio por m²</h3>
          <div className="h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f4" />
                <XAxis 
                  type="number" 
                  dataKey="area" 
                  name="Área" 
                  unit=" m²"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#78716c', fontSize: 12 }}
                />
                <YAxis 
                  type="number" 
                  dataKey="pricePerSqm" 
                  name="Precio/m²" 
                  tickFormatter={formatCompactCurrency}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#78716c', fontSize: 12 }}
                />
                <ZAxis type="number" dataKey="z" range={[60, 200]} name="Tamaño" />
                <RechartsTooltip content={<CustomScatterTooltip />} cursor={{ strokeDasharray: '3 3' }} />
                <Scatter name="Propiedades" data={scatterData}>
                  {scatterData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.isSubject ? '#FFD700' : '#044e45'} 
                      opacity={entry.isSubject ? 1 : 0.7} 
                    />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
