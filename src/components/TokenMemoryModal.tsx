import React, { useState } from 'react';
import { X, Cpu, Zap, Brain, Plus, Trash2, Heart, ShieldCheck, Check } from 'lucide-react';
import { LightweightMemory, LLMConfig } from '../types';

interface TokenMemoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  memory: LightweightMemory;
  onUpdateMemory: (updated: LightweightMemory) => void;
  config: LLMConfig;
  onUpdateConfig: (updated: LLMConfig) => void;
  activeTokens: number;
  tokensSaved: number;
  savingsPercent: number;
}

export const TokenMemoryModal: React.FC<TokenMemoryModalProps> = ({
  isOpen,
  onClose,
  memory,
  onUpdateMemory,
  config,
  onUpdateConfig,
  activeTokens,
  tokensSaved,
  savingsPercent
}) => {
  const [newFact, setNewFact] = useState('');
  const [newInsideJoke, setNewInsideJoke] = useState('');

  if (!isOpen) return null;

  const handleAddFact = () => {
    if (newFact.trim()) {
      onUpdateMemory({
        ...memory,
        factsAboutUser: [...memory.factsAboutUser, newFact.trim()]
      });
      setNewFact('');
    }
  };

  const handleRemoveFact = (index: number) => {
    onUpdateMemory({
      ...memory,
      factsAboutUser: memory.factsAboutUser.filter((_, i) => i !== index)
    });
  };

  const handleAddJoke = () => {
    if (newInsideJoke.trim()) {
      onUpdateMemory({
        ...memory,
        insideJokes: [...memory.insideJokes, newInsideJoke.trim()]
      });
      setNewInsideJoke('');
    }
  };

  const handleRemoveJoke = (index: number) => {
    onUpdateMemory({
      ...memory,
      insideJokes: memory.insideJokes.filter((_, i) => i !== index)
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md">
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-3xl bg-[#0f111a] border border-slate-800 shadow-2xl overflow-hidden text-slate-100">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#131622]/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Brain className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Mémoire Légère & Optimisation Tokens</h2>
              <p className="text-xs text-slate-400">Format compact JanitorAI / World-Info anti-surconsommation</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Token Savings Comparison Strip */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-200">
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800">
              <span className="text-[11px] text-slate-400 font-medium block">Tokens Actifs par Tour</span>
              <div className="text-xl font-bold font-mono text-emerald-400 mt-1 tabular-nums">
                ~{activeTokens} <span className="text-xs font-normal text-slate-400">tokens</span>
              </div>
              <span className="text-[10px] text-slate-500 mt-0.5 block">Sliding window {config.maxContextMessages} msgs</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800">
              <span className="text-[11px] text-slate-400 font-medium block">Vs Her&Him Classique</span>
              <div className="text-xl font-bold font-mono text-rose-400 line-through mt-1 tabular-nums">
                ~{activeTokens + tokensSaved} <span className="text-xs font-normal text-slate-400">tokens</span>
              </div>
              <span className="text-[10px] text-slate-500 mt-0.5 block">Historique brut non compressé</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-gradient-to-br from-emerald-950/40 to-teal-950/30 border border-emerald-500/30">
              <span className="text-[11px] text-emerald-300 font-medium block flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 text-emerald-400" /> Économie Réalisée
              </span>
              <div className="text-xl font-bold font-mono text-emerald-300 mt-1 tabular-nums">
                -{savingsPercent}%
              </div>
              <span className="text-[10px] text-emerald-400/80 mt-0.5 block">{tokensSaved} tokens épargnés</span>
            </div>
          </div>

          {/* Intimacy & Affection */}
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Heart className="w-4 h-4 text-rose-400" />
                <span className="text-xs font-semibold text-white">Niveau d'Affection & Intimité</span>
              </div>
              <span className="text-xs font-mono font-bold text-rose-400 tabular-nums">
                {memory.affectionScore}/100
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-rose-500 to-pink-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, memory.affectionScore)}%` }}
              />
            </div>
            <div className="mt-2 text-[11px] text-slate-400 flex items-center justify-between">
              <span>Humeur perçue : <strong className="text-rose-300">{memory.currentMood}</strong></span>
            </div>
          </div>

          {/* Facts about User */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-white">
                Ce qu'elle a retenu sur toi ({memory.factsAboutUser.length} faits)
              </h3>
              <span className="text-[10px] text-slate-500">Injecté en JSON compact (~40 tokens)</span>
            </div>

            <div className="space-y-1.5 mb-2.5">
              {memory.factsAboutUser.map((fact, index) => (
                <div 
                  key={index} 
                  className="flex items-center justify-between p-2 rounded-xl bg-slate-900/80 border border-slate-800 text-xs text-slate-200"
                >
                  <span className="truncate pr-2">• {fact}</span>
                  <button
                    onClick={() => handleRemoveFact(index)}
                    className="text-slate-500 hover:text-rose-400 p-1 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={newFact}
                onChange={(e) => setNewFact(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddFact()}
                placeholder="Ajouter manuellement un fait (ex: Aime le chocolat noir 85%)..."
                className="flex-1 text-xs bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-rose-500"
              />
              <button
                onClick={handleAddFact}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-white flex items-center gap-1 transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Ajouter</span>
              </button>
            </div>
          </div>

          {/* Inside Jokes */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-white">
                Délires & Inside Jokes partagés ({memory.insideJokes.length})
              </h3>
            </div>

            <div className="space-y-1.5 mb-2.5">
              {memory.insideJokes.map((joke, index) => (
                <div 
                  key={index} 
                  className="flex items-center justify-between p-2 rounded-xl bg-slate-900/80 border border-slate-800 text-xs text-slate-200"
                >
                  <span className="truncate pr-2">✨ {joke}</span>
                  <button
                    onClick={() => handleRemoveJoke(index)}
                    className="text-slate-500 hover:text-rose-400 p-1 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={newInsideJoke}
                onChange={(e) => setNewInsideJoke(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddJoke()}
                placeholder="Ajouter une private joke..."
                className="flex-1 text-xs bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-rose-500"
              />
              <button
                onClick={handleAddJoke}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-white flex items-center gap-1 transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Ajouter</span>
              </button>
            </div>
          </div>

          {/* Sliding Window Size Control */}
          <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-white">Taille de la fenêtre glissante (Historique)</span>
              <span className="text-xs font-mono font-bold text-rose-400">{config.maxContextMessages} messages</span>
            </div>
            <input
              type="range"
              min={4}
              max={16}
              value={config.maxContextMessages}
              onChange={(e) => onUpdateConfig({ ...config, maxContextMessages: parseInt(e.target.value) })}
              className="w-full accent-rose-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 mt-1">
              <span>Ultra économique (4 msgs)</span>
              <span>Recommandé (8 msgs)</span>
              <span>Étendu (16 msgs)</span>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-[#131622]/90 flex items-center justify-end shrink-0">
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
