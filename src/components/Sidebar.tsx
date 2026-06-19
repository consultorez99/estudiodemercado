import { LayoutDashboard, Map, Building2, TrendingUp, Archive, HelpCircle, LogOut, Sparkles, FileText, Printer, X, Trash2, AlertTriangle, LineChart, Percent, Calculator } from 'lucide-react';
import { useState } from 'react';

interface SidebarProps {
  currentView: string;
  onViewChange: (view: string) => void;
  data: any;
  onPrint?: () => void;
  isOpen?: boolean;
  onClose?: () => void;
  isOutliersExcluded?: boolean;
  onToggleOutliers?: () => void;
  onClearData?: () => void;
}

export default function Sidebar({ currentView, onViewChange, data, onPrint, isOpen, onClose, isOutliersExcluded, onToggleOutliers, onClearData }: SidebarProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const exportToExcel = () => {
    setIsGenerating(true);
    
    try {
      const properties = data?.properties || [];
      
      const headers = ['ID', 'Proyecto', 'Ubicación', 'Precio_Total', 'Area_m2', 'Recamaras', 'Banos', 'Estacionamientos', 'CP', 'Precio_por_m2', 'Amenidades'];
      
      const rows = properties.map((p: any) => {
        const priceNum = Number(p.price.replace(/[^0-9.-]+/g, ""));
        const sqmNum = Number(p.sqm.replace(/[^0-9.-]+/g, ""));
        
        const pricePerSqm = sqmNum > 0 ? priceNum / sqmNum : 0;
        const formattedPricePerSqm = new Intl.NumberFormat('es-MX', {
          style: 'currency',
          currency: 'MXN',
          maximumFractionDigits: 2
        }).format(pricePerSqm);
        
        const amenitiesStr = Array.isArray(p.amenities) 
          ? p.amenities.map((a: string) => a.replace(/_/g, ' ')).join(', ') 
          : '';

        const escapeCSV = (str: string | number) => `"${String(str).replace(/"/g, '""')}"`;

        return [
          escapeCSV(p.id || ''),
          escapeCSV(p.project || ''),
          escapeCSV(p.location || ''),
          escapeCSV(priceNum),
          escapeCSV(sqmNum),
          escapeCSV(p.bedrooms ?? ''),
          escapeCSV(p.bathrooms ?? ''),
          escapeCSV(p.parking ?? ''),
          escapeCSV(p.postalCode ?? ''),
          escapeCSV(formattedPricePerSqm),
          escapeCSV(amenitiesStr)
        ].join(',');
      });

      const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
      
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', 'Estudio_Mercado_Ags_Norte.csv');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Error exporting to Excel:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'map', label: 'Map View', icon: Map },
    { id: 'inventory', label: 'Inventory', icon: Building2 },
    { id: 'yield', label: 'Yield Analysis', icon: TrendingUp },
    { id: 'caprate', label: 'Renta & Cap Rate', icon: Percent },
    { id: 'hedonic', label: 'Valuación Hedónica', icon: Calculator },
    { id: 'trends', label: 'Market Trends', icon: LineChart },
    { id: 'archive', label: 'Archive', icon: Archive },
    { id: 'import', label: 'AI Importer', icon: Sparkles },
  ];

  return (
    <aside className={`h-screen w-64 fixed left-0 top-0 z-40 bg-[#f6f3ee] flex flex-col py-8 shadow-none border-none print:hidden transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
      <div className="px-6 mb-10 flex justify-between items-start">
        <div>
          <h1 className="font-headline font-extrabold text-[#745853] text-xl tracking-tight">Archivist AI</h1>
          <p className="text-[10px] uppercase tracking-[0.2em] text-stone-400 font-bold mt-1">Market Intel v1.0</p>
        </div>
        <button 
          onClick={onClose}
          className="md:hidden p-1 text-stone-500 hover:bg-[#e5e2dd] rounded-lg transition-colors"
        >
          <X size={20} />
        </button>
      </div>
      <nav className="flex-1 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className={`w-full text-left py-3 pl-6 flex items-center gap-3 transition-all duration-300 ${
                isActive
                  ? 'text-[#00423c] font-bold bg-[#ffffff] rounded-r-full translate-x-1'
                  : 'text-stone-500 hover:bg-[#e5e2dd]'
              }`}
            >
              <Icon size={20} />
              <span className="font-body text-sm font-semibold tracking-wide">{item.label}</span>
            </button>
          );
        })}
      </nav>
      
      <div className="px-6 mt-4 mb-4">
        <label className="flex items-center justify-between cursor-pointer group bg-white p-3 rounded-xl border border-stone-200 shadow-sm hover:border-stone-300 transition-colors">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className={isOutliersExcluded ? "text-[#f59e0b]" : "text-stone-400"} />
            <span className="text-xs font-bold text-stone-600">Trim Outliers</span>
          </div>
          <div className="relative">
            <input 
              type="checkbox" 
              className="sr-only" 
              checked={isOutliersExcluded}
              onChange={onToggleOutliers}
            />
            <div className={`block w-10 h-6 rounded-full transition-colors ${isOutliersExcluded ? 'bg-[#00423c]' : 'bg-stone-300'}`}></div>
            <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${isOutliersExcluded ? 'transform translate-x-4' : ''}`}></div>
          </div>
        </label>
      </div>

      <div className="px-6 mt-auto space-y-3">
        <button
          onClick={exportToExcel}
          disabled={isGenerating}
          className="w-full bg-[#00423c] text-white py-3 rounded-xl font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isGenerating ? 'Generating...' : 'Generate Report (Excel)'}
        </button>
        <button
          onClick={onPrint || (() => window.print())}
          className="w-full bg-white border-2 border-[#00423c] text-[#00423c] py-2.5 rounded-xl font-bold text-sm hover:bg-stone-50 transition-colors flex items-center justify-center gap-2"
        >
          <Printer size={16} />
          Print / Save as PDF
        </button>
        <button
          onClick={() => setShowClearConfirm(true)}
          className="w-full bg-red-50 text-red-600 py-2.5 rounded-xl font-bold text-sm hover:bg-red-100 transition-colors flex items-center justify-center gap-2 mt-4"
        >
          <Trash2 size={16} />
          Start New Study
        </button>
      </div>

      {showClearConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <div className="flex items-center gap-3 text-red-600 mb-4">
              <AlertTriangle size={24} />
              <h3 className="font-bold text-lg">Clear Active Data?</h3>
            </div>
            <p className="text-stone-600 text-sm mb-6">
              ¿Estás seguro de limpiar la mesa de trabajo? Asegúrate de haber guardado tu estudio en el Archive primero.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 py-2 rounded-lg font-bold text-sm bg-stone-100 text-stone-700 hover:bg-stone-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  onClearData?.();
                  setShowClearConfirm(false);
                }}
                className="flex-1 py-2 rounded-lg font-bold text-sm bg-red-600 text-white hover:bg-red-700 transition-colors"
              >
                Limpiar Datos
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
