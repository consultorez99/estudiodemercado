import { useState, useMemo, useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap } from 'react-leaflet';
import { Layers } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import { getCoordinates } from '../utils/geo';

const getMarkerColor = (priceStr: string) => {
  const price = Number(priceStr.replace(/[^0-9.-]+/g, ""));
  if (price < 3500000) return '#10b981'; // emerald-500
  if (price < 5500000) return '#f59e0b'; // amber-500
  return '#ef4444'; // red-500
};

// Auto-fits the map to the visible markers so it never opens on an empty area.
function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length > 0) {
      map.fitBounds(points, { padding: [40, 40], maxZoom: 15 });
    }
  }, [points, map]);
  return null;
}

export default function MapView({ data }: { data: any }) {
  const [mapType, setMapType] = useState('map');
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const propertiesWithCoords = useMemo(() => {
    return data.properties.map((p: any) => ({
      ...p,
      coords: getCoordinates(p.location, p.id)
    }));
  }, [data.properties]);

  return (
    // Bound the height to the viewport (minus TopNav 64px + divider + Footer 80px)
    // so the property list scrolls internally and the map fills the area instead
    // of the tall list stretching the whole row (which pushed markers off-screen).
    <div className="flex w-full overflow-hidden bg-surface h-[calc(100vh-145px)] print:h-auto">
      {/* Left Panel - Property List */}
      <div className="w-[30%] min-w-[320px] max-w-[400px] bg-white border-r border-stone-200 overflow-y-auto flex flex-col">
        <div className="p-6 border-b border-stone-100 bg-white sticky top-0 z-10">
          <h2 className="font-headline font-bold text-2xl text-on-surface">Map View</h2>
          <p className="text-sm text-on-surface-variant mt-1">{propertiesWithCoords.length} properties found</p>
        </div>
        <div className="p-4 space-y-4">
          {propertiesWithCoords.map((p: any) => {
            const priceNum = Number(p.price.replace(/[^0-9.-]+/g, ""));
            const sqmNum = Number(p.sqm.replace(/[^0-9.-]+/g, ""));
            const pricePerSqm = sqmNum > 0 ? priceNum / sqmNum : 0;
            const formattedPricePerSqm = new Intl.NumberFormat('es-MX', { 
              style: 'currency', 
              currency: 'MXN', 
              maximumFractionDigits: 0 
            }).format(pricePerSqm);

            return (
              <div 
                key={p.id}
                className={`p-4 rounded-xl border transition-all cursor-pointer ${
                  hoveredId === p.id 
                    ? 'border-primary bg-primary/5 shadow-md scale-[1.02]' 
                    : 'border-stone-200 bg-white hover:border-primary/30 hover:shadow-sm'
                }`}
                onMouseEnter={() => setHoveredId(p.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                <h3 className="font-bold text-on-surface text-lg leading-tight">{p.project}</h3>
                <p className="text-xs text-stone-500 mt-1 mb-3">{p.location}</p>
                
                <div className="flex justify-between items-end pt-3 border-t border-stone-100">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider font-bold text-stone-400 mb-0.5">Total Price</p>
                    <p className="font-bold text-primary text-lg leading-none">{p.price}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] uppercase tracking-wider font-bold text-stone-400 mb-0.5">{p.sqm}</p>
                    <p className="text-sm font-semibold text-stone-700 leading-none">{formattedPricePerSqm}/m²</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right Panel - Map */}
      <div className="flex-1 relative z-0">
        <div className="absolute top-6 right-6 z-[1000]">
          <button
            onClick={() => setMapType(mapType === 'satellite' ? 'map' : 'satellite')}
            className={`px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg transition-colors ${
              mapType === 'satellite' 
                ? 'bg-primary text-white hover:bg-primary/90' 
                : 'bg-white text-on-surface hover:bg-stone-50'
            }`}
          >
            <Layers size={18} />
            {mapType === 'satellite' ? 'Satellite View' : 'Map View'}
          </button>
        </div>
        <MapContainer center={[21.920, -102.305]} zoom={14} style={{ height: '100%', width: '100%', zIndex: 0 }}>
          <TileLayer
            attribution={mapType === 'satellite' ? '&copy; Esri' : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}
            url={mapType === 'satellite' ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}' : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'}
          />
          {propertiesWithCoords.map((property: any) => {
            const color = getMarkerColor(property.price);
            const isHovered = hoveredId === property.id;
            
            return (
              <CircleMarker
                key={property.id}
                center={property.coords}
                radius={isHovered ? 14 : 8}
                pathOptions={{ 
                  color: isHovered ? '#ffffff' : color, 
                  fillColor: color, 
                  fillOpacity: isHovered ? 1 : 0.7, 
                  weight: isHovered ? 3 : 2 
                }}
              >
                <Tooltip>
                  <div className="font-sans">
                    <p className="font-bold text-sm m-0">{property.project}</p>
                    <p className="text-xs text-stone-500 m-0">{property.location}</p>
                    <p className="font-bold text-primary mt-1 mb-0">{property.price}</p>
                  </div>
                </Tooltip>
              </CircleMarker>
            );
          })}
          <FitBounds points={propertiesWithCoords.map((p: any) => p.coords)} />
        </MapContainer>
      </div>
    </div>
  );
}
