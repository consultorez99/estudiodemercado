import { useState, useMemo, useEffect } from 'react';
import { Layers, Filter, ArrowRight, Waves, Dumbbell, Car, Sun, Shield, TreePine, Coffee, Briefcase, Flower2, Home, CheckCircle2 } from 'lucide-react';
import { MapContainer, TileLayer, CircleMarker, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { getCoordinates } from '../utils/geo';

const getAmenityIcon = (name: string, index: number) => {
  const props = { size: 20, className: "text-stone-400" };
  switch(name) {
    case 'pool':
    case 'indoor_pool':
    case 'heated_pool':
    case 'kids_pool': return <Waves key={index} {...props} />;
    case 'gym': return <Dumbbell key={index} {...props} />;
    case 'parking':
    case 'covered_parking':
    case 'underground_parking':
    case 'guest_parking':
    case 'outdoor_parking': return <Car key={index} {...props} />;
    case 'sun': return <Sun key={index} {...props} />;
    case 'shield':
    case 'security':
    case 'security_cameras':
    case 'controlled_access': return <Shield key={index} {...props} />;
    case 'tree':
    case 'green areas':
    case 'green_areas':
    case 'garden': return <TreePine key={index} {...props} />;
    case 'coffee': return <Coffee key={index} {...props} />;
    case 'coworking':
    case 'business_center': return <Briefcase key={index} {...props} />;
    case 'roof garden':
    case 'roof_garden':
    case 'private_roof_garden':
    case 'terrace':
    case 'balcony': return <Flower2 key={index} {...props} />;
    case 'clubhouse':
    case 'event_hall':
    case 'multi_purpose_room': return <Home key={index} {...props} />;
    default: return <CheckCircle2 key={index} {...props} />;
  }
};

const getHeatmapColor = (pricePerSqm: number) => {
  if (pricePerSqm > 40000) return '#e11d48'; // High Premium (Rose-600)
  if (pricePerSqm >= 30000) return '#f59e0b'; // Mid/High Market (Amber-500)
  return '#0d9488'; // Value Market (Teal-600)
};

export default function Dashboard({ data, onNavigate }: { data: any, onNavigate: (view: string) => void }) {
  const [mapType, setMapType] = useState('map');
  const [isHeatmapActive, setIsHeatmapActive] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState('All');
  const [maxPrice, setMaxPrice] = useState('All');
  const [projectStage, setProjectStage] = useState('Todos');
  const [hideStagnant, setHideStagnant] = useState(false);
  const [subjectProperty, setSubjectProperty] = useState<any>(null);

  const loadSubjectProperty = () => {
    const saved = localStorage.getItem('subject_property');
    if (saved) {
      try {
        setSubjectProperty(JSON.parse(saved));
      } catch (e) {
        console.error(e);
      }
    } else {
      setSubjectProperty(null);
    }
  };

  useEffect(() => {
    loadSubjectProperty();
    window.addEventListener('subject_property_updated', loadSubjectProperty);
    return () => window.removeEventListener('subject_property_updated', loadSubjectProperty);
  }, []);

  // Dynamic KPI Calculations
  const propertiesWithCoords = useMemo(() => {
    return data.properties.map((p: any) => ({
      ...p,
      coords: getCoordinates(p.location, p.id)
    }));
  }, [data.properties]);

  const uniqueLocations = useMemo(() => {
    const locations = new Set(propertiesWithCoords.map((p: any) => p.location));
    return ['All', ...Array.from(locations)] as string[];
  }, [propertiesWithCoords]);

  const filteredData = useMemo(() => {
    return propertiesWithCoords.filter((p: any) => {
      const priceNum = Number(p.price.replace(/[^0-9.-]+/g, ""));
      const matchesLocation = selectedLocation === 'All' || p.location === selectedLocation;
      
      let matchesPrice = true;
      if (maxPrice !== 'All') {
        const limit = Number(maxPrice);
        matchesPrice = priceNum <= limit;
      }

      const matchesStage = projectStage === 'Todos' || p.status === projectStage;
      const matchesStagnant = hideStagnant ? (p.daysOnMarket === null || p.daysOnMarket <= 180) : true;

      return matchesLocation && matchesPrice && matchesStage && matchesStagnant;
    });
  }, [propertiesWithCoords, selectedLocation, maxPrice, projectStage, hideStagnant]);
  
  const parsePrice = (priceStr: string) => Number(priceStr.replace(/[^0-9.-]+/g, ""));
  const parseSqm = (sqmStr: string) => Number(sqmStr.replace(/[^0-9.-]+/g, ""));

  let totalPrice = 0;
  let totalSqm = 0;

  filteredData.forEach((p: any) => {
    totalPrice += parsePrice(p.price);
    totalSqm += parseSqm(p.sqm);
  });

  const avgTicketNum = filteredData.length > 0 ? totalPrice / filteredData.length : 0;
  const pricePerSqmNum = totalSqm > 0 ? totalPrice / totalSqm : 0;

  const formattedAvgTicket = avgTicketNum > 0 ? `$${(avgTicketNum / 1000000).toFixed(2)}M` : '$0';
  const formattedPricePerSqm = new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 0
  }).format(pricePerSqmNum);
  const formattedTotalMarketValue = totalPrice > 0 ? `$${(totalPrice / 1000000).toFixed(2)}M` : '$0';

  return (
    <div className="px-8 py-10 space-y-11 flex-1">
      {/* KPI Section */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-8 print:break-inside-avoid">
        <div className="bg-surface-container-lowest p-6 rounded-xl border-none shadow-none flex flex-col justify-center h-32">
          <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant/60">Average Ticket</span>
          <h2 className="text-4xl font-headline font-extrabold text-on-surface mt-2">{formattedAvgTicket}</h2>
        </div>

        <div className="bg-surface-container-lowest p-6 rounded-xl border-none shadow-none flex flex-col justify-center h-32">
          <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant/60">Price per m²</span>
          <h2 className="text-4xl font-headline font-extrabold text-on-surface mt-2">{formattedPricePerSqm}</h2>
        </div>

        <div className="bg-surface-container-lowest p-6 rounded-xl border-none shadow-none flex flex-col justify-center h-32">
          <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant/60">Total Market Value</span>
          <h2 className="text-4xl font-headline font-extrabold text-on-surface mt-2">{formattedTotalMarketValue}</h2>
        </div>
      </section>

      {/* Global Filters Bar */}
      <section className="bg-surface-container-lowest p-4 rounded-xl border border-stone-100 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-stone-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-stone-500">Etapa de Proyecto:</span>
          </div>
          <select 
            value={projectStage}
            onChange={(e) => setProjectStage(e.target.value)}
            className="bg-surface border border-stone-200 rounded-lg px-3 py-1.5 text-sm font-medium text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            <option value="Todos">Todos</option>
            <option value="Preventa">Preventa</option>
            <option value="Nuevo">Nuevo</option>
            <option value="Usado">Usado</option>
          </select>
        </div>

        <label className="flex items-center gap-3 cursor-pointer group w-full sm:w-auto">
          <span className="text-xs font-bold uppercase tracking-wider text-stone-500">Ocultar Estancado (&gt;180 días)</span>
          <div className="relative">
            <input 
              type="checkbox" 
              className="sr-only" 
              checked={hideStagnant}
              onChange={() => setHideStagnant(!hideStagnant)}
            />
            <div className={`block w-10 h-6 rounded-full transition-colors ${hideStagnant ? 'bg-[#00423c]' : 'bg-stone-300'}`}></div>
            <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${hideStagnant ? 'transform translate-x-4' : ''}`}></div>
          </div>
        </label>
      </section>

      {/* Map View Section */}
      <section className="space-y-6 print:break-inside-avoid">
        <div>
          <h3 className="font-headline font-bold text-2xl text-on-surface">Geographic Yield Heatmap</h3>
          <p className="text-on-surface-variant text-sm font-medium mt-1">Aguascalientes Norte | Density vs. Appreciation</p>
        </div>
        <div className="w-full bg-surface-container-high rounded-xl overflow-hidden min-h-[500px] relative flex flex-col">
          <div className="absolute top-6 left-6 z-10 space-y-2">
            <div className="flex gap-2 relative">
              <button
                onClick={() => setMapType(mapType === 'satellite' ? 'map' : 'satellite')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 ${mapType === 'satellite' ? 'bg-primary text-white' : 'bg-white/80 text-on-surface'}`}
            >
              <Layers size={16} />
              {mapType === 'satellite' ? 'Satellite' : 'Map'}
            </button>
            <button
              onClick={() => setIsHeatmapActive(!isHeatmapActive)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 ${isHeatmapActive ? 'bg-primary text-white' : 'bg-white/80 text-on-surface'}`}
            >
              🔥 Heatmap (Price/m²)
            </button>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 ${showFilters ? 'bg-primary text-white' : 'bg-white/80 text-on-surface'}`}
            >
              <Filter size={16} />
              Filters
            </button>
            
            {showFilters && (
              <div className="absolute top-full left-0 mt-2 bg-white rounded-xl shadow-lg border border-stone-200 p-4 w-64 z-50">
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Zona (Location)</label>
                    <select 
                      value={selectedLocation}
                      onChange={(e) => setSelectedLocation(e.target.value)}
                      className="w-full bg-surface-container-lowest border border-stone-200 rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50"
                    >
                      {uniqueLocations.map(loc => (
                        <option key={loc} value={loc}>{loc === 'All' ? 'Todas las zonas' : loc}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Precio Máximo</label>
                    <select 
                      value={maxPrice}
                      onChange={(e) => setMaxPrice(e.target.value)}
                      className="w-full bg-surface-container-lowest border border-stone-200 rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50"
                    >
                      <option value="All">Sin Límite</option>
                      <option value="3000000">Hasta $3M</option>
                      <option value="5000000">Hasta $5M</option>
                      <option value="7000000">Hasta $7M</option>
                      <option value="10000000">Hasta $10M</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="flex-1 relative z-0">
          <MapContainer center={[21.920, -102.305]} zoom={14} style={{ height: '100%', width: '100%', minHeight: '500px', zIndex: 0 }}>
            <TileLayer
              attribution={mapType === 'satellite' ? '&copy; Esri' : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}
              url={mapType === 'satellite' ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}' : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'}
            />
            {filteredData.map((property: any) => {
              const price = parsePrice(property.price);
              const sqm = parseSqm(property.sqm);
              const pricePerSqm = sqm > 0 ? price / sqm : 0;
              
              const color = isHeatmapActive ? getHeatmapColor(pricePerSqm) : '#044e45';
              const radius = isHeatmapActive ? 12 : 8;
              const fillOpacity = isHeatmapActive ? 0.5 : 0.7;
              const weight = isHeatmapActive ? 0 : 2;
              const stroke = !isHeatmapActive;

              return (
                <CircleMarker
                  key={property.id}
                  center={property.coords}
                  radius={radius}
                  stroke={stroke}
                  pathOptions={{ color: color, fillColor: color, fillOpacity: fillOpacity, weight: weight }}
                >
                  <Tooltip>
                    <div className="font-sans">
                      <p className="font-bold text-sm m-0">{property.project}</p>
                      <p className="text-xs text-stone-500 m-0">{property.location}</p>
                      <p className="font-bold text-primary mt-1 mb-0">{property.price}</p>
                      {isHeatmapActive && (
                        <p className="text-xs font-bold text-stone-500 mt-1 mb-0">
                          {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(pricePerSqm)}/m²
                        </p>
                      )}
                    </div>
                  </Tooltip>
                </CircleMarker>
              );
            })}
            {subjectProperty && subjectProperty.lat && subjectProperty.lng && (
              <CircleMarker
                center={[subjectProperty.lat, subjectProperty.lng]}
                radius={12}
                pathOptions={{ color: '#000000', fillColor: '#FFD700', fillOpacity: 1, weight: 3 }}
              >
                <Tooltip permanent direction="top" offset={[0, -10]} className="font-bold text-[#00423c]">
                  ✨ PROYECTO OBJETIVO: {subjectProperty.name}
                </Tooltip>
              </CircleMarker>
            )}
          </MapContainer>
          
          {isHeatmapActive && (
            <div className="absolute bottom-6 right-6 z-[400] bg-white/90 backdrop-blur-md p-4 rounded-xl shadow-lg border border-stone-200">
              <h4 className="text-xs font-bold text-on-surface uppercase tracking-wider mb-3">Precio / m²</h4>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-[#e11d48] opacity-80"></div>
                  <span className="text-xs font-medium text-stone-600">&gt; $40,000 (High Premium)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-[#f59e0b] opacity-80"></div>
                  <span className="text-xs font-medium text-stone-600">$30k - $40k (Mid/High)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-[#0d9488] opacity-80"></div>
                  <span className="text-xs font-medium text-stone-600">&lt; $30,000 (Value)</span>
                </div>
              </div>
            </div>
          )}
        </div>
        </div>
      </section>

      {/* Listings Data Table */}
      <section className="space-y-6 print:break-inside-avoid">
        <div className="flex justify-between items-end">
          <div>
            <h3 className="font-headline font-bold text-2xl text-on-surface">Recent Market Additions</h3>
            <p className="text-on-surface-variant text-sm font-medium mt-1">Refined analysis of verified multi-family units in Zona Norte.</p>
          </div>
          <button onClick={() => onNavigate('archive')} className="text-primary font-bold text-sm flex items-center gap-2 hover:opacity-70 transition-opacity">
            View Full Archive
            <ArrowRight size={16} />
          </button>
        </div>
        <div className="bg-surface-container-lowest rounded-xl overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low">
                <th className="px-6 py-4 text-[10px] uppercase tracking-widest text-on-surface-variant font-black">Project</th>
                <th className="px-6 py-4 text-[10px] uppercase tracking-widest text-on-surface-variant font-black">Location</th>
                <th className="px-6 py-4 text-[10px] uppercase tracking-widest text-on-surface-variant font-black">Price</th>
                <th className="px-6 py-4 text-[10px] uppercase tracking-widest text-on-surface-variant font-black">m²</th>
                <th className="px-6 py-4 text-[10px] uppercase tracking-widest text-on-surface-variant font-black">Amenities</th>
                <th className="px-6 py-4 text-[10px] uppercase tracking-widest text-on-surface-variant font-black">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filteredData.slice(0, 5).map((property: any) => (
                <tr key={property.id} className="hover:bg-surface-bright transition-colors">
                  <td className="px-6 py-5 font-headline font-bold text-on-surface">{property.project}</td>
                  <td className="px-6 py-5 text-sm font-medium text-stone-500">{property.location}</td>
                  <td className="px-6 py-5 font-headline font-extrabold text-primary">{property.price}</td>
                  <td className="px-6 py-5 text-sm text-stone-600">{property.sqm}</td>
                  <td className="px-6 py-5">
                    <div className="flex flex-wrap gap-1.5">
                      {property.amenities.map((amenity: string, idx: number) => (
                        <span key={idx} className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider bg-surface-variant text-on-surface-variant rounded-full whitespace-nowrap">
                          {amenity.replace(/_/g, ' ')}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <span className={`px-2 py-1 text-[10px] font-bold rounded uppercase ${property.statusColor}`}>
                      {property.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="p-4 bg-surface-container-lowest border-t border-stone-100 flex justify-center">
            <button 
              onClick={() => onNavigate('inventory')}
              className="px-6 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-sm rounded-lg transition-colors flex items-center gap-2"
            >
              View Full Inventory
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
