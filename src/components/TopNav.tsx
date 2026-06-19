import { Menu } from 'lucide-react';

interface TopNavProps {
  onMenuClick?: () => void;
}

export default function TopNav({ onMenuClick }: TopNavProps) {
  return (
    <header className="flex justify-between items-center w-full px-4 md:px-8 py-4 bg-[#fcf9f4] sticky top-0 z-50">
      <div className="flex items-center gap-2 md:gap-8">
        <button 
          onClick={onMenuClick}
          className="md:hidden p-2 -ml-2 text-[#00423c] hover:bg-[#e5e2dd] rounded-lg transition-colors"
        >
          <Menu size={24} />
        </button>
        <span className="font-headline font-black text-lg md:text-xl italic text-[#00423c]">Architectural Archivist</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-stone-500 tracking-wide hidden sm:block">
          Herramienta de Estudio de Mercado Inmobiliario
        </span>
        <div className="w-8 h-8 rounded-full bg-[#00423c] text-white flex items-center justify-center text-xs font-bold ml-2 shadow-sm">
          EZ
        </div>
      </div>
    </header>
  );
}
