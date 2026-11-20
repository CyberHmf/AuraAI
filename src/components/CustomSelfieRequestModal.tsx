import React, { useState, useEffect } from 'react';
import { X, Camera, Sparkles, Wand2, Check } from 'lucide-react';
import { GirlfriendPersona } from '../types';

interface CustomSelfieRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  girlfriend: GirlfriendPersona;
  onTriggerSelfie: (title: string, snippet: string, customOutfit?: string) => Promise<void>;
}

const PRESET_SUGGESTIONS = [
  {
    title: '☕ Pyjama & café du matin',
    prompt: 'at home in the morning in cozy pajamas, messy bedhead hair, holding a warm coffee mug by a gray rainy window, natural authentic selfie',
    suggestedOutfit: 'Pyjama cosy & débardeur',
  },
  {
    title: '☕ Au café en terrasse',
    prompt: 'sitting at a Parisian cafe terrace with a warm cappuccino, morning sunlight, relaxed cozy vibe',
  },
  {
    title: '🌙 Sous la couette',
    prompt: 'cozy late evening in bed under fluffy duvet, soft silk camisole, warm bedside lamp glow, tender intimate smile',
    suggestedOutfit: 'Pyjama cosy & débardeur',
  },
  {
    title: '👗 Miroir tenue du jour',
    prompt: 'standing in front of a full-length bedroom mirror taking a stylish candid mirror selfie, chic modern look',
  },
  {
    title: '🧘‍♀️ Séance sport & fitness',
    prompt: 'at home fitness workout, wearing sleek athletic sportswear, ponytail hairstyle, natural glowing skin',
  },
  {
    title: '🥐 Cuisine gourmande',
    prompt: 'in the kitchen making breakfast, playful smile holding a coffee mug, warm sunlit kitchen ambiance',
  },
];

export const CustomSelfieRequestModal: React.FC<CustomSelfieRequestModalProps> = ({
  isOpen,
  onClose,
  girlfriend,
  onTriggerSelfie,
}) => {
  const [customPrompt, setCustomPrompt] = useState('');
  const [selectedOutfit, setSelectedOutfit] = useState(girlfriend.appearance.currentOutfitStyle);
  const [customOutfitInput, setCustomOutfitInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSelectedOutfit(girlfriend.appearance.currentOutfitStyle);
      setCustomOutfitInput('');
    }
  }, [isOpen, girlfriend.appearance.currentOutfitStyle]);

  if (!isOpen) return null;

  const baseOutfits = girlfriend.appearance.availableOutfits && girlfriend.appearance.availableOutfits.length > 0
    ? girlfriend.appearance.availableOutfits
    : [
        'Haut décontracté chic & jeans',
        'Robe élégante en lin pastel',
        'Top cosy d’intérieur & shorty',
        'Veste en cuir souple & t-shirt noir',
      ];

  const hasPajamaOption = baseOutfits.some(o => /pyjama/i.test(o));
  const outfits = hasPajamaOption
    ? baseOutfits
    : [...baseOutfits, 'Pyjama cosy & débardeur'];

  const handleApplyPreset = (preset: typeof PRESET_SUGGESTIONS[0]) => {
    setCustomPrompt(preset.prompt);
    if (preset.suggestedOutfit) {
      setSelectedOutfit(preset.suggestedOutfit);
      setCustomOutfitInput('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customPrompt.trim()) return;

    setIsSubmitting(true);
    const trimmedPrompt = customPrompt.trim();
    const chosenOutfit = customOutfitInput.trim() || selectedOutfit;
    const isDefaultUntouched = !customOutfitInput.trim() && selectedOutfit === girlfriend.appearance.currentOutfitStyle;
    const promptMentionsClothing = /\b(pyjama|nuisette|peignoir|serviette|jogging|maillot|sportswear|athletic|camisole|robe|sweat|hoodie)\b/i.test(trimmedPrompt);
    const effectiveCustomOutfit = (isDefaultUntouched && promptMentionsClothing) ? undefined : chosenOutfit;

    const title = trimmedPrompt.length > 30 
      ? trimmedPrompt.slice(0, 28) + '...'
      : trimmedPrompt;

    try {
      await onTriggerSelfie(title, trimmedPrompt, effectiveCustomOutfit);
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/90 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-3xl bg-[#0e1018] border border-rose-500/30 shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800/80 flex items-center justify-between bg-[#121420]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-rose-500 to-pink-600 flex items-center justify-center text-white shadow-md shadow-rose-500/25">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white font-display">
                Demander un selfie à {girlfriend.name}
              </h3>
              <p className="text-[11px] text-slate-400">
                Choisis la scène et la tenue pour une photo sur-mesure
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable content */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 overflow-y-auto space-y-5 text-xs flex-1">
          
          {/* Quick suggestions */}
          <div className="space-y-2">
            <label className="text-[11px] font-semibold text-rose-300 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-rose-400" />
              <span>Idées de scènes rapides :</span>
            </label>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_SUGGESTIONS.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleApplyPreset(preset)}
                  className="px-2.5 py-1.5 rounded-xl text-[11px] bg-slate-900 hover:bg-rose-500/15 border border-slate-800 hover:border-rose-500/30 text-slate-300 hover:text-rose-200 transition active:scale-95 text-left"
                >
                  {preset.title}
                </button>
              ))}
            </div>
          </div>

          {/* Prompt textarea */}
          <div className="space-y-2">
            <label className="text-[11px] font-semibold text-slate-200 uppercase tracking-wider flex items-center justify-between">
              <span>Scène ou contexte du selfie :</span>
              <span className="text-[10px] text-slate-500 normal-case font-normal">Ex: en pyjama de soie buvant un thé chaud</span>
            </label>
            <textarea
              rows={3}
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder={`Décris ce que fait ${girlfriend.name} (ex: souriant dans le parc avec ses lunettes de soleil, au volant d'une voiture, assise sur un canapé...).`}
              className="w-full bg-slate-900/90 border border-slate-800 focus:border-rose-500/80 rounded-2xl p-3 text-slate-100 placeholder:text-slate-500 focus:outline-none transition leading-relaxed resize-none text-xs"
              required
            />
          </div>

          {/* Outfit selector */}
          <div className="space-y-2.5">
            <label className="text-[11px] font-semibold text-slate-200 uppercase tracking-wider block">
              Tenue portée sur la photo :
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {outfits.map((outfit, index) => {
                const isSelected = selectedOutfit === outfit && !customOutfitInput.trim();
                return (
                  <button
                    key={index}
                    type="button"
                    onClick={() => {
                      setSelectedOutfit(outfit);
                      setCustomOutfitInput('');
                    }}
                    className={`p-2.5 rounded-xl border text-left transition flex items-center justify-between ${
                      isSelected
                        ? 'bg-rose-500/15 border-rose-500/40 text-rose-200'
                        : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:bg-slate-800/80'
                    }`}
                  >
                    <span className="truncate text-[11px]">{outfit}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-rose-400 shrink-0 ml-1.5" />}
                  </button>
                );
              })}
            </div>

            {/* Custom outfit input */}
            <input
              type="text"
              value={customOutfitInput}
              onChange={(e) => setCustomOutfitInput(e.target.value)}
              placeholder="Ou décris une autre tenue spécifique..."
              className="w-full bg-slate-900/70 border border-slate-800 focus:border-rose-500/70 rounded-xl px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:outline-none transition text-xs mt-1"
            />
          </div>

          {/* Continuity Guarantee Notice */}
          <div className="p-3 rounded-2xl bg-slate-900/40 border border-slate-800/80 text-[11px] text-slate-400 space-y-1">
            <span className="text-slate-300 font-semibold flex items-center gap-1.5">
              <Wand2 className="w-3.5 h-3.5 text-rose-400" />
              <span>Continuité visuelle garantie</span>
            </span>
            <p className="leading-relaxed">
              Le portrait de référence de {girlfriend.name} (cheveux {girlfriend.appearance.hairColor}, yeux {girlfriend.appearance.eyeColor}, morphologie) est automatiquement injecté pour préserver son visage et son identité.
            </p>
          </div>

          {/* Action buttons */}
          <div className="pt-2 flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 px-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold transition text-xs"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={!customPrompt.trim() || isSubmitting}
              className="flex-1 py-3 px-4 rounded-2xl bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white font-semibold transition disabled:opacity-50 shadow-lg shadow-rose-500/20 text-xs flex items-center justify-center gap-2 active:scale-95"
            >
              <Camera className="w-4 h-4" />
              <span>{isSubmitting ? 'Génération...' : 'Prendre ce selfie 📸'}</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
