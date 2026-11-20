import { GirlfriendPersona, SelfieConfig, SelfieItem, LLMConfig } from '../types';
import { compressImageForVision, cropFaceAndShouldersForVision } from './imageUtils';
import { logger } from './logger';

export interface GenerateSelfieOptions {
  scenarioTitle: string;
  scenarioSnippet: string;
  customOutfit?: string;
  captionText?: string;
  girlfriendReply?: string;
}

/**
 * Translates age into photography-grade facial maturity descriptors so a 19yo looks distinctly juvenile compared to a 25yo or 30yo
 */
export function getAgeFacialDescriptor(age: number): string {
  if (age <= 19) {
    return `very youthful ${age}-year-old young woman, fresh juvenile facial contours, soft smooth cheeks, youthful college student features, bright energetic young gaze`;
  }
  if (age <= 22) {
    return `fresh young adult ${age}-year-old woman face, radiant youthful facial structure, smooth glowing skin, fresh young beauty`;
  }
  if (age <= 25) {
    return `refined young adult ${age}-year-old woman face, elegant feminine facial contours, graceful charming features`;
  }
  if (age <= 29) {
    return `sophisticated ${age}-year-old woman face, refined mature feminine facial bone structure, elegant poised allure`;
  }
  return `confident mature ${age}-year-old woman face, elegant refined facial contours, graceful womanly presence`;
}

/**
 * Translates French distinguishing features into English photography tokens
 */
export function translateDistinguishingFeatures(features?: string[]): string {
  if (!features || features.length === 0) return '';
  const featureMap: Record<string, string> = {
    'Taches de rousseur': 'natural subtle cute freckles scattered across nose and cheeks',
    'taches de rousseur': 'natural subtle cute freckles scattered across nose and cheeks',
    'Grain de beauté': 'subtle charming beauty mark on cheek',
    'grain de beauté': 'subtle charming beauty mark on cheek',
    'Fossettes': 'cute natural cheek dimples when smiling',
    'fossettes': 'cute natural cheek dimples when smiling',
    'Pommettes saillantes': 'high defined sculpted cheekbones',
    'pommettes saillantes': 'high defined sculpted cheekbones',
    'Lèvres pulpeuses': 'naturally full plump soft lips',
    'lèvres pulpeuses': 'naturally full plump soft lips',
    'Regard expressif et pétillant': 'bright sparkling captivating eyes',
    'Sourire bienveillant et chaleureux': 'warm genuine captivating smile',
    'Mâchoire fine & délicate': 'delicate fine jawline structure',
  };

  return features
    .map(f => featureMap[f] || (f.length > 2 ? `distinctive feature: ${f}` : ''))
    .filter(Boolean)
    .join(', ');
}

/**
 * Translates free-text or French descriptors into clean English tokens for diffusion models
 */
function applyFrenchTokenDictionary(text: string, dictionary: Array<[RegExp, string]>): string {
  let result = ` ${text} `;
  for (const [pattern, replacement] of dictionary) {
    result = result.replace(pattern, ` ${replacement} `);
  }
  return result.replace(/\s+/g, ' ').trim();
}

const FRENCH_COLOR_AND_STYLE_DICT: Array<[RegExp, string]> = [
  [/\btrès\b/gi, 'very'],
  [/\bavec\b/gi, 'with'],
  [/\bsans\b/gi, 'without'],
  [/\breflets?\b/gi, 'highlights'],
  [/\bpoitrine\b/gi, 'chest'],
  [/\bépaules?\b/gi, 'shoulders'],
  [/\bjambes?\b/gi, 'legs'],
  [/\bvisage\b/gi, 'face'],
  [/\byeux\b/gi, 'eyes'],
  [/\bcheveux\b/gi, 'hair'],
  [/\bpeau\b/gi, 'skin'],
  [/\bteint\b/gi, 'complexion'],
  [/\bvert(?:e|s)?\b/gi, 'green'],
  [/\bémeraude\b/gi, 'emerald'],
  [/\bbleu(?:e|s)?\b/gi, 'blue'],
  [/\bciel\b/gi, 'sky'],
  [/\bglacier\b/gi, 'ice'],
  [/\bnoisette\b/gi, 'hazel'],
  [/\bbrun(?:e|s)?\b/gi, 'brown'],
  [/\bchocolat\b/gi, 'chocolate'],
  [/\bchâtain\b/gi, 'chestnut brown'],
  [/\bblond(?:e|s)?\b/gi, 'blonde'],
  [/\bdoré(?:e|s)?\b/gi, 'golden'],
  [/\bmiel\b/gi, 'honey'],
  [/\bplatine\b/gi, 'platinum'],
  [/\bpolaire\b/gi, 'icy'],
  [/\bcendré(?:e|s)?\b/gi, 'ash'],
  [/\bnoir(?:e|s)?\b/gi, 'black'],
  [/\bcorbeau\b/gi, 'raven'],
  [/\broux|rousse\b/gi, 'copper red'],
  [/\bcuivré(?:e|s)?\b/gi, 'copper'],
  [/\bblanc(?:he|s)?\b/gi, 'white'],
  [/\bgris(?:e|s)?\b/gi, 'gray'],
  [/\bardoise\b/gi, 'slate'],
  [/\bambre\b/gi, 'amber'],
  [/\brouge(?:s)?\b/gi, 'red'],
  [/\brose(?:s)?\b/gi, 'pink'],
  [/\blilas\b/gi, 'lilac'],
  [/\bpourpre(?:s)?\b/gi, 'purple'],
  [/\bviolet(?:te|s)?\b/gi, 'violet'],
  [/\bbeige(?:s)?\b/gi, 'beige'],
  [/\bpastel\b/gi, 'pastel'],
  [/\bclaire?\b/gi, 'fair'],
  [/\bpâle\b/gi, 'pale'],
  [/\bporcelaine\b/gi, 'porcelain'],
  [/\bhâlée?\b/gi, 'sun-kissed tanned'],
  [/\bmétisse\b/gi, 'mixed heritage'],
  [/\bambrée?\b/gi, 'warm amber'],
  [/\bébène\b/gi, 'deep ebony'],
  [/\blongs?\b/gi, 'long'],
  [/\bmi-longs?\b/gi, 'shoulder-length'],
  [/\bcourts?\b/gi, 'short'],
  [/\blisses?\b/gi, 'straight sleek'],
  [/\bondulés?|ondulations\b/gi, 'soft wavy'],
  [/\bbouclés?|boucles\b/gi, 'curly'],
  [/\bfrange\b/gi, 'bangs'],
  [/\bcarré\b/gi, 'bob haircut'],
  [/\bchignon\b/gi, 'bun updo'],
  [/\bqueue de cheval\b/gi, 'ponytail'],
  [/\btresses?\b/gi, 'braided'],
];

const FRENCH_OUTFIT_AND_TRAITS_DICT: Array<[RegExp, string]> = [
  ...FRENCH_COLOR_AND_STYLE_DICT,
  [/\brobe\b/gi, 'dress'],
  [/\bjupe\b/gi, 'skirt'],
  [/\bmini-jupe\b/gi, 'mini skirt'],
  [/\bchemise\b/gi, 'button-up shirt'],
  [/\bchemisier\b/gi, 'blouse'],
  [/\bjeans?\b/gi, 'jeans'],
  [/\bpantalon\b/gi, 'trousers'],
  [/\bshort\b/gi, 'shorts'],
  [/\bsweat(?:-shirt)?\b/gi, 'cozy sweatshirt'],
  [/\bpull\b/gi, 'knit sweater'],
  [/\bveste\b/gi, 'jacket'],
  [/\bblouson\b/gi, 'jacket'],
  [/\bcuir\b/gi, 'leather'],
  [/\bblazer\b/gi, 'tailored blazer'],
  [/\blaine\b/gi, 'wool'],
  [/\blin\b/gi, 'linen'],
  [/\bsoie\b/gi, 'silk'],
  [/\bsatin\b/gi, 'satin'],
  [/\bdentelle\b/gi, 'lace'],
  [/\bvelours\b/gi, 'velvet'],
  [/\bdébardeur\b/gi, 'tank top'],
  [/\bhaut\b/gi, 'top'],
  [/\bmoulant(?:e|s)?\b/gi, 'fitted'],
  [/\bample\b/gi, 'loose flowing'],
  [/\bouvert(?:e|s)?\b/gi, 'open'],
  [/\bdécolleté(?:e|s)?\b/gi, 'v-neck'],
  [/\bélégant(?:e|s)?\b/gi, 'elegant'],
  [/\bchic\b/gi, 'chic'],
  [/\bdécontracté(?:e|s)?\b/gi, 'casual'],
  [/\bsoirée\b/gi, 'evening'],
  [/\bété\b/gi, 'summer'],
  [/\boversize\b/gi, 'oversized'],
  [/\bd'intérieur\b/gi, 'loungewear'],
  [/\bsur\b/gi, 'on'],
  [/\btaches de rousseur\b/gi, 'natural freckles'],
  [/\bfossettes\b/gi, 'cute cheek dimples'],
  [/\bgrain de beauté\b/gi, 'subtle beauty mark'],
  [/\bpommette\b/gi, 'cheekbone'],
  [/\bnez\b/gi, 'nose'],
  [/\blunettes(?:\s+fines)?\b/gi, 'stylish delicate glasses'],
  [/\btatouages?\b/gi, 'artistic tattoo'],
  [/\bpiercing\b/gi, 'subtle piercing'],
  [/\blèvres pulpeuses\b/gi, 'full soft lips'],
  [/\bsourire\b/gi, 'smile'],
  [/\bregard\b/gi, 'gaze'],
  [/\bcomplice\b/gi, 'warm playful'],
  [/\bmaquillage\b/gi, 'makeup'],
  [/\bdiscrètes?\b/gi, 'subtle'],
  [/\bpetit(?:e|s)?\b/gi, 'small'],
  [/\ballongée?\b/gi, 'lying down'],
  [/\bassise\b/gi, 'sitting'],
  [/\bdebout\b/gi, 'standing'],
  [/\blumière\b/gi, 'lighting'],
  [/\btamisée?\b/gi, 'dim warm cozy'],
  [/\bbougies?\b/gi, 'candlelight'],
  [/\bcheminée\b/gi, 'fireplace'],
  [/\bchambre\b/gi, 'bedroom'],
  [/\bsalon\b/gi, 'living room'],
  [/\bcanapé\b/gi, 'sofa'],
  [/\blit\b/gi, 'bed'],
  [/\bterrasse\b/gi, 'outdoor cafe terrace'],
  [/\bcafé\b/gi, 'coffee shop'],
  [/\bplage\b/gi, 'beach'],
  [/\bmer\b/gi, 'sea'],
  [/\bforêt\b/gi, 'forest'],
  [/\brue\b/gi, 'street'],
  [/\bnuit\b/gi, 'nighttime'],
  [/\bsoir\b/gi, 'evening'],
  [/\bmatin\b/gi, 'morning'],
  [/\bcoucher de soleil\b/gi, 'golden sunset'],
  [/\bpluie\b/gi, 'rainy'],
  [/\bfenêtre\b/gi, 'window'],
  [/\bmiroir\b/gi, 'mirror'],
  [/\bverre\b/gi, 'glass'],
  [/\bvin\b/gi, 'wine'],
  [/\bguitare\b/gi, 'guitar'],
  [/\blivre\b/gi, 'book'],
  [/\bappareil photo\b/gi, 'camera'],
  [/\bdans\b/gi, 'in'],
  [/\bdevant\b/gi, 'in front of'],
  [/\bsous\b/gi, 'under'],
  [/\bpyjamas?\b/gi, 'cozy pajamas'],
  [/\bnuisette\b/gi, 'silk camisole nightgown'],
  [/\bpeignoir\b/gi, 'soft plush bathrobe'],
  [/\bserviette\b/gi, 'bath towel'],
  [/\bjogging\b/gi, 'comfy joggers and hoodie'],
  [/\btasse\s+(?:de\s+)?café\b/gi, 'coffee mug'],
  [/\bcafé\s+à\s+la\s+main\b/gi, 'holding a warm coffee mug in hand'],
  [/\bà\s+la\s+main\b/gi, 'in hand'],
  [/\bcheveux\s+en\s+bataille\b/gi, 'messy tousled bedhead hair'],
  [/\ben\s+bataille\b/gi, 'messy tousled'],
  [/\bdécoiffée?s?\b/gi, 'tousled messy'],
  [/\bmouillée?s?\b/gi, 'damp wet'],
  [/\btout\s+gris\b/gi, 'overcast gray cloudy'],
  [/\bderrière\b/gi, 'outside behind'],
  [/\bcouette\b/gi, 'fluffy duvet'],
  [/\bplaid\b/gi, 'cozy throw blanket'],
  [/\bthé\b/gi, 'hot tea'],
  [/\bappartement\b/gi, 'cozy apartment'],
  [/\bcuisine\b/gi, 'kitchen'],
  [/\bmaison\b/gi, 'home'],
  [/\bcosy\b/gi, 'cozy'],
];

export function translateOutfitToEnglish(outfit?: string): string {
  const raw = (outfit || '').trim();
  if (!raw) return 'stylish casual top and jeans';
  const presetMap: Record<string, string> = {
    'Haut décontracté chic & jeans': 'stylish Parisian casual chic top and fitted jeans',
    'Robe élégante en lin pastel': 'elegant pastel linen sundress',
    'Sweat d’intérieur oversize cozy': 'cozy oversized knit loungewear sweatshirt',
    "Sweat d'intérieur oversize cozy": 'cozy oversized knit loungewear sweatshirt',
    'Pyjama cosy & débardeur': 'cozy soft homewear pajamas and tank top',
    'Pyjama doux d’intérieur': 'soft comfortable indoor pajamas',
    "Pyjama doux d'intérieur": 'soft comfortable indoor pajamas',
  };
  if (presetMap[raw]) return presetMap[raw];
  return applyFrenchTokenDictionary(raw, FRENCH_OUTFIT_AND_TRAITS_DICT);
}

/**
 * Extracts explicit clothing, hair state, and visual scene details from the girlfriend's chat reply
 * so the generated selfie stays 100% visually coherent with what she just described.
 */
function extractVisualOverridesFromReply(replyText?: string, sceneText?: string): {
  outfitOverride?: string;
  hairStyleOverride?: string;
  cleanedReplyScene: string;
} {
  const rawReply = (replyText || '').trim();
  const combinedSource = `${rawReply} ${sceneText || ''}`.trim();

  let outfitOverride: string | undefined;
  const outfitSource = rawReply || (sceneText || '').trim();
  if (outfitSource) {
    if (/\bpyjamas?\b/i.test(outfitSource)) {
      const detailedMatch = outfitSource.match(/\b(pyjama[^.!?\n,;]{0,45})/i);
      outfitOverride = detailedMatch ? detailedMatch[1].trim() : 'Pyjama cosy d’intérieur';
    } else if (/\bnuisette\b/i.test(outfitSource)) {
      const detailedMatch = outfitSource.match(/\b(nuisette[^.!?\n,;]{0,40})/i);
      outfitOverride = detailedMatch ? detailedMatch[1].trim() : 'Nuisette en soie délicate';
    } else if (/\bpeignoir\b/i.test(outfitSource)) {
      outfitOverride = 'Peignoir doux d’intérieur';
    } else if (/\bserviette\b/i.test(outfitSource)) {
      outfitOverride = 'Enroulée dans une serviette de bain';
    } else if (/\b(?:jogging|survêtement)\b/i.test(outfitSource)) {
      outfitOverride = 'Jogging confortable & haut détente';
    } else if (/\b(?:tenue de sport|legging|brassière|sportswear)\b/i.test(outfitSource)) {
      outfitOverride = 'Tenue de sport & fitness';
    } else if (/\b(?:sweat|hoodie)\b/i.test(outfitSource)) {
      outfitOverride = 'Sweat d’intérieur oversize cozy';
    } else if (/\b(?:robe\s+d['’]?intérieur|robe\s+noire|robe\s+légère|petite\s+robe|en\s+robe)\b/i.test(outfitSource)) {
      const robeMatch = outfitSource.match(/\b(robe[^.!?\n,;]{0,35})/i);
      outfitOverride = robeMatch ? robeMatch[1].trim() : 'Robe légère';
    } else if (/\b(?:maillot de bain|bikini)\b/i.test(outfitSource)) {
      outfitOverride = 'Maillot de bain';
    }
  }

  let hairStyleOverride: string | undefined;
  if (/\b(?:cheveux\s+en\s+bataille|cheveux\s+décoiffés|toute\s+décoiffée|tête\s+du\s+matin)\b/i.test(combinedSource)) {
    hairStyleOverride = 'messy tousled morning bedhead hair';
  } else if (/\b(?:cheveux\s+mouillés|cheveux\s+humides)\b/i.test(combinedSource)) {
    hairStyleOverride = 'damp wet just-showered hair';
  } else if (/\bchignon\b/i.test(combinedSource)) {
    hairStyleOverride = 'casual loose messy bun updo';
  } else if (/\bqueue de cheval\b/i.test(combinedSource)) {
    hairStyleOverride = 'casual ponytail';
  }

  // Keep action descriptions (*...*) as plain text while cleaning emojis and conversational tail questions
  const cleanedReplyScene = rawReply
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
    .replace(/\b(?:tu es sûr de vouloir voir ça|tu veux voir|ça te pla[îi]t|avec plaisir,? mais tu vas être déçu)\b[^.?!]*[.?!]?/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  return { outfitOverride, hairStyleOverride, cleanedReplyScene };
}

export function translateCustomTraitsToEnglish(customTraits?: string): string {
  const raw = (customTraits || '').trim();
  if (!raw) return '';
  return applyFrenchTokenDictionary(raw, FRENCH_OUTFIT_AND_TRAITS_DICT);
}

/**
 * Translates personality tone, passions/soul traits, occupation & bio cues into concrete visual aura for portraits
 */
export function translatePersonalityToVisualAura(girlfriend: GirlfriendPersona): string {
  const parts: string[] = [];

  const toneMap: Record<string, string> = {
    affectionate: 'warm tender affectionate expression, soft loving eyes, natural inviting warmth',
    teasing: 'playful teasing smile, bright mischievous sparkling eyes, lively spirited charm',
    rebel: 'edgy rebellious rock attitude, bold fearless gaze, slightly tousled hair, confident half-smirk',
    gothic: 'mysterious dark gothic romantic aura, subtle dark eyeliner, moody artistic lighting, intense enigmatic gaze',
    possessive: 'passionate intense captivating gaze, magnetic alluring warmth, intimate closeness',
    dominant: 'confident commanding gaze, poised charismatic posture, sleek self-assured expression',
    poetic: 'dreamy thoughtful soulful eyes, artistic gentle serenity, soft cinematic daylight',
    shy: 'sweet bashful soft smile, delicate natural cheek blush, gentle tender shy eyes',
  };
  if (girlfriend.speechStyle?.tone && toneMap[girlfriend.speechStyle.tone]) {
    parts.push(toneMap[girlfriend.speechStyle.tone]);
  }

  const passionMap: Record<string, string> = {
    "Passionnée de cinéma & séries d'auteur": 'cinematic artistic mood',
    'Amoureuse de musique & concerts live': 'indie music lover vibe',
    'Gourmande & cuisine maison': 'warm cozy lifestyle charm',
    'Créatrice de jeux vidéo & tech': 'modern creative tech vibe',
    'Lectrice passionnée & poésie': 'thoughtful intellectual elegance',
    'Amie des chats & animaux': 'gentle sweet warm aura',
    'Noctambule & balades sous les étoiles': 'atmospheric evening city light ambiance',
    'Passionnée de photo argentique': 'authentic 35mm analog film aesthetic',
    'Amoureuse de mode vintage & friperies': 'curated vintage chic fashion taste',
    'Sportive & séances yoga/fitness': 'healthy toned radiant wellness glow',
    'Accro aux cafés en terrasse': 'charming Parisian cafe lifestyle glow',
    'Voyageuse & nouvelles cultures': 'sunlit adventurous worldly glow',
  };

  if (Array.isArray(girlfriend.soulTraits) && girlfriend.soulTraits.length > 0) {
    const mappedTraits = girlfriend.soulTraits
      .map(t => passionMap[t] || applyFrenchTokenDictionary(t, FRENCH_OUTFIT_AND_TRAITS_DICT))
      .filter(Boolean);
    if (mappedTraits.length > 0) {
      parts.push(mappedTraits.join(', '));
    }
  }

  if (girlfriend.occupation && girlfriend.occupation.trim()) {
    const translatedOcc = applyFrenchTokenDictionary(girlfriend.occupation.trim(), FRENCH_OUTFIT_AND_TRAITS_DICT);
    parts.push(`${translatedOcc} vibe`);
  }

  return parts.filter(Boolean).join(', ');
}

export function constructSelfiePrompt(
  girlfriend: GirlfriendPersona,
  options: GenerateSelfieOptions,
  aspectRatio: '3:4' | '9:16' | '1:1' = '3:4'
): { prompt: string; negativePrompt: string } {
  const { distinguishingFeatures, currentOutfitStyle, bodyProfile } = girlfriend.appearance;
  const overrides = extractVisualOverridesFromReply(options.girlfriendReply, options.scenarioSnippet);
  const effectiveOutfitRaw = options.customOutfit || overrides.outfitOverride || currentOutfitStyle;
  const outfit = translateOutfitToEnglish(effectiveOutfitRaw);

  const ageDescriptor = getAgeFacialDescriptor(girlfriend.age);
  const morphologyDetails = translateMorphologyToEnglish(bodyProfile);
  const faceFeatures = translateFaceFeaturesToEnglish(girlfriend.appearance, overrides.hairStyleOverride);
  const featuresText = translateDistinguishingFeatures(distinguishingFeatures);

  // Translate French scene snippet (and girlfriend's own reply description when available)
  const rawSceneSource = overrides.cleanedReplyScene
    ? `${overrides.cleanedReplyScene}${options.scenarioSnippet ? `, ${options.scenarioSnippet}` : ''}`
    : (options.scenarioSnippet || 'candid authentic smile into phone camera').trim();
  const translatedScene = applyFrenchTokenDictionary(rawSceneSource, FRENCH_OUTFIT_AND_TRAITS_DICT);

  // Put exact current face/hair/eyes + current scene/outfit FIRST so visual coherence always wins!
  const identityCore = `Authentic raw candid photograph of ${girlfriend.age}-year-old woman named ${girlfriend.name}, ${ageDescriptor}, ${faceFeatures}`;
  const faceDetails = [
    identityCore,
    featuresText ? `facial details: ${featuresText}` : '',
  ].filter(Boolean).join(', ');

  const sceneDetails = `${translatedScene}, wearing ${outfit}, tastefully clothed`;
  const isSpecificIndoorOrOverrideScene = Boolean(
    overrides.cleanedReplyScene ||
    options.customOutfit ||
    /\b(pyjama|lit|bed|couette|duvet|douche|shower|towel|serviette|gym|workout|cuisine|kitchen|chambre|bedroom|fenêtre|window|maison|home|canapé|sofa)\b/i.test(rawSceneSource)
  );
  // Avoid letting unrelated hobbies (like "Parisian cafe") pull an indoor pajama selfie into a sunny outdoor cafe
  const personalityAura = isSpecificIndoorOrOverrideScene ? '' : translatePersonalityToVisualAura(girlfriend);

  const framing = aspectRatio === '3:4'
    ? 'candid RAW upper-body medium portrait selfie, 3:4 ratio'
    : 'candid vertical smartphone selfie photo';
  const cameraDetails = `realistic photograph, ${framing}, authentic candid glance, natural lighting, realistic skin texture with natural pores, 35mm film photography style, sharp eye focus`;

  const backgroundOverrideInstruction = 'Preserve strictly and exclusively the face, facial features, eyes, hair color, and likeness from the reference portrait photo. IGNORE and completely replace the background, environment, and clothing of the reference image, adopting ONLY the clothing and setting specified in this prompt.';
  const prompt = [backgroundOverrideInstruction, faceDetails, sceneDetails, morphologyDetails, personalityAura, cameraDetails].filter(Boolean).join(', ');

  return { prompt, negativePrompt: 'deformed, cartoon, anime, illustration, 3d render, plastic skin, doll, extra fingers, disfigured, blurry face, carrying over bar background' };
}

/**
 * Translates French user-facing criteria into photography-grade English tokens
 */
function translateMorphologyToEnglish(bodyProfile?: GirlfriendPersona['appearance']['bodyProfile']): string {
  if (!bodyProfile) return '';

  const ethnicityMap: Record<string, string> = {
    'Caucasienne / Européenne': 'authentic European Caucasian heritage, refined European facial features',
    'Asiatique (Japonaise/Coréenne)': 'authentic East Asian Japanese/Korean heritage, delicate almond-shaped eyes, soft Asian facial contours',
    'Latina / Métisse ambrée': 'authentic Latina Hispanic warm amber heritage, expressive warm facial features, full soft lips',
    'Afro / Ébène sculptée': 'authentic Black African heritage, radiant rich ebony complexion, sculpted cheekbones, full lips',
    'Moyen-Orientale / Méditerranéenne': 'authentic Mediterranean Middle Eastern heritage, warm olive complexion, defined almond eyes',
    'Scandinave / Nordique': 'authentic Scandinavian Nordic heritage, high cheekbones, clear fair Nordic features',
  };

  const heightMap: Record<string, string> = {
    petite: 'petite 155cm delicate stature',
    moyenne: 'medium 165cm natural height',
    grande: 'tall 175cm slender height',
  };

  const bodyMap: Record<string, string> = {
    fine: 'slender slim feminine silhouette',
    petite: 'petite delicate slim build',
    athletique: 'fit toned athletic feminine physique',
    generouse: 'soft curvy feminine figure with gentle curves',
    pulpeuse: 'curvy voluptuous feminine silhouette',
    sablier: 'defined hourglass silhouette with narrow waist and curves',
  };

  const bustMap: Record<string, string> = {
    petite: 'petite small delicate bust',
    moyenne: 'natural medium bust',
    generouse: 'full generous curvy bust',
    voluptueuse: 'voluptuous full bust',
  };

  const attitudeMap: Record<string, string> = {
    'Souriante & lumineuse': 'warm radiant genuine smile, bright friendly eye contact',
    'Pétillante & taquine': 'playful teasing smile, sparkling lively eyes',
    'Mystérieuse & magnétique': 'mysterious captivating gaze, alluring enigmatic look',
    'Charismatique & affirmée': 'confident charismatic gaze, magnetic poise',
    'Sérieuse & intellectuelle': 'thoughtful serene focused gaze, subtle composed smile',
    'Blasée & rebelle rock': 'cool rebellious half-smirk, intense direct gaze',
    'Douce & timide': 'sweet tender shy smile, affectionate gentle look',
  };

  const styleMap: Record<string, string> = {
    'Soigné & élégant chic': 'refined Parisian chic elegant fashion taste',
    'Soigné, chic & élégant': 'refined Parisian chic elegant fashion taste',
    'Teen look / Casual branché': 'trendy youthful casual modern streetwear style',
    'Négligé cosy décontracté': 'relaxed effortless cozy casual aesthetic',
    'Négligé doux / Homewear cozy': 'relaxed effortless cozy homewear aesthetic',
    'Streetwear rock & cuir': 'edgy rock streetwear fashion with dark leather vibe',
    'Streetwear sombre / Rock gothique': 'edgy dark alternative rock gothic fashion',
    'Riche & haute couture': 'luxurious haute couture designer glamour style',
    'Riche, glamour & luxe': 'luxurious haute couture designer glamour style',
    'Bohème chic en lin': 'bohemian chic natural linen fashion taste',
    'Bohème & naturel': 'bohemian natural relaxed style',
    'Rétro vintage 90s': 'authentic 90s retro vintage fashion aesthetic',
  };

  const eth = ethnicityMap[bodyProfile.ethnicity] || applyFrenchTokenDictionary(bodyProfile.ethnicity || '', FRENCH_COLOR_AND_STYLE_DICT);
  const hgt = heightMap[bodyProfile.height] || '';
  const bdy = bodyMap[bodyProfile.bodyType] || '';
  const bst = bustMap[bodyProfile.bustSize] || '';
  const att = attitudeMap[bodyProfile.generalAttitude] || applyFrenchTokenDictionary(bodyProfile.generalAttitude || '', FRENCH_OUTFIT_AND_TRAITS_DICT);
  const sty = styleMap[bodyProfile.mainStyle] || applyFrenchTokenDictionary(bodyProfile.mainStyle || '', FRENCH_OUTFIT_AND_TRAITS_DICT);
  const custom = bodyProfile.customTraits ? translateCustomTraitsToEnglish(bodyProfile.customTraits) : '';

  return [eth, hgt, bdy, bst, att, sty, custom].filter(Boolean).join(', ');
}

function translateFaceFeaturesToEnglish(
  appearance: GirlfriendPersona['appearance'],
  hairStyleOverride?: string
): string {
  const eyeMap: Record<string, string> = {
    'Vert émeraude': 'vivid emerald green eyes',
    'Vert émeraude pétillant': 'bright sparkling emerald green eyes',
    'Noisette doré': 'warm golden hazel eyes',
    'Noisette doré chaleureux': 'warm golden hazel eyes',
    'Bleu ciel profond': 'vivid deep sky blue eyes',
    'Bleu ciel': 'bright sky blue eyes',
    'Bleu glacier perçant': 'piercing glacial ice blue eyes',
    'Bleu glacier': 'glacial ice blue eyes',
    'Brun chocolat': 'warm dark chocolate brown eyes',
    'Brun chocolat intense': 'intense dark chocolate brown eyes',
    'Brun ténébreux': 'intense dark brown eyes',
    'Gris ardoise': 'slate gray eyes',
    'Gris ardoise magnétique': 'magnetic slate gray eyes',
    'Ambre': 'warm amber golden eyes',
    'Ambre étincelant': 'sparkling golden amber eyes',
  };

  const hairStyleMap: Record<string, string> = {
    'Ondulations douces mi-longues': 'shoulder-length soft wavy hair',
    'Longs lisses soyeux avec frange': 'long straight silky hair with fringe bangs',
    'Longs lisses avec frange': 'long straight hair with fringe bangs',
    'Carré flou déstructuré (Bob)': 'textured messy bob haircut',
    'Carré flou déstructuré': 'textured messy bob haircut',
    'Queue de cheval haute & mèches': 'high ponytail with loose face-framing strands',
    'Boucles aériennes volumineuses': 'voluminous bouncy curly hair',
    'Boucles aériennes': 'soft bouncy curly hair',
    'Chignon messy casual chic': 'casual chic messy bun updo with loose strands',
    'Chignon messy casual': 'casual messy bun hair with loose strands',
    'Mi-longs dégradés wavy': 'medium-length layered wavy hair',
    'Tresses bohèmes élégantes': 'elegant bohemian braided hair',
    'Coupe courte pixie rock': 'short textured rock pixie haircut',
    'Coupe déstructurée rock': 'textured edgy layered haircut',
  };

  const hairColorMap: Record<string, string> = {
    'Blond miel doré': 'honey golden blonde hair',
    'Blond doré miel': 'honey golden blonde hair with warm highlights',
    'Blond platine / polaire': 'icy platinum blonde hair',
    'Blond platine polaire': 'icy platinum blonde hair',
    'Blond polaire': 'icy platinum blonde hair',
    'Blond cendré naturel': 'natural ash blonde hair',
    'Blond cendré': 'natural ash blonde hair',
    'Châtain clair avec reflets caramel': 'light chestnut brown hair with caramel highlights',
    'Châtain clair reflets caramel': 'light chestnut brown hair with caramel highlights',
    'Châtain caramel': 'light chestnut brown hair with caramel highlights',
    'Brun chocolat profond': 'deep rich dark chocolate brown hair',
    'Brun chocolat': 'warm dark chocolate brown hair',
    'Brun profond': 'deep rich brunette dark brown hair',
    'Noir corbeau soyeux': 'silky raven black hair',
    'Noir corbeau': 'natural raven black hair',
    'Noir corbeau profond': 'natural raven black hair',
    'Roux cuivré flamboyant': 'vibrant fiery copper red hair',
    'Roux cuivré naturel': 'natural copper auburn red hair',
    'Roux cuivré': 'natural copper red hair',
    'Auburn reflets pourpres': 'deep auburn hair with subtle purple sheen',
    'Auburn': 'deep auburn hair',
    'Pastel reflets lilas/rose': 'pastel pink and soft lilac dyed hair',
  };

  const skinToneMap: Record<string, string> = {
    'Claire et lumineuse': 'fair radiant natural human skin with subtle pores',
    'Claire lumineuse': 'fair radiant natural human skin with subtle pores',
    'Pâle porcelaine délicate': 'delicate pale porcelain natural skin with fine pores',
    'Pâle porcelaine': 'pale porcelain natural skin with fine pores',
    'Pêche dorée naturelle': 'warm golden peach skin with natural pores',
    'Pêche dorée': 'warm golden peach skin with natural pores',
    'Hâlée naturelle ensoleillée': 'sun-kissed tanned warm natural skin',
    'Hâlée naturelle': 'sun-kissed natural skin',
    'Hâlée': 'sun-kissed natural skin',
    'Métisse ambrée soyeuse': 'silky radiant warm amber skin with natural pores',
    'Métisse ambrée': 'radiant warm amber skin',
    'Ébène veloutée sculptée': 'rich deep velvety ebony radiant skin with natural pores',
    'Ébène soyeuse': 'rich deep ebony radiant skin',
  };

  const rawEye = (appearance.eyeColor || '').trim();
  const rawStyle = (appearance.hairStyle || '').trim();
  const rawColor = (appearance.hairColor || '').trim();
  const rawSkin = (appearance.skinTone || '').trim();

  const eye = eyeMap[rawEye] || applyFrenchTokenDictionary(rawEye || 'brown eyes', FRENCH_COLOR_AND_STYLE_DICT);
  const hStyle = hairStyleOverride || hairStyleMap[rawStyle] || applyFrenchTokenDictionary(rawStyle || 'wavy hair', FRENCH_COLOR_AND_STYLE_DICT);
  const hColor = hairColorMap[rawColor] || applyFrenchTokenDictionary(rawColor || 'chestnut hair', FRENCH_COLOR_AND_STYLE_DICT);
  const skin = skinToneMap[rawSkin] || applyFrenchTokenDictionary(rawSkin || 'natural skin', FRENCH_COLOR_AND_STYLE_DICT);

  return `${eye}, ${hStyle}, ${hColor}, ${skin}`;
}

/**
 * Compiles a clean, up-to-date English visual anchor from ALL current attributes of a persona.
 * Never carries over stale fields from a previous portrait!
 */
export function compileVisualAnchorPrompt(girlfriend: GirlfriendPersona): string {
  const faceFeatures = translateFaceFeaturesToEnglish(girlfriend.appearance);
  const morphology = translateMorphologyToEnglish(girlfriend.appearance.bodyProfile);
  const outfit = translateOutfitToEnglish(girlfriend.appearance.currentOutfitStyle);
  const personalityAura = translatePersonalityToVisualAura(girlfriend);

  return [
    `Candid portrait of ${girlfriend.name}, ${girlfriend.age}-year-old woman`,
    faceFeatures,
    morphology,
    `wearing ${outfit}`,
    personalityAura,
  ].filter(Boolean).join(', ');
}

/**
 * Computes or retrieves a deterministic face seed for the girlfriend.
 * Includes ALL physical, clothing, and personality criteria so changing ANY attribute produces a distinct seed.
 */
export function getPersonaFaceSeed(girlfriend: GirlfriendPersona, variationNonce: number = 0): number {
  if (girlfriend.appearance.faceSeed && girlfriend.appearance.faceSeed > 0 && variationNonce === 0) {
    return girlfriend.appearance.faceSeed;
  }
  let hash = 0;
  const p = girlfriend.appearance.bodyProfile;
  const str = [
    girlfriend.id || 'gf',
    girlfriend.name,
    girlfriend.age,
    girlfriend.occupation || '',
    girlfriend.speechStyle?.tone || '',
    (girlfriend.soulTraits || []).join('|'),
    girlfriend.appearance.eyeColor,
    girlfriend.appearance.hairColor,
    girlfriend.appearance.hairStyle,
    girlfriend.appearance.skinTone,
    girlfriend.appearance.currentOutfitStyle,
    p?.ethnicity || '',
    p?.height || '',
    p?.bodyType || '',
    p?.bustSize || '',
    p?.generalAttitude || '',
    p?.mainStyle || '',
    p?.customTraits || '',
    (girlfriend.appearance.distinguishingFeatures || []).join(''),
    variationNonce > 0 ? String(variationNonce) : '',
  ].join('-');
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return (Math.abs(hash) % 8999999) + 1000000;
}

/**
 * Builds an authentic Pollinations Flux AI URL with deterministic facial seed
 */
export function buildFluxImageUrl(
  prompt: string, 
  negativePrompt: string = '',
  aspectRatio: '3:4' | '9:16' | '1:1' = '3:4',
  fixedSeed?: number
): string {
  const width = aspectRatio === '1:1' ? 1024 : 768;
  const height = aspectRatio === '1:1' ? 1024 : aspectRatio === '3:4' ? 1024 : 1365;
  const encoded = encodeURIComponent(prompt);
  const seed = fixedSeed && fixedSeed > 0 ? fixedSeed : Math.floor(Math.random() * 9999999);
  return `https://image.pollinations.ai/prompt/${encoded}?width=${width}&height=${height}&seed=${seed}&model=flux&nologo=true`;
}

function resolveOpenRouterImageModel(model?: string): string {
  const trimmed = (model || '').trim();
  if (!trimmed || !trimmed.includes('/') || trimmed.startsWith('openrouter/auto')) {
    return 'google/gemini-2.5-flash-image';
  }
  return trimmed;
}

function resolveNanoGptImageModel(model?: string): string {
  const trimmed = (model || '').trim();
  if (!trimmed || trimmed === 'flux' || trimmed.startsWith('gemini-') || trimmed.includes('/')) {
    return 'qwen-image';
  }
  return trimmed;
}

async function hasServerKeyFor(provider: 'openrouter' | 'nanogpt', configuredKey?: string): Promise<boolean> {
  if (configuredKey && configuredKey.trim()) return true;
  try {
    const res = await fetch('/api/keys');
    if (res.ok) {
      const data = await res.json();
      if (provider === 'openrouter') return Boolean(data.hasOpenRouterKey);
      if (provider === 'nanogpt') return Boolean(data.hasNanoGptKey);
    }
  } catch {
    // ignore
  }
  return false;
}

export interface PortraitGenerationResult {
  status: 'success' | 'needs_openrouter_config';
  url?: string;
  providerUsed?: 'gemini' | 'openrouter' | 'nanogpt' | 'flux';
  geminiError?: string;
  openRouterError?: string;
}

/**
 * Protocole exact de génération du portrait initial :
 * - SI une clé OpenRouter ou NanoGPT est saisie/configurée -> ON OUBLIE Gemini (.env) et on passe DIRECTEMENT
 *   à NanoGPT ou OpenRouter selon le modèle/fournisseur configuré (+ repli FluxAI si besoin).
 * - SINON (aucune clé OpenRouter/NanoGPT) -> 1. Gemini (.env), 2. Demande de configuration Cloud, 3. FluxAI.
 *
 * IMPORTANT : Le prompt est compilé à 100% depuis les champs ACTUELS (sans jamais réinjecter d'ancien faceAnchorPrompt).
 */
export async function generateInitialPortraitWithProtocol(
  girlfriend: GirlfriendPersona,
  userExtraPrompt?: string,
  aspectRatio: '3:4' | '9:16' = '3:4',
  config?: SelfieConfig,
  skipConfigPrompt: boolean = false,
  variationNonce: number = 0,
  llmConfig?: LLMConfig
): Promise<PortraitGenerationResult> {
  const { name, age, occupation, soulTraits, relationshipStatus } = girlfriend;
  const { currentOutfitStyle, bodyProfile, distinguishingFeatures } = girlfriend.appearance;

  const ageDescriptor = getAgeFacialDescriptor(age);
  const morphologyDetails = translateMorphologyToEnglish(bodyProfile);
  const faceFeatures = translateFaceFeaturesToEnglish(girlfriend.appearance);
  const featuresText = translateDistinguishingFeatures(distinguishingFeatures);
  const personalityAura = translatePersonalityToVisualAura(girlfriend);
  const outfitEn = translateOutfitToEnglish(currentOutfitStyle);

  const framing = aspectRatio === '3:4'
    ? 'candid portrait photograph, upper-body shot, 3:4 vertical portrait'
    : 'vertical portrait photograph, 9:16 ratio';

  const clothingAnchors = `wearing ${outfitEn}, tastefully fully clothed`;
  const sceneDetail = userExtraPrompt?.trim()
    ? applyFrenchTokenDictionary(userExtraPrompt.trim(), FRENCH_OUTFIT_AND_TRAITS_DICT)
    : 'looking into camera lens';

  const photoRealismAnchors = 'photorealistic raw 35mm photography, natural skin pores, soft daylight, sharp eyes, NOT 3D render, NOT anime, NOT CGI';

  const fallbackPrompt = [
    `${framing} of a real ${age}-year-old woman named ${name}`,
    faceFeatures,
    clothingAnchors,
    morphologyDetails,
    personalityAura,
    featuresText,
    `age maturity: ${ageDescriptor}`,
    `setting: ${sceneDetail}`,
    photoRealismAnchors,
  ].filter(Boolean).join(', ');

  // Tier 1 : Traduction LLM intelligente en anglais de TOUS les champs saisis en français
  let prompt = fallbackPrompt;
  let translatedVia = 'dictionnaire-local';
  try {
    const compileRes = await fetch('/api/compile-portrait-prompt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        persona: {
          name,
          age,
          relationshipStatus,
          occupation,
          tone: girlfriend.speechStyle?.tone,
          soulTraits,
          ethnicity: bodyProfile?.ethnicity,
          height: bodyProfile?.height,
          bodyType: bodyProfile?.bodyType,
          bustSize: bodyProfile?.bustSize,
          generalAttitude: bodyProfile?.generalAttitude,
          mainStyle: bodyProfile?.mainStyle,
          hairStyle: girlfriend.appearance.hairStyle,
          hairColor: girlfriend.appearance.hairColor,
          eyeColor: girlfriend.appearance.eyeColor,
          skinTone: girlfriend.appearance.skinTone,
          customTraits: bodyProfile?.customTraits,
          distinguishingFeatures,
          currentOutfitStyle,
          userExtraPrompt: userExtraPrompt?.trim() || '',
          aspectRatio,
        },
        llmConfig,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (compileRes.ok) {
      const compiledData = await compileRes.json();
      if (compiledData?.compiledPrompt) {
        prompt = compiledData.compiledPrompt;
        translatedVia = `llm:${compiledData.translatedVia || 'auto'}`;
      }
    }
  } catch {
    // fallbackPrompt déjà prêt
  }

  logger.info('IMAGE_GEN', 'Prompt portrait initial compilé (tous champs actuels)', {
    translatedVia,
    name,
    age,
    occupation,
    soulTraits,
    eyes: girlfriend.appearance.eyeColor,
    hair: `${girlfriend.appearance.hairColor} / ${girlfriend.appearance.hairStyle}`,
    skinTone: girlfriend.appearance.skinTone,
    customTraits: bodyProfile?.customTraits,
    outfit: currentOutfitStyle,
    userExtraPrompt: userExtraPrompt?.trim() || '',
    tone: girlfriend.speechStyle?.tone,
    promptLength: prompt.length,
    promptCompiled: prompt,
  });

  // Vérifier immédiatement si OpenRouter ou NanoGPT est configuré (clé saisie ou stockée sur le serveur)
  const clientNanoKey = (config?.nanoGptApiKey || '').trim();
  const clientOrKey = (config?.openRouterApiKey || '').trim();
  const hasNanoGptKey = await hasServerKeyFor('nanogpt', clientNanoKey);
  const hasOpenRouterKey = await hasServerKeyFor('openrouter', clientOrKey);
  const rawModel = (config?.imageModel || '').trim();
  const hasValidOrModel = Boolean(rawModel && rawModel.includes('/') && !rawModel.startsWith('openrouter/auto'));

  const explicitNano = config?.provider === 'nanogpt';
  const explicitOpenRouter = config?.provider === 'openrouter';
  const hasAnyCloudKey = hasNanoGptKey || hasOpenRouterKey;

  // Déterminer quel fournisseur Cloud utiliser directement (en ignorant Gemini .env)
  const shouldBypassGemini = explicitNano || explicitOpenRouter || hasAnyCloudKey;
  let openRouterError = '';

  if (shouldBypassGemini) {
    logger.info('IMAGE_GEN', 'Clé/fournisseur Cloud détecté → Gemini (.env) ignoré, passage direct au moteur configuré', {
      providerConfig: config?.provider,
      hasNanoGptKey,
      hasOpenRouterKey,
      imageModel: rawModel || '(défaut)',
    });

    // Choisir entre NanoGPT et OpenRouter selon le fournisseur/modèle configuré
    const routeToNanoGpt =
      explicitNano ||
      (!explicitOpenRouter && hasNanoGptKey && !(hasOpenRouterKey && hasValidOrModel));

    if (routeToNanoGpt) {
      if (!hasNanoGptKey) {
        if (!skipConfigPrompt) {
          logger.info('IMAGE_GEN', 'NanoGPT sélectionné sans clé → Ouverture configuration (profil conservé)');
          return { status: 'needs_openrouter_config' };
        }
      } else {
        const nanoModel = resolveNanoGptImageModel(rawModel);
        try {
          logger.info('IMAGE_GEN', `Génération directe portrait initial via NanoGPT (${nanoModel})`);
          const ngRes = await fetch('/api/nanogpt/generate-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt,
              model: nanoModel,
              aspectRatio,
              ...(clientNanoKey ? { apiKey: clientNanoKey } : {}),
            }),
          });
          if (ngRes.ok) {
            const data = await ngRes.json();
            if (data.imageUrl) {
              logger.info('IMAGE_GEN', `Portrait initial généré avec succès via NanoGPT (${nanoModel}) !`);
              return {
                status: 'success',
                url: data.imageUrl,
                providerUsed: 'nanogpt',
              };
            }
          } else {
            const errJson = await ngRes.json().catch(() => ({}));
            openRouterError = errJson.error || `NanoGPT HTTP ${ngRes.status}`;
            logger.error('IMAGE_GEN', `NanoGPT HS : ${openRouterError} → Repli vers FluxAI`);
          }
        } catch (e: any) {
          openRouterError = e?.message || 'Erreur réseau NanoGPT';
          logger.error('IMAGE_GEN', `NanoGPT HS : ${openRouterError} → Repli vers FluxAI`);
        }
      }
    } else {
      // Routage direct vers OpenRouter via proxy serveur
      if (!hasOpenRouterKey || (!hasValidOrModel && !skipConfigPrompt)) {
        if (!skipConfigPrompt) {
          logger.info('IMAGE_GEN', 'OpenRouter sans clé ou modèle valide → Ouverture configuration (profil conservé)');
          return { status: 'needs_openrouter_config' };
        }
      }
      if (hasOpenRouterKey) {
        const modelToUse = resolveOpenRouterImageModel(rawModel);
        try {
          logger.info('IMAGE_GEN', `Génération directe portrait initial via OpenRouter (${modelToUse})`);
          const orRes = await fetch('/api/openrouter/generate-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt,
              model: modelToUse,
              mode: 'portrait',
              ...(clientOrKey ? { apiKey: clientOrKey } : {}),
            }),
            signal: AbortSignal.timeout(45000),
          });

          if (orRes.ok) {
            const data = await orRes.json();
            if (data.imageUrl) {
              logger.info('IMAGE_GEN', `Portrait initial généré avec succès via OpenRouter (${modelToUse}) !`);
              return {
                status: 'success',
                url: data.imageUrl,
                providerUsed: 'openrouter',
              };
            }
            openRouterError = 'OpenRouter HTTP 200 mais aucune image dans la réponse';
          } else {
            const errData = await orRes.json().catch(() => ({}));
            openRouterError = errData?.error || `HTTP ${orRes.status}`;
          }
        } catch (e: any) {
          openRouterError = e?.message || 'Erreur réseau OpenRouter';
        }
        logger.error('IMAGE_GEN', `OpenRouter HS : ${openRouterError} → Repli vers FluxAI`);
      }
    }

    // Repli final vers FluxAI si le moteur Cloud a échoué (sans jamais rappeler Gemini .env)
    const faceSeed = getPersonaFaceSeed(girlfriend, variationNonce);
    const fluxUrl = buildFluxImageUrl(prompt, '', aspectRatio, faceSeed);
    logger.info('IMAGE_GEN', 'Repli final portrait initial via FluxAI Photoreal', {
      openRouterError,
      faceSeed,
    });
    return {
      status: 'success',
      url: fluxUrl,
      providerUsed: 'flux',
      openRouterError,
    };
  }

  // =========================================================================
  // CAS SANS CLÉ NANOGPT NI OPENROUTER : Tentative Gemini (.env) puis Config / FluxAI
  // =========================================================================
  let geminiError = '';
  try {
    logger.info('IMAGE_GEN', 'Aucune clé Cloud saisie → Tentative portrait initial via Gemini (.env)');
    const response = await fetch('/api/generate-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        aspectRatio,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      if (data.imageUrl) {
        logger.info('IMAGE_GEN', 'Portrait initial généré et sauvegardé avec succès via Gemini (.env) !');
        return {
          status: 'success',
          url: data.imageUrl,
          providerUsed: 'gemini',
        };
      }
      geminiError = 'Aucune image retournée par Gemini';
    } else {
      const errJson = await response.json().catch(() => ({}));
      geminiError = errJson.error || `HTTP ${response.status}`;
    }
  } catch (err: any) {
    geminiError = err?.message || 'Erreur réseau Gemini';
  }

  logger.warn('IMAGE_GEN', `Gemini (.env) HS (${geminiError})`);

  if (!skipConfigPrompt) {
    logger.info('IMAGE_GEN', 'Aucune clé Cloud configurée et Gemini HS → Ouverture configuration (profil conservé)');
    return {
      status: 'needs_openrouter_config',
      geminiError,
    };
  }

  const faceSeed = getPersonaFaceSeed(girlfriend, variationNonce);
  const fluxUrl = buildFluxImageUrl(prompt, '', aspectRatio, faceSeed);
  logger.info('IMAGE_GEN', 'Repli final portrait initial via FluxAI Photoreal', {
    geminiError,
    faceSeed,
  });

  return {
    status: 'success',
    url: fluxUrl,
    providerUsed: 'flux',
    geminiError,
  };
}

/**
 * Legacy helper wrapper preserving signature
 */
export async function generateInitialPortrait(
  girlfriend: GirlfriendPersona,
  userExtraPrompt?: string,
  aspectRatio: '3:4' | '9:16' = '3:4',
  _preferredProvider: 'gemini' | 'pollinations' | 'openrouter' = 'gemini',
  _clientApiKey?: string,
  config?: SelfieConfig
): Promise<string> {
  const res = await generateInitialPortraitWithProtocol(girlfriend, userExtraPrompt, aspectRatio, config, true);
  return res.url || '';
}

/**
 * Helper to resolve reference portrait for Img2Img (returns compressed data URL, or raw /api/images/... path for server disk loading)
 */
async function resolvePortraitReferenceForImg2Img(avatarUrl?: string): Promise<string | undefined> {
  if (!avatarUrl || avatarUrl.startsWith('data:image/svg')) return undefined;
  try {
    const croppedFace = await cropFaceAndShouldersForVision(avatarUrl, 512, 0.85);
    if (croppedFace && croppedFace.startsWith('data:image/')) {
      return croppedFace;
    }
  } catch {
    // fallback below
  }
  if (avatarUrl.startsWith('/api/images/') || avatarUrl.startsWith('data:image/')) {
    return avatarUrl;
  }
  return undefined;
}

/**
 * Generates or routes a consistent selfie (using Cloud keys NanoGPT / OpenRouter first whenever configured)
 */
export async function generateSelfie(
  girlfriend: GirlfriendPersona,
  config: SelfieConfig,
  options: GenerateSelfieOptions,
  llmConfig?: LLMConfig
): Promise<SelfieItem> {
  const timestampId = `selfie-${Date.now()}`;
  const now = new Date();
  const timeFormatted = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  const faceSeed = getPersonaFaceSeed(girlfriend);
  const ratio: '3:4' | '9:16' | '1:1' = config.aspectRatio === '1:1' ? '1:1' : config.aspectRatio === '9:16' ? '9:16' : '3:4';
  const overrides = extractVisualOverridesFromReply(options.girlfriendReply, options.scenarioSnippet);
  const activeOutfit = options.customOutfit || overrides.outfitOverride || girlfriend.appearance.currentOutfitStyle;

  let finalUrl = '';
  const finalTitle = options.scenarioTitle;
  const finalCaption = options.captionText;

  // Only treat as pure empty scenery when the user explicitly requests scenery/landscape WITHOUT her
  const isScenery = /\b(paysage|vue\s+de\s+dehors|vue\s+sur|ciel\s+étoilé|rue\s+vide|terrasse\s+vide|décor\s+(?:uniquement|sans\s+personne)|sans\s+toi|montre(?:-moi)?\s+(?:le\s+paysage|la\s+vue|le\s+ciel|l'appartement\s+vide))\b/i.test(
    `${options.scenarioTitle} ${options.scenarioSnippet}`
  );

  if (isScenery) {
    const sceneryEn = applyFrenchTokenDictionary(options.scenarioSnippet || 'cozy room interior', FRENCH_OUTFIT_AND_TRAITS_DICT);
    const sceneryPrompt = `authentic aesthetic photograph of ${sceneryEn}, beautiful atmosphere, 35mm photography, cinematic natural light, warm ambiance, masterpiece, no people`;
    logger.info('IMAGE_GEN', 'Génération photo décor/paysage sans personnage', { sceneryPrompt });
    finalUrl = buildFluxImageUrl(sceneryPrompt, 'people, person, girl, face, woman, cartoon, drawing, illustration', ratio, faceSeed);
    return {
      id: timestampId,
      url: finalUrl,
      scenarioTitle: finalTitle || 'Photo du lieu',
      caption: finalCaption || `Voilà l'endroit où je suis en ce moment... Tu aimes l'ambiance ? ✨`,
      timestamp: `Aujourd'hui à ${timeFormatted}`,
      outfitUsed: 'Ambiance & Décor',
      isFavorite: false,
    };
  }

  // 0. Compile clean English selfie prompt AFTER receiving girlfriendReply so scene, outfit & props match her message 100%
  const { prompt: fallbackPrompt } = constructSelfiePrompt(girlfriend, options, ratio);
  let prompt = fallbackPrompt;
  let translatedVia = 'dictionnaire-local';

  try {
    const compileRes = await fetch('/api/compile-portrait-prompt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'selfie',
        persona: {
          name: girlfriend.name,
          age: girlfriend.age,
          relationshipStatus: girlfriend.relationshipStatus,
          occupation: girlfriend.occupation,
          tone: girlfriend.speechStyle?.tone,
          soulTraits: overrides.cleanedReplyScene ? [] : girlfriend.soulTraits,
          ethnicity: girlfriend.appearance.bodyProfile?.ethnicity,
          height: girlfriend.appearance.bodyProfile?.height,
          bodyType: girlfriend.appearance.bodyProfile?.bodyType,
          bustSize: girlfriend.appearance.bodyProfile?.bustSize,
          generalAttitude: girlfriend.appearance.bodyProfile?.generalAttitude,
          mainStyle: girlfriend.appearance.bodyProfile?.mainStyle,
          hairStyle: overrides.hairStyleOverride || girlfriend.appearance.hairStyle,
          hairColor: girlfriend.appearance.hairColor,
          eyeColor: girlfriend.appearance.eyeColor,
          skinTone: girlfriend.appearance.skinTone,
          customTraits: girlfriend.appearance.bodyProfile?.customTraits,
          distinguishingFeatures: girlfriend.appearance.distinguishingFeatures,
          currentOutfitStyle: activeOutfit,
          explicitOutfitSelected: Boolean(options.customOutfit || overrides.outfitOverride),
          girlfriendReply: overrides.cleanedReplyScene || options.girlfriendReply || '',
          userExtraPrompt: options.scenarioSnippet || '',
          aspectRatio: ratio,
        },
        llmConfig,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (compileRes.ok) {
      const compiledData = await compileRes.json();
      if (compiledData?.compiledPrompt) {
        prompt = compiledData.compiledPrompt;
        translatedVia = `llm:${compiledData.translatedVia || 'auto'}`;
      }
    }
  } catch {
    // fallbackPrompt déjà prêt
  }

  // Vérifier la disponibilité des clés Cloud côté serveur (ou saisies dans la session)
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

  logger.info('IMAGE_GEN', 'Prompt selfie compilé & routage moteur', {
    translatedVia,
    scenarioTitle: finalTitle,
    scenarioSnippet: options.scenarioSnippet,
    girlfriendReplyUsed: Boolean(options.girlfriendReply),
    outfitOverrideFromReply: overrides.outfitOverride || null,
    hairStyleOverride: overrides.hairStyleOverride || null,
    outfit: activeOutfit,
    providerConfig: config.provider,
    routeSelected: routeToNanoGpt ? 'nanogpt' : routeToOpenRouter ? 'openrouter' : config.provider,
    hasNanoGptKey,
    hasOpenRouterKey,
    promptCompiled: prompt,
  });

  // 1. NANOGPT IMAGE (HiDream, Chroma, Z Image Turbo, Qwen Image avec référence faciale Img2Img)
  if (!finalUrl && routeToNanoGpt) {
    const modelToUse = resolveNanoGptImageModel(config.imageModel);
    if (hasNanoGptKey) {
      try {
        const supportsFaceRef = modelToUse.includes('qwen-image') ||
                                modelToUse.includes('image-to-image') ||
                                modelToUse.includes('edit') ||
                                modelToUse.includes('hidream-e');
        const referenceImage = supportsFaceRef
          ? await resolvePortraitReferenceForImg2Img(girlfriend.appearance.avatarUrl)
          : undefined;

        logger.info('IMAGE_GEN', `Demande selfie NanoGPT (${modelToUse})`, {
          hasReferenceImage: Boolean(referenceImage),
          aspectRatio: ratio,
        });

        const ngRes = await fetch('/api/nanogpt/generate-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt,
            model: modelToUse,
            aspectRatio: ratio,
            ...(clientNanoKey ? { apiKey: clientNanoKey } : {}),
            referenceImage,
          }),
        });

        if (ngRes.ok) {
          const data = await ngRes.json();
          if (data.imageUrl) {
            finalUrl = data.imageUrl;
            logger.info('IMAGE_GEN', `Selfie NanoGPT (${data.modelUsed || modelToUse}) généré et sauvegardé !`, {
              usedReferenceImage: data.usedReferenceImage,
              imageUrl: finalUrl,
            });
          }
        } else {
          const errJson = await ngRes.json().catch(() => ({}));
          logger.error('IMAGE_GEN', `NanoGPT Selfie HTTP ${ngRes.status}: ${errJson.error || ''}`, {
            model: modelToUse,
            status: ngRes.status,
          });
        }
      } catch (e: any) {
        logger.error('IMAGE_GEN', `Erreur NanoGPT selfie: ${e.message}`, e);
      }
    } else {
      logger.warn('IMAGE_GEN', 'Clé NanoGPT manquante pour la génération du selfie');
    }
  }

  // 2. OPENROUTER IMAGE (Proxied via Express backend; keys remain on server)
  if (!finalUrl && routeToOpenRouter) {
    const modelToUse = resolveOpenRouterImageModel(config.imageModel);
    if (hasOpenRouterKey) {
      try {
        const compressedPortrait = await resolvePortraitReferenceForImg2Img(girlfriend.appearance.avatarUrl);
        const validDataRef = compressedPortrait && (compressedPortrait.startsWith('data:image/') || compressedPortrait.startsWith('/api/images/'))
          ? compressedPortrait
          : undefined;

        logger.info('IMAGE_GEN', `Demande selfie OpenRouter (${modelToUse})`, {
          hasReferenceImage: Boolean(validDataRef),
        });

        const orRes = await fetch('/api/openrouter/generate-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt,
            model: modelToUse,
            mode: 'selfie',
            referenceImage: validDataRef,
            ...(clientOrKey ? { apiKey: clientOrKey } : {}),
          }),
          signal: AbortSignal.timeout(45000),
        });
        if (orRes.ok) {
          const data = await orRes.json();
          if (data.imageUrl) {
            finalUrl = data.imageUrl;
            logger.info('IMAGE_GEN', 'Selfie OpenRouter généré et sauvegardé avec succès !', {
              model: modelToUse,
              imageUrl: finalUrl,
            });
          } else {
            logger.warn('IMAGE_GEN', `OpenRouter HTTP 200 mais aucune image trouvée (${modelToUse})`);
          }
        } else {
          const errData = await orRes.json().catch(() => ({}));
          logger.error('IMAGE_GEN', `OpenRouter Selfie HTTP ${orRes.status}: ${errData.error || JSON.stringify(errData)}`, {
            model: modelToUse,
            status: orRes.status,
            errData,
          });
        }
      } catch (e: any) {
        logger.error('IMAGE_GEN', `Erreur OpenRouter selfie: ${e.message}`, e);
      }
    } else {
      logger.warn('IMAGE_GEN', 'Clé OpenRouter manquante pour la génération du selfie');
    }
  }

  // 3. GEMINI (.env) uniquement si aucune clé Cloud NanoGPT/OpenRouter active et provider === 'gemini'
  if (!finalUrl && config.provider === 'gemini' && !routeToNanoGpt && !routeToOpenRouter) {
    const compressedPortrait = await resolvePortraitReferenceForImg2Img(girlfriend.appearance.avatarUrl);
    const validDataRef = compressedPortrait && compressedPortrait.startsWith('data:image/') ? compressedPortrait : undefined;
    logger.info('IMAGE_GEN', 'Demande génération selfie via Google Gemini (.env)', {
      promptPreview: prompt.slice(0, 80),
      hasReferenceImage: Boolean(validDataRef),
    });
    try {
      const res = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          aspectRatio: ratio,
          referenceImage: validDataRef,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.imageUrl) {
          finalUrl = data.imageUrl;
          logger.info('IMAGE_GEN', 'Selfie généré avec succès via Gemini (.env)');
        }
      } else {
        const errJson = await res.json().catch(() => ({}));
        logger.warn('IMAGE_GEN', `Gemini image HTTP ${res.status}, bascule en repli vers Flux AI`, errJson);
      }
    } catch (e: any) {
      logger.error('IMAGE_GEN', `Erreur génération image Gemini: ${e.message}`, e);
    }
  }

  // 4. COMFYUI LOCAL
  if (!finalUrl && config.provider === 'comfyui' && config.comfyEndpoint) {
    try {
      const comfyRes = await fetch(`${config.comfyEndpoint}/prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: `aura-${Date.now()}`,
          prompt: {
            "3": {
              "inputs": {
                "seed": faceSeed,
                "steps": 24,
                "cfg": 7,
                "sampler_name": "euler",
                "scheduler": "normal",
                "denoise": 1,
                "positive": prompt,
                "negative": ""
              },
              "class_type": "KSampler"
            }
          }
        }),
        signal: AbortSignal.timeout(4000),
      });

      if (!comfyRes.ok) throw new Error('ComfyUI response not ok');
      finalUrl = buildFluxImageUrl(prompt, '', ratio, faceSeed);
    } catch (err) {
      logger.warn('IMAGE_GEN', 'ComfyUI hors ligne ou inaccessible → Repli vers Flux AI', { err: String(err), faceSeed });
    }
  }

  // 5. Repli final Flux AI Photoreal (toujours loggé + avec graine faciale faceSeed)
  if (!finalUrl) {
    logger.warn('IMAGE_GEN', 'Repli final selfie via FluxAI Photoreal', {
      providerConfig: config.provider,
      faceSeed,
      promptCompiled: prompt,
    });
    finalUrl = buildFluxImageUrl(prompt, '', ratio, faceSeed);
  }

  const defaultCaptions = [
    `Rien que pour toi mon cœur... J'espère que ça te donne le sourire ! 💕`,
    `Coucou toi ! Tu me manquais trop, voilà un petit aperçu de ma journée ✨`,
    `Je pensais justement à toi au moment où j'ai pris ça... ☕`,
    `Spécialement pour mon chéri. Tu as vu mon style ? 🥰`
  ];

  return {
    id: timestampId,
    url: finalUrl,
    scenarioTitle: finalTitle,
    caption: finalCaption || defaultCaptions[Math.floor(Math.random() * defaultCaptions.length)],
    timestamp: `Aujourd'hui à ${timeFormatted}`,
    outfitUsed: activeOutfit,
    isFavorite: false,
  };
}
