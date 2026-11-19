import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  X, Server, Key, Cloud, Sparkles, Check, Globe, 
  Image, Sliders, ExternalLink, Volume2, Eye, Play, Mic, RotateCcw, Trash2,
  RefreshCw, Loader2, Search, CheckCircle2, AlertCircle, Cpu
} from 'lucide-react';
import { LLMConfig, SelfieConfig, RealWorldContext, VoiceConfig, GirlfriendPersona } from '../types';
import { POPULAR_CITIES } from '../services/contextService';
import { speakMessage } from '../services/speechService';

interface ModelItem {
  id: string;
  name: string;
  tag?: string;
  category?: string;
  isVision?: boolean;
  supportsTools?: boolean;
  isReasoning?: boolean;
  isSubscriptionIncluded?: boolean;
  isPopular?: boolean;
  isDefault?: boolean;
  supportsFaceReference?: boolean;
  description?: string;
}

interface LLMSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  llmConfig: LLMConfig;
  onUpdateLLMConfig: (cfg: LLMConfig) => void;
  selfieConfig: SelfieConfig;
  onUpdateSelfieConfig: (cfg: SelfieConfig) => void;
  voiceConfig: VoiceConfig;
  onUpdateVoiceConfig: (cfg: VoiceConfig) => void;
  context: RealWorldContext;
  onUpdateCity: (city: string) => void;
  onToggleContextOption: (key: 'injectWeather' | 'injectNews' | 'injectTime', val: boolean) => void;
  girlfriend: GirlfriendPersona;
  onOpenReset?: () => void;
  onOpenLogs?: () => void;
  initialSubTab?: 'llm' | 'voice' | 'image' | 'context' | 'data';
  isPortraitRedirect?: boolean;
  onSaveAndRetryPortrait?: () => void;
  onCancelPortraitRedirect?: () => void;
}

export const LLMSettingsModal: React.FC<LLMSettingsModalProps> = ({
  isOpen,
  onClose,
  llmConfig,
  onUpdateLLMConfig,
  selfieConfig,
  onUpdateSelfieConfig,
  voiceConfig,
  onUpdateVoiceConfig,
  context,
  onUpdateCity,
  onToggleContextOption,
  girlfriend,
  onOpenReset,
  onOpenLogs,
  initialSubTab,
  isPortraitRedirect,
  onSaveAndRetryPortrait,
  onCancelPortraitRedirect,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'llm' | 'voice' | 'image' | 'context' | 'data'>(initialSubTab || 'llm');
  const [isTestingVoice, setIsTestingVoice] = useState(false);

  useEffect(() => {
    if (isOpen && initialSubTab) {
      setActiveSubTab(initialSubTab);
    }
  }, [isOpen, initialSubTab]);

  // Dynamic model fetching state
  const [availableModels, setAvailableModels] = useState<ModelItem[]>([]);
  const [availableImageModels, setAvailableImageModels] = useState<ModelItem[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [isLoadingImageModels, setIsLoadingImageModels] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [modelSearchQuery, setModelSearchQuery] = useState('');
  const [isManualInput, setIsManualInput] = useState(false);
  const [isLiveApi, setIsLiveApi] = useState(false);
  const [recommendedVisionModel, setRecommendedVisionModel] = useState<string | null>(null);
  const [isSavedToServer, setIsSavedToServer] = useState(false);
  const [serverKeyStatus, setServerKeyStatus] = useState<{
    hasGeminiKey: boolean;
    hasGroqKey: boolean;
    hasOpenRouterKey: boolean;
    hasNanoGptKey: boolean;
  }>({
    hasGeminiKey: false,
    hasGroqKey: false,
    hasOpenRouterKey: false,
    hasNanoGptKey: false,
  });
  const [nanoGptSubscriptionOnly, setNanoGptSubscriptionOnly] = useState(true);
  const [nanoSubscriptionCount, setNanoSubscriptionCount] = useState(0);
  const keySyncTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Synchronise et persiste la clé API non vide dans data/keys.json sur le serveur
  const persistKeyToServer = async (provider: string, key: string) => {
    const trimmed = key.trim();
    if (!trimmed) return;
    try {
      const payload: Record<string, string> = {};
      if (provider === 'groq') payload.groqApiKey = trimmed;
      if (provider === 'openrouter') payload.openRouterApiKey = trimmed;
      if (provider === 'gemini') payload.geminiApiKey = trimmed;
      if (provider === 'nanogpt') payload.nanoGptApiKey = trimmed;
      const res = await fetch('/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json();
        setServerKeyStatus({
          hasGeminiKey: Boolean(data.hasGeminiKey),
          hasGroqKey: Boolean(data.hasGroqKey),
          hasOpenRouterKey: Boolean(data.hasOpenRouterKey),
          hasNanoGptKey: Boolean(data.hasNanoGptKey),
        });
        setIsSavedToServer(true);
        setTimeout(() => setIsSavedToServer(false), 2500);
      }
    } catch (e) {
      console.warn('Erreur synchronisation clé serveur:', e);
    }
  };

  const syncKeyToServer = (provider: string, key: string, immediate = false) => {
    if (keySyncTimersRef.current[provider]) {
      clearTimeout(keySyncTimersRef.current[provider]);
      delete keySyncTimersRef.current[provider];
    }
    if (!key.trim()) return;
    if (immediate) {
      void persistKeyToServer(provider, key);
      return;
    }
    keySyncTimersRef.current[provider] = setTimeout(() => {
      delete keySyncTimersRef.current[provider];
      void persistKeyToServer(provider, key);
    }, 350);
  };

  const deleteKeyFromServer = async (provider: 'groq' | 'openrouter' | 'gemini' | 'nanogpt') => {
    try {
      if (keySyncTimersRef.current[provider]) {
        clearTimeout(keySyncTimersRef.current[provider]);
        delete keySyncTimersRef.current[provider];
      }
      const res = await fetch(`/api/keys/${provider}`, { method: 'DELETE' });
      if (res.ok) {
        const data = await res.json();
        setServerKeyStatus({
          hasGeminiKey: Boolean(data.hasGeminiKey),
          hasGroqKey: Boolean(data.hasGroqKey),
          hasOpenRouterKey: Boolean(data.hasOpenRouterKey),
          hasNanoGptKey: Boolean(data.hasNanoGptKey),
        });
      }
      if (provider === 'groq' && llmConfig.provider === 'groq') {
        onUpdateLLMConfig({ ...llmConfig, apiKey: '' });
      } else if (provider === 'openrouter') {
        if (llmConfig.provider === 'openrouter') onUpdateLLMConfig({ ...llmConfig, apiKey: '' });
        if (selfieConfig.openRouterApiKey) onUpdateSelfieConfig({ ...selfieConfig, openRouterApiKey: '' });
      } else if (provider === 'nanogpt') {
        if (llmConfig.provider === 'nanogpt') onUpdateLLMConfig({ ...llmConfig, apiKey: '' });
        if (selfieConfig.nanoGptApiKey) onUpdateSelfieConfig({ ...selfieConfig, nanoGptApiKey: '' });
      }
    } catch (e) {
      console.warn('Erreur suppression clé serveur:', e);
    }
  };

  // Vérifie le statut booléen des clés persistées sur le serveur à l'ouverture (aucune clé brute exposée)
  useEffect(() => {
    if (!isOpen) return;
    fetch('/api/keys')
      .then(r => r.json())
      .then(keys => {
        setServerKeyStatus({
          hasGeminiKey: Boolean(keys.hasGeminiKey),
          hasGroqKey: Boolean(keys.hasGroqKey),
          hasOpenRouterKey: Boolean(keys.hasOpenRouterKey),
          hasNanoGptKey: Boolean(keys.hasNanoGptKey),
        });
      })
      .catch(() => {});
  }, [isOpen, llmConfig.provider, selfieConfig.provider]);

  // Fetch LLM models whenever provider, apiKey, or localEndpoint changes (POST body so keys stay out of URLs)
  const fetchLLMModels = async (provider: string, apiKey: string, endpoint: string) => {
    setIsLoadingModels(true);
    setModelsError(null);
    try {
      const res = await fetch('/api/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          apiKey: apiKey || '',
          endpoint: endpoint || '',
          type: 'chat',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Erreur ${res.status}`);
      }
      setIsLiveApi(Boolean(data.isLive));
      if (data.recommendedVisionModel) {
        setRecommendedVisionModel(data.recommendedVisionModel);
      }
      if (typeof data.subscriptionCount === 'number') {
        setNanoSubscriptionCount(data.subscriptionCount);
      }
      if (Array.isArray(data.models)) {
        setAvailableModels(data.models);
        if (!llmConfig.model && data.models.length > 0) {
          const defaultChoice = data.recommendedVisionModel || data.models[0].id;
          onUpdateLLMConfig({ ...llmConfig, model: defaultChoice });
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur récupération modèles';
      setModelsError(msg);
      setIsLiveApi(false);
    } finally {
      setIsLoadingModels(false);
    }
  };

  // Fetch Image models (OpenRouter or NanoGPT images)
  const fetchImageModels = async (provider: 'openrouter' | 'nanogpt', apiKey: string) => {
    setIsLoadingImageModels(true);
    try {
      const res = await fetch('/api/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          apiKey: apiKey || '',
          type: 'image',
        }),
      });
      const data = await res.json();
      if (Array.isArray(data.models)) {
        setAvailableImageModels(data.models);
        const currentImgModel = selfieConfig.imageModel || '';
        if (provider === 'openrouter') {
          const isInvalidForOpenRouter = !currentImgModel || !currentImgModel.includes('/') || currentImgModel.startsWith('openrouter/auto');
          if (isInvalidForOpenRouter && data.models.length > 0) {
            onUpdateSelfieConfig({ ...selfieConfig, imageModel: data.models[0].id });
          }
        } else if (provider === 'nanogpt') {
          const isInvalidForNanoGpt = !currentImgModel || currentImgModel === 'flux' || currentImgModel.startsWith('gemini-') || currentImgModel.includes('/');
          if (isInvalidForNanoGpt && data.models.length > 0) {
            onUpdateSelfieConfig({ ...selfieConfig, imageModel: data.models[0].id });
          }
        }
      }
    } catch (err) {
      console.warn('Erreur récupération modèles images:', err);
    } finally {
      setIsLoadingImageModels(false);
    }
  };

  // Trigger LLM model fetch on tab open, provider switch, or debounced API key change
  useEffect(() => {
    if (!isOpen) return;

    if (activeSubTab === 'llm') {
      const timer = setTimeout(() => {
        fetchLLMModels(llmConfig.provider, llmConfig.apiKey, llmConfig.localEndpoint);
      }, 300);
      return () => clearTimeout(timer);
    }

    if (activeSubTab === 'image' && selfieConfig.provider === 'openrouter') {
      const timer = setTimeout(() => {
        const keyToUse = selfieConfig.openRouterApiKey || (llmConfig.provider === 'openrouter' ? llmConfig.apiKey : '');
        fetchImageModels('openrouter', keyToUse);
      }, 300);
      return () => clearTimeout(timer);
    }

    if (activeSubTab === 'image' && selfieConfig.provider === 'nanogpt') {
      const timer = setTimeout(() => {
        const keyToUse = selfieConfig.nanoGptApiKey || (llmConfig.provider === 'nanogpt' ? llmConfig.apiKey : '');
        fetchImageModels('nanogpt', keyToUse);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen, activeSubTab, llmConfig.provider, llmConfig.apiKey, llmConfig.localEndpoint, selfieConfig.provider, selfieConfig.openRouterApiKey, selfieConfig.nanoGptApiKey]);

  // Filtered models for OpenRouter / Groq / NanoGPT list
  const filteredModels = useMemo(() => {
    let list = availableModels;
    if (llmConfig.provider === 'nanogpt' && nanoGptSubscriptionOnly) {
      const subOnly = list.filter(m => m.isSubscriptionIncluded);
      if (subOnly.length > 0) list = subOnly;
    }
    if (!modelSearchQuery.trim()) return list;
    const q = modelSearchQuery.toLowerCase();
    return list.filter(m => 
      m.id.toLowerCase().includes(q) || 
      (m.name && m.name.toLowerCase().includes(q)) ||
      (m.tag && m.tag.toLowerCase().includes(q))
    );
  }, [availableModels, modelSearchQuery, llmConfig.provider, nanoGptSubscriptionOnly]);

  if (!isOpen) return null;

  const handleTestVoiceAudio = async () => {
    setIsTestingVoice(true);
    await speakMessage(
      `Coucou mon cœur ! Comment trouves-tu ma voix ? Je suis tellement contente de pouvoir te parler de vive voix.`,
      girlfriend,
      voiceConfig,
      () => setIsTestingVoice(true),
      () => setIsTestingVoice(false)
    );
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md">
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-3xl bg-[#0f111a] border border-slate-800 shadow-2xl overflow-hidden text-slate-100">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#131622]/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-white">Moteurs d'IA, LLM & Vision</h2>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Prise d'effet immédiate
                </span>
              </div>
              <p className="text-xs text-slate-400">Modèles en direct, vision multimodale & détection automatique des modèles</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onOpenLogs && (
              <button
                type="button"
                onClick={onOpenLogs}
                className="text-xs px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-purple-300 border border-slate-700 transition flex items-center gap-1.5"
                title="Ouvrir le journal de logs complet"
              >
                <Cpu className="w-3.5 h-3.5 text-purple-400" />
                <span className="hidden sm:inline font-medium">Journal Logs</span>
              </button>
            )}

            <button
              onClick={isPortraitRedirect && onCancelPortraitRedirect ? onCancelPortraitRedirect : onClose}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Sub tabs */}
        <div className="flex border-b border-slate-800 px-6 bg-[#131622]/40 shrink-0 overflow-x-auto">
          <button
            onClick={() => setActiveSubTab('llm')}
            className={`flex items-center gap-2 py-3 px-3.5 text-xs font-medium border-b-2 transition whitespace-nowrap ${
              activeSubTab === 'llm'
                ? 'border-rose-500 text-rose-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            <span>Moteur LLM & Vision</span>
          </button>

          <button
            onClick={() => setActiveSubTab('image')}
            className={`flex items-center gap-2 py-3 px-3.5 text-xs font-medium border-b-2 transition whitespace-nowrap ${
              activeSubTab === 'image'
                ? 'border-rose-500 text-rose-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Image className="w-3.5 h-3.5" />
            <span>Générateur d'Images</span>
          </button>

          <button
            onClick={() => setActiveSubTab('voice')}
            className={`flex items-center gap-2 py-3 px-3.5 text-xs font-medium border-b-2 transition whitespace-nowrap ${
              activeSubTab === 'voice'
                ? 'border-rose-500 text-rose-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Volume2 className="w-3.5 h-3.5" />
            <span>Voix & TTS (GPU/Cloud)</span>
          </button>

          <button
            onClick={() => setActiveSubTab('context')}
            className={`flex items-center gap-2 py-3 px-3.5 text-xs font-medium border-b-2 transition whitespace-nowrap ${
              activeSubTab === 'context'
                ? 'border-rose-500 text-rose-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Météo & Réel</span>
          </button>

          <button
            onClick={() => setActiveSubTab('data')}
            className={`flex items-center gap-2 py-3 px-3.5 text-xs font-medium border-b-2 transition whitespace-nowrap ${
              activeSubTab === 'data'
                ? 'border-rose-500 text-rose-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Données & Reset</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-200">
          
          {/* TAB 1: LLM PROVIDERS & VISION */}
          {activeSubTab === 'llm' && (
            <div className="space-y-5">
              
              {/* Immediate Effect Notification Badge */}
              <div className="p-3 rounded-2xl bg-gradient-to-r from-emerald-950/30 to-slate-900 border border-emerald-500/30 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="text-slate-300">
                    Les modifications appliquées ici sont actives <strong>immédiatement</strong> pour vos prochains messages et restent mémorisées au redémarrage.
                  </span>
                </div>
              </div>

              {/* Provider Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">Choisir le moteur LLM actif</label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {[
                    { id: 'gemini', title: 'Google Gemini', subtitle: 'Clé .env (Recommandé)' },
                    { id: 'groq', title: 'Groq', subtitle: 'Ultra-rapide Llama' },
                    { id: 'openrouter', title: 'OpenRouter', subtitle: 'DeepSeek, Claude...' },
                    { id: 'nanogpt', title: 'NanoGPT', subtitle: 'Abo 12$ (299+ LLM)' },
                    { id: 'local', title: 'LLM Local', subtitle: 'Ollama / LM Studio' },
                  ].map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        const newProvider = p.id as any;
                        let defaultModel = llmConfig.model;
                        let nextKey = llmConfig.apiKey;
                        if (newProvider === 'gemini') defaultModel = 'gemini-3.1-flash-lite';
                        else if (newProvider === 'groq') defaultModel = 'llama-3.3-70b-versatile';
                        else if (newProvider === 'openrouter') defaultModel = 'meta-llama/llama-3.3-70b-instruct';
                        else if (newProvider === 'nanogpt') {
                          defaultModel = 'z-ai/glm-5.3-flash';
                          if (selfieConfig.nanoGptApiKey) nextKey = selfieConfig.nanoGptApiKey;
                        }
                        else if (newProvider === 'local') defaultModel = 'llama3.2-vision';

                        onUpdateLLMConfig({
                          ...llmConfig,
                          provider: newProvider,
                          model: defaultModel,
                          apiKey: nextKey,
                        });
                      }}
                      className={`p-3 rounded-2xl border text-left transition ${
                        llmConfig.provider === p.id
                          ? 'border-rose-500/80 bg-rose-500/15 text-rose-200 shadow-sm shadow-rose-500/10'
                          : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="text-xs font-bold text-white flex items-center justify-between">
                        <span>{p.title}</span>
                        {llmConfig.provider === p.id && <Check className="w-3.5 h-3.5 text-rose-400" />}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">{p.subtitle}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* GOOGLE GEMINI CONFIGURATION */}
              {llmConfig.provider === 'gemini' && (
                <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-semibold text-white">
                      <Sparkles className="w-4 h-4 text-rose-400" />
                      <span>Google Gemini (Multimodal & Vision native)</span>
                    </div>
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 px-2 py-0.5 rounded-full font-medium">
                      Actif via Backend
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs text-slate-300 mb-1.5 font-medium">Sélection du Modèle Gemini</label>
                    <select
                      value={llmConfig.model}
                      onChange={(e) => onUpdateLLMConfig({ ...llmConfig, model: e.target.value })}
                      className="w-full text-xs bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-200 focus:outline-none focus:border-rose-500"
                    >
                      <option value="gemini-3.1-flash-lite">⚡ Gemini 3.1 Flash Lite (Recommandé Budget & Vitesse - ~0.07$/1M tokens)</option>
                      <option value="gemini-3.5-flash">Gemini 3.5 Flash (Équilibré & Vif)</option>
                      <option value="gemini-3.8-flash">Gemini 3.8 Flash (Haute Fidélité Multimodale & Vision)</option>
                      <option value="gemini-4-argon">Gemini 4 Argon (Raisonnement & Émotions profonds)</option>
                    </select>
                    <span className="text-[10px] text-emerald-400 mt-1 block">
                      💡 Flash Lite consomme une fraction minime de quota, idéal pour des discussions illimitées avec Cloé.
                    </span>
                  </div>

                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                    <div className="text-xs">
                      <span className="font-semibold text-white block">Activer aussi Gemini pour les Images</span>
                      <span className="text-[10px] text-slate-400">Génération native via gemini-3.1-flash-lite-image</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onUpdateSelfieConfig({ ...selfieConfig, provider: selfieConfig.provider === 'gemini' ? 'pollinations' : 'gemini' })}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                        selfieConfig.provider === 'gemini'
                          ? 'bg-rose-500 text-white shadow-sm shadow-rose-500/30'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {selfieConfig.provider === 'gemini' ? 'Gemini Images Actif ✓' : 'Activer pour Images'}
                    </button>
                  </div>
                </div>
              )}

              {/* GROQ CONFIGURATION */}
              {llmConfig.provider === 'groq' && (
                <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-semibold text-white">
                      <Cpu className="w-4 h-4 text-rose-400" />
                      <span>Configuration Groq (Llama LPUs Ultra-Rapide)</span>
                    </div>
                    <a 
                      href="https://console.groq.com/keys" 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="text-[10px] text-rose-400 hover:underline flex items-center gap-1"
                    >
                      <span>Obtenir une clé Groq</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>

                  {/* API Key */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs text-slate-300">Clé d'API Groq</label>
                      <div className="flex items-center gap-2">
                        {isSavedToServer && (
                          <span className="text-[10px] text-emerald-400 font-semibold animate-pulse">
                            💾 Sauvegardée sur le serveur !
                          </span>
                        )}
                        {serverKeyStatus.hasGroqKey && (
                          <button
                            type="button"
                            onClick={() => deleteKeyFromServer('groq')}
                            className="text-[10px] text-red-400 hover:text-red-300 flex items-center gap-1"
                            title="Supprimer la clé enregistrée sur le serveur"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Supprimer</span>
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="relative">
                      <input
                        type="password"
                        value={llmConfig.apiKey}
                        onChange={(e) => {
                          const val = e.target.value;
                          onUpdateLLMConfig({ ...llmConfig, apiKey: val });
                          syncKeyToServer('groq', val);
                        }}
                        onBlur={(e) => syncKeyToServer('groq', e.target.value, true)}
                        placeholder={serverKeyStatus.hasGroqKey ? '•••••••••••••••••••• (Enregistrée sur le serveur)' : 'gsk_...'}
                        className="w-full text-xs font-mono bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-rose-500"
                      />
                      {(llmConfig.apiKey || serverKeyStatus.hasGroqKey) && (
                        <span className="absolute right-3 top-2.5 text-[10px] text-emerald-400 font-semibold">
                          {llmConfig.apiKey ? 'Clé saisie ✓' : '✓ Enregistrée sur le serveur'}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">
                      🔒 Stockée uniquement côté serveur dans <code className="text-slate-400 font-mono">data/keys.json</code> et jamais ré-exposée au navigateur.
                    </p>
                  </div>

                  {/* Live API Confirmation & Chat+Vision Helper */}
                  {isLiveApi ? (
                    <div className="p-3 rounded-2xl bg-gradient-to-r from-emerald-950/40 to-slate-900 border border-emerald-500/40 text-xs flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                          <CheckCircle2 className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="font-semibold text-emerald-300 block">🟢 Connecté à l'API Groq en direct !</span>
                          <span className="text-[11px] text-slate-300">
                            {availableModels.length} modèles réels retournés à l'instant T (dont Vision multimodale).
                          </span>
                        </div>
                      </div>
                      {recommendedVisionModel && llmConfig.model !== recommendedVisionModel && (
                        <button
                          type="button"
                          onClick={() => onUpdateLLMConfig({ ...llmConfig, model: recommendedVisionModel })}
                          className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold transition shadow-sm shrink-0"
                        >
                          Activer Vision
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
                      <span>{(llmConfig.apiKey || serverKeyStatus.hasGroqKey) ? 'Validation de votre clé Groq en cours...' : 'Saisissez votre clé Groq pour interroger l\'API en direct.'}</span>
                      <button
                        type="button"
                        onClick={() => fetchLLMModels('groq', llmConfig.apiKey, '')}
                        disabled={isLoadingModels}
                        className="text-[10px] text-rose-400 hover:underline flex items-center gap-1 font-semibold"
                      >
                        <RefreshCw className={`w-3 h-3 ${isLoadingModels ? 'animate-spin' : ''}`} />
                        <span>Vérifier la clé</span>
                      </button>
                    </div>
                  )}

                  {/* Models List Header with Refresh & Search */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-slate-300 font-medium">Modèle Groq sélectionné ({filteredModels.length} disponibles)</label>
                        {isLoadingModels && <Loader2 className="w-3 h-3 animate-spin text-rose-400" />}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => fetchLLMModels('groq', llmConfig.apiKey, '')}
                          disabled={isLoadingModels}
                          className="text-[10px] text-slate-400 hover:text-rose-400 flex items-center gap-1 transition"
                          title="Actualiser la liste des modèles Groq"
                        >
                          <RefreshCw className={`w-3 h-3 ${isLoadingModels ? 'animate-spin' : ''}`} />
                          <span>Actualiser en direct</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsManualInput(!isManualInput)}
                          className="text-[10px] text-slate-500 hover:text-slate-300 underline"
                        >
                          {isManualInput ? 'Mode liste' : 'Saisie manuelle'}
                        </button>
                      </div>
                    </div>

                    {modelsError && (
                      <div className="p-2.5 rounded-xl bg-red-950/30 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{modelsError}</span>
                      </div>
                    )}

                    {!isManualInput ? (
                      <div className="space-y-1.5">
                        <div className="relative">
                          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                          <input
                            type="text"
                            value={modelSearchQuery}
                            onChange={(e) => setModelSearchQuery(e.target.value)}
                            placeholder="Filtrer les modèles Groq (ex: 70b, vision, deepseek, qwen)..."
                            className="w-full text-xs bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-2 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-rose-500"
                          />
                        </div>

                        <select
                          value={llmConfig.model}
                          onChange={(e) => onUpdateLLMConfig({ ...llmConfig, model: e.target.value })}
                          className="w-full text-xs bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-200 focus:outline-none focus:border-rose-500"
                        >
                          {filteredModels.map(m => (
                            <option key={m.id} value={m.id} className="bg-slate-950 text-slate-200 font-normal">
                              {m.name} {m.tag ? `— [${m.tag}]` : ''} {m.isVision ? '👁️' : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <input
                        type="text"
                        value={llmConfig.model}
                        onChange={(e) => onUpdateLLMConfig({ ...llmConfig, model: e.target.value })}
                        className="w-full text-xs font-mono bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-rose-500"
                        placeholder="llama-3.3-70b-versatile"
                      />
                    )}

                    {/* Vision capability status badge */}
                    <div className="pt-0.5">
                      {llmConfig.model?.includes('vision') ? (
                        <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-medium bg-emerald-500/10 px-2.5 py-1.5 rounded-lg border border-emerald-500/20">
                          <Eye className="w-3.5 h-3.5 shrink-0" />
                          <span>Modèle <strong>Chat + Vision actif</strong> : {girlfriend.name} commente toutes vos photos en direct.</span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between text-[11px] text-amber-300/90 bg-amber-500/10 px-2.5 py-1.5 rounded-lg border border-amber-500/20">
                          <div className="flex items-center gap-1.5">
                            <Eye className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                            <span>Modèle texte pur (l'envoi d'une photo basculera automatiquement sur Llama 3.2 Vision).</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => onUpdateLLMConfig({ ...llmConfig, model: 'llama-3.2-11b-vision-preview' })}
                            className="text-[10px] underline text-amber-300 hover:text-white font-semibold ml-2 shrink-0"
                          >
                            Passer en Vision
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Quick recommended chips */}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => onUpdateLLMConfig({ ...llmConfig, model: 'llama-3.2-11b-vision-preview' })}
                        className={`text-[10px] px-2.5 py-1 rounded-lg border transition ${
                          llmConfig.model === 'llama-3.2-11b-vision-preview'
                            ? 'bg-rose-500/20 border-rose-500/50 text-rose-300 font-semibold shadow-sm'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        👁️ Llama 3.2 11B (Chat + Vision)
                      </button>
                      <button
                        type="button"
                        onClick={() => onUpdateLLMConfig({ ...llmConfig, model: 'deepseek-r1-distill-llama-70b' })}
                        className={`text-[10px] px-2.5 py-1 rounded-lg border transition ${
                          llmConfig.model === 'deepseek-r1-distill-llama-70b'
                            ? 'bg-rose-500/20 border-rose-500/50 text-rose-300 font-semibold shadow-sm'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        🧠 DeepSeek R1 70B
                      </button>
                      <button
                        type="button"
                        onClick={() => onUpdateLLMConfig({ ...llmConfig, model: 'llama-3.3-70b-versatile' })}
                        className={`text-[10px] px-2.5 py-1 rounded-lg border transition ${
                          llmConfig.model === 'llama-3.3-70b-versatile'
                            ? 'bg-rose-500/20 border-rose-500/50 text-rose-300 font-semibold shadow-sm'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        ⭐ Llama 3.3 70B
                      </button>
                      <button
                        type="button"
                        onClick={() => onUpdateLLMConfig({ ...llmConfig, model: 'llama-3.2-11b-vision-preview' })}
                        className={`text-[10px] px-2.5 py-1 rounded-lg border transition ${
                          llmConfig.model === 'llama-3.2-11b-vision-preview'
                            ? 'bg-rose-500/20 border-rose-500/50 text-rose-300 font-semibold'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        👁️ Llama 3.2 Vision
                      </button>
                      <button
                        type="button"
                        onClick={() => onUpdateLLMConfig({ ...llmConfig, model: 'llama-3.1-8b-instant' })}
                        className={`text-[10px] px-2.5 py-1 rounded-lg border transition ${
                          llmConfig.model === 'llama-3.1-8b-instant'
                            ? 'bg-rose-500/20 border-rose-500/50 text-rose-300 font-semibold'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        ⚡ 8B Instant (1200 tps)
                      </button>
                      <button
                        type="button"
                        onClick={() => onUpdateLLMConfig({ ...llmConfig, model: 'qwen-2.5-32b' })}
                        className={`text-[10px] px-2.5 py-1 rounded-lg border transition ${
                          llmConfig.model === 'qwen-2.5-32b'
                            ? 'bg-rose-500/20 border-rose-500/50 text-rose-300 font-semibold'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        🌐 Qwen 2.5 32B
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* OPENROUTER CONFIGURATION */}
              {llmConfig.provider === 'openrouter' && (
                <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-semibold text-white">
                      <Globe className="w-4 h-4 text-sky-400" />
                      <span>Configuration OpenRouter (400+ Modèles Mondiaux)</span>
                    </div>
                    <a 
                      href="https://openrouter.ai/keys" 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="text-[10px] text-rose-400 hover:underline flex items-center gap-1"
                    >
                      <span>Obtenir une clé OpenRouter</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>

                  {/* API Key */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs text-slate-300">Clé d'API OpenRouter</label>
                      <div className="flex items-center gap-2">
                        {isSavedToServer && (
                          <span className="text-[10px] text-emerald-400 font-semibold animate-pulse">
                            💾 Sauvegardée sur le serveur !
                          </span>
                        )}
                        {serverKeyStatus.hasOpenRouterKey && (
                          <button
                            type="button"
                            onClick={() => deleteKeyFromServer('openrouter')}
                            className="text-[10px] text-red-400 hover:text-red-300 flex items-center gap-1"
                            title="Supprimer la clé enregistrée sur le serveur"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Supprimer</span>
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="relative">
                      <input
                        type="password"
                        value={llmConfig.apiKey}
                        onChange={(e) => {
                          const val = e.target.value;
                          onUpdateLLMConfig({ ...llmConfig, apiKey: val });
                          syncKeyToServer('openrouter', val);
                        }}
                        onBlur={(e) => syncKeyToServer('openrouter', e.target.value, true)}
                        placeholder={serverKeyStatus.hasOpenRouterKey ? '•••••••••••••••••••• (Enregistrée sur le serveur)' : 'sk-or-v1-...'}
                        className="w-full text-xs font-mono bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-rose-500"
                      />
                      {(llmConfig.apiKey || serverKeyStatus.hasOpenRouterKey) && (
                        <span className="absolute right-3 top-2.5 text-[10px] text-emerald-400 font-semibold">
                          {llmConfig.apiKey ? 'Clé saisie ✓' : '✓ Enregistrée sur le serveur'}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">
                      🔒 Stockée uniquement côté serveur dans <code className="text-slate-400 font-mono">data/keys.json</code> et jamais ré-exposée au navigateur.
                    </p>
                  </div>

                  <div className="p-3 rounded-2xl bg-gradient-to-r from-sky-950/40 to-slate-900 border border-sky-500/40 text-xs flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-sky-500/20 flex items-center justify-center text-sky-400 shrink-0">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="font-semibold text-sky-300 block">🟢 Connecté à OpenRouter en direct !</span>
                        <span className="text-[11px] text-slate-300">
                          {availableModels.length} modèles mondiaux synchronisés à l'instant T (Llama, DeepSeek, Claude, Gemini...).
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Models list with search & select */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-slate-300 font-medium">Modèle OpenRouter ({filteredModels.length} disponibles)</label>
                        {isLoadingModels && <Loader2 className="w-3 h-3 animate-spin text-rose-400" />}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => fetchLLMModels('openrouter', llmConfig.apiKey, '')}
                          disabled={isLoadingModels}
                          className="text-[10px] text-slate-400 hover:text-rose-400 flex items-center gap-1 transition"
                          title="Actualiser la liste des modèles"
                        >
                          <RefreshCw className={`w-3 h-3 ${isLoadingModels ? 'animate-spin' : ''}`} />
                          <span>Actualiser</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsManualInput(!isManualInput)}
                          className="text-[10px] text-slate-500 hover:text-slate-300 underline"
                        >
                          {isManualInput ? 'Mode liste' : 'Saisie manuelle'}
                        </button>
                      </div>
                    </div>

                    {!isManualInput ? (
                      <div className="space-y-1.5">
                        {/* Search Filter input */}
                        <div className="relative">
                          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                          <input
                            type="text"
                            value={modelSearchQuery}
                            onChange={(e) => setModelSearchQuery(e.target.value)}
                            placeholder="Filtrer parmi les 400+ modèles (ex: llama, deepseek, claude, mistral, vision)..."
                            className="w-full text-xs bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-2 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-rose-500"
                          />
                        </div>

                        {/* Select dropdown */}
                        <select
                          value={llmConfig.model}
                          onChange={(e) => onUpdateLLMConfig({ ...llmConfig, model: e.target.value })}
                          className="w-full text-xs bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-200 focus:outline-none focus:border-rose-500"
                        >
                          {filteredModels.map(m => (
                            <option key={m.id} value={m.id}>
                              {m.name} {m.tag ? `[${m.tag}]` : ''} {m.isVision ? '👁️' : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <input
                        type="text"
                        value={llmConfig.model}
                        onChange={(e) => onUpdateLLMConfig({ ...llmConfig, model: e.target.value })}
                        className="w-full text-xs font-mono bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-rose-500"
                        placeholder="meta-llama/llama-3.3-70b-instruct"
                      />
                    )}

                    {/* Quick popular chips */}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => onUpdateLLMConfig({ ...llmConfig, model: 'meta-llama/llama-3.3-70b-instruct' })}
                        className={`text-[10px] px-2.5 py-1 rounded-lg border transition ${
                          llmConfig.model === 'meta-llama/llama-3.3-70b-instruct'
                            ? 'bg-rose-500/20 border-rose-500/50 text-rose-300 font-semibold'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        ⭐ Llama 3.3 70B
                      </button>
                      <button
                        type="button"
                        onClick={() => onUpdateLLMConfig({ ...llmConfig, model: 'deepseek/deepseek-chat' })}
                        className={`text-[10px] px-2.5 py-1 rounded-lg border transition ${
                          llmConfig.model === 'deepseek/deepseek-chat'
                            ? 'bg-rose-500/20 border-rose-500/50 text-rose-300 font-semibold'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        DeepSeek V3
                      </button>
                      <button
                        type="button"
                        onClick={() => onUpdateLLMConfig({ ...llmConfig, model: 'meta-llama/llama-3.2-11b-vision-instruct' })}
                        className={`text-[10px] px-2.5 py-1 rounded-lg border transition ${
                          llmConfig.model === 'meta-llama/llama-3.2-11b-vision-instruct'
                            ? 'bg-rose-500/20 border-rose-500/50 text-rose-300 font-semibold'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        👁️ Llama 3.2 Vision
                      </button>
                      <button
                        type="button"
                        onClick={() => onUpdateLLMConfig({ ...llmConfig, model: 'anthropic/claude-3.5-sonnet' })}
                        className={`text-[10px] px-2.5 py-1 rounded-lg border transition ${
                          llmConfig.model === 'anthropic/claude-3.5-sonnet'
                            ? 'bg-rose-500/20 border-rose-500/50 text-rose-300 font-semibold'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        Claude 3.5 Sonnet
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* NANOGPT CONFIGURATION */}
              {llmConfig.provider === 'nanogpt' && (
                <div className="p-4 rounded-2xl bg-slate-900/80 border border-indigo-500/30 space-y-3.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-semibold text-white">
                      <Sparkles className="w-4 h-4 text-indigo-400" />
                      <span>Configuration NanoGPT (Abo 12$/mois • 299+ LLM & Vision)</span>
                    </div>
                    <a
                      href="https://nano-gpt.com/api"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-rose-400 hover:underline flex items-center gap-1"
                    >
                      <span>Obtenir une clé NanoGPT</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>

                  {/* Shared API Key */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs text-slate-300">Clé d'API NanoGPT (Unique pour LLM + Images)</label>
                      <div className="flex items-center gap-2">
                        {isSavedToServer && (
                          <span className="text-[10px] text-emerald-400 font-semibold animate-pulse">
                            💾 Sauvegardée sur le serveur !
                          </span>
                        )}
                        {serverKeyStatus.hasNanoGptKey && (
                          <button
                            type="button"
                            onClick={() => deleteKeyFromServer('nanogpt')}
                            className="text-[10px] text-red-400 hover:text-red-300 flex items-center gap-1"
                            title="Supprimer la clé enregistrée sur le serveur"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Supprimer</span>
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="relative">
                      <input
                        type="password"
                        value={llmConfig.apiKey || selfieConfig.nanoGptApiKey || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          onUpdateLLMConfig({ ...llmConfig, apiKey: val });
                          onUpdateSelfieConfig({ ...selfieConfig, nanoGptApiKey: val });
                          syncKeyToServer('nanogpt', val);
                        }}
                        onBlur={(e) => syncKeyToServer('nanogpt', e.target.value, true)}
                        placeholder={serverKeyStatus.hasNanoGptKey ? '•••••••••••••••••••• (Enregistrée sur le serveur)' : 'Votre clé API NanoGPT...'}
                        className="w-full text-xs font-mono bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
                      />
                      {(llmConfig.apiKey || selfieConfig.nanoGptApiKey || serverKeyStatus.hasNanoGptKey) && (
                        <span className="absolute right-3 top-2.5 text-[10px] text-emerald-400 font-semibold">
                          {(llmConfig.apiKey || selfieConfig.nanoGptApiKey) ? 'Clé partagée ✓' : '✓ Enregistrée sur le serveur'}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-indigo-300/90 mt-1">
                      🔗 Saisie ici, cette clé est stockée uniquement côté serveur (<code className="text-slate-400 font-mono">data/keys.json</code>) et activée pour le <strong>Chat/Vision</strong> ET la <strong>Génération d'Images (100/jour incluses)</strong>.
                    </p>
                  </div>

                  {/* Live Catalog & One-Click Activate Images */}
                  <div className="p-3 rounded-2xl bg-gradient-to-r from-indigo-950/50 to-slate-900 border border-indigo-500/40 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="font-semibold text-indigo-300 block">
                          🟢 Catalogue NanoGPT synchronisé ({nanoSubscriptionCount || '300+'} inclus Abo 12$)
                        </span>
                        <span className="text-[11px] text-slate-300">
                          {availableModels.length} modèles disponibles • Badges 👁️ Vision, 🛠️ Outils, 🧠 Raisonnement.
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const sharedKey = llmConfig.apiKey || selfieConfig.nanoGptApiKey || '';
                        const curImg = selfieConfig.imageModel || '';
                        const nextImgModel = (!curImg || curImg === 'flux' || curImg.startsWith('gemini-') || curImg.includes('/'))
                          ? 'qwen-image'
                          : curImg;
                        onUpdateSelfieConfig({
                          ...selfieConfig,
                          provider: selfieConfig.provider === 'nanogpt' ? 'pollinations' : 'nanogpt',
                          nanoGptApiKey: sharedKey,
                          imageModel: selfieConfig.provider === 'nanogpt' ? 'flux' : nextImgModel,
                        });
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition shrink-0 ${
                        selfieConfig.provider === 'nanogpt'
                          ? 'bg-indigo-500 text-white shadow-sm shadow-indigo-500/30'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {selfieConfig.provider === 'nanogpt' ? 'NanoGPT Images Actif ✓' : 'Activer aussi pour Images'}
                    </button>
                  </div>

                  {/* Subscription Filter & Refresh & Search */}
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-slate-300 font-medium">
                          Modèle NanoGPT ({filteredModels.length} affichés)
                        </label>
                        {isLoadingModels && <Loader2 className="w-3 h-3 animate-spin text-indigo-400" />}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setNanoGptSubscriptionOnly(!nanoGptSubscriptionOnly)}
                          className={`text-[10px] px-2.5 py-1 rounded-lg border font-semibold transition ${
                            nanoGptSubscriptionOnly
                              ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300'
                              : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          {nanoGptSubscriptionOnly ? '💎 Abo 12$ uniquement' : '🌐 Tous les modèles'}
                        </button>
                        <button
                          type="button"
                          onClick={() => fetchLLMModels('nanogpt', llmConfig.apiKey || selfieConfig.nanoGptApiKey || '', '')}
                          disabled={isLoadingModels}
                          className="text-[10px] text-slate-400 hover:text-indigo-400 flex items-center gap-1 transition"
                        >
                          <RefreshCw className={`w-3 h-3 ${isLoadingModels ? 'animate-spin' : ''}`} />
                          <span>Actualiser</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsManualInput(!isManualInput)}
                          className="text-[10px] text-slate-500 hover:text-slate-300 underline"
                        >
                          {isManualInput ? 'Mode liste' : 'Saisie manuelle'}
                        </button>
                      </div>
                    </div>

                    {modelsError && (
                      <div className="p-2.5 rounded-xl bg-red-950/30 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{modelsError}</span>
                      </div>
                    )}

                    {!isManualInput ? (
                      <div className="space-y-1.5">
                        <div className="relative">
                          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                          <input
                            type="text"
                            value={modelSearchQuery}
                            onChange={(e) => setModelSearchQuery(e.target.value)}
                            placeholder="Filtrer les modèles NanoGPT (ex: vision, outils, qwen, deepseek, llama, glm)..."
                            className="w-full text-xs bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-2 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
                          />
                        </div>

                        <select
                          value={llmConfig.model}
                          onChange={(e) => onUpdateLLMConfig({ ...llmConfig, model: e.target.value })}
                          className="w-full text-xs bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-200 focus:outline-none focus:border-indigo-500"
                        >
                          {filteredModels.map(m => (
                            <option key={m.id} value={m.id}>
                              {m.name} {m.tag ? `— [${m.tag}]` : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <input
                        type="text"
                        value={llmConfig.model}
                        onChange={(e) => onUpdateLLMConfig({ ...llmConfig, model: e.target.value })}
                        className="w-full text-xs font-mono bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
                        placeholder="z-ai/glm-5.3-flash"
                      />
                    )}

                    {/* Quick subscription picks */}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {[
                        { id: 'z-ai/glm-5.3-flash', label: '👁️🛠️ GLM 5.3 Flash' },
                        { id: 'prism-ml/ternary-bonsai-2-27b', label: '👁️🛠️ Ternary Bonsai 2 27B' },
                        { id: 'meta/muse-spark-1.3-contributor', label: '👁️🛠️ Muse Spark 1.3' },
                        { id: 'qwen/qwen3.8-27b-cybersecurity', label: '👁️🛠️ Qwen 3.8 27B' },
                      ].map(chip => (
                        <button
                          key={chip.id}
                          type="button"
                          onClick={() => onUpdateLLMConfig({ ...llmConfig, model: chip.id })}
                          className={`text-[10px] px-2.5 py-1 rounded-lg border transition ${
                            llmConfig.model === chip.id
                              ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300 font-semibold'
                              : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          {chip.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* LOCAL LLM CONFIGURATION */}
              {llmConfig.provider === 'local' && (
                <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-semibold text-white">
                      <Server className="w-4 h-4 text-purple-400" />
                      <span>Configuration Ollama / LM Studio (Localhost)</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => fetchLLMModels('local', '', llmConfig.localEndpoint)}
                      disabled={isLoadingModels}
                      className="text-[10px] text-purple-400 hover:text-purple-300 flex items-center gap-1"
                    >
                      <RefreshCw className={`w-3 h-3 ${isLoadingModels ? 'animate-spin' : ''}`} />
                      <span>Détecter modèles locaux</span>
                    </button>
                  </div>
                  
                  <div>
                    <label className="block text-xs text-slate-300 mb-1">URL Endpoint OpenAI-Compatible</label>
                    <input
                      type="text"
                      value={llmConfig.localEndpoint}
                      onChange={(e) => onUpdateLLMConfig({ ...llmConfig, localEndpoint: e.target.value })}
                      className="w-full text-xs font-mono bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-rose-500"
                      placeholder="http://localhost:11434/v1"
                    />
                    <div className="flex gap-2 mt-1.5">
                      <button
                        type="button"
                        onClick={() => onUpdateLLMConfig({ ...llmConfig, localEndpoint: 'http://localhost:11434/v1', model: 'llama3.2-vision' })}
                        className="text-[10px] px-2 py-0.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
                      >
                        Ollama Port 11434
                      </button>
                      <button
                        type="button"
                        onClick={() => onUpdateLLMConfig({ ...llmConfig, localEndpoint: 'http://localhost:1234/v1', model: 'local-model' })}
                        className="text-[10px] px-2 py-0.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
                      >
                        LM Studio Port 1234
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-slate-300 mb-1">Modèle local sélectionné</label>
                    <select
                      value={llmConfig.model}
                      onChange={(e) => onUpdateLLMConfig({ ...llmConfig, model: e.target.value })}
                      className="w-full text-xs bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-200 focus:outline-none focus:border-rose-500 mb-1.5"
                    >
                      {availableModels.map(m => (
                        <option key={m.id} value={m.id}>{m.name} {m.isVision ? '👁️' : ''}</option>
                      ))}
                    </select>
                    <span className="text-[10px] text-purple-400 mt-1 block">
                      💡 Pour la vision locale, exécutez dans votre terminal : <code>ollama run llama3.2-vision</code>
                    </span>
                  </div>
                </div>
              )}

              {/* Temperature & Injection Mode */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs text-slate-300">Température créative</label>
                    <span className="text-xs font-mono text-rose-400">{llmConfig.temperature}</span>
                  </div>
                  <input
                    type="range"
                    min={0.3}
                    max={1.2}
                    step={0.05}
                    value={llmConfig.temperature}
                    onChange={(e) => onUpdateLLMConfig({ ...llmConfig, temperature: parseFloat(e.target.value) })}
                    className="w-full accent-rose-500 cursor-pointer"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-300 mb-1">Format injection mémoire</label>
                  <select
                    value={llmConfig.memoryInjectionMode}
                    onChange={(e) => onUpdateLLMConfig({ ...llmConfig, memoryInjectionMode: e.target.value as any })}
                    className="w-full text-xs bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-rose-500"
                  >
                    <option value="compact_json">JSON Ultra-compact (Optimisé Tokens)</option>
                    <option value="bullet_points">Liste à puces sobre</option>
                    <option value="minimal">Minimaliste</option>
                  </select>
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: IMAGE GENERATOR (Pollinations / Gemini / OpenRouter / ComfyUI) */}
          {activeSubTab === 'image' && (
            <div className="space-y-5">
              {isPortraitRedirect && (
                <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-950/50 via-rose-950/30 to-slate-900 border border-amber-500/40 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
                    <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>Gemini (.env) indisponible — Configurez OpenRouter ou NanoGPT pour générer le portrait</span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    Tous les critères saisis pour <strong>{girlfriend.name}</strong> sont conservés intacts ! Entrez votre clé API OpenRouter ou NanoGPT et sélectionnez un modèle image ci-dessous, puis cliquez sur <strong>« Enregistrer & Générer le portrait → »</strong> (ou passez au repli Flux AI).
                  </p>
                </div>
              )}

              <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
                <label className="block text-xs font-semibold text-white mb-2">
                  Fournisseur de génération des selfies & portraits
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {[
                    { id: 'pollinations', name: 'Flux AI Photoreal (Par défaut)', desc: '100% Gratuit, haute fidélité humaine et sans limite' },
                    { id: 'gemini', name: 'Google Gemini Image', desc: 'Génération native gemini-3.1-flash-lite-image via la clé .env' },
                    { id: 'nanogpt', name: 'NanoGPT Image (Abo 12$)', desc: '100 img/jour incluses : Qwen Image, Z Image Turbo, HiDream, Chroma' },
                    { id: 'openrouter', name: 'OpenRouter Image', desc: 'Génération via modèles multimodaux ou Flux avec votre clé OpenRouter' },
                    { id: 'comfyui', name: 'ComfyUI Local', desc: 'Votre pipeline LoRA / IP-Adapter personnel sur GPU local (Port 8188)' },
                  ].map(item => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        const newProv = item.id as SelfieConfig['provider'];
                        let nextModel = selfieConfig.imageModel;
                        let nextNanoKey = selfieConfig.nanoGptApiKey;
                        if (newProv === 'openrouter') {
                          if (!nextModel || !nextModel.includes('/') || nextModel.startsWith('openrouter/auto')) {
                            nextModel = availableImageModels[0]?.id || 'google/gemini-2.5-flash-image';
                          }
                        } else if (newProv === 'nanogpt') {
                          if (!nextModel || nextModel === 'flux' || nextModel.startsWith('gemini-') || nextModel.includes('/')) {
                            nextModel = 'qwen-image';
                          }
                          if (!nextNanoKey && llmConfig.provider === 'nanogpt' && llmConfig.apiKey) {
                            nextNanoKey = llmConfig.apiKey;
                          }
                        } else if (newProv === 'pollinations') {
                          nextModel = 'flux';
                        } else if (newProv === 'gemini') {
                          nextModel = 'gemini-3.1-flash-lite-image';
                        }
                        onUpdateSelfieConfig({
                          ...selfieConfig,
                          provider: newProv,
                          imageModel: nextModel,
                          ...(nextNanoKey !== undefined ? { nanoGptApiKey: nextNanoKey } : {}),
                        });
                      }}
                      className={`p-3 rounded-xl border text-left transition ${
                        selfieConfig.provider === item.id
                          ? 'border-rose-500/80 bg-rose-500/15 text-rose-200 shadow-sm'
                          : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="text-xs font-semibold text-white flex items-center justify-between">
                        <span>{item.name}</span>
                        {selfieConfig.provider === item.id && <Check className="w-3.5 h-3.5 text-rose-400" />}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1 leading-snug">{item.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {selfieConfig.provider === 'pollinations' && (
                <div className="p-4 rounded-2xl bg-purple-950/20 border border-purple-500/30 text-xs text-slate-300 space-y-1.5">
                  <span className="font-semibold text-purple-400 block">✨ Moteur Flux AI Photoreal Actif</span>
                  <p className="text-[11px] leading-relaxed">
                    Ce mode génère chaque photo à la volée avec le modèle de pointe Flux AI. Les traits physiques de <strong>{girlfriend.name}</strong>, sa morphologie, ses cheveux et son style de tenue sont scrupuleusement injectés dans chaque requête.
                  </p>
                </div>
              )}

              {selfieConfig.provider === 'gemini' && (
                <div className="p-4 rounded-2xl bg-rose-950/20 border border-rose-500/30 text-xs text-slate-300 space-y-1.5">
                  <span className="font-semibold text-rose-400 block">✨ Google Gemini Imagen 3 Actif</span>
                  <p className="text-[11px] leading-relaxed">
                    Les selfies et portraits sont générés par le modèle Imagen 3 de Google via le serveur proxy et la clé API configurée dans votre fichier .env.
                  </p>
                </div>
              )}

              {selfieConfig.provider === 'nanogpt' && (
                <div className="p-4 rounded-2xl bg-indigo-950/25 border border-indigo-500/35 space-y-3.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold text-indigo-300 block">
                        💎 Modèles Images NanoGPT (Abo 12$/mois • 100/jour incluses)
                      </span>
                      <span className="text-[10px] text-slate-400">
                        4 modèles inclus dans l'abonnement + catalogue complet ({availableImageModels.length} modèles)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => fetchImageModels('nanogpt', selfieConfig.nanoGptApiKey || (llmConfig.provider === 'nanogpt' ? llmConfig.apiKey : ''))}
                      disabled={isLoadingImageModels}
                      className="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                    >
                      <RefreshCw className={`w-3 h-3 ${isLoadingImageModels ? 'animate-spin' : ''}`} />
                      <span>Actualiser</span>
                    </button>
                  </div>

                  {/* Shared NanoGPT API key input */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs text-slate-300">Clé API NanoGPT (Partagée avec le Moteur LLM)</label>
                      {serverKeyStatus.hasNanoGptKey && (
                        <button
                          type="button"
                          onClick={() => deleteKeyFromServer('nanogpt')}
                          className="text-[10px] text-red-400 hover:text-red-300 flex items-center gap-1"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Supprimer</span>
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <input
                        type="password"
                        value={selfieConfig.nanoGptApiKey || (llmConfig.provider === 'nanogpt' ? llmConfig.apiKey : '')}
                        onChange={(e) => {
                          const val = e.target.value;
                          onUpdateSelfieConfig({ ...selfieConfig, nanoGptApiKey: val });
                          if (llmConfig.provider === 'nanogpt') {
                            onUpdateLLMConfig({ ...llmConfig, apiKey: val });
                          }
                          syncKeyToServer('nanogpt', val);
                        }}
                        onBlur={(e) => syncKeyToServer('nanogpt', e.target.value, true)}
                        placeholder={serverKeyStatus.hasNanoGptKey ? '•••••••••••••••••••• (Enregistrée sur le serveur)' : 'Clé API NanoGPT (identique au chat texte)...'}
                        className="w-full text-xs font-mono bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
                      />
                      {!(selfieConfig.nanoGptApiKey || (llmConfig.provider === 'nanogpt' ? llmConfig.apiKey : '')) && serverKeyStatus.hasNanoGptKey && (
                        <span className="absolute right-3 top-2.5 text-[10px] text-emerald-400 font-semibold">
                          ✓ Enregistrée sur le serveur
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-indigo-300/85 mt-1">
                      🔗 Clé unique partagée entre LLM & Images, stockée uniquement côté serveur (<code className="text-slate-400 font-mono">data/keys.json</code>).
                    </p>
                  </div>

                  {/* Quick cards for the 4 subscription-included image models */}
                  <div>
                    <label className="block text-xs text-slate-300 mb-1.5 font-medium">
                      Modèles inclus dans votre abonnement 12$/mois (100 images/jour) :
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: 'qwen-image', title: 'Qwen Image', badge: '📸 Face Persistante' },
                        { id: 'z-image-turbo', title: 'Z Image Turbo', badge: '⚡ Ultra-Rapide' },
                        { id: 'hidream', title: 'HiDream', badge: '🎨 Haute Fidélité' },
                        { id: 'chroma', title: 'Chroma', badge: '🔓 Artistique' },
                      ].map(m => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => onUpdateSelfieConfig({ ...selfieConfig, imageModel: m.id })}
                          className={`p-2.5 rounded-xl border text-left transition ${
                            selfieConfig.imageModel === m.id
                              ? 'border-indigo-400 bg-indigo-500/20 text-white shadow-sm'
                              : 'border-slate-800 bg-slate-950/70 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                          }`}
                        >
                          <div className="flex items-center justify-between text-xs font-semibold">
                            <span>{m.title}</span>
                            {selfieConfig.imageModel === m.id && <Check className="w-3.5 h-3.5 text-indigo-400" />}
                          </div>
                          <div className="text-[10px] text-indigo-300 mt-0.5">{m.badge} • 💎 Inclus</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Full live dropdown + manual slug */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs text-slate-300">Catalogue complet NanoGPT Images</label>
                      <span className="text-[10px] text-emerald-400 font-medium">📸 Modèles Img2Img en tête</span>
                    </div>
                    {availableImageModels.length > 0 && (
                      <select
                        value={availableImageModels.some(m => m.id === selfieConfig.imageModel) ? selfieConfig.imageModel : 'custom'}
                        onChange={(e) => {
                          if (e.target.value !== 'custom') {
                            onUpdateSelfieConfig({ ...selfieConfig, imageModel: e.target.value });
                          }
                        }}
                        className="w-full text-xs bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-200 focus:outline-none focus:border-indigo-500 mb-1.5"
                      >
                        <optgroup label="💎 Inclus Abonnement 12$ (100/jour)">
                          {availableImageModels.filter(m => m.isSubscriptionIncluded).map(m => (
                            <option key={m.id} value={m.id}>
                              {m.name} ({m.id}) {m.tag ? `— ${m.tag}` : ''}
                            </option>
                          ))}
                        </optgroup>
                        {availableImageModels.filter(m => !m.isSubscriptionIncluded).length > 0 && (
                          <optgroup label="🖼️ Autres modèles NanoGPT (Pay-per-image)">
                            {availableImageModels.filter(m => !m.isSubscriptionIncluded).map(m => (
                              <option key={m.id} value={m.id}>
                                {m.name} ({m.id}) {m.supportsFaceReference ? '📸' : ''}
                              </option>
                            ))}
                          </optgroup>
                        )}
                        <option value="custom">✏️ Saisir manuellement un autre ID NanoGPT...</option>
                      </select>
                    )}

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-500 font-mono">ID actif :</span>
                      <input
                        type="text"
                        value={selfieConfig.imageModel || 'qwen-image'}
                        onChange={(e) => onUpdateSelfieConfig({ ...selfieConfig, imageModel: e.target.value })}
                        placeholder="qwen-image"
                        className="flex-1 text-[11px] font-mono bg-slate-900/80 border border-slate-800 rounded-lg px-2.5 py-1 text-indigo-300 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {selfieConfig.provider === 'openrouter' && (
                <div className="p-4 rounded-2xl bg-sky-950/20 border border-sky-500/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold text-sky-400 block">✨ Modèles Images OpenRouter (Génération Pure)</span>
                      <span className="text-[10px] text-slate-400">
                        {availableImageModels.length} modèles réels filtrés (Google Gemini Image, GPT-5 Image, Flux...)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => fetchImageModels('openrouter', selfieConfig.openRouterApiKey || (llmConfig.provider === 'openrouter' ? llmConfig.apiKey : ''))}
                      disabled={isLoadingImageModels}
                      className="text-[10px] text-sky-400 hover:text-sky-300 flex items-center gap-1"
                    >
                      <RefreshCw className={`w-3 h-3 ${isLoadingImageModels ? 'animate-spin' : ''}`} />
                      <span>Actualiser</span>
                    </button>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs text-slate-300">Clé API OpenRouter pour images</label>
                      {serverKeyStatus.hasOpenRouterKey && (
                        <button
                          type="button"
                          onClick={() => deleteKeyFromServer('openrouter')}
                          className="text-[10px] text-red-400 hover:text-red-300 flex items-center gap-1"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Supprimer</span>
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <input
                        type="password"
                        value={selfieConfig.openRouterApiKey || (llmConfig.provider === 'openrouter' ? llmConfig.apiKey : '')}
                        onChange={(e) => {
                          const val = e.target.value;
                          onUpdateSelfieConfig({ ...selfieConfig, openRouterApiKey: val });
                          syncKeyToServer('openrouter', val);
                        }}
                        onBlur={(e) => syncKeyToServer('openrouter', e.target.value, true)}
                        placeholder={serverKeyStatus.hasOpenRouterKey ? '•••••••••••••••••••• (Enregistrée sur le serveur)' : 'sk-or-v1-... (clé OpenRouter)'}
                        className="w-full text-xs font-mono bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-rose-500"
                      />
                      {!(selfieConfig.openRouterApiKey || (llmConfig.provider === 'openrouter' ? llmConfig.apiKey : '')) && serverKeyStatus.hasOpenRouterKey && (
                        <span className="absolute right-3 top-2.5 text-[10px] text-emerald-400 font-semibold">
                          ✓ Enregistrée sur le serveur
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">
                      🔒 Stockée uniquement côté serveur dans <code className="text-slate-400 font-mono">data/keys.json</code>.
                    </p>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs text-slate-300">Modèle d'image OpenRouter</label>
                      <span className="text-[10px] text-emerald-400 font-medium">📸 Modèles avec Face Persistante en tête</span>
                    </div>
                    {availableImageModels.length > 0 ? (
                      <div className="space-y-1.5">
                        <select
                          value={availableImageModels.some(m => m.id === selfieConfig.imageModel) ? selfieConfig.imageModel : 'custom'}
                          onChange={(e) => {
                            if (e.target.value !== 'custom') {
                              onUpdateSelfieConfig({ ...selfieConfig, imageModel: e.target.value });
                            }
                          }}
                          className="w-full text-xs bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-200 focus:outline-none focus:border-rose-500"
                        >
                          <optgroup label="📸 Modèles avec Face Persistante (Img2Img)">
                            {availableImageModels.filter(m => m.supportsFaceReference).map(m => (
                              <option key={m.id} value={m.id}>
                                {m.name} — {m.id}
                              </option>
                            ))}
                          </optgroup>
                          {availableImageModels.filter(m => !m.supportsFaceReference).length > 0 && (
                            <optgroup label="🖼️ Modèles Texte -> Image (Sans référence portrait)">
                              {availableImageModels.filter(m => !m.supportsFaceReference).map(m => (
                                <option key={m.id} value={m.id}>
                                  {m.name} — {m.id}
                                </option>
                              ))}
                            </optgroup>
                          )}
                          <option value="custom">✏️ Saisir manuellement un autre identifiant OpenRouter...</option>
                        </select>

                        {/* Always show or allow editing exact model slug */}
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-500 font-mono">ID actif :</span>
                          <input
                            type="text"
                            value={selfieConfig.imageModel || ''}
                            onChange={(e) => onUpdateSelfieConfig({ ...selfieConfig, imageModel: e.target.value })}
                            placeholder="google/gemini-2.5-flash-image"
                            className="flex-1 text-[11px] font-mono bg-slate-900/80 border border-slate-800 rounded-lg px-2.5 py-1 text-sky-300 focus:outline-none focus:border-sky-500"
                          />
                        </div>
                      </div>
                    ) : (
                      <input
                        type="text"
                        value={(selfieConfig.imageModel && selfieConfig.imageModel.includes('/')) ? selfieConfig.imageModel : 'google/gemini-2.5-flash-image'}
                        onChange={(e) => onUpdateSelfieConfig({ ...selfieConfig, imageModel: e.target.value })}
                        placeholder="google/gemini-2.5-flash-image"
                        className="w-full text-xs font-mono bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-rose-500"
                      />
                    )}
                  </div>
                </div>
              )}

              {selfieConfig.provider === 'comfyui' && (
                <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
                  <label className="block text-xs font-semibold text-white">URL Endpoint ComfyUI</label>
                  <input
                    type="text"
                    value={selfieConfig.comfyEndpoint}
                    onChange={(e) => onUpdateSelfieConfig({ ...selfieConfig, comfyEndpoint: e.target.value })}
                    className="w-full text-xs font-mono bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-rose-500"
                    placeholder="http://localhost:8188"
                  />
                  <p className="text-[11px] text-slate-400">
                    Aura AI transmet le prompt verrouillé du visage et la tenue au workflow standard de ton instance ComfyUI.
                  </p>
                </div>
              )}

              {/* Aspect ratio selector */}
              <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800">
                <label className="block text-xs font-semibold text-slate-300 mb-2">Format des Selfies</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: '3:4', label: 'Portrait 3:4 (Recommandé)', desc: 'Buste & épaules équilibré' },
                    { id: '9:16', label: 'Smartphone 9:16', desc: 'Plein écran story' },
                    { id: '1:1', label: 'Carré 1:1', desc: 'Format profil' },
                  ].map(ar => (
                    <button
                      key={ar.id}
                      type="button"
                      onClick={() => onUpdateSelfieConfig({ ...selfieConfig, aspectRatio: ar.id as any })}
                      className={`p-2.5 rounded-xl border text-center transition ${
                        selfieConfig.aspectRatio === ar.id
                          ? 'border-rose-500 bg-rose-500/20 text-white font-semibold'
                          : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-white'
                      }`}
                    >
                      <span className="text-xs block">{ar.label}</span>
                      <span className="text-[10px] text-slate-500">{ar.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: VOICE & TTS (Local GPU / Cloud) */}
          {activeSubTab === 'voice' && (
            <div className="space-y-5">
              
              {/* Provider Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">Moteur de Synthèse Vocale (TTS)</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => onUpdateVoiceConfig({ ...voiceConfig, provider: 'webspeech' })}
                    className={`p-3.5 rounded-2xl border text-left transition ${
                      voiceConfig.provider === 'webspeech'
                        ? 'border-rose-500/80 bg-rose-500/15 text-rose-200'
                        : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white">Web Speech API (Intégrée)</span>
                      <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">Gratuit 100%</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Zéro token, zéro clé. Utilise le moteur neural haute fidélité de votre système (iOS/Android/macOS/Windows).
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => onUpdateVoiceConfig({ ...voiceConfig, provider: 'local_gpu' })}
                    className={`p-3.5 rounded-2xl border text-left transition ${
                      voiceConfig.provider === 'local_gpu'
                        ? 'border-rose-500/80 bg-rose-500/15 text-rose-200'
                        : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white">TTS Local GPU (XTTS / Piper)</span>
                      <span className="text-[10px] text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-500/20">Local GPU</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Connexion à votre serveur XTTS-v2, Piper ou AllTalk tournant sur votre carte graphique en local.
                    </p>
                  </button>
                </div>
              </div>

              {/* LOCAL GPU TTS CONFIGURATION */}
              {voiceConfig.provider === 'local_gpu' && (
                <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-white">
                    <Volume2 className="w-4 h-4 text-purple-400" />
                    <span>Configuration Endpoint Local GPU</span>
                  </div>

                  <div>
                    <label className="block text-xs text-slate-300 mb-1">URL Endpoint Audio Speech</label>
                    <input
                      type="text"
                      value={voiceConfig.localGpuEndpoint}
                      onChange={(e) => onUpdateVoiceConfig({ ...voiceConfig, localGpuEndpoint: e.target.value })}
                      className="w-full text-xs font-mono bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-rose-500"
                      placeholder="http://localhost:8020/v1/audio/speech"
                    />
                    <div className="flex gap-2 mt-1.5">
                      <button
                        type="button"
                        onClick={() => onUpdateVoiceConfig({ ...voiceConfig, localGpuEndpoint: 'http://localhost:8020/v1/audio/speech' })}
                        className="text-[10px] px-2 py-0.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
                      >
                        XTTS-v2 Server (8020)
                      </button>
                      <button
                        type="button"
                        onClick={() => onUpdateVoiceConfig({ ...voiceConfig, localGpuEndpoint: 'http://localhost:7851/v1/audio/speech' })}
                        className="text-[10px] px-2 py-0.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
                      >
                        AllTalk TTS (7851)
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Pitch & Speed */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl bg-slate-900/40 border border-slate-800">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs text-slate-300">Vitesse d'élocution</label>
                    <span className="text-xs font-mono text-rose-400">{voiceConfig.rate}x</span>
                  </div>
                  <input
                    type="range"
                    min={0.7}
                    max={1.4}
                    step={0.05}
                    value={voiceConfig.rate}
                    onChange={(e) => onUpdateVoiceConfig({ ...voiceConfig, rate: parseFloat(e.target.value) })}
                    className="w-full accent-rose-500 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs text-slate-300">Tonalité / Hauteur (Pitch)</label>
                    <span className="text-xs font-mono text-rose-400">{voiceConfig.pitch}</span>
                  </div>
                  <input
                    type="range"
                    min={0.8}
                    max={1.3}
                    step={0.05}
                    value={voiceConfig.pitch}
                    onChange={(e) => onUpdateVoiceConfig({ ...voiceConfig, pitch: parseFloat(e.target.value) })}
                    className="w-full accent-rose-500 cursor-pointer"
                  />
                </div>
              </div>

              {/* Test Button */}
              <div className="flex items-center justify-between p-4 rounded-2xl bg-gradient-to-r from-rose-950/20 to-pink-950/20 border border-rose-500/20">
                <div>
                  <span className="text-xs font-semibold text-white block">Tester la voix de {girlfriend.name}</span>
                  <span className="text-[11px] text-slate-400">Écouter un échantillon audio avec les paramètres actuels</span>
                </div>
                <button
                  type="button"
                  disabled={isTestingVoice}
                  onClick={handleTestVoiceAudio}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-xs font-semibold text-white flex items-center gap-2 transition active:scale-95 disabled:opacity-50"
                >
                  <Play className="w-3.5 h-3.5 fill-white" />
                  <span>{isTestingVoice ? 'Lecture en cours...' : 'Écouter'}</span>
                </button>
              </div>

            </div>
          )}

          {/* TAB 4: REAL WORLD CONTEXT (Weather, News, Time) */}
          {activeSubTab === 'context' && (
            <div className="space-y-5">
              <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-white block">Ville pour la météo réelle</span>
                    <span className="text-[10px] text-slate-400">Synchronisé via Open-Meteo API en temps réel</span>
                  </div>
                  <span className="text-xs font-semibold text-rose-400 bg-rose-500/10 px-2.5 py-1 rounded-lg border border-rose-500/20">
                    {context.temperature}°C, {context.weatherCondition}
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5 pt-1">
                  {Object.keys(POPULAR_CITIES).map(cityName => (
                    <button
                      key={cityName}
                      type="button"
                      onClick={() => onUpdateCity(cityName)}
                      className={`text-xs px-3 py-1.5 rounded-xl border transition ${
                        context.city === cityName
                          ? 'border-rose-500 bg-rose-500/20 text-rose-200 font-medium'
                          : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {cityName}
                    </button>
                  ))}
                </div>
              </div>

              {/* Toggles */}
              <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
                <h3 className="text-xs font-semibold text-white">Injections contextuelles dans le prompt</h3>

                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <span className="text-xs text-slate-200 block">Injecter la météo en direct</span>
                    <span className="text-[10px] text-slate-500">Elle sait s'il pleut ou fait beau dehors</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={context.injectWeather}
                    onChange={(e) => onToggleContextOption('injectWeather', e.target.checked)}
                    className="rounded accent-rose-500 w-4 h-4"
                  />
                </label>

                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <span className="text-xs text-slate-200 block">Injecter l'heure et le moment de la journée</span>
                    <span className="text-[10px] text-slate-500">Distingue le réveil matinal, l'après-midi et la nuit</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={context.injectTime}
                    onChange={(e) => onToggleContextOption('injectTime', e.target.checked)}
                    className="rounded accent-rose-500 w-4 h-4"
                  />
                </label>

                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <span className="text-xs text-slate-200 block">Injecter des actualités culturelles réelles</span>
                    <span className="text-[10px] text-slate-500">Sujets de conversation naturels et ancrés dans le réel</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={context.injectNews}
                    onChange={(e) => onToggleContextOption('injectNews', e.target.checked)}
                    className="rounded accent-rose-500 w-4 h-4"
                  />
                </label>
              </div>
            </div>
          )}

          {/* TAB 5: DONNÉES & RESET */}
          {activeSubTab === 'data' && (
            <div className="space-y-5">
              <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
                <div className="flex items-center gap-2 text-rose-400 font-semibold text-xs">
                  <RotateCcw className="w-4 h-4" />
                  <span>Gestion des Données & Réinitialisation</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Aura AI stocke vos préférences, profils, mémoire légère et historique de discussion dans le stockage local de votre navigateur (LocalStorage), garantissant une confidentialité maximale.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Soft reset card */}
                <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800 space-y-2.5 flex flex-col justify-between">
                  <div>
                    <span className="text-xs font-semibold text-white block">Remise à zéro Soft</span>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Efface les messages, photos du chat et la mémoire relationnelle. <strong>Conserve scrupuleusement</strong> le profil et le portrait avatar de {girlfriend.name}.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      onClose();
                      onOpenReset?.();
                    }}
                    className="w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700 transition flex items-center justify-center gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
                    <span>Lancer la remise Soft</span>
                  </button>
                </div>

                {/* Hard reset card */}
                <div className="p-4 rounded-2xl bg-red-950/20 border border-red-900/30 space-y-2.5 flex flex-col justify-between">
                  <div>
                    <span className="text-xs font-semibold text-red-300 block">Remise à zéro d'usine (Hard)</span>
                    <p className="text-[11px] text-red-400/80 mt-1">
                      Action irréversible : efface l'intégralité du stockage local et réinitialise l'application à zéro.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      onClose();
                      onOpenReset?.();
                    }}
                    className="w-full py-2 px-3 rounded-xl bg-red-950/40 hover:bg-red-900/50 text-xs font-medium text-red-300 border border-red-800/50 transition flex items-center justify-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-400" />
                    <span>Options de suppression totale</span>
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-[#131622]/90 flex items-center justify-between gap-2 shrink-0">
          <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Moteur actuel : <strong className="text-white">{llmConfig.provider.toUpperCase()}</strong> ({llmConfig.model})</span>
          </div>
          {isPortraitRedirect ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onCancelPortraitRedirect || onClose}
                className="px-3.5 py-2 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-xs font-medium text-slate-300 hover:text-white transition"
              >
                Passer → Flux AI
              </button>
              <button
                type="button"
                onClick={onSaveAndRetryPortrait || onClose}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-xs font-semibold text-white transition shadow-sm shadow-rose-500/20"
              >
                Enregistrer & Générer le portrait →
              </button>
            </div>
          ) : (
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-xs font-semibold text-white transition shadow-sm shadow-rose-500/20"
            >
              Enregistrer & Fermer
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
