import React from 'react';
import { X, Sparkles, Heart, Sliders, Download, Eye } from 'lucide-react';
import { GirlfriendPersona } from '../types';

interface GirlfriendPortraitModalProps {
  isOpen: boolean;
  onClose: () => void;
  girlfriend: GirlfriendPersona;
  onOpenCustomizer?: () => void;
}

export const GirlfriendPortraitModal: React.FC<GirlfriendPortraitModalProps> = ({
  isOpen,
  onClose,
  girlfriend,
  onOpenCustomizer,
}) => {
  if (!isOpen) return null;

  const isSvgPlaceholder = girlfriend.appearance.avatarUrl.startsWith('data:image/svg+xml');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/90 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md sm:max-w-lg rounded-3xl overflow-hidden bg-[#0e1018] border border-rose-500/30 shadow-2xl flex flex-col max-h-[92vh]">
        
        {/* Floating close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-20 w-9 h-9 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center backdrop-blur-sm transition border border-white/10"
          title="Fermer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Image Display */}
        <div className="relative w-full aspect-[3/4] bg-black overflow-hidden flex items-center justify-center group">
          <img
            src={girlfriend.appearance.avatarUrl}
            alt={girlfriend.name}
            className="w-full h-full object-cover object-top select-none"
          />

          <div className="absolute inset-0 bg-gradient-to-t from-[#0e1018] via-transparent to-black/30 pointer-events-none" />

          {/* Quick badge */}
          <div className="absolute top-3 left-3 flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-xs font-semibold text-rose-300">
            <Sparkles className="w-3.5 h-3.5 text-rose-400" />
            <span>Portrait Officiel</span>
          </div>
        </div>

        {/* Persona Details Card */}
        <div className="p-5 bg-[#0e1018] border-t border-slate-800/80 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-white font-display">
                  {girlfriend.name}, {girlfriend.age} ans
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 font-medium">
                  {girlfriend.relationshipStatus === 'girlfriend' ? 'Petite amie' : girlfriend.relationshipStatus}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {girlfriend.occupation}
              </p>
            </div>

            <a
              href={girlfriend.appearance.avatarUrl}
              download={`${girlfriend.name.toLowerCase()}-portrait.jpg`}
              target="_blank"
              rel="noreferrer"
              className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition text-xs flex items-center gap-1.5"
              title="Télécharger la photo"
            >
              <Download className="w-4 h-4 text-rose-400" />
            </a>
          </div>

          {/* Physical traits & outfit pill */}
          <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
            <div className="p-2 rounded-xl bg-slate-900/70 border border-slate-800/80">
              <span className="text-slate-500 block text-[10px]">Tenue actuelle :</span>
              <span className="text-rose-300 font-medium truncate block">{girlfriend.appearance.currentOutfitStyle}</span>
            </div>
            <div className="p-2 rounded-xl bg-slate-900/70 border border-slate-800/80">
              <span className="text-slate-500 block text-[10px]">Yeux & Cheveux :</span>
              <span className="text-slate-200 font-medium truncate block">{girlfriend.appearance.eyeColor} · {girlfriend.appearance.hairColor}</span>
            </div>
          </div>

          {/* Footer actions */}
          <div className="pt-2 flex items-center gap-2">
            {onOpenCustomizer && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenCustomizer();
                }}
                className="flex-1 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition"
              >
                <Sliders className="w-3.5 h-3.5 text-rose-400" />
                <span>Modifier son apparence</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="py-2.5 px-5 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white text-xs font-semibold transition shadow-md shadow-rose-500/20"
            >
              Fermer
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
