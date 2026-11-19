import React, { useState } from 'react';
import { Download, Share, X, Check } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [installedSuccess, setInstalledSuccess] = useState(false);

  if (isInstalled) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-rose-300/80 font-medium px-2.5 py-1 rounded-lg bg-rose-500/10 border border-rose-500/20">
        <Check className="w-3.5 h-3.5 text-rose-400" />
        <span>PWA Installée</span>
      </div>
    );
  }

  const handleInstallClick = async () => {
    const success = await install();
    if (success) {
      setInstalledSuccess(true);
    }
  };

  if (isInstallable) {
    return (
      <button
        onClick={handleInstallClick}
        className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-lg shadow-rose-500/20 hover:from-rose-600 hover:to-pink-700 active:scale-95 transition whitespace-nowrap shrink-0"
      >
        <Download className="w-3.5 h-3.5" />
        <span>Installer l'App</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-1.5 text-xs font-medium text-rose-200 hover:bg-rose-500/20 active:scale-95 transition whitespace-nowrap shrink-0"
        >
          <Share className="w-3.5 h-3.5 text-rose-400" />
          <span>Installer PWA</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl text-slate-100 relative">
              <button
                onClick={() => setShowIOSGuide(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center mb-4 text-rose-400">
                <Share className="w-5 h-5" />
              </div>
              <h3 className="text-base font-semibold text-white">Installer sur iPhone / iPad</h3>
              <p className="mt-2 text-xs text-slate-300 leading-relaxed">
                Pour une expérience plein écran type CandyAI sans barre Safari :
              </p>
              <ol className="mt-3 text-xs text-slate-300 space-y-2 list-decimal list-inside bg-slate-800/60 p-3 rounded-xl border border-slate-700/50">
                <li>Appuyez sur le bouton <strong>Partager</strong> <span className="text-rose-400">⎋</span> en bas de Safari</li>
                <li>Faites défiler et choisissez <strong>Sur l'écran d'accueil</strong></li>
                <li>Appuyez sur <strong>Ajouter</strong> en haut à droite</li>
              </ol>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full rounded-xl bg-slate-800 py-2.5 text-xs font-semibold text-white hover:bg-slate-700 transition"
              >
                J'ai compris
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
