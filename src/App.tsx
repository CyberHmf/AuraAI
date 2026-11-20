/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  GirlfriendPersona, UserPersona, LightweightMemory, 
  RealWorldContext, LLMConfig, SelfieConfig, SelfieItem, ChatMessage, VoiceConfig, ChatMode 
} from './types';
import { 
  DEFAULT_USER, INITIAL_MEMORIES, INITIAL_SELFIES, createBlankCustomPersona, buildInitialMemory 
} from './data/presets';
import { fetchLiveContext } from './services/contextService';
import { 
  buildLightweightSystemPrompt, getSlidingWindowMessages, 
  calculateTokenOptimizationStats, analyzeAndExtractFacts 
} from './services/memoryService';
import { sendChatMessage } from './services/llmService';
import { generateSelfie } from './services/selfieService';
import { speakMessage, stopSpeaking } from './services/speechService';

import { TopBar } from './components/TopBar';
import { ChatView } from './components/ChatView';
import { BottomTabBar } from './components/BottomTabBar';
import { PersonaCustomizerModal } from './components/PersonaCustomizerModal';
import { SelfieGalleryModal } from './components/SelfieGalleryModal';
import { TokenMemoryModal } from './components/TokenMemoryModal';
import { DiaryModal } from './components/DiaryModal';
import { LLMSettingsModal } from './components/LLMSettingsModal';
import { ResetConfirmModal } from './components/ResetConfirmModal';
import { OfflineIndicator } from './components/OfflineIndicator';
import { OnboardingModal } from './components/OnboardingModal';
import { GirlfriendPortraitModal } from './components/GirlfriendPortraitModal';
import { CustomSelfieRequestModal } from './components/CustomSelfieRequestModal';
import { LogsModal } from './components/LogsModal';
import { AuthGate } from './components/AuthGate';
import { safeStorage } from './services/safeStorage';
import { logger } from './services/logger';

export default function App() {
  const [authState, setAuthState] = useState<{
    checking: boolean;
    authRequired: boolean;
    authenticated: boolean;
  }>({
    checking: true,
    authRequired: false,
    authenticated: false,
  });
  const [isStateHydrated, setIsStateHydrated] = useState(false);

  // 1. Core State with LocalStorage persistence
  const [girlfriend, setGirlfriend] = useState<GirlfriendPersona>(() => {
    const saved = localStorage.getItem('aura_girlfriend');
    return saved ? JSON.parse(saved) : createBlankCustomPersona();
  });

  const [user, setUser] = useState<UserPersona>(() => {
    const saved = localStorage.getItem('aura_user');
    return saved ? JSON.parse(saved) : DEFAULT_USER;
  });

  const [memory, setMemory] = useState<LightweightMemory>(() => {
    const saved = localStorage.getItem('aura_memory');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // fallback
      }
    }
    return buildInitialMemory(user);
  });

  const [selfies, setSelfies] = useState<SelfieItem[]>(() => {
    const saved = localStorage.getItem('aura_selfies');
    return saved ? JSON.parse(saved) : INITIAL_SELFIES;
  });

  const [llmConfig, setLlmConfig] = useState<LLMConfig>(() => {
    const saved = localStorage.getItem('aura_llm_config');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.provider === 'mock') {
          parsed.provider = 'gemini';
        }
        if (parsed.model === 'gemini-2.5-flash' || parsed.model === 'gemini-2.5-pro' || !parsed.model || parsed.model.includes('2.0') || parsed.model.includes('1.5')) {
          parsed.model = 'gemini-3.1-flash-lite';
        }
        parsed.apiKey = '';
        return parsed;
      } catch (e) {
        // fallback
      }
    }
    return {
      provider: 'gemini',
      apiKey: '',
      model: 'gemini-3.1-flash-lite',
      localEndpoint: 'http://localhost:11434/v1',
      maxContextMessages: 8,
      temperature: 0.85,
      memoryInjectionMode: 'compact_json',
    };
  });

  const [selfieConfig, setSelfieConfig] = useState<SelfieConfig>(() => {
    const saved = localStorage.getItem('aura_selfie_config');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.provider === 'gallery') {
          parsed.provider = 'pollinations';
        }
        parsed.openRouterApiKey = '';
        parsed.nanoGptApiKey = '';
        return parsed;
      } catch (e) {
        // fallback below
      }
    }
    return {
      provider: 'pollinations',
      comfyEndpoint: 'http://localhost:8188',
      openRouterApiKey: '',
      nanoGptApiKey: '',
      imageModel: 'flux',
      aspectRatio: '3:4',
      enablePhotoRequests: true,
    };
  });

  const [voiceConfig, setVoiceConfig] = useState<VoiceConfig>(() => {
    const saved = localStorage.getItem('aura_voice_config');
    return saved ? JSON.parse(saved) : {
      provider: 'webspeech',
      edgeVoice: 'fr-FR-VivienneMultilingualNeural',
      localGpuEndpoint: 'http://localhost:8020/v1/audio/speech',
      autoPlay: false,
      pitch: 1.05,
      rate: 0.95,
    };
  });

  // 2. Real-World Live Context (Weather, Time, News)
  const [context, setContext] = useState<RealWorldContext>({
    city: 'Paris',
    temperature: 19,
    weatherCondition: 'Ciel doux et dégagé',
    weatherCode: 1,
    isDay: true,
    currentTime: '14:30',
    timeOfDay: 'afternoon',
    recentNewsHeadlines: [
      'Une exposition de photographie d\'art contemporain fait sensation à Paris',
      'Le festival du film d\'auteur démarre ce week-end'
    ],
    injectWeather: true,
    injectNews: true,
    injectTime: true,
  });

  // 3. Conversation Messages
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const saved = localStorage.getItem('aura_chat_messages');
    if (saved) {
      try {
        const parsed: ChatMessage[] = JSON.parse(saved);
        const hasUserMsg = parsed.some(m => m.sender === 'user');
        if (!hasUserMsg) {
          // Si l'utilisateur n'a jamais envoyé de message, supprimer toutes les barres de séparation fantômes
          return parsed.filter(m => !m.isSystemDivider);
        }
        // Dédupliquer les séparateurs consécutifs
        const cleaned: ChatMessage[] = [];
        for (const msg of parsed) {
          if (msg.isSystemDivider && cleaned.length > 0 && cleaned[cleaned.length - 1].isSystemDivider) {
            cleaned[cleaned.length - 1] = msg;
          } else {
            cleaned.push(msg);
          }
        }
        return cleaned;
      } catch (e) {
        // fallback
      }
    }
    return [
      {
        id: 'msg-welcome',
        sender: 'girlfriend',
        text: girlfriend.initialGreeting || `*te sourit doucement en s'asseyant à côté de toi* Coucou mon cœur... Je suis tellement heureuse que tu sois là. Comment se passe ta journée ? Raconte-moi tout, et n'hésite pas à m'envoyer une photo si tu veux me montrer ce que tu fais ✨`,
        timestamp: 'À l\'instant',
      }
    ];
  });

  const [isTyping, setIsTyping] = useState(false);
  const [isGeneratingSelfie, setIsGeneratingSelfie] = useState(false);

  // 4. Chat Mode (SMS vs IRL)
  const [chatMode, setChatMode] = useState<ChatMode>(() => {
    const saved = localStorage.getItem('aura_chat_mode');
    return (saved === 'irl' || saved === 'message') ? saved : 'message';
  });

  const [isCustomizerOpen, setIsCustomizerOpen] = useState(false);
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [isMemoryOpen, setIsMemoryOpen] = useState(false);
  const [isDiaryOpen, setIsDiaryOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState<1 | 2>(1);
  const [isOnboardingPendingSettings, setIsOnboardingPendingSettings] = useState(false);
  const [isPortraitModalOpen, setIsPortraitModalOpen] = useState(false);
  const [isCustomSelfieModalOpen, setIsCustomSelfieModalOpen] = useState(false);
  const [isLogsOpen, setIsLogsOpen] = useState(false);
  const [settingsInitialSubTab, setSettingsInitialSubTab] = useState<'llm' | 'voice' | 'image' | 'context' | 'data'>('llm');
  const [isPortraitRedirect, setIsPortraitRedirect] = useState(false);
  const [retryPortraitTrigger, setRetryPortraitTrigger] = useState(0);
  const [retrySkipConfig, setRetrySkipConfig] = useState(false);
  const [mobileActiveView, setMobileActiveView] = useState<'chat' | 'gallery' | 'memory' | 'diary' | 'customizer'>('chat');

  // Handle Mode Switch between SMS and In Real Life
  const handleToggleChatMode = (newMode: ChatMode) => {
    if (newMode === chatMode) return;
    setChatMode(newMode);
    safeStorage.setItem('aura_chat_mode', newMode);

    setMessages(prev => {
      const hasUserMsg = prev.some(m => m.sender === 'user');

      // Si l'utilisateur n'a encore jamais tapé de message (juste le message d'accueil initial),
      // AUCUNE barre de séparation n'a lieu d'apparaître : le sélecteur d'en-tête suffit amplement !
      if (!hasUserMsg) {
        return prev.filter(m => !m.isSystemDivider);
      }

      // Si le dernier message était déjà un séparateur (l'utilisateur re-clique sans avoir écrit)
      const lastMsg = prev[prev.length - 1];
      if (lastMsg && lastMsg.isSystemDivider) {
        const nonDividers = prev.filter(m => !m.isSystemDivider);
        // Si l'utilisateur revient simplement au mode d'avant sans avoir rien écrit, on retire la barre
        const lastRealMsg = nonDividers[nonDividers.length - 1];
        if (lastRealMsg && lastRealMsg.chatMode === newMode) {
          return nonDividers;
        }
        // Sinon on remplace l'unique séparateur par le nouveau mode sans jamais les empiler
        const now = new Date();
        const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        return [
          ...nonDividers,
          {
            id: `divider-${Date.now()}`,
            sender: 'girlfriend',
            text: newMode === 'irl' ? '── ✨ Mode Présentiel (IRL) ──' : '── 💬 Mode Messages SMS ──',
            timestamp: timeStr,
            isSystemDivider: true,
            chatMode: newMode,
          }
        ];
      }

      // Une vraie conversation a eu lieu : on insère la barre de séparation pour marquer la transition
      const now = new Date();
      const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      const dividerMsg: ChatMessage = {
        id: `divider-${Date.now()}`,
        sender: 'girlfriend',
        text: newMode === 'irl' ? '── ✨ Mode Présentiel (IRL) ──' : '── 💬 Mode Messages SMS ──',
        timestamp: timeStr,
        isSystemDivider: true,
        chatMode: newMode,
      };
      return [...prev, dividerMsg];
    });
  };

  // Check optional server auth status on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/auth/status');
        if (res.ok) {
          const data = await res.json();
          setAuthState({
            checking: false,
            authRequired: Boolean(data.authRequired),
            authenticated: Boolean(data.authenticated),
          });
          return;
        }
      } catch {
        // fallback if auth endpoint unreachable
      }
      setAuthState({ checking: false, authRequired: false, authenticated: true });
    };
    checkAuth();
  }, []);

  // Check first launch, load server persistent state, and fetch backend config once authenticated
  useEffect(() => {
    if (authState.checking || !authState.authenticated) return;

    const isCompleted = localStorage.getItem('aura_onboarding_completed');
    if (!isCompleted) {
      setIsOnboardingOpen(true);
    }

    const hydrateStartup = async () => {
      let hasServerState = false;

      try {
        // 1. Charger l'état complet sauvegardé sur le serveur (data/app_state.json)
        try {
          const stateRes = await fetch('/api/state');
          if (stateRes.ok) {
            const data = await stateRes.json();
            if (data.exists && data.state) {
              hasServerState = true;
              const s = data.state;
              if (s.girlfriend) setGirlfriend(s.girlfriend);
              if (s.user) setUser(s.user);
              if (s.memory) setMemory(s.memory);
              if (s.selfies) setSelfies(s.selfies);
              if (s.messages) setMessages(s.messages);
              if (s.llmConfig) {
                setLlmConfig({ ...s.llmConfig, apiKey: '' });
              }
              if (s.selfieConfig) {
                setSelfieConfig({ ...s.selfieConfig, openRouterApiKey: '', nanoGptApiKey: '' });
              }
              if (s.voiceConfig) setVoiceConfig(s.voiceConfig);
              if (s.chatMode) setChatMode(s.chatMode);
            }
          }
        } catch (err) {
          console.warn('Erreur chargement état serveur:', err);
        }

        // 2. Config status (seulement si aucun état serveur/local n'existe)
        if (!hasServerState) {
          try {
            const cfgRes = await fetch('/api/config-status');
            if (cfgRes.ok) {
              const data = await cfgRes.json();
              if (data.hasGeminiKey) {
                if (!localStorage.getItem('aura_llm_config')) {
                  setLlmConfig(prev => ({ ...prev, provider: 'gemini' }));
                }
                if (!localStorage.getItem('aura_selfie_config')) {
                  setSelfieConfig(prev => ({ ...prev, provider: 'gemini' }));
                }
              }
            }
          } catch {
            // ignore
          }
        }

        // 3. Vérifier les booléens de clés persistées sur le serveur (aucune clé brute n'est exposée)
        try {
          const keysRes = await fetch('/api/keys');
          if (keysRes.ok) {
            const keys = await keysRes.json();
            if (keys.hasOpenRouterKey || keys.hasNanoGptKey) {
              setSelfieConfig(prev => {
                const isDefaultUnconfigured =
                  !hasServerState ||
                  ((prev.provider === 'pollinations' || prev.provider === 'gemini') && (!prev.imageModel || prev.imageModel === 'flux'));
                const nextProvider = isDefaultUnconfigured && keys.hasNanoGptKey
                  ? 'nanogpt'
                  : prev.provider;
                const nextImageModel = nextProvider === 'nanogpt' && (!prev.imageModel || prev.imageModel === 'flux' || prev.imageModel.includes('/') || prev.imageModel.startsWith('gemini-'))
                  ? 'qwen-image'
                  : prev.imageModel;
                return {
                  ...prev,
                  provider: nextProvider,
                  imageModel: nextImageModel,
                };
              });
            }
          }
        } catch {
          // ignore
        }
      } finally {
        setIsStateHydrated(true);
      }
    };

    hydrateStartup();
  }, [authState.checking, authState.authenticated]);

  // Sync automatique de l'état complet vers le serveur (data/app_state.json)
  // Conversion automatique des images base64 en fichiers physiques (/api/images/img_...)
  useEffect(() => {
    if (!authState.authenticated || !isStateHydrated) return;

    const timer = setTimeout(() => {
      const safeLlmConfig: LLMConfig = { ...llmConfig, apiKey: '' };
      const safeSelfieConfig: SelfieConfig = {
        ...selfieConfig,
        openRouterApiKey: '',
        nanoGptApiKey: '',
      };

      const fullState = {
        girlfriend,
        user,
        memory,
        selfies,
        messages,
        llmConfig: safeLlmConfig,
        selfieConfig: safeSelfieConfig,
        voiceConfig,
        chatMode,
      };

      fetch('/api/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: fullState }),
      })
        .then(r => r.json())
        .then(data => {
          if (data.success && data.state) {
            safeStorage.setItem('aura_girlfriend', JSON.stringify(data.state.girlfriend));
            safeStorage.setItem('aura_user', JSON.stringify(data.state.user));
            safeStorage.setItem('aura_memory', JSON.stringify(data.state.memory));
            safeStorage.setItem('aura_selfies', JSON.stringify(data.state.selfies));
            safeStorage.setItem('aura_chat_messages', JSON.stringify(data.state.messages));
            safeStorage.setItem('aura_llm_config', JSON.stringify(data.state.llmConfig));
            safeStorage.setItem('aura_selfie_config', JSON.stringify(data.state.selfieConfig));
            safeStorage.setItem('aura_voice_config', JSON.stringify(data.state.voiceConfig));
            safeStorage.setItem('aura_chat_mode', data.state.chatMode);
          }
        })
        .catch(err => console.warn('Erreur sync état serveur:', err));
    }, 600);

    return () => clearTimeout(timer);
  }, [authState.authenticated, isStateHydrated, girlfriend, user, memory, selfies, messages, llmConfig, selfieConfig, voiceConfig, chatMode]);

  // Remise à zéro SOFT :
  // Efface les messages, photos du chat, selfies et mémoire conversationnelle
  // SANS JAMAIS toucher ou écraser le profil de la compagne (portrait avatar original, nom, bio, garde-robe intacts)
  const handleSoftReset = async () => {
    logger.clear();
    try {
      await fetch('/api/reset-state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'soft' }),
      });
    } catch (e) {
      console.warn('Erreur reset soft serveur:', e);
    }

    const welcomeGreeting = girlfriend.initialGreeting || (girlfriend.speechStyle.tone === 'gothic'
      ? `*laisse ses doigts effleurer les tiens dans la pénombre* Te revoilà... J'ai fait silence autour de nous. Dis-moi ce qui hante ton esprit mon cœur.`
      : girlfriend.speechStyle.tone === 'rebel'
      ? `*relève la tête avec un sourire en coin* Tiens, regarde qui passe enfin la porte ! Prêt pour une nouvelle aventure ? Dis-moi tout 🎸`
      : girlfriend.speechStyle.tone === 'possessive'
      ? `*te serre immédiatement dans ses bras* Enfin avec moi ! Tu m'as tellement manqué... Promets-moi de ne penser qu'à nous maintenant 💕`
      : `*te sourit doucement en s'asseyant à côté de toi* Coucou ${user.nickname}... Je suis tellement heureuse que tu sois là. Comment se passe ta journée ? Raconte-moi tout ✨`);

    const freshMessages: ChatMessage[] = [
      {
        id: `msg-welcome-${Date.now()}`,
        sender: 'girlfriend',
        text: welcomeGreeting,
        timestamp: 'À l\'instant',
      }
    ];
    setMessages(freshMessages);
    safeStorage.setItem('aura_chat_messages', JSON.stringify(freshMessages));

    const freshMemory: LightweightMemory = buildInitialMemory(user);
    freshMemory.affectionScore = 35;
    freshMemory.currentMood = `Complice et heureuse de redémarrer sur de nouvelles bases avec toi`;
    setMemory(freshMemory);
    safeStorage.setItem('aura_memory', JSON.stringify(freshMemory));

    // Vide l'album de photos et selfies échangés (tout en gardant le portrait de base dans girlfriend.appearance.avatarUrl)
    setSelfies([]);
    safeStorage.setItem('aura_selfies', JSON.stringify([]));
  };

  // Remise à zéro COMPLÈTE & HARD :
  // Efface les messages, mémoire et personnalisations,
  // MAIS préserve et restaure scrupuleusement les clés API stockées sur le serveur (keys.json).
  const handleHardReset = async () => {
    logger.clear();
    try {
      await fetch('/api/reset-state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'hard' }),
      });
    } catch (e) {
      console.warn('Erreur reset hard serveur:', e);
    }

    // Vérifier les clés stockées sur le serveur (booléens uniquement) pour restaurer les fournisseurs actifs
    let storedKeys: { hasGroqKey?: boolean; hasOpenRouterKey?: boolean; hasGeminiKey?: boolean; hasNanoGptKey?: boolean } = {};
    try {
      const res = await fetch('/api/keys');
      if (res.ok) storedKeys = await res.json();
    } catch {
      // fallback
    }

    localStorage.clear();

    const freshCustom = createBlankCustomPersona();
    setGirlfriend(freshCustom);
    setUser(DEFAULT_USER);
    setMemory(buildInitialMemory(DEFAULT_USER));
    setSelfies([]);
    setMessages([
      {
        id: `msg-welcome-${Date.now()}`,
        sender: 'girlfriend',
        text: `*te regarde avec curiosité et un doux sourire* Bonjour... C'est le tout début de notre histoire. Définissons ensemble qui je suis et commençons à discuter ✨`,
        timestamp: 'À l\'instant',
      }
    ]);

    // Rétablir le fournisseur actif selon les clés préservées sur le serveur (aucune clé brute côté client)
    const activeProvider = storedKeys.hasGroqKey
      ? 'groq'
      : storedKeys.hasOpenRouterKey
      ? 'openrouter'
      : storedKeys.hasNanoGptKey
      ? 'nanogpt'
      : 'gemini';
    const restoredLlm: LLMConfig = {
      provider: activeProvider,
      apiKey: '',
      model:
        activeProvider === 'groq'
          ? 'llama-3.3-70b-versatile'
          : activeProvider === 'openrouter'
          ? 'meta-llama/llama-3.3-70b-instruct'
          : activeProvider === 'nanogpt'
          ? 'z-ai/glm-5.3-flash'
          : 'gemini-3.1-flash-lite',
      localEndpoint: 'http://localhost:11434/v1',
      maxContextMessages: 8,
      temperature: 0.85,
      memoryInjectionMode: 'compact_json',
    };
    const restoredSelfie: SelfieConfig = {
      provider: storedKeys.hasNanoGptKey ? 'nanogpt' : 'pollinations',
      comfyEndpoint: 'http://localhost:8188',
      openRouterApiKey: '',
      nanoGptApiKey: '',
      imageModel: storedKeys.hasNanoGptKey ? 'qwen-image' : 'flux',
      aspectRatio: '3:4',
      enablePhotoRequests: true,
    };

    setLlmConfig(restoredLlm);
    setSelfieConfig(restoredSelfie);
    safeStorage.setItem('aura_llm_config', JSON.stringify(restoredLlm));
    safeStorage.setItem('aura_selfie_config', JSON.stringify(restoredSelfie));

    setIsResetModalOpen(false);
    setOnboardingStep(1);
    setIsOnboardingPendingSettings(false);
    setIsOnboardingOpen(true);
  };

  // Sync to safeStorage (Guaranteed Quota-Safe: never throws QuotaExceededError!)
  useEffect(() => {
    safeStorage.setItem('aura_girlfriend', JSON.stringify(girlfriend));
  }, [girlfriend]);

  useEffect(() => {
    safeStorage.setItem('aura_user', JSON.stringify(user));
  }, [user]);

  useEffect(() => {
    safeStorage.setItem('aura_memory', JSON.stringify(memory));
  }, [memory]);

  useEffect(() => {
    safeStorage.setItem('aura_selfies', JSON.stringify(selfies));
  }, [selfies]);

  useEffect(() => {
    safeStorage.setItem('aura_chat_messages', JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    safeStorage.setItem('aura_llm_config', JSON.stringify(llmConfig));
  }, [llmConfig]);

  useEffect(() => {
    safeStorage.setItem('aura_selfie_config', JSON.stringify(selfieConfig));
  }, [selfieConfig]);

  useEffect(() => {
    safeStorage.setItem('aura_voice_config', JSON.stringify(voiceConfig));
  }, [voiceConfig]);

  // Load live weather & context on mount
  useEffect(() => {
    fetchLiveContext(context.city).then(freshContext => {
      setContext(prev => ({
        ...prev,
        ...freshContext,
      }));
    });
  }, [context.city]);

  // Token Optimization Statistics
  const systemPrompt = buildLightweightSystemPrompt(girlfriend, user, memory, context, llmConfig, chatMode);
  const slidingHistory = getSlidingWindowMessages(messages, llmConfig.maxContextMessages);
  const tokenStats = calculateTokenOptimizationStats(systemPrompt, slidingHistory, messages);

  // Trigger selfie generation
  const handleTriggerSelfie = async (scenarioTitle: string, snippet: string, customOutfit?: string) => {
    setIsGeneratingSelfie(true);
    try {
      const generated = await generateSelfie(girlfriend, selfieConfig, {
        scenarioTitle,
        scenarioSnippet: snippet,
        customOutfit: customOutfit || girlfriend.appearance.currentOutfitStyle,
      }, llmConfig);

      // Add to gallery
      setSelfies(prev => [generated, ...prev]);

      // Add to chat stream as message with image
      const now = new Date();
      const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      const selfieMsg: ChatMessage = {
        id: `msg-${Date.now()}`,
        sender: 'girlfriend',
        text: generated.caption,
        timestamp: timeStr,
        selfie: generated,
      };

      setMessages(prev => [...prev, selfieMsg]);
    } catch (err) {
      console.error('Selfie generation error:', err);
    } finally {
      setIsGeneratingSelfie(false);
    }
  };

  // Supprime une image générée de l'Album Privé et du disque serveur (sans jamais toucher à l'avatar du profil)
  const removeSelfieFromGalleryAndDisk = (selfie?: SelfieItem) => {
    if (!selfie) return;
    setSelfies(prev => {
      const next = prev.filter(s => s.id !== selfie.id && s.url !== selfie.url);
      safeStorage.setItem('aura_selfies', JSON.stringify(next));
      return next;
    });
    if (selfie.url && selfie.url.startsWith('/api/images/') && selfie.url !== girlfriend.appearance.avatarUrl) {
      const filename = selfie.url.replace('/api/images/', '').split('?')[0];
      if (filename) {
        fetch(`/api/images/${encodeURIComponent(filename)}`, { method: 'DELETE' }).catch(() => {});
      }
    }
  };

  // Cœur partagé entre l'envoi normal et la régénération ("seconde passe") d'une réponse de la compagne
  const generateGirlfriendReply = async (
    userMsg: ChatMessage,
    historyBeforeUserMsg: ChatMessage[],
    currentMemory: LightweightMemory,
    allowAutoDiary: boolean
  ) => {
    const text = userMsg.text;
    const response = await sendChatMessage(
      text,
      historyBeforeUserMsg,
      girlfriend,
      user,
      currentMemory,
      context,
      llmConfig,
      userMsg.userImage,
      chatMode
    );

    // Nettoyer d'éventuelles balises factices *selfie* / [selfie] si le LLM en a écrit AVANT de générer l'image
    const cleanedResponseText = response.text
      .replace(/(\*|\[\s*)\s*(?:selfie|photo|envoie\s+une?\s+(?:photo|selfie)|prend\s+un\s+selfie)\s*(\*|\])/gi, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim() || response.text;

    // Détection naturelle et fiable d'une demande explicite de photo / selfie / apparence dans le chat
    const normalizedText = text.trim();
    const isExplicitSelfieRequest =
      /\b(envoie|envois|fais|prends|montre|montres|partage|laisse(?:-moi)?\s+voir|fais(?:-moi)?\s+voir)(?:-moi|\s+moi|-nous|\s+me)?\b.{0,45}\b(photo|selfie|cliché|portrait|toi|visage|tête|bouille|tenue|look)\b/i.test(normalizedText) ||
      /(?:^|[\s,'"(])(?:à\s+quoi\s+tu\s+ressembles?|voir\s+à\s+quoi\s+tu\s+ressembles?|comment\s+tu\s+(?:es\s+habillée|t'habilles|ressembles))\b/i.test(normalizedText) ||
      (/\b(?:une?\s+(?:petite?\s+)?(?:photo|selfie)|un\s+(?:autre\s+|nouveau\s+|petit\s+)?selfie)\b/i.test(normalizedText) &&
        /(?:\b(?:envoie|envois|fais|prends|montre|montres|veux|voudrais|peux|pourrais|stp)\b|s'il\s+te\s+pla[îi]t|\?)/i.test(normalizedText));

    // 1. On attend la réponse de la Girlfriend pour injecter SA description (tenue, coiffure, décor, action) dans le prompt image !
    let selfieItem: SelfieItem | undefined = undefined;
    if (isExplicitSelfieRequest && selfieConfig.enablePhotoRequests && !response.isError) {
      setIsGeneratingSelfie(true);
      try {
        selfieItem = await generateSelfie(girlfriend, selfieConfig, {
          scenarioTitle: 'Selfie sur demande',
          scenarioSnippet: `user asked: "${normalizedText}" — candid authentic selfie matching her exact current description`,
          girlfriendReply: cleanedResponseText,
        }, llmConfig);
        setSelfies(prev => [selfieItem!, ...prev]);
      } catch (err) {
        console.warn('Erreur génération selfie sur demande:', err);
      } finally {
        setIsGeneratingSelfie(false);
      }
    }

    // Check if user requested a voice note, audio or whisper
    const wantsVoiceNote = /vocal|voix|audio|chuchote|murmure|note vocale|dis-le|entendre/i.test(text);
    let voiceNoteItem = undefined;
    if (wantsVoiceNote) {
      const waveform = Array.from({ length: 28 }, (_, i) => {
        return Math.floor(Math.sin(i * 0.45) * 35 + 50 + (Math.random() * 25));
      });

      voiceNoteItem = {
        durationSeconds: Math.min(25, Math.max(5, Math.round(cleanedResponseText.length / 15))),
        transcript: cleanedResponseText,
        waveform,
        isWhisper: /chuchote|murmure|secret|nuit|lit/i.test(text),
      };
    }

    const gfMsg: ChatMessage = {
      id: `msg-gf-${Date.now()}`,
      sender: 'girlfriend',
      text: cleanedResponseText,
      timestamp: `${new Date().getHours().toString().padStart(2, '0')}:${new Date().getMinutes().toString().padStart(2, '0')}`,
      selfie: selfieItem,
      voiceNote: voiceNoteItem,
      reactionMood: currentMemory.jealousyState?.isJealous ? 'jealous' : undefined,
      tokenCountEstimate: response.tokensUsedEstimate,
      isError: response.isError,
    };

    setMessages(prev => {
      const next = response.isError
        ? prev.map(m => (m.id === userMsg.id ? { ...m, isError: true } : m))
        : prev.map(m => (m.id === userMsg.id ? { ...m, isError: false } : m));
      return [...next, gfMsg];
    });

    // Automatic diary update every 6 messages (uniquement lors d'un nouvel échange)
    const totalMessages = historyBeforeUserMsg.length + 2;
    if (allowAutoDiary && totalMessages > 0 && totalMessages % 6 === 0) {
      const snippet = text.slice(0, 40);
      const autoDiaryEntry = {
        id: `entry-${Date.now()}`,
        date: 'Aujourd’hui',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        title: `Pensée complice · Affinité ${currentMemory.affectionScore}%`,
        content: `On a eu une super conversation aujourd'hui. ${snippet ? `Il me parlait de "${snippet}".` : ''} J'adore nos moments ensemble, il me fait toujours sourire.`,
        mood: currentMemory.affectionScore > 70 ? 'Amoureuse & joyeuse' : 'Tendre & complice',
      };
      setMemory(prev => {
        const updated = {
          ...prev,
          diaryEntries: [autoDiaryEntry, ...(prev.diaryEntries || [])].slice(0, 15),
        };
        safeStorage.setItem('aura_memory', JSON.stringify(updated));
        return updated;
      });
    }

    // Auto-play voice if configured
    if (voiceConfig.autoPlay && !response.isError) {
      speakMessage(response.text, girlfriend, voiceConfig);
    }
  };

  // Send Chat Message Flow (with optional multimodal user image vision)
  const handleSendMessage = async (text: string, userImage?: string) => {
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    const userMsg: ChatMessage = {
      id: `msg-user-${Date.now()}`,
      sender: 'user',
      text,
      userImage,
      timestamp: timeStr,
    };

    const historyBeforeUserMsg = messages;
    setMessages([...historyBeforeUserMsg, userMsg]);
    setIsTyping(true);

    // Extract facts asynchronously into memory card with photo awareness & jealousy detection
    const extractedUpdates = analyzeAndExtractFacts(text, memory, Boolean(userImage));
    const currentMemory = extractedUpdates ? { ...memory, ...extractedUpdates } : memory;
    if (extractedUpdates) {
      setMemory(currentMemory);
      safeStorage.setItem('aura_memory', JSON.stringify(currentMemory));
    }

    try {
      await generateGirlfriendReply(userMsg, historyBeforeUserMsg, currentMemory, true);
    } catch (err) {
      console.error('Chat error:', err);
    } finally {
      setIsTyping(false);
    }
  };

  // Supprimer un message de l'AI Girlfriend (et son image générée si présente)
  const handleDeleteMessage = (msgId: string) => {
    const targetMsg = messages.find(m => m.id === msgId);
    if (!targetMsg || targetMsg.sender === 'user') return;

    stopSpeaking();
    if (targetMsg.selfie) {
      removeSelfieFromGalleryAndDisk(targetMsg.selfie);
    }
    setMessages(prev => {
      const next = prev.filter(m => m.id !== msgId);
      safeStorage.setItem('aura_chat_messages', JSON.stringify(next));
      return next;
    });
    logger.info('LLM_CHAT', 'Message de la compagne supprimé', {
      msgId,
      hadSelfie: Boolean(targetMsg.selfie),
    });
  };

  // Seconde passe : supprime la réponse actuelle (et son image) et régénère une réponse au dernier message utilisateur
  const handleReloadMessage = async (msgId: string) => {
    if (isTyping || isGeneratingSelfie) return;
    const targetIdx = messages.findIndex(m => m.id === msgId);
    if (targetIdx === -1) return;
    const targetMsg = messages[targetIdx];
    if (targetMsg.sender !== 'girlfriend') return;

    let userIdx = -1;
    for (let i = targetIdx - 1; i >= 0; i--) {
      if (messages[i].sender === 'user') {
        userIdx = i;
        break;
      }
    }
    if (userIdx === -1) return;

    const lastUserMsg = messages[userIdx];
    const historyBeforeUserMsg = messages.slice(0, userIdx);

    stopSpeaking();
    if (targetMsg.selfie) {
      removeSelfieFromGalleryAndDisk(targetMsg.selfie);
    }

    // Retire la réponse à régénérer immédiatement pour afficher l'indicateur de frappe
    const remainingMessages = messages.filter(m => m.id !== msgId);
    setMessages(remainingMessages);
    safeStorage.setItem('aura_chat_messages', JSON.stringify(remainingMessages));

    logger.info('LLM_CHAT', 'Seconde passe : régénération de la réponse au dernier message utilisateur', {
      replacedMsgId: msgId,
      hadSelfie: Boolean(targetMsg.selfie),
    });

    setIsTyping(true);
    try {
      await generateGirlfriendReply(lastUserMsg, historyBeforeUserMsg, memory, false);
    } catch (err) {
      console.error('Reload message error:', err);
    } finally {
      setIsTyping(false);
    }
  };

  // Switch mobile views
  const handleSelectMobileView = (view: 'chat' | 'gallery' | 'memory' | 'diary' | 'customizer') => {
    setMobileActiveView(view);
    if (view === 'gallery') setIsGalleryOpen(true);
    if (view === 'memory') setIsMemoryOpen(true);
    if (view === 'diary') setIsDiaryOpen(true);
    if (view === 'customizer') setIsCustomizerOpen(true);
  };

  if (authState.checking) {
    return (
      <div className="flex items-center justify-center h-screen w-full bg-[#090a10] text-slate-400 text-xs">
        Initialisation d’Aura AI...
      </div>
    );
  }

  if (authState.authRequired && !authState.authenticated) {
    return (
      <AuthGate
        onAuthenticated={() => {
          setIsStateHydrated(false);
          setAuthState({ checking: false, authRequired: true, authenticated: true });
        }}
      />
    );
  }

  return (
    <div className="flex flex-col h-screen w-full bg-[#090a10] text-slate-100 overflow-hidden font-sans">
      <OfflineIndicator />

      {/* Top Bar Navigation */}
      <TopBar
        girlfriend={girlfriend}
        context={context}
        onOpenCustomizer={() => setIsCustomizerOpen(true)}
        onOpenGallery={() => setIsGalleryOpen(true)}
        onOpenMemory={() => setIsMemoryOpen(true)}
        onOpenDiary={() => setIsDiaryOpen(true)}
        onOpenSettings={() => {
          setIsPortraitRedirect(false);
          setSettingsInitialSubTab('llm');
          setIsSettingsOpen(true);
        }}
        onOpenLogs={() => setIsLogsOpen(true)}
        onOpenReset={() => setIsResetModalOpen(true)}
        onOpenPortrait={() => setIsPortraitModalOpen(true)}
        activeTokens={tokenStats.activeTurnTokens}
      />

      {/* Main Interactive Chat Area */}
      <main className="flex-1 flex flex-col min-h-0 relative">
        <ChatView
          girlfriend={girlfriend}
          user={user}
          messages={messages}
          memory={memory}
          chatMode={chatMode}
          onToggleChatMode={handleToggleChatMode}
          onSendMessage={handleSendMessage}
          onTriggerSelfie={(title, snippet, outfit) => handleTriggerSelfie(title, snippet, outfit)}
          onOpenPortrait={() => setIsPortraitModalOpen(true)}
          onOpenCustomSelfieModal={() => setIsCustomSelfieModalOpen(true)}
          onOpenCustomizer={() => setIsCustomizerOpen(true)}
          onOpenGallery={() => setIsGalleryOpen(true)}
          onOpenMemory={() => setIsMemoryOpen(true)}
          onOpenSettings={() => {
            setIsPortraitRedirect(false);
            setSettingsInitialSubTab('llm');
            setIsSettingsOpen(true);
          }}
          onOpenReset={() => setIsResetModalOpen(true)}
          isTyping={isTyping}
          isGeneratingSelfie={isGeneratingSelfie}
          context={context}
          activeTokens={tokenStats.activeTurnTokens}
          tokensSaved={tokenStats.tokensSaved}
          voiceConfig={voiceConfig}
          selfieConfig={selfieConfig}
          llmConfig={llmConfig}
          onUpdateGreeting={(newGreeting) => {
            const updatedGf = { ...girlfriend, initialGreeting: newGreeting };
            setGirlfriend(updatedGf);
            safeStorage.setItem('aura_girlfriend', JSON.stringify(updatedGf));
            setMessages(prev => prev.map(m => (m.id === 'msg-welcome' || m.id.startsWith('msg-welcome')) ? { ...m, text: newGreeting } : m));
          }}
          onDeleteMessage={handleDeleteMessage}
          onReloadMessage={handleReloadMessage}
        />
      </main>

      {/* Bottom Tab Bar for Mobile Navigation */}
      <BottomTabBar
        activeView={mobileActiveView}
        onSelectView={handleSelectMobileView}
        activeTokens={tokenStats.activeTurnTokens}
      />

      {/* Modals */}
      <PersonaCustomizerModal
        isOpen={isCustomizerOpen}
        onClose={() => {
          setIsCustomizerOpen(false);
          setMobileActiveView('chat');
        }}
        girlfriend={girlfriend}
        user={user}
        selfieConfig={selfieConfig}
        llmConfig={llmConfig}
        onSave={(updatedGf, updatedUsr) => {
          setGirlfriend(updatedGf);
          setUser(updatedUsr);
          safeStorage.setItem('aura_girlfriend', JSON.stringify(updatedGf));
          safeStorage.setItem('aura_user', JSON.stringify(updatedUsr));

          const newFacts: string[] = [];
          if (updatedUsr.physicalDescription) newFacts.push(updatedUsr.physicalDescription);
          if (updatedUsr.bio) newFacts.push(updatedUsr.bio);
          if (updatedUsr.interests && updatedUsr.interests.length > 0) {
            newFacts.push(`Centres d'intérêt : ${updatedUsr.interests.join(', ')}`);
          }
          if (newFacts.length === 0) newFacts.push('Au début de notre belle histoire');

          setMemory(prev => {
            const updatedMemory = {
              ...prev,
              factsAboutUser: newFacts.slice(0, 8),
              diaryEntries: prev.diaryEntries.map((entry, idx) => {
                if (idx === 0) {
                  return {
                    ...entry,
                    content: `Je viens de faire la connaissance de ${updatedUsr.name || 'mon chéri'}. J'ai hâte qu'on apprenne à se connaître, de découvrir ce qu'il aime et de partager de beaux moments complices.`,
                  };
                }
                return entry;
              }),
            };
            safeStorage.setItem('aura_memory', JSON.stringify(updatedMemory));
            return updatedMemory;
          });
        }}
        onTestSelfieRequest={() => {
          setIsCustomizerOpen(false);
          handleTriggerSelfie('Test Ancre Visuelle', 'looking happily at camera');
        }}
        onRequestOpenRouterConfig={() => {
          setSelfieConfig(prev => {
            const currentModel = (prev.imageModel || '').trim();
            const preferNano = prev.provider === 'nanogpt' || llmConfig.provider === 'nanogpt' || (Boolean(prev.nanoGptApiKey) && !prev.openRouterApiKey);
            if (preferNano) {
              const isValidNano = Boolean(currentModel && currentModel !== 'flux' && !currentModel.startsWith('gemini-') && !currentModel.includes('/'));
              return {
                ...prev,
                provider: 'nanogpt',
                imageModel: isValidNano ? currentModel : 'qwen-image',
              };
            }
            const isValidOrModel = Boolean(currentModel && currentModel.includes('/') && !currentModel.startsWith('openrouter/auto'));
            return {
              ...prev,
              provider: 'openrouter',
              imageModel: isValidOrModel ? currentModel : 'google/gemini-2.5-flash-image',
            };
          });
          setSettingsInitialSubTab('image');
          setIsPortraitRedirect(true);
          setIsSettingsOpen(true);
        }}
        retryPortraitTrigger={retryPortraitTrigger}
        retrySkipConfig={retrySkipConfig}
      />

      <SelfieGalleryModal
        isOpen={isGalleryOpen}
        onClose={() => {
          setIsGalleryOpen(false);
          setMobileActiveView('chat');
        }}
        girlfriend={girlfriend}
        selfies={selfies}
        onTriggerSelfie={handleTriggerSelfie}
        onClearGallery={() => {
          setSelfies([]);
          safeStorage.setItem('aura_selfies', JSON.stringify([]));
        }}
        isGenerating={isGeneratingSelfie}
      />

      <TokenMemoryModal
        isOpen={isMemoryOpen}
        onClose={() => {
          setIsMemoryOpen(false);
          setMobileActiveView('chat');
        }}
        memory={memory}
        onUpdateMemory={setMemory}
        config={llmConfig}
        onUpdateConfig={setLlmConfig}
        activeTokens={tokenStats.activeTurnTokens}
        tokensSaved={tokenStats.tokensSaved}
        savingsPercent={tokenStats.savingsPercent}
      />

      <DiaryModal
        isOpen={isDiaryOpen}
        onClose={() => {
          setIsDiaryOpen(false);
          setMobileActiveView('chat');
        }}
        girlfriend={girlfriend}
        entries={memory.diaryEntries}
      />

      <LLMSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => {
          setIsSettingsOpen(false);
          setIsPortraitRedirect(false);
          if (isOnboardingPendingSettings) {
            setIsOnboardingPendingSettings(false);
            setIsOnboardingOpen(true);
          }
        }}
        initialSubTab={settingsInitialSubTab}
        isPortraitRedirect={isPortraitRedirect}
        onSaveAndRetryPortrait={() => {
          setIsSettingsOpen(false);
          setIsPortraitRedirect(false);
          setRetrySkipConfig(false);
          setRetryPortraitTrigger(prev => prev + 1);
        }}
        onCancelPortraitRedirect={() => {
          setIsSettingsOpen(false);
          setIsPortraitRedirect(false);
          setRetrySkipConfig(true);
          setRetryPortraitTrigger(prev => prev + 1);
        }}
        llmConfig={llmConfig}
        onUpdateLLMConfig={setLlmConfig}
        selfieConfig={selfieConfig}
        onUpdateSelfieConfig={setSelfieConfig}
        voiceConfig={voiceConfig}
        onUpdateVoiceConfig={setVoiceConfig}
        context={context}
        onUpdateCity={(cityName) => {
          setContext(prev => ({ ...prev, city: cityName }));
          fetchLiveContext(cityName).then(fresh => setContext(prev => ({ ...prev, ...fresh })));
        }}
        onToggleContextOption={(key, val) => {
          setContext(prev => ({ ...prev, [key]: val }));
        }}
        girlfriend={girlfriend}
        onOpenReset={() => setIsResetModalOpen(true)}
        onOpenLogs={() => setIsLogsOpen(true)}
      />

      <ResetConfirmModal
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        girlfriend={girlfriend}
        onSoftReset={handleSoftReset}
        onHardReset={handleHardReset}
      />

      <OnboardingModal
        isOpen={isOnboardingOpen}
        initialStep={onboardingStep}
        onClose={() => setIsOnboardingOpen(false)}
        llmConfig={llmConfig}
        selfieConfig={selfieConfig}
        onUpdateLLMConfig={(cfg) => {
          setLlmConfig(cfg);
          safeStorage.setItem('aura_llm_config', JSON.stringify(cfg));
        }}
        onUpdateSelfieConfig={(cfg) => {
          setSelfieConfig(cfg);
          safeStorage.setItem('aura_selfie_config', JSON.stringify(cfg));
        }}
        onSelectPersona={(persona) => {
          setGirlfriend(persona);
          safeStorage.setItem('aura_girlfriend', JSON.stringify(persona));
        }}
        onOpenCustomizer={() => setIsCustomizerOpen(true)}
        onOpenSettings={() => {
          setIsOnboardingOpen(false);
          setIsOnboardingPendingSettings(true);
          setIsPortraitRedirect(false);
          setSettingsInitialSubTab('llm');
          setIsSettingsOpen(true);
        }}
        onConfigureKeys={(provider) => {
          setOnboardingStep(2);
          setIsOnboardingOpen(false);
          setIsOnboardingPendingSettings(true);
          setIsPortraitRedirect(false);
          setSettingsInitialSubTab('llm');
          setIsSettingsOpen(true);
        }}
      />

      <GirlfriendPortraitModal
        isOpen={isPortraitModalOpen}
        onClose={() => setIsPortraitModalOpen(false)}
        girlfriend={girlfriend}
        onOpenCustomizer={() => setIsCustomizerOpen(true)}
      />

      <CustomSelfieRequestModal
        isOpen={isCustomSelfieModalOpen}
        onClose={() => setIsCustomSelfieModalOpen(false)}
        girlfriend={girlfriend}
        onTriggerSelfie={handleTriggerSelfie}
      />

      <LogsModal
        isOpen={isLogsOpen}
        onClose={() => setIsLogsOpen(false)}
      />
    </div>
  );
}
