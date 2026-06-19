import { useState, useMemo, useEffect } from 'react';
import { Search, ChevronUp, ChevronDown } from 'lucide-react';

export default function Inventory({ data }: { data?: any }) {
  const [localData, setLocalData] = useState<any>(data);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

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

  const properties = localData?.properties || [];

  const processedData = useMemo(() => {
    return properties.map((p: any) => {
      const priceNum = Number(p.price.replace(/[^0-9.-]+/g, ""));
      const sqmNum = Number(p.sqm.replace(/[^0-9.-]+/g, ""));
      const pricePerSqmNum = sqmNum > 0 ? priceNum / sqmNum : 0;
      return {
        ...p,
        priceNum,
        sqmNum,
        pricePerSqmNum
      };
    });
  }, [properties]);

  const filteredData = useMemo(() => {
    return processedData.filter((p: any) => {
      const term = searchTerm.toLowerCase();
      return p.project.toLowerCase().includes(term) || p.location.toLowerCase().includes(term);
    });
  }, [processedData, searchTerm]);

  const sortedData = useMemo(() => {
    let sortableItems = [...filteredData];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (a[sortConfig.key] > b[sortConfig.key]) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [filteredData, sortConfig]);

  const requestSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      maximumFractionDigits: 0
    }).format(value);
  };

  const SortableHeader = ({ label, sortKey }: { label: string, sortKey: string }) => {
    const isActive = sortConfig?.key === sortKey;
    return (
      <th 
        className="py-4 px-6 font-bold text-xs uppercase tracking-widest text-stone-400 cursor-pointer hover:text-stone-600 transition-colors select-none text-left"
        onClick={() => requestSort(sortKey)}
      >
        <div className="flex items-center gap-1">
          {label}
          <span className="w-4 flex justify-center">
            {isActive ? (
              sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
            ) : null}
          </span>
        </div>
      </th>
    );
  };

  return (
    <div className="flex-1 flex flex-col bg-surface overflow-hidden">
      {/* Header & Toolbar */}
      <div className="p-8 pb-4 shrink-0">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
          <div>
            <h2 className="font-headline font-bold text-3xl text-on-surface">Inventory Control</h2>
            <p className="text-on-surface-variant mt-2">Master property database and metrics</p>
          </div>
          
          <div className="relative w-full md:w-72">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search size={18} className="text-stone-400" />
            </div>
            <input
              type="text"
              placeholder="Search project or location..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
          </div>
        </div>
      </div>

      {/* Data Grid */}
      <div className="flex-1 overflow-auto px-8 pb-8">
        <div className="min-w-[1000px] bg-white rounded-2xl shadow-sm border border-stone-100 overflow-hidden">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-stone-100 bg-white">
                <th className="py-4 px-6 font-bold text-xs uppercase tracking-widest text-stone-400 text-left">Proyecto</th>
                <th className="py-4 px-6 font-bold text-xs uppercase tracking-widest text-stone-400 text-left">Ubicación</th>
                <SortableHeader label="CP" sortKey="postalCode" />
                <SortableHeader label="Precio Total" sortKey="priceNum" />
                <SortableHeader label="Área (m²)" sortKey="sqmNum" />
                <SortableHeader label="Rec" sortKey="bedrooms" />
                <SortableHeader label="Baños" sortKey="bathrooms" />
                <SortableHeader label="Estac" sortKey="parking" />
                <SortableHeader label="Precio/m²" sortKey="pricePerSqmNum" />
                <th className="py-4 px-6 font-bold text-xs uppercase tracking-widest text-stone-400 text-left">Amenidades</th>
              </tr>
            </thead>
            <tbody>
              {sortedData.map((property: any, index: number) => (
                <tr 
                  key={property.id} 
                  className={`transition-colors hover:bg-stone-100/50 ${index % 2 === 0 ? 'bg-white' : 'bg-stone-50/30'}`}
                >
                  <td className="py-4 px-6">
                    <span className="font-bold text-on-surface">{property.project}</span>
                  </td>
                  <td className="py-4 px-6">
                    <span className="text-sm text-stone-600">{property.location}</span>
                  </td>
                  <td className="py-4 px-6">
                    <span className="text-sm text-stone-600">{property.postalCode ?? '—'}</span>
                  </td>
                  <td className="py-4 px-6">
                    <span className="font-semibold text-primary">{property.price}</span>
                  </td>
                  <td className="py-4 px-6">
                    <span className="text-sm text-stone-600">{property.sqm}</span>
                  </td>
                  <td className="py-4 px-6">
                    <span className="text-sm text-stone-600">{property.bedrooms ?? '—'}</span>
                  </td>
                  <td className="py-4 px-6">
                    <span className="text-sm text-stone-600">{property.bathrooms ?? '—'}</span>
                  </td>
                  <td className="py-4 px-6">
                    <span className="text-sm text-stone-600">{property.parking ?? '—'}</span>
                  </td>
                  <td className="py-4 px-6">
                    <span className="text-sm font-semibold text-stone-700">
                      {formatCurrency(property.pricePerSqmNum)}
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex flex-wrap gap-1.5">
                      {property.amenities.slice(0, 3).map((amenity: string, i: number) => (
                        <span 
                          key={i} 
                          className="px-2 py-1 bg-stone-100 text-stone-600 rounded-md text-[10px] uppercase tracking-wider font-medium"
                        >
                          {amenity}
                        </span>
                      ))}
                      {property.amenities.length > 3 && (
                        <span className="px-2 py-1 bg-stone-100 text-stone-400 rounded-md text-[10px] uppercase tracking-wider font-medium">
                          +{property.amenities.length - 3}
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {sortedData.length === 0 && (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-stone-400">
                    No properties found matching your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
