import { GirlfriendPersona, UserPersona, LightweightMemory, RealWorldContext, ChatMessage, LLMConfig, ChatMode } from '../types';
import { buildLightweightSystemPrompt, getSlidingWindowMessages } from './memoryService';
import { logger } from './logger';

export interface LLMResponse {
  text: string;
  tokensUsedEstimate: number;
  isError?: boolean;
}

async function fetchServerKeyStatus(): Promise<{
  hasGeminiKey: boolean;
  hasGroqKey: boolean;
  hasOpenRouterKey: boolean;
  hasNanoGptKey: boolean;
}> {
  try {
    const kRes = await fetch('/api/keys');
    if (kRes.ok) {
      return await kRes.json();
    }
  } catch {
    // ignore
  }
  return { hasGeminiKey: false, hasGroqKey: false, hasOpenRouterKey: false, hasNanoGptKey: false };
}

/**
 * Executes authentic chat inference across configured real LLM providers
 * (Google Gemini, Groq, OpenRouter, NanoGPT via backend proxies, or Local Ollama/vLLM).
 * No hardcoded mock personas or simulated responses.
 */
export async function sendChatMessage(
  latestUserText: string,
  history: ChatMessage[],
  girlfriend: GirlfriendPersona,
  user: UserPersona,
  memory: LightweightMemory,
  context: RealWorldContext,
  config: LLMConfig,
  userImage?: string,
  chatMode: ChatMode = 'message'
): Promise<LLMResponse> {
  const startTime = Date.now();
  const systemPrompt = buildLightweightSystemPrompt(girlfriend, user, memory, context, config, chatMode);
  const slidingHistory = getSlidingWindowMessages(history.filter(m => !m.isError), config.maxContextMessages);

  if (userImage) {
    logger.info('VISION_INPUT', `Photo envoyée par l'utilisateur (${Math.round(userImage.length / 1024)} Ko)`, {
      provider: config.provider,
      model: config.model,
      promptText: latestUserText,
    });
  } else {
    logger.info('LLM_CHAT', `Envoi message texte pur (${latestUserText.length} car.)`, {
      provider: config.provider,
      model: config.model || '(auto)',
      mode: chatMode,
      historyLength: slidingHistory.length,
      imageSent: false,
    });
  }

  // 1. LOCAL LLM (Ollama, LM Studio, vLLM) with Vision support
  if (config.provider === 'local') {
    const endpoint = config.localEndpoint.replace(/\/$/, '') + '/chat/completions';
    
    const userMessageContent = userImage
      ? [
          { type: 'text', text: latestUserText || 'Regarde cette photo que je viens de t\'envoyer :' },
          { type: 'image_url', image_url: { url: userImage } }
        ]
      : latestUserText;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...slidingHistory.map(m => ({
        role: m.sender === 'user' ? 'user' : 'assistant',
        content: m.text,
      })),
      { role: 'user', content: userMessageContent },
    ];

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: config.model || 'llama3.2-vision',
          messages,
          temperature: config.temperature,
          max_tokens: 350,
        }),
      });

      if (!res.ok) throw new Error(`Local LLM returned status ${res.status}`);
      const data = await res.json();
      const content = data.choices?.[0]?.message?.content;
      if (content) {
        logger.info('LLM_CHAT', `Réponse Local LLM reçue en ${Date.now() - startTime}ms`, {
          model: config.model,
          tokens: data.usage?.total_tokens,
        });
        return {
          text: content,
          tokensUsedEstimate: data.usage?.total_tokens || Math.ceil((systemPrompt.length + content.length) / 3.8),
        };
      }
    } catch (err: any) {
      logger.error('LLM_CHAT', `Erreur Local LLM: ${err.message}`, err);
      return {
        text: `*te regarde avec un sourire désolé* Je n'arrive pas à joindre ton serveur local (${config.localEndpoint}). Vérifie qu'Ollama ou LM Studio est bien démarré !`,
        tokensUsedEstimate: 30,
        isError: true,
      };
    }
  }

  // 2. OPENROUTER OR GROQ (Proxied via Express backend; keys remain on server)
  if (config.provider === 'openrouter' || config.provider === 'groq') {
    const clientKey = (config.apiKey || '').trim();
    let hasKey = Boolean(clientKey);
    if (!hasKey) {
      const serverKeys = await fetchServerKeyStatus();
      hasKey = config.provider === 'groq' ? Boolean(serverKeys.hasGroqKey) : Boolean(serverKeys.hasOpenRouterKey);
    }

    if (!hasKey) {
      logger.warn('LLM_CHAT', `Clé API manquante pour ${config.provider}`);
      return {
        text: `*te sourit gentiment* Pour discuter avec le moteur ${config.provider === 'groq' ? 'Groq' : 'OpenRouter'}, renseigne ta clé API dans "Moteurs & LLM", ou active Google Gemini qui fonctionne directement ! 💕`,
        tokensUsedEstimate: 35,
        isError: true,
      };
    }

    const endpoint = config.provider === 'openrouter' ? '/api/openrouter/chat' : '/api/groq/chat';

    const userContent = userImage
      ? [
          { type: 'text', text: latestUserText || 'Regarde cette photo :' },
          { type: 'image_url', image_url: { url: userImage } }
        ]
      : latestUserText;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...slidingHistory.map(m => ({
        role: m.sender === 'user' ? 'user' : 'assistant',
        content: m.text,
      })),
      { role: 'user', content: userContent },
    ];

    let chosenModel = config.model;
    if (config.provider === 'groq') {
      if (userImage) {
        if (!chosenModel || !chosenModel.includes('vision')) {
          chosenModel = 'llama-3.2-11b-vision-preview';
        }
      } else {
        chosenModel = chosenModel || 'qwen/qwen3.8-27b';
      }
    } else if (config.provider === 'openrouter') {
      if (userImage) {
        if (!chosenModel || !chosenModel.includes('vision')) {
          chosenModel = 'meta-llama/llama-3.2-11b-vision-instruct';
        }
      } else {
        chosenModel = chosenModel || 'meta-llama/llama-3.3-70b-instruct';
      }
    }

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: chosenModel,
          messages,
          temperature: config.temperature,
          max_tokens: 1000,
          ...(chosenModel?.startsWith('openai/gpt-oss') ? { reasoning_effort: 'low' } : {}),
          ...(clientKey ? { apiKey: clientKey } : {}),
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const errMsg = errData.error || `HTTP ${res.status}`;
        logger.error('LLM_CHAT', `${config.provider} API HTTP ${res.status}: ${errMsg}`, {
          endpoint,
          model: chosenModel,
          status: res.status,
          body: errMsg,
        });
        throw new Error(`${config.provider} API error ${res.status}: ${errMsg}`);
      }
      const data = await res.json();
      if (data.text) {
        logger.info('LLM_CHAT', `Réponse ${config.provider} reçue en ${Date.now() - startTime}ms`, {
          model: chosenModel,
          tokens: data.tokensUsed,
        });
        return {
          text: data.text,
          tokensUsedEstimate: data.tokensUsed || Math.ceil((systemPrompt.length + data.text.length) / 3.8),
        };
      }
      logger.warn('LLM_CHAT', `Réponse vide reçue de ${config.provider}`);
      return {
        text: `*te regarde avec un air perdu* Je n'ai rien reçu en réponse... réessaie ?`,
        tokensUsedEstimate: 0,
        isError: true,
      };
    } catch (err: any) {
      logger.error('LLM_CHAT', `Erreur ${config.provider}: ${err.message}`, err);
      return {
        text: `*te regarde avec tendresse* Une petite erreur réseau est survenue avec ${config.provider} (${err.message?.slice(0, 80)}...). Vérifie le solde ou le modèle sélectionné.`,
        tokensUsedEstimate: 25,
        isError: true,
      };
    }
  }

  // 2b. NANOGPT (299+ text/vision/tools models via server proxy, shared API key)
  if (config.provider === 'nanogpt') {
    const clientKey = (config.apiKey || '').trim();
    let hasNanoKey = Boolean(clientKey);
    if (!hasNanoKey) {
      const serverKeys = await fetchServerKeyStatus();
      hasNanoKey = Boolean(serverKeys.hasNanoGptKey);
    }

    if (!hasNanoKey) {
      logger.warn('LLM_CHAT', 'Clé API manquante pour NanoGPT');
      return {
        text: `*te sourit gentiment* Pour discuter avec NanoGPT, renseigne ta clé API dans "Moteurs & LLM" (elle fonctionnera aussi pour les 100 images/jour) ! 💕`,
        tokensUsedEstimate: 35,
        isError: true,
      };
    }

    const userContent = userImage
      ? [
          { type: 'text', text: latestUserText || 'Regarde cette photo :' },
          { type: 'image_url', image_url: { url: userImage } }
        ]
      : latestUserText;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...slidingHistory.map(m => ({
        role: m.sender === 'user' ? 'user' : 'assistant',
        content: m.text,
      })),
      { role: 'user', content: userContent },
    ];

    const chosenModel = config.model || 'z-ai/glm-5.3-flash';

    try {
      const res = await fetch('/api/nanogpt/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: chosenModel,
          messages,
          temperature: config.temperature,
          max_tokens: 1000,
          ...(clientKey ? { apiKey: clientKey } : {}),
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const errMsg = errData.error || `HTTP ${res.status}`;
        logger.error('LLM_CHAT', `NanoGPT HTTP ${res.status}: ${errMsg}`, { model: chosenModel });
        throw new Error(errMsg);
      }

      const data = await res.json();
      if (data.text) {
        logger.info('LLM_CHAT', `Réponse NanoGPT reçue en ${Date.now() - startTime}ms`, {
          model: chosenModel,
          tokens: data.tokensUsed,
        });
        return {
          text: data.text,
          tokensUsedEstimate: data.tokensUsed || Math.ceil((systemPrompt.length + data.text.length) / 3.8),
        };
      }

      return {
        text: `*te regarde avec un air perdu* Je n'ai rien reçu de NanoGPT... réessaie ?`,
        tokensUsedEstimate: 0,
        isError: true,
      };
    } catch (err: any) {
      logger.error('LLM_CHAT', `Erreur NanoGPT: ${err.message}`, err);
      return {
        text: `*te regarde avec tendresse* Une erreur est survenue avec NanoGPT (${err.message?.slice(0, 80)}...). Vérifie ta clé ou le modèle sélectionné.`,
        tokensUsedEstimate: 25,
        isError: true,
      };
    }
  }

  // 3. GOOGLE GEMINI (Multimodal Vision via server proxy - Default & Recommended)
  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemPrompt,
        messages: slidingHistory.map(m => ({
          role: m.sender === 'user' ? 'user' : 'assistant',
          content: m.text,
        })),
        latestMessage: latestUserText,
        userImage,
        model: (config.model && config.model !== 'gemini-2.5-flash' && config.model !== 'gemini-2.5-pro') ? config.model : 'gemini-3.1-flash-lite',
        apiKey: config.apiKey,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.text) {
        return {
          text: data.text,
          tokensUsedEstimate: data.tokensUsed || 380,
        };
      }
    } else {
      const err = await res.json().catch(() => ({}));
      console.warn('Gemini chat proxy error:', err);
    }
  } catch (e) {
    console.warn('Gemini chat request failed:', e);
  }

  // Error fallback if backend service is unreachable
  return {
    text: `*te sourit doucement en inclinant la tête* Je n'ai pas pu joindre le serveur d'IA à l'instant... Peux-tu renvoyer ton message ou vérifier la connexion ?`,
    tokensUsedEstimate: 20,
    isError: true,
  };
}
