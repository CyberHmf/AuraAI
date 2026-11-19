import React, { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';

export const OfflineIndicator: React.FC = () => {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-xl bg-amber-900/90 border border-amber-600/50 backdrop-blur-md px-3.5 py-1.5 text-xs font-medium text-amber-100 shadow-xl">
      <WifiOff className="w-3.5 h-3.5 text-amber-400" />
      <span>Mode hors-ligne — Données et IA locales actives</span>
    </div>
  );
};
