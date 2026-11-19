import React, { useState } from 'react';
import { X, BookHeart, Calendar, Heart, Feather, Sparkles } from 'lucide-react';
import { GirlfriendPersona, DiaryEntry } from '../types';

interface DiaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  girlfriend: GirlfriendPersona;
  entries: DiaryEntry[];
  onAddNote?: (entry: Omit<DiaryEntry, 'id'>) => void;
}

export const DiaryModal: React.FC<DiaryModalProps> = ({
  isOpen,
  onClose,
  girlfriend,
  entries,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md">
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-3xl bg-[#0f111a] border border-slate-800 shadow-2xl overflow-hidden text-slate-100">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#131622]/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-pink-500/20 border border-pink-500/30 flex items-center justify-center text-pink-400">
              <BookHeart className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Le Journal Intime de {girlfriend.name}</h2>
              <p className="text-xs text-slate-400">Ses pensées secrètes et petits mots doux sur vos moments</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1 text-slate-200">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="p-5 rounded-2xl bg-gradient-to-br from-slate-900/90 to-[#141220]/80 border border-slate-800 shadow-sm relative overflow-hidden"
            >
              <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                <div className="flex items-center gap-1.5 font-medium text-rose-300">
                  <Calendar className="w-3.5 h-3.5 text-rose-400" />
                  <span>{entry.date} · {entry.time}</span>
                </div>
                <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-300 border border-rose-500/20">
                  {entry.mood}
                </span>
              </div>

              <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-1.5 font-display">
                <Feather className="w-3.5 h-3.5 text-rose-400" />
                <span>{entry.title}</span>
              </h3>

              <p className="text-xs text-slate-300 leading-relaxed italic bg-black/20 p-3.5 rounded-xl border border-slate-800/60">
                "{entry.content}"
              </p>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-[#131622]/90 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-500">
            {girlfriend.name} écrit spontanément après vos conversations profondes
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white transition"
          >
            Fermer
          </button>
        </div>

      </div>
    </div>
  );
};
