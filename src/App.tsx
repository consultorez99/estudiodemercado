import { useState, useEffect, useRef, useMemo } from 'react';
import { useReactToPrint } from 'react-to-print';
import Sidebar from './components/Sidebar';
import TopNav from './components/TopNav';
import Dashboard from './components/Dashboard';
import MapView from './components/MapView';
import YieldAnalysis from './components/YieldAnalysis';
import MarketTrends from './components/MarketTrends';
import Inventory from './components/Inventory';
import CapRateEstimator from './components/CapRateEstimator';
import HedonicValuation from './components/HedonicValuation';
import Archive from './components/Archive';
import Footer from './components/Footer';
import AiMarketImporter from './components/AiMarketImporter';
import { marketData as defaultMarketData } from './data';

export default function App() {
  const [currentView, setCurrentView] = useState('dashboard');
  const [appData, setAppData] = useState(defaultMarketData);
  const [isOutliersExcluded, setIsOutliersExcluded] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const componentRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    contentRef: componentRef,
    documentTitle: 'Estudio_Mercado_Ags_Norte',
  });

  useEffect(() => {
    const savedData = localStorage.getItem('real_estate_market_data');
    if (savedData) {
      try {
        setAppData(JSON.parse(savedData));
      } catch (e) {
        console.error("Failed to parse saved market data", e);
      }
    }
  }, []);

  const cleanedData = useMemo(() => {
    if (!isOutliersExcluded || !appData || !appData.properties) return appData;

    const pricePerSqmOf = (p: any) => {
      const price = Number(p.price.replace(/[^0-9.-]+/g, ""));
      const sqm = Number(p.sqm.replace(/[^0-9.-]+/g, ""));
      return sqm > 0 ? price / sqm : 0;
    };

    // Only listings with a valid price/m² participate in the percentile cut.
    // Listings without area (0 m²) are kept untouched so we don't lose inventory.
    const withSqm = appData.properties.filter((p: any) => pricePerSqmOf(p) > 0);
    const withoutSqm = appData.properties.filter((p: any) => pricePerSqmOf(p) <= 0);

    const sorted = [...withSqm].sort((a, b) => pricePerSqmOf(a) - pricePerSqmOf(b));

    // Trim the bottom and top 5% of price/m² anomalies.
    const lowCut = Math.floor(sorted.length * 0.05);
    const highCut = Math.ceil(sorted.length * 0.95);
    const trimmed = sorted.slice(lowCut, highCut);

    return {
      ...appData,
      properties: [...trimmed, ...withoutSqm]
    };
  }, [appData, isOutliersExcluded]);

  const handleClearData = () => {
    setAppData({ properties: [] });
    localStorage.removeItem('real_estate_market_data');
    setCurrentView('import');
  };

  const renderContent = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard data={cleanedData} onNavigate={setCurrentView} />;
      case 'map':
        return <MapView data={cleanedData} />;
      case 'inventory':
        return <Inventory data={cleanedData} />;
      case 'yield':
        return <YieldAnalysis data={cleanedData} />;
      case 'caprate':
        return <CapRateEstimator data={cleanedData} />;
      case 'hedonic':
        return <HedonicValuation />;
      case 'trends':
        return <MarketTrends />;
      case 'archive':
        return <Archive data={cleanedData} onRestore={setAppData} />;
      case 'import':
        return <AiMarketImporter onUpdateData={setAppData} />;
      default:
        return <Dashboard data={cleanedData} onNavigate={setCurrentView} />;
    }
  };

  return (
    <div className="flex min-h-screen bg-surface font-body text-on-surface">
      <Sidebar 
        currentView={currentView} 
        onViewChange={(view) => {
          setCurrentView(view);
          setIsMobileMenuOpen(false);
        }} 
        data={cleanedData} 
        onPrint={handlePrint}
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        isOutliersExcluded={isOutliersExcluded}
        onToggleOutliers={() => setIsOutliersExcluded(!isOutliersExcluded)}
        onClearData={handleClearData}
      />
      
      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 md:hidden transition-opacity"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      <main ref={componentRef} className="flex-1 md:ml-64 flex flex-col min-h-screen relative print:ml-0 print:w-full w-full">
        <TopNav onMenuClick={() => setIsMobileMenuOpen(true)} />
        <div className="bg-[#f6f3ee] h-[1px] w-full"></div>
        {renderContent()}
        <Footer />
      </main>
    </div>
  );
}
