import { useState, useEffect } from 'react';
import { Save, Archive as ArchiveIcon, Calendar, Building2, Trash2, Download, CheckCircle2, Printer } from 'lucide-react';

interface SavedStudy {
  id: string;
  name: string;
  date: string;
  data: any;
}

export default function Archive({ data, onRestore }: { data: any, onRestore: (data: any) => void }) {
  const [history, setHistory] = useState<SavedStudy[]>([]);
  const [newStudyName, setNewStudyName] = useState('');
  const [notification, setNotification] = useState<{ show: boolean; message: string }>({ show: false, message: '' });

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

  const showNotification = (message: string) => {
    setNotification({ show: true, message });
    setTimeout(() => setNotification({ show: false, message: '' }), 3000);
  };

  const handleSave = () => {
    if (!newStudyName.trim()) return;
    
    const newStudy: SavedStudy = {
      id: Date.now().toString(),
      name: newStudyName.trim(),
      date: new Date().toISOString(),
      data: data
    };

    const updatedHistory = [newStudy, ...history];
    setHistory(updatedHistory);
    localStorage.setItem('archivist_history', JSON.stringify(updatedHistory));
    setNewStudyName('');
    showNotification('Market data saved successfully.');
  };

  const handleRestore = (study: SavedStudy) => {
    localStorage.setItem('real_estate_market_data', JSON.stringify(study.data));
    onRestore(study.data);
    showNotification(`Study "${study.name}" restored successfully.`);
  };

  const handleDelete = (id: string) => {
    const updatedHistory = history.filter(h => h.id !== id);
    setHistory(updatedHistory);
    localStorage.setItem('archivist_history', JSON.stringify(updatedHistory));
    showNotification('Study deleted from archive.');
  };

  const handleGeneratePDF = async (study: SavedStudy) => {
    handleRestore(study);
    setTimeout(() => {
      window.print();
    }, 500);
  };

  const formatDate = (isoString: string) => {
    return new Intl.DateTimeFormat('es-MX', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(isoString));
  };

  return (
    <div className="flex-1 flex flex-col bg-surface overflow-hidden relative">
      {/* Notification Toast */}
      {notification.show && (
        <div className="absolute top-6 right-6 z-50 bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
          <CheckCircle2 size={18} className="text-emerald-500" />
          <span className="text-sm font-medium">{notification.message}</span>
        </div>
      )}

      {/* Header & Save Panel */}
      <div className="p-8 pb-6 shrink-0 border-b border-stone-100 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="mb-6">
            <h2 className="font-headline font-bold text-3xl text-on-surface flex items-center gap-3">
              <ArchiveIcon className="text-primary" size={28} />
              Market Archive
            </h2>
            <p className="text-on-surface-variant mt-2">Save and restore historical market studies</p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4 items-end bg-stone-50 p-4 rounded-2xl border border-stone-100">
            <div className="flex-1 w-full">
              <label className="block text-xs font-bold text-stone-500 uppercase tracking-widest mb-2">
                Study Name
              </label>
              <input
                type="text"
                placeholder="e.g., Q1 2026 Northern Zone Analysis"
                value={newStudyName}
                onChange={(e) => setNewStudyName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                className="w-full px-4 py-2.5 bg-white border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
            </div>
            <button
              onClick={handleSave}
              disabled={!newStudyName.trim()}
              className="w-full sm:w-auto px-6 py-2.5 bg-primary text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              <Save size={18} />
              Save Current Market Data
            </button>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-5xl mx-auto">
          {history.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-2xl border border-stone-100 border-dashed">
              <ArchiveIcon size={48} className="mx-auto text-stone-300 mb-4" />
              <h3 className="text-lg font-bold text-stone-700 mb-1">No saved studies yet</h3>
              <p className="text-stone-500 text-sm">Save your current market data to build a history.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {history.map((study) => (
                <div key={study.id} className="bg-white border border-stone-100 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col">
                  <div className="mb-4">
                    <h3 className="font-bold text-lg text-on-surface leading-tight mb-2">{study.name}</h3>
                    <div className="flex items-center gap-1.5 text-xs text-stone-400 font-medium">
                      <Calendar size={14} />
                      {formatDate(study.date)}
                    </div>
                  </div>
                  
                  <div className="bg-stone-50 rounded-xl p-4 mb-6 flex items-center gap-3 border border-stone-100/50">
                    <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm text-primary shrink-0">
                      <Building2 size={18} />
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-widest font-bold text-stone-400 mb-0.5">Properties</p>
                      <p className="font-bold text-stone-700">{study.data?.properties?.length || 0} total units</p>
                    </div>
                  </div>

                  <div className="mt-auto flex gap-2 pt-4 border-t border-stone-100">
                    <button
                      onClick={() => handleRestore(study)}
                      className="flex-1 py-2 px-3 bg-primary/5 text-primary hover:bg-primary/10 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-colors"
                      title="Restore data"
                    >
                      <Download size={16} />
                      Restore
                    </button>
                    <button
                      onClick={() => handleGeneratePDF(study)}
                      className="py-2 px-3 bg-stone-100 text-stone-600 hover:bg-stone-200 rounded-lg text-sm font-bold flex items-center justify-center transition-colors"
                      title="Print / Save as PDF"
                    >
                      <Printer size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(study.id)}
                      className="py-2 px-3 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg text-sm font-bold flex items-center justify-center transition-colors"
                      title="Delete study"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
