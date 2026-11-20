import React, { useState } from 'react';
import { X, Camera, Sparkles, Heart, Download, Coffee, Utensils, Sun, BookOpen, Activity, Loader2, RotateCcw, Trash2 } from 'lucide-react';
import { GirlfriendPersona, SelfieItem, SelfieConfig } from '../types';
import { SELFIE_SCENARIOS } from '../data/presets';

interface SelfieGalleryModalProps {
  isOpen: boolean;
  onClose: () => void;
  girlfriend: GirlfriendPersona;
  selfies: SelfieItem[];
  onTriggerSelfie: (scenarioTitle: string, snippet: string, customOutfit?: string) => Promise<void>;
  onClearGallery?: () => void;
  onRestoreSampleSelfies?: () => void;
  isGenerating: boolean;
}

export const SelfieGalleryModal: React.FC<SelfieGalleryModalProps> = ({
  isOpen,
  onClose,
  girlfriend,
  selfies,
  onTriggerSelfie,
  onClearGallery,
  onRestoreSampleSelfies,
  isGenerating,
}) => {
  const [selectedSelfie, setSelectedSelfie] = useState<SelfieItem | null>(null);
  const [customSceneText, setCustomSceneText] = useState('');
  const [selectedOutfit, setSelectedOutfit] = useState(girlfriend.appearance.currentOutfitStyle);

  if (!isOpen) return null;

  const handleQuickScenario = async (title: string, snippet: string) => {
    await onTriggerSelfie(title, snippet, selectedOutfit);
  };

  const handleCustomScenarioSubmit = async () => {
    if (customSceneText.trim()) {
      await onTriggerSelfie('Selfie personnalisé', customSceneText.trim(), selectedOutfit);
      setCustomSceneText('');
    }
  };

  const getScenarioIcon = (iconName: string) => {
    switch (iconName) {
      case 'Coffee': return <Coffee className="w-3.5 h-3.5" />;
      case 'Utensils': return <Utensils className="w-3.5 h-3.5" />;
      case 'Sun': return <Sun className="w-3.5 h-3.5" />;
      case 'BookOpen': return <BookOpen className="w-3.5 h-3.5" />;
      case 'Activity': return <Activity className="w-3.5 h-3.5" />;
      default: return <Sparkles className="w-3.5 h-3.5" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md">
      <div className="w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl bg-[#0f111a] border border-slate-800 shadow-2xl overflow-hidden text-slate-100">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#131622]/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Album Privé de {girlfriend.name}</h2>
              <p className="text-xs text-slate-400">Photos et selfies générés avec visage constant & tenue active</p>
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
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-200">
          
          {/* Quick Request Strip */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-rose-950/20 to-slate-900/60 border border-slate-800">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-rose-400" />
                <span className="text-xs font-semibold text-white">Demander un nouveau selfie à l'instant</span>
              </div>
              
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-400">Tenue :</span>
                <select
                  value={selectedOutfit}
                  onChange={(e) => setSelectedOutfit(e.target.value)}
                  className="bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1 text-xs text-rose-300 focus:outline-none"
                >
                  {(girlfriend.appearance.availableOutfits.some(o => /pyjama/i.test(o))
                    ? girlfriend.appearance.availableOutfits
                    : [...girlfriend.appearance.availableOutfits, 'Pyjama cosy & débardeur']
                  ).map(o => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Quick buttons */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 mb-3">
              {SELFIE_SCENARIOS.map(sc => (
                <button
                  key={sc.id}
                  disabled={isGenerating}
                  onClick={() => handleQuickScenario(sc.title, sc.promptSnippet)}
                  className="p-2.5 rounded-xl border border-slate-800 bg-slate-900/60 hover:border-rose-500/50 hover:bg-rose-500/10 text-left transition disabled:opacity-50 flex flex-col items-start gap-1 text-xs"
                >
                  <span className="text-rose-400">{getScenarioIcon(sc.icon)}</span>
                  <span className="font-medium text-slate-200 line-clamp-1">{sc.title}</span>
                </button>
              ))}
            </div>

            {/* Custom Scene Input */}
            <div className="flex gap-2">
              <input
                type="text"
                disabled={isGenerating}
                value={customSceneText}
                onChange={(e) => setCustomSceneText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCustomScenarioSubmit()}
                placeholder="Ou décris une scène sur-mesure (ex: Dans un musée devant une peinture, souriant avec son café)..."
                className="flex-1 text-xs bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-rose-500 disabled:opacity-50"
              />
              <button
                disabled={isGenerating || !customSceneText.trim()}
                onClick={handleCustomScenarioSubmit}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-xs font-semibold text-white flex items-center gap-1.5 transition disabled:opacity-50"
              >
                {isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
                <span>Prendre le selfie</span>
              </button>
            </div>

            {isGenerating && (
              <div className="mt-3 flex items-center gap-2 text-xs text-rose-300 font-medium animate-pulse">
                <Loader2 className="w-4 h-4 animate-spin text-rose-400" />
                <span>{girlfriend.name} ajuste ses cheveux et prend sa photo pour toi...</span>
              </div>
            )}
          </div>

          {/* Photo Gallery Grid */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-semibold text-white">Galerie ({selfies.length} photos)</h3>
                {selfies.length > 0 && onClearGallery && (
                  <button
                    onClick={onClearGallery}
                    className="text-[10px] text-slate-500 hover:text-red-400 transition flex items-center gap-1 px-2 py-0.5 rounded-lg hover:bg-red-500/10"
                    title="Vider les photos de l'album"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Vider l'album</span>
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                {selfies.length === 0 && onRestoreSampleSelfies && (
                  <button
                    onClick={onRestoreSampleSelfies}
                    className="text-[11px] text-rose-400 hover:text-rose-300 font-medium flex items-center gap-1 transition"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Restaurer photos exemples</span>
                  </button>
                )}
                {selfies.length > 0 && (
                  <span className="text-[11px] text-slate-500">Cliquez pour voir en plein écran</span>
                )}
              </div>
            </div>

            {selfies.length === 0 ? (
              <div className="py-12 px-6 rounded-2xl bg-slate-900/40 border border-slate-800 text-center flex flex-col items-center justify-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
                  <Camera className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-white">L'album privé est vide</h4>
                  <p className="text-[11px] text-slate-400 mt-1 max-w-sm">
                    Demandez un selfie spontané à <strong>{girlfriend.name}</strong> ci-dessus ou en pleine discussion pour enrichir votre album !
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {selfies.map((selfie) => (
                  <div
                    key={selfie.id}
                    onClick={() => setSelectedSelfie(selfie)}
                    className="group relative rounded-2xl overflow-hidden aspect-[9/16] bg-slate-900 border border-slate-800/80 cursor-pointer shadow-md hover:border-rose-500/50 transition-all duration-200"
                  >
                    <img
                      src={selfie.url}
                      alt={selfie.scenarioTitle}
                      className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-300"
                      referrerPolicy="no-referrer"
                      loading="lazy"
                    />
                    
                    {/* Gradient Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-80 group-hover:opacity-95 transition-opacity pointer-events-none" />

                    {/* Caption & Scenario Tag */}
                    <div className="absolute bottom-2.5 left-2.5 right-2.5 pointer-events-none">
                      <span className="text-[10px] text-rose-300 font-medium block truncate">
                        {selfie.scenarioTitle}
                      </span>
                      <span className="text-[11px] text-white line-clamp-1 mt-0.5">
                        {selfie.caption}
                      </span>
                      <span className="text-[9px] text-slate-400 mt-1 block">
                        {selfie.timestamp}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Lightbox Modal */}
        {selectedSelfie && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/95 backdrop-blur-md">
            <div className="relative max-w-sm sm:max-w-md w-full flex flex-col rounded-3xl overflow-hidden bg-slate-900 border border-slate-800 shadow-2xl">
              <button
                onClick={() => setSelectedSelfie(null)}
                className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="relative aspect-[9/16] w-full bg-black overflow-hidden flex items-center justify-center">
                <img
                  src={selectedSelfie.url}
                  alt={selectedSelfie.scenarioTitle}
                  className="w-full h-full object-cover object-top"
                  referrerPolicy="no-referrer"
                />
              </div>

              <div className="p-4 bg-slate-900 border-t border-slate-800">
                <div className="flex items-center justify-between text-xs text-rose-400 font-semibold mb-1">
                  <span>{selectedSelfie.scenarioTitle}</span>
                  <span className="text-slate-500 font-normal">{selectedSelfie.timestamp}</span>
                </div>
                <p className="text-xs text-slate-200 leading-relaxed italic">
                  "{selectedSelfie.caption}"
                </p>
                <div className="mt-2 text-[10px] text-slate-400 flex items-center justify-between">
                  <span>Tenue : {selectedSelfie.outfitUsed}</span>
                  <a
                    href={selectedSelfie.url}
                    download={`selfie-${selectedSelfie.id}.jpg`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-rose-400 hover:underline flex items-center gap-1"
                  >
                    <Download className="w-3 h-3" />
                    <span>Télécharger</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
