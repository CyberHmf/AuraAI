import React, { useState, useEffect } from 'react';
import { Sparkles, Server, ArrowRight, Globe, Zap } from 'lucide-react';
import { LLMConfig, SelfieConfig, GirlfriendPersona } from '../types';
import { createBlankCustomPersona } from '../data/presets';
import { safeStorage } from '../services/safeStorage';
import { BrandLogo } from './BrandLogo';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  llmConfig: LLMConfig;
  selfieConfig: SelfieConfig;
  onUpdateLLMConfig: (config: LLMConfig) => void;
  onUpdateSelfieConfig: (config: SelfieConfig) => void;
  onSelectPersona: (persona: GirlfriendPersona) => void;
  onOpenCustomizer: () => void;
  onOpenSettings: () => void;
  onConfigureKeys?: (provider: 'local' | 'openrouter' | 'groq' | 'nanogpt') => void;
  initialStep?: 1 | 2;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  isOpen,
  onClose,
  llmConfig,
  selfieConfig,
  onUpdateLLMConfig,
  onUpdateSelfieConfig,
  onSelectPersona,
  onOpenCustomizer,
  onOpenSettings,
  onConfigureKeys,
  initialStep = 1,
}) => {
  const [step, setStep] = useState<1 | 2>(initialStep);
  const [hasServerGemini, setHasServerGemini] = useState(false);

  useEffect(() => {
    if (isOpen && initialStep) {
      setStep(initialStep);
    }
  }, [isOpen, initialStep]);

  useEffect(() => {
    // Check if backend has Gemini key configured in .env
    fetch('/api/config-status')
      .then(r => r.json())
      .then(data => {
        if (data.hasGeminiKey) {
          setHasServerGemini(true);
        }
      })
      .catch(() => {});
  }, []);

  if (!isOpen) return null;

  const preserveOrDefaultSelfieConfig = (): SelfieConfig => {
    if (selfieConfig.provider === 'nanogpt' || selfieConfig.nanoGptApiKey) {
      const currentImg = selfieConfig.imageModel || '';
      const validNanoImg = (!currentImg || currentImg === 'flux' || currentImg.startsWith('gemini-') || currentImg.includes('/'))
        ? 'qwen-image'
        : currentImg;
      return {
        ...selfieConfig,
        provider: 'nanogpt',
        imageModel: validNanoImg,
        aspectRatio: selfieConfig.aspectRatio || '3:4',
      };
    }
    if (selfieConfig.provider === 'openrouter' && selfieConfig.openRouterApiKey) {
      return {
        ...selfieConfig,
        aspectRatio: selfieConfig.aspectRatio || '3:4',
      };
    }
    return {
      ...selfieConfig,
      provider: 'pollinations',
      aspectRatio: '3:4',
    };
  };

  const handleSelectGeminiDefault = () => {
    onUpdateLLMConfig({
      ...llmConfig,
      provider: 'gemini',
      model: 'gemini-3.1-flash-lite',
    });
    onUpdateSelfieConfig(preserveOrDefaultSelfieConfig());
    setStep(2);
  };

  const handleSelectLocalOllama = () => {
    onUpdateLLMConfig({
      ...llmConfig,
      provider: 'local',
      localEndpoint: 'http://localhost:11434/v1',
      model: 'llama3.2-vision',
    });
    onUpdateSelfieConfig(preserveOrDefaultSelfieConfig());
    if (onConfigureKeys) {
      onConfigureKeys('local');
    } else {
      setStep(2);
    }
  };

  const handleSelectOpenRouterOrGroq = () => {
    onUpdateLLMConfig({
      ...llmConfig,
      provider: 'openrouter',
      model: 'meta-llama/llama-3.3-70b-instruct',
    });
    onUpdateSelfieConfig(preserveOrDefaultSelfieConfig());
    if (onConfigureKeys) {
      onConfigureKeys('openrouter');
    } else {
      setStep(2);
    }
  };

  const handleSelectNanoGpt = () => {
    onUpdateLLMConfig({
      ...llmConfig,
      provider: 'nanogpt',
      model: 'z-ai/glm-5.3-flash',
    });
    const currentImg = selfieConfig.imageModel || '';
    const validNanoImg = (!currentImg || currentImg === 'flux' || currentImg.startsWith('gemini-') || currentImg.includes('/'))
      ? 'qwen-image'
      : currentImg;
    onUpdateSelfieConfig({
      ...selfieConfig,
      provider: 'nanogpt',
      imageModel: validNanoImg,
      aspectRatio: '3:4',
    });
    if (onConfigureKeys) {
      onConfigureKeys('nanogpt');
    } else {
      setStep(2);
    }
  };

  const handleStartCustomGirlfriend = () => {
    const blank = createBlankCustomPersona();
    onSelectPersona(blank);
    onUpdateSelfieConfig({
      ...selfieConfig,
      provider: selfieConfig.provider || 'pollinations',
      aspectRatio: selfieConfig.aspectRatio || '3:4',
    });
    safeStorage.setItem('aura_onboarding_completed', 'true');
    onClose();
    onOpenCustomizer();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md text-slate-100">
      <div className="w-full max-w-xl rounded-3xl bg-[#0f111a] border border-rose-500/30 shadow-2xl overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-rose-950/40 via-[#161828] to-purple-950/40 border-b border-slate-800">
          <div className="flex items-center gap-2 text-xs font-semibold text-rose-400 uppercase tracking-wider mb-1.5">
            <BrandLogo className="w-5 h-5 rounded-md shadow-sm shadow-rose-500/20" />
            <span>Bienvenue sur Aura AI • Étape {step}/2</span>
          </div>
          <h2 className="text-xl font-bold text-white">
            {step === 1 ? "Configuration du Moteur d'IA Réel" : "Création de votre Compagne sur-mesure"}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {step === 1 
              ? "Choisissez le moteur IA réel qui animera l'esprit, la vision et la personnalité de votre compagne."
              : "Aucun personnage générique : personnalisez son âme, son physique et générez son portrait initial avec l'IA."}
          </p>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          
          {step === 1 && (
            <div className="space-y-3">
              {/* Option 1: Gemini via .env (Recommandé) */}
              <button
                type="button"
                onClick={handleSelectGeminiDefault}
                className="w-full p-4 rounded-2xl border border-rose-500/50 bg-rose-500/10 hover:bg-rose-500/20 text-left transition flex items-center justify-between group active:scale-[0.99]"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-rose-500 to-pink-500 flex items-center justify-center text-white shrink-0 shadow-md shadow-rose-500/20">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white">Google Gemini (Recommandé)</span>
                      <span className="text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                        {hasServerGemini ? "Clé .env Détectée" : "Prêt via Backend"}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Gemini 3.1 Flash Lite : ultra-rapide, vision multimodale & mémoire instantanée.
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-rose-400 group-hover:translate-x-1 transition" />
              </button>

              {/* Option 2: Local Ollama / vLLM */}
              <button
                type="button"
                onClick={handleSelectLocalOllama}
                className="w-full p-4 rounded-2xl border border-slate-800 bg-slate-900/70 hover:border-slate-700 text-left transition flex items-center justify-between group active:scale-[0.99]"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
                    <Server className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white">Ollama Local (GPU / CPU)</span>
                      <span className="text-[10px] font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded-full">
                        100% Hors Ligne & Privé
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Modèle local sur votre machine (Llama 3.2 Vision, Mistral...) sans dépendance cloud.
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-slate-400 group-hover:translate-x-1 transition" />
              </button>

              {/* Option 3: OpenRouter / Groq */}
              <button
                type="button"
                onClick={handleSelectOpenRouterOrGroq}
                className="w-full p-4 rounded-2xl border border-slate-800 bg-slate-900/70 hover:border-slate-700 text-left transition flex items-center justify-between group active:scale-[0.99]"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-sky-500/20 border border-sky-500/30 flex items-center justify-center text-sky-400 shrink-0">
                    <Globe className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white">OpenRouter / Groq</span>
                      <span className="text-[10px] font-semibold bg-sky-500/20 text-sky-300 border border-sky-500/30 px-2 py-0.5 rounded-full">
                        Cloud Haute Vitesse
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Llama 3.3 70B, Claude ou DeepSeek via vos propres clés d'API.
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-slate-400 group-hover:translate-x-1 transition" />
              </button>

              {/* Option 4: NanoGPT (1 clé partagée LLM + 100 images/jour) */}
              <button
                type="button"
                onClick={handleSelectNanoGpt}
                className="w-full p-4 rounded-2xl border border-indigo-500/40 bg-indigo-500/10 hover:bg-indigo-500/15 text-left transition flex items-center justify-between group active:scale-[0.99]"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
                    <Zap className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-white">NanoGPT (Abo 12$)</span>
                      <span className="text-[10px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full">
                        LLM + 100 Images/j · Clé Unique
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      299+ LLM (GLM, Qwen, DeepSeek) + HiDream, Chroma, Z Image Turbo & Qwen Image avec une seule clé.
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-indigo-400 group-hover:translate-x-1 transition" />
              </button>

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenSettings();
                  }}
                  className="text-xs text-rose-400 hover:text-rose-300 underline underline-offset-4"
                >
                  Ouvrir les réglages avancés (clés, synthèse vocale TTS, ports...)
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              {/* Active Engine Badge */}
              <div className="p-3 rounded-2xl bg-slate-900 border border-rose-500/30 text-xs flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span className="text-slate-400">Moteur actif :</span>
                  <span className="font-bold text-white uppercase">{llmConfig.provider}</span>
                  <span className="text-slate-400 text-[11px]">({llmConfig.model})</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (onConfigureKeys) {
                      onConfigureKeys(llmConfig.provider as any);
                    } else {
                      onOpenSettings();
                    }
                  }}
                  className="text-[11px] text-rose-400 hover:text-rose-300 font-semibold underline underline-offset-2"
                >
                  Clés / Modèles ⚙️
                </button>
              </div>

              <div className="p-5 rounded-2xl border border-rose-500/40 bg-gradient-to-br from-rose-950/30 via-slate-900 to-purple-950/20 text-center flex flex-col items-center">
                <BrandLogo className="w-16 h-16 rounded-2xl mb-3 shadow-lg shadow-rose-500/30" />
                
                <h3 className="text-lg font-bold text-white">Prêt à créer votre Compagne idéale</h3>
                <p className="text-xs text-slate-300 mt-2 max-w-md leading-relaxed">
                  Vous allez définir son prénom, son caractère, ses passions ainsi que son physique (cheveux, yeux, morphologie). 
                  L'intelligence artificielle générera son portrait de référence réaliste pour donner vie à vos échanges.
                </p>

                <div className="w-full mt-6 flex flex-col gap-2.5">
                  <button
                    type="button"
                    onClick={handleStartCustomGirlfriend}
                    className="w-full py-3.5 px-5 rounded-xl bg-gradient-to-r from-rose-500 via-pink-500 to-purple-600 hover:from-rose-600 hover:to-purple-700 text-white font-semibold text-sm shadow-lg shadow-rose-500/20 flex items-center justify-center gap-2 transition active:scale-[0.99]"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Créer ma Compagne maintenant</span>
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  ← Retour au choix moteur
                </button>
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
};
