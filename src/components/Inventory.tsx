import { useState, useMemo, useEffect } from 'react';
import { Search, ChevronUp, ChevronDown, Pencil, Trash2, Check, X } from 'lucide-react';

const formatPrice = (num: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(num);

export default function Inventory({ data, onUpdateData }: { data?: any; onUpdateData?: (data: any) => void }) {
  const [localData, setLocalData] = useState<any>(data);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  useEffect(() => {
    if (!data) {
      const savedData = localStorage.getItem('real_estate_market_data');
      if (savedData) {
        try { setLocalData(JSON.parse(savedData)); } catch (e) { console.error(e); }
      }
    } else {
      setLocalData(data);
    }
  }, [data]);

  const persist = (updated: any) => {
    setLocalData(updated);
    localStorage.setItem('real_estate_market_data', JSON.stringify(updated));
    onUpdateData?.(updated);
  };

  const handleDelete = (id: number) => {
    const updated = { ...localData, properties: localData.properties.filter((p: any) => p.id !== id) };
    persist(updated);
    setConfirmDeleteId(null);
  };

  const handleEditStart = (property: any) => {
    setEditingId(property.id);
    setConfirmDeleteId(null);
    setEditForm({
      project: property.project,
      location: property.location,
      postalCode: property.postalCode ?? '',
      price: property.priceNum,
      sqm: property.sqmNum,
      bedrooms: property.bedrooms ?? '',
      bathrooms: property.bathrooms ?? '',
      parking: property.parking ?? '',
      amenities: property.amenities.join(', '),
    });
  };

  const handleEditSave = (id: number) => {
    const updated = {
      ...localData,
      properties: localData.properties.map((p: any) =>
        p.id !== id ? p : {
          ...p,
          project: editForm.project,
          location: editForm.location,
          postalCode: editForm.postalCode || null,
          price: formatPrice(Number(editForm.price)),
          sqm: `${editForm.sqm} m²`,
          bedrooms: editForm.bedrooms !== '' ? Number(editForm.bedrooms) : null,
          bathrooms: editForm.bathrooms !== '' ? Number(editForm.bathrooms) : null,
          parking: editForm.parking !== '' ? Number(editForm.parking) : null,
          amenities: editForm.amenities.split(',').map((a: string) => a.trim()).filter(Boolean),
        }
      ),
    };
    persist(updated);
    setEditingId(null);
  };

  const properties = localData?.properties || [];

  const processedData = useMemo(() => {
    return properties.map((p: any) => {
      const priceNum = Number(p.price.replace(/[^0-9.-]+/g, ''));
      const sqmNum = Number(p.sqm.replace(/[^0-9.-]+/g, ''));
      return { ...p, priceNum, sqmNum, pricePerSqmNum: sqmNum > 0 ? priceNum / sqmNum : 0 };
    });
  }, [properties]);

  const filteredData = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return processedData.filter((p: any) =>
      p.project.toLowerCase().includes(term) || p.location.toLowerCase().includes(term)
    );
  }, [processedData, searchTerm]);

  const sortedData = useMemo(() => {
    if (!sortConfig) return filteredData;
    return [...filteredData].sort((a, b) => {
      if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
      if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredData, sortConfig]);

  const requestSort = (key: string) => {
    setSortConfig(prev =>
      prev?.key === key && prev.direction === 'asc'
        ? { key, direction: 'desc' }
        : { key, direction: 'asc' }
    );
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(value);

  const SortableHeader = ({ label, sortKey }: { label: string; sortKey: string }) => {
    const isActive = sortConfig?.key === sortKey;
    return (
      <th className="py-4 px-4 font-bold text-xs uppercase tracking-widest text-stone-400 cursor-pointer hover:text-stone-600 transition-colors select-none text-left"
        onClick={() => requestSort(sortKey)}>
        <div className="flex items-center gap-1">
          {label}
          <span className="w-4 flex justify-center">
            {isActive ? (sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />) : null}
          </span>
        </div>
      </th>
    );
  };

  const inputCls = 'w-full px-2 py-1 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30';

  return (
    <div className="flex-1 flex flex-col bg-surface overflow-hidden">
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

      <div className="flex-1 overflow-auto px-8 pb-8">
        <div className="min-w-[1100px] bg-white rounded-2xl shadow-sm border border-stone-100 overflow-hidden">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-stone-100 bg-white">
                <th className="py-4 px-4 font-bold text-xs uppercase tracking-widest text-stone-400 text-left">Proyecto</th>
                <th className="py-4 px-4 font-bold text-xs uppercase tracking-widest text-stone-400 text-left">Ubicación</th>
                <SortableHeader label="CP" sortKey="postalCode" />
                <SortableHeader label="Precio Total" sortKey="priceNum" />
                <SortableHeader label="Área (m²)" sortKey="sqmNum" />
                <SortableHeader label="Rec" sortKey="bedrooms" />
                <SortableHeader label="Baños" sortKey="bathrooms" />
                <SortableHeader label="Estac" sortKey="parking" />
                <SortableHeader label="Precio/m²" sortKey="pricePerSqmNum" />
                <th className="py-4 px-4 font-bold text-xs uppercase tracking-widest text-stone-400 text-left">Amenidades</th>
                <th className="py-4 px-4 font-bold text-xs uppercase tracking-widest text-stone-400 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {sortedData.map((property: any, index: number) => {
                const isEditing = editingId === property.id;
                const isConfirmingDelete = confirmDeleteId === property.id;

                if (isEditing) {
                  return (
                    <tr key={property.id} className="bg-amber-50 border-y border-amber-200">
                      <td className="py-2 px-4"><input className={inputCls} value={editForm.project} onChange={e => setEditForm((f: any) => ({ ...f, project: e.target.value }))} /></td>
                      <td className="py-2 px-4"><input className={inputCls} value={editForm.location} onChange={e => setEditForm((f: any) => ({ ...f, location: e.target.value }))} /></td>
                      <td className="py-2 px-4"><input className={inputCls + ' w-20'} value={editForm.postalCode} onChange={e => setEditForm((f: any) => ({ ...f, postalCode: e.target.value }))} /></td>
                      <td className="py-2 px-4"><input className={inputCls + ' w-28'} type="number" value={editForm.price} onChange={e => setEditForm((f: any) => ({ ...f, price: e.target.value }))} /></td>
                      <td className="py-2 px-4"><input className={inputCls + ' w-20'} type="number" value={editForm.sqm} onChange={e => setEditForm((f: any) => ({ ...f, sqm: e.target.value }))} /></td>
                      <td className="py-2 px-4"><input className={inputCls + ' w-14'} type="number" value={editForm.bedrooms} onChange={e => setEditForm((f: any) => ({ ...f, bedrooms: e.target.value }))} /></td>
                      <td className="py-2 px-4"><input className={inputCls + ' w-14'} type="number" value={editForm.bathrooms} onChange={e => setEditForm((f: any) => ({ ...f, bathrooms: e.target.value }))} /></td>
                      <td className="py-2 px-4"><input className={inputCls + ' w-14'} type="number" value={editForm.parking} onChange={e => setEditForm((f: any) => ({ ...f, parking: e.target.value }))} /></td>
                      <td className="py-2 px-4 text-sm text-stone-400">auto</td>
                      <td className="py-2 px-4"><input className={inputCls} placeholder="amenidad1, amenidad2" value={editForm.amenities} onChange={e => setEditForm((f: any) => ({ ...f, amenities: e.target.value }))} /></td>
                      <td className="py-2 px-4">
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => handleEditSave(property.id)} className="p-1.5 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 transition-colors" title="Guardar"><Check size={15} /></button>
                          <button onClick={() => setEditingId(null)} className="p-1.5 rounded-lg bg-stone-100 text-stone-500 hover:bg-stone-200 transition-colors" title="Cancelar"><X size={15} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr key={property.id} className={`transition-colors hover:bg-stone-100/50 ${index % 2 === 0 ? 'bg-white' : 'bg-stone-50/30'}`}>
                    <td className="py-4 px-4"><span className="font-bold text-on-surface">{property.project}</span></td>
                    <td className="py-4 px-4"><span className="text-sm text-stone-600">{property.location}</span></td>
                    <td className="py-4 px-4"><span className="text-sm text-stone-600">{property.postalCode ?? '—'}</span></td>
                    <td className="py-4 px-4"><span className="font-semibold text-primary">{property.price}</span></td>
                    <td className="py-4 px-4"><span className="text-sm text-stone-600">{property.sqm}</span></td>
                    <td className="py-4 px-4"><span className="text-sm text-stone-600">{property.bedrooms ?? '—'}</span></td>
                    <td className="py-4 px-4"><span className="text-sm text-stone-600">{property.bathrooms ?? '—'}</span></td>
                    <td className="py-4 px-4"><span className="text-sm text-stone-600">{property.parking ?? '—'}</span></td>
                    <td className="py-4 px-4"><span className="text-sm font-semibold text-stone-700">{formatCurrency(property.pricePerSqmNum)}</span></td>
                    <td className="py-4 px-4">
                      <div className="flex flex-wrap gap-1.5">
                        {property.amenities.slice(0, 3).map((amenity: string, i: number) => (
                          <span key={i} className="px-2 py-1 bg-stone-100 text-stone-600 rounded-md text-[10px] uppercase tracking-wider font-medium">{amenity}</span>
                        ))}
                        {property.amenities.length > 3 && (
                          <span className="px-2 py-1 bg-stone-100 text-stone-400 rounded-md text-[10px] uppercase tracking-wider font-medium">+{property.amenities.length - 3}</span>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      {isConfirmingDelete ? (
                        <div className="flex items-center justify-center gap-1">
                          <span className="text-xs text-red-600 font-medium">¿Borrar?</span>
                          <button onClick={() => handleDelete(property.id)} className="p-1 rounded bg-red-100 text-red-600 hover:bg-red-200 transition-colors" title="Confirmar"><Check size={13} /></button>
                          <button onClick={() => setConfirmDeleteId(null)} className="p-1 rounded bg-stone-100 text-stone-500 hover:bg-stone-200 transition-colors" title="Cancelar"><X size={13} /></button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => handleEditStart(property)} className="p-1.5 rounded-lg text-stone-400 hover:bg-amber-100 hover:text-amber-700 transition-colors" title="Editar"><Pencil size={15} /></button>
                          <button onClick={() => setConfirmDeleteId(property.id)} className="p-1.5 rounded-lg text-stone-400 hover:bg-red-100 hover:text-red-600 transition-colors" title="Borrar"><Trash2 size={15} /></button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {sortedData.length === 0 && (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-stone-400">No properties found matching your search.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
