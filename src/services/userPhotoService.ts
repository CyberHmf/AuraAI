import { UserPersona, SelfieConfig, LLMConfig } from '../types';
import { compressImageForVision, cropFaceAndShouldersForVision } from './imageUtils';
import { logger } from './logger';

export interface GeneratedUserPhotoResult {
  imageUrl: string;
  dataUrlForVision: string;
  promptUsed: string;
  providerUsed: string;
  usedReferenceImage: boolean;
}

const USER_FRENCH_DICT: Array<[RegExp, string]> = [
  [/\bhomme\b/gi, 'man'],
  [/\bfemme\b/gi, 'woman'],
  [/\bbrun(?:e|s)?\b/gi, 'dark brown hair'],
  [/\bgrisonnant(?:e|s)?\b/gi, 'salt-and-pepper graying'],
  [/\bblond(?:e|s)?\b/gi, 'blonde'],
  [/\bchâtain\b/gi, 'chestnut brown'],
  [/\bnoir(?:e|s)?\b/gi, 'black'],
  [/\bblanc(?:he|s)?\b/gi, 'white'],
  [/\bbleu(?:e|s)?\b/gi, 'blue'],
  [/\bvert(?:e|s)?\b/gi, 'green'],
  [/\bnoisette\b/gi, 'hazel'],
  [/\byeux\b/gi, 'eyes'],
  [/\bcheveux\b/gi, 'hair'],
  [/\bbarbe\s+soignée\s+de\s+3\s+jours\b/gi, 'neat trimmed 3-day stubble beard'],
  [/\bbarbe\s+de\s+3\s+jours\b/gi, '3-day stubble beard'],
  [/\bbarbe\b/gi, 'beard'],
  [/\bmoustache\b/gi, 'mustache'],
  [/\bsilhouette\b/gi, 'build'],
  [/\bathlétique\b/gi, 'athletic fit'],
  [/\bmusclé(?:e|s)?\b/gi, 'toned muscular'],
  [/\bmince\b/gi, 'slim'],
  [/\blunettes(?:\s+de\s+soleil)?\b/gi, 'glasses'],
  [/\bsouriant(?:e|s)?\b/gi, 'smiling warmly'],
  [/\bsourire\b/gi, 'warm smile'],
  [/\ben\s+terrasse\b/gi, 'at an outdoor cafe terrace'],
  [/\bcafé\b/gi, 'coffee'],
  [/\bsalle\s+de\s+sport\b/gi, 'gym workout'],
  [/\bbureau\b/gi, 'modern office desk'],
  [/\btélétravail\b/gi, 'home office'],
  [/\bvoiture\b/gi, 'car'],
  [/\bplage\b/gi, 'beach'],
  [/\bsoirée\b/gi, 'evening night out'],
  [/\bcostume\b/gi, 'tailored suit'],
  [/\bchemise\b/gi, 'button-down shirt'],
  [/\bt-shirt\b/gi, 't-shirt'],
  [/\bveste\b/gi, 'jacket'],
  [/\bcuir\b/gi, 'leather'],
  [/\bmiroir\b/gi, 'mirror'],
  [/\bcuisine\b/gi, 'kitchen'],
  [/\bmaison\b/gi, 'at home'],
  [/\bsoleil\b/gi, 'warm sunlight'],
  [/\bnuit\b/gi, 'nighttime'],
  [/\bavec\b/gi, 'with'],
  [/\bdans\b/gi, 'in'],
  [/\bdevant\b/gi, 'in front of'],
];

function translateUserFrenchTokens(text: string): string {
  let result = ` ${text} `;
  for (const [pattern, replacement] of USER_FRENCH_DICT) {
    result = result.replace(pattern, ` ${replacement} `);
  }
  return result.replace(/\s+/g, ' ').trim();
}

function getUserFaceSeed(user: UserPersona): number {
  const str = [
    user.name || 'user',
    user.gender || 'Homme',
    user.physicalDescription || '',
  ].join('|');
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % 99999999 + 1000;
}

async function hasServerKeyFor(provider: 'nanogpt' | 'openrouter', clientKey?: string): Promise<boolean> {
  if (clientKey && clientKey.trim().length > 0) return true;
  try {
    const res = await fetch('/api/keys');
    if (!res.ok) return false;
    const data = await res.json();
    if (provider === 'nanogpt') return Boolean(data.hasNanoGptKey || data.nanoGptApiKey);
    if (provider === 'openrouter') return Boolean(data.hasOpenRouterKey || data.openRouterApiKey);
  } catch {
    // ignore
  }
  return false;
}

async function resolveUserReferencePortrait(avatarUrl?: string): Promise<string | undefined> {
  if (!avatarUrl || avatarUrl.startsWith('data:image/svg')) return undefined;
  try {
    const cropped = await cropFaceAndShouldersForVision(avatarUrl, 512, 0.85);
    if (cropped && cropped.startsWith('data:image/')) {
      return cropped;
    }
  } catch {
    // fallback below
  }
  if (avatarUrl.startsWith('data:image/') || avatarUrl.startsWith('/api/images/')) {
    return avatarUrl;
  }
  return undefined;
}

function resolveNanoGptImageModel(rawModel?: string): string {
  const m = (rawModel || '').trim();
  const blockedModels = [
    'flux-2-pro',
    'flux-2-max',
    'flux-pro',
    'flux-pro/v1.1',
    'flux-pro/v1.1-ultra',
    'flux-kontext',
    'seedream-v4',
    'gpt-image-1',
    'flux',
  ];
  if (!m || m.includes('/') || blockedModels.includes(m) || m.startsWith('gemini-')) {
    return 'qwen-image';
  }
  return m;
}

function resolveOpenRouterImageModel(rawModel?: string): string {
  const m = (rawModel || '').trim();
  if (!m || !m.includes('/') || m.startsWith('openrouter/auto')) {
    return 'google/gemini-2.5-flash-image';
  }
  return m;
}

function buildFluxFallbackUrl(prompt: string, ratio: '3:4' | '9:16' | '1:1', seed: number): string {
  const dims = ratio === '9:16' ? 'width=720&height=1280' : ratio === '1:1' ? 'width=960&height=960' : 'width=768&height=1024';
  const cleaned = encodeURIComponent(prompt.slice(0, 700));
  return `https://image.pollinations.ai/prompt/${cleaned}?${dims}&nologo=true&enhance=true&model=flux&seed=${seed}`;
}

function constructFallbackUserPhotoPrompt(
  user: UserPersona,
  scenePrompt: string,
  hasReferenceImage: boolean
): string {
  const genderEn = /femme/i.test(user.gender || '') ? 'woman' : 'man';
  const traitsEn = user.physicalDescription ? translateUserFrenchTokens(user.physicalDescription) : '';
  const sceneEn = translateUserFrenchTokens(scenePrompt || 'candid smiling smartphone selfie');

  const identityPrefix = hasReferenceImage
    ? 'Preserve strictly and exclusively the face, facial features, eyes, hair, facial hair, and likeness of the person from the reference portrait photo. IGNORE and completely replace the background, environment, and clothing of the reference image, adopting ONLY the new setting and scene described in this prompt.'
    : '';

  return [
    identityPrefix,
    `Authentic raw candid smartphone photograph of a ${genderEn}${traitsEn ? `, ${traitsEn}` : ''}`,
    sceneEn,
    'candid natural expression, realistic skin texture with natural pores, 35mm smartphone photography, natural lighting, sharp focus',
  ]
    .filter(Boolean)
    .join(', ');
}

/**
 * Generates an AI photo of the USER using their profile portrait (`user.avatarUrl`) + physical description + scene prompt,
 * routed through the exact image provider configured in `selfieConfig` without altering girlfriend selfie behavior.
 */
export async function generateUserPhoto(
  user: UserPersona,
  config: SelfieConfig,
  scenePrompt: string,
  llmConfig?: LLMConfig
): Promise<GeneratedUserPhotoResult> {
  const ratio: '3:4' | '9:16' | '1:1' = config.aspectRatio === '1:1' ? '1:1' : config.aspectRatio === '9:16' ? '9:16' : '3:4';
  const faceSeed = getUserFaceSeed(user);
  const referenceImage = await resolveUserReferencePortrait(user.avatarUrl);
  const hasReferenceImage = Boolean(referenceImage);

  let prompt = constructFallbackUserPhotoPrompt(user, scenePrompt, hasReferenceImage);
  let translatedVia = 'dictionnaire-local';

  // Compile a crisp English photography prompt from user profile + French scene description
  try {
    const compileRes = await fetch('/api/compile-portrait-prompt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'user_photo',
        persona: {
          name: user.name,
          gender: user.gender || 'Homme',
          physicalDescription: user.physicalDescription || '',
          scenePrompt: scenePrompt.trim(),
          hasReferenceImage,
          aspectRatio: ratio,
        },
        llmConfig,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (compileRes.ok) {
      const compiledData = await compileRes.json();
      if (compiledData?.compiledPrompt) {
        prompt = hasReferenceImage
          ? `Preserve strictly the face, eyes, hair, beard, and likeness from the reference portrait photo while replacing the background and outfit. ${compiledData.compiledPrompt}`
          : compiledData.compiledPrompt;
        translatedVia = `llm:${compiledData.translatedVia || 'auto'}`;
      }
    }
  } catch {
    // fallback already ready
  }

  const clientNanoKey = (config.nanoGptApiKey || '').trim();
  const clientOrKey = (config.openRouterApiKey || '').trim();
  const hasNanoGptKey = await hasServerKeyFor('nanogpt', clientNanoKey);
  const hasOpenRouterKey = await hasServerKeyFor('openrouter', clientOrKey);
  const rawModel = (config.imageModel || '').trim();
  const hasValidOrModel = Boolean(rawModel && rawModel.includes('/') && !rawModel.startsWith('openrouter/auto'));

  const explicitNano = config.provider === 'nanogpt';
  const explicitOpenRouter = config.provider === 'openrouter';
  const routeToNanoGpt =
    explicitNano ||
    (!explicitOpenRouter && config.provider !== 'comfyui' && hasNanoGptKey && !(hasOpenRouterKey && hasValidOrModel));
  const routeToOpenRouter =
    !routeToNanoGpt &&
    (explicitOpenRouter || (config.provider !== 'comfyui' && hasOpenRouterKey && hasValidOrModel));

  logger.info('IMAGE_GEN', 'Prompt photo utilisateur compilé & routage moteur', {
    translatedVia,
    hasReferenceImage,
    routeSelected: routeToNanoGpt ? 'nanogpt' : routeToOpenRouter ? 'openrouter' : config.provider,
    promptCompiled: prompt,
  });

  let rawImageUrl = '';
  let providerUsed = 'flux';
  let usedRefInRequest = false;

  // 1. NanoGPT
  if (!rawImageUrl && routeToNanoGpt && hasNanoGptKey) {
    const modelToUse = resolveNanoGptImageModel(config.imageModel);
    const supportsFaceRef =
      modelToUse.includes('qwen-image') ||
      modelToUse.includes('image-to-image') ||
      modelToUse.includes('edit') ||
      modelToUse.includes('hidream-e');
    try {
      const res = await fetch('/api/nanogpt/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          model: modelToUse,
          aspectRatio: ratio,
          ...(clientNanoKey ? { apiKey: clientNanoKey } : {}),
          ...(supportsFaceRef && referenceImage ? { referenceImage } : {}),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.imageUrl) {
          rawImageUrl = data.imageUrl;
          providerUsed = `nanogpt (${data.modelUsed || modelToUse})`;
          usedRefInRequest = Boolean(data.usedReferenceImage);
        }
      } else {
        const err = await res.json().catch(() => ({}));
        logger.error('IMAGE_GEN', `NanoGPT photo utilisateur HTTP ${res.status}: ${err.error || ''}`);
      }
    } catch (e: any) {
      logger.error('IMAGE_GEN', `Erreur NanoGPT photo utilisateur: ${e.message}`, e);
    }
  }

  // 2. OpenRouter
  if (!rawImageUrl && routeToOpenRouter && hasOpenRouterKey) {
    const modelToUse = resolveOpenRouterImageModel(config.imageModel);
    try {
      const res = await fetch('/api/openrouter/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          model: modelToUse,
          mode: 'selfie',
          ...(referenceImage ? { referenceImage } : {}),
          ...(clientOrKey ? { apiKey: clientOrKey } : {}),
        }),
        signal: AbortSignal.timeout(45000),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.imageUrl) {
          rawImageUrl = data.imageUrl;
          providerUsed = `openrouter (${modelToUse})`;
          usedRefInRequest = Boolean(referenceImage);
        }
      } else {
        const err = await res.json().catch(() => ({}));
        logger.error('IMAGE_GEN', `OpenRouter photo utilisateur HTTP ${res.status}: ${err.error || ''}`);
      }
    } catch (e: any) {
      logger.error('IMAGE_GEN', `Erreur OpenRouter photo utilisateur: ${e.message}`, e);
    }
  }

  // 3. Gemini
  if (!rawImageUrl && config.provider === 'gemini' && !routeToNanoGpt && !routeToOpenRouter) {
    try {
      const res = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          aspectRatio: ratio,
          ...(referenceImage ? { referenceImage } : {}),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.imageUrl) {
          rawImageUrl = data.imageUrl;
          providerUsed = 'gemini';
          usedRefInRequest = Boolean(referenceImage);
        }
      }
    } catch (e: any) {
      logger.error('IMAGE_GEN', `Erreur Gemini photo utilisateur: ${e.message}`, e);
    }
  }

  // 4. ComfyUI Local
  if (!rawImageUrl && config.provider === 'comfyui' && config.comfyEndpoint) {
    try {
      const comfyRes = await fetch(`${config.comfyEndpoint}/prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: `aura-user-${Date.now()}`,
          prompt: {
            '3': {
              inputs: {
                seed: faceSeed,
                steps: 24,
                cfg: 7,
                sampler_name: 'euler',
                scheduler: 'normal',
                denoise: 1,
                positive: prompt,
                negative: '',
              },
              class_type: 'KSampler',
            },
          },
        }),
        signal: AbortSignal.timeout(4000),
      });
      if (comfyRes.ok) {
        rawImageUrl = buildFluxFallbackUrl(prompt, ratio, faceSeed);
        providerUsed = 'comfyui';
      }
    } catch {
      // fallback to Flux
    }
  }

  // 5. Fallback Flux
  if (!rawImageUrl) {
    rawImageUrl = buildFluxFallbackUrl(prompt, ratio, faceSeed);
    providerUsed = 'flux';
  }

  // Convert generated image into compressed vision-ready base64 dataUrl so Gemini/OpenRouter/NanoGPT/Groq/Ollama Vision can analyze it directly
  const dataUrlForVision = await compressImageForVision(rawImageUrl, 896, 0.85);

  // Clean up redundant server disk temp image if successfully converted to compressed vision dataUrl
  if (rawImageUrl.startsWith('/api/images/') && dataUrlForVision.startsWith('data:image/')) {
    const filename = rawImageUrl.replace('/api/images/', '').split('?')[0];
    if (filename) {
      fetch(`/api/images/${encodeURIComponent(filename)}`, { method: 'DELETE' }).catch(() => {});
    }
  }

  logger.info('IMAGE_GEN', `Photo utilisateur générée via ${providerUsed}`, {
    usedReferenceImage: usedRefInRequest,
    visionReadyDataUrl: dataUrlForVision.startsWith('data:image/'),
  });

  return {
    imageUrl: dataUrlForVision,
    dataUrlForVision,
    promptUsed: prompt,
    providerUsed,
    usedReferenceImage: usedRefInRequest,
  };
}
