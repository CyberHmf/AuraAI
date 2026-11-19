import React from 'react';
import { Sliders, Brain, Camera, BookHeart, Server, RotateCcw, Terminal } from 'lucide-react';
import { GirlfriendPersona, RealWorldContext } from '../types';
import { PWAInstallButton } from './PWAInstallButton';
import { BrandLogo } from './BrandLogo';

interface TopBarProps {
  girlfriend: GirlfriendPersona;
  context: RealWorldContext;
  onOpenCustomizer: () => void;
  onOpenGallery: () => void;
  onOpenMemory: () => void;
  onOpenDiary: () => void;
  onOpenSettings: () => void;
  onOpenLogs?: () => void;
  onOpenReset?: () => void;
  onOpenPortrait?: () => void;
  activeTokens: number;
}

export const TopBar: React.FC<TopBarProps> = ({
  girlfriend,
  context,
  onOpenCustomizer,
  onOpenGallery,
  onOpenMemory,
  onOpenDiary,
  onOpenSettings,
  onOpenLogs,
  onOpenReset,
  onOpenPortrait,
  activeTokens,
}) => {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-8 px-4 sm:px-6 py-3 bg-[#0b0d14]/90 backdrop-blur-md border-b border-slate-800/80">
      
      {/* Zone 1: Single text element wordmark + Her clickable avatar */}
      <div className="flex items-center gap-3 shrink-0">
        <a href="/" className="flex items-center gap-2.5 text-base sm:text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0 font-display group">
          <BrandLogo className="w-8 h-8 rounded-xl shadow-md shadow-rose-500/25 group-hover:scale-105 transition-transform" />
          <span>Aura AI</span>
        </a>

        {/* Quiet status chip showing her avatar, name & city */}
        <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400 pl-2.5 border-l border-slate-800">
          <button
            type="button"
            onClick={onOpenPortrait || onOpenCustomizer}
            className="flex items-center gap-2 hover:opacity-90 transition group cursor-pointer"
            title="Cliquer pour afficher son portrait officiel en grand 📸"
          >
            <div className="w-6 h-6 rounded-full overflow-hidden border border-rose-500/40 group-hover:border-rose-400 group-hover:scale-105 transition shadow-sm bg-black">
              <img
                src={girlfriend.appearance.avatarUrl}
                alt={girlfriend.name}
                className="w-full h-full object-cover"
              />
            </div>
            <span className="text-slate-200 font-medium group-hover:text-rose-300 transition">{girlfriend.name}</span>
          </button>
          <span aria-hidden="true" className="text-slate-600">·</span>
          <span>{context.city}</span>
          <span aria-hidden="true" className="text-slate-600">·</span>
          <span className="text-rose-400/90">{context.temperature}°C</span>
        </div>
      </div>

      {/* Zone 2: 4–5 clean single-line text navigation links */}
      <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-slate-400">
        <button 
          onClick={onOpenGallery} 
          className="hover:text-rose-300 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5"
        >
          <Camera className="w-3.5 h-3.5 text-rose-400" />
          <span>Album Privé</span>
        </button>

        <button 
          onClick={onOpenMemory} 
          className="hover:text-rose-300 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5"
        >
          <Brain className="w-3.5 h-3.5 text-purple-400" />
          <span>Mémoire Légère</span>
          <span className="text-[10px] font-mono font-normal text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
            {activeTokens} tok
          </span>
        </button>

        <button 
          onClick={onOpenDiary} 
          className="hover:text-rose-300 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5"
        >
          <BookHeart className="w-3.5 h-3.5 text-pink-400" />
          <span>Journal Intime</span>
        </button>

        <button 
          onClick={onOpenSettings} 
          className="hover:text-rose-300 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5"
        >
          <Server className="w-3.5 h-3.5 text-slate-400" />
          <span>Moteurs & LLM</span>
        </button>

        {onOpenLogs && (
          <button 
            onClick={onOpenLogs} 
            className="hover:text-purple-300 text-slate-400 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 bg-slate-900/60 hover:bg-slate-800 px-2 py-1 rounded-lg border border-slate-800"
            title="Consulter le journal de logs & débogage en direct"
          >
            <Terminal className="w-3.5 h-3.5 text-purple-400" />
            <span>Logs</span>
          </button>
        )}

        {onOpenReset && (
          <button 
            onClick={onOpenReset} 
            className="hover:text-rose-400 text-slate-500 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1"
            title="Options de réinitialisation (Soft & Hard)"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset</span>
          </button>
        )}
      </nav>

      {/* Zone 3: 1 primary action */}
      <div className="flex items-center gap-2.5 shrink-0">
        <PWAInstallButton />
        
        <button
          onClick={onOpenCustomizer}
          className="px-3.5 py-2 text-xs font-semibold text-white bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 rounded-xl shadow-md shadow-rose-500/20 transition-all active:scale-95 whitespace-nowrap shrink-0 flex items-center gap-1.5"
        >
          <Sliders className="w-3.5 h-3.5" />
          <span className="hidden xs:inline">Personnaliser</span>
          <span className="xs:hidden">Profil</span>
        </button>
      </div>

    </header>
  );
};
