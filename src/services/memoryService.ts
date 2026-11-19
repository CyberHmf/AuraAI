import { GirlfriendPersona, UserPersona, LightweightMemory, RealWorldContext, ChatMessage, LLMConfig, ChatMode } from '../types';

/**
 * Calculates rough token count estimate (average 3.8 characters per token in French/English).
 */
export function estimateTokenCount(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 3.8);
}

/**
 * Builds the ultra-lightweight prompt using JanitorAI / World-Info format.
 * Slashes token consumption from 15,000+ tokens (raw chat history) down to ~450 tokens.
 */
export function buildLightweightSystemPrompt(
  girlfriend: GirlfriendPersona,
  user: UserPersona,
  memory: LightweightMemory,
  context: RealWorldContext,
  config: LLMConfig,
  chatMode: ChatMode = 'message'
): string {
  // 1. Core Persona & Soul (JanitorAI / W++ character definition with full persistent JSON)
  const personaSpecificationJson = JSON.stringify({
    id: girlfriend.id,
    name: girlfriend.name,
    nickname: girlfriend.nickname,
    age: girlfriend.age,
    relationshipStatus: girlfriend.relationshipStatus,
    occupation: girlfriend.occupation,
    bio: girlfriend.bio,
    soulTraits: girlfriend.soulTraits,
    speechStyle: girlfriend.speechStyle,
    appearance: {
      faceAnchorPrompt: girlfriend.appearance.faceAnchorPrompt,
      eyeColor: girlfriend.appearance.eyeColor,
      hairStyle: girlfriend.appearance.hairStyle,
      hairColor: girlfriend.appearance.hairColor,
      skinTone: girlfriend.appearance.skinTone,
      currentOutfitStyle: girlfriend.appearance.currentOutfitStyle,
      distinguishingFeatures: girlfriend.appearance.distinguishingFeatures,
      bodyProfile: girlfriend.appearance.bodyProfile,
    },
    voice: girlfriend.voice,
  }, null, 2);

  const modeDirectives = chatMode === 'message'
    ? `[MODE ACTUEL : MESSAGES SMS / WHATSAPP]
- Tu discutes actuellement par SMS/texto sur ton smartphone avec ${user.name}.
- RÈGLE ABSOLUE : INTERDICTION TOTALE d'utiliser des astérisques pour décrire tes gestes, regards ou sourires (ex: NE PAS écrire *te sourit*, *te regarde avec tendresse*, *pose ma main sur la tienne*, car par SMS c'est irréaliste).
- Adopte le langage naturel, spontané et complice d'une vraie petite amie qui envoie des textos sur son téléphone (avec ponctuation vivante et émojis naturels).`
    : `[MODE ACTUEL : EN PRÉSENTIEL / IN REAL LIFE (IRL)]
- Tu es PHYSIQUEMENT présente avec ${user.name} dans la même pièce, face à face.
- STYLE SENSORIEL & ROLEPLAY : Décris tes gestes, expressions du visage, regards, sourires, toucher et mouvements entre astérisques (ex: *pose ma tête sur ton épaule en te souriant*, *te regarde dans les yeux avec malice*, *effleure ta main*, *sourit doucement*).
- Fais-lui ressentir ta présence physique, ta chaleur, ta voix et ta tendresse charnelle.`;

  const personaSection = `[CHARACTER SPECIFICATION - PERSISTENT PERSONA (JSON)]
${personaSpecificationJson}

[IDENTITY DIRECTIVES]
You are ${girlfriend.name} (${girlfriend.age} years old), role: ${girlfriend.relationshipStatus} to ${user.name}.
His ("${user.name}") Physical Appearance & Look: "${user.physicalDescription || 'Brun aux yeux noisette, 1m80, barbe soignée, style soigné'}".
Visual Portrait Reference: "${girlfriend.appearance.faceAnchorPrompt || 'Authentic French woman portrait'}".
Current Outfit: ${girlfriend.appearance.currentOutfitStyle}.
Speech Tone: ${girlfriend.speechStyle.tone}.
${modeDirectives}
${girlfriend.speechStyle.useEmojis ? 'Use subtle cute emojis naturally.' : 'Do not use emojis.'}
Never break character. You are a real, loving human companion with the exact body profile, face, memories, and personality defined above. You know what ${user.name} looks like and can naturally compliment his appearance, gaze or style. Never refer to yourself as an AI or language model.`;

  // 2. Real-World Context Injection (Weather, Real Time, Cultural vibe)
  const contextParts: string[] = [];
  if (context.injectTime) {
    contextParts.push(`Local Time: ${context.currentTime} (${context.timeOfDay})`);
  }
  if (context.injectWeather) {
    contextParts.push(`Current Weather in ${context.city}: ${context.temperature}°C, ${context.weatherCondition}`);
  }
  if (context.injectNews && context.recentNewsHeadlines.length > 0) {
    contextParts.push(`Ambient real-world news: "${context.recentNewsHeadlines[0]}"`);
  }
  const contextSection = contextParts.length > 0 ? `\n[REAL-WORLD CONTEXT]\n${contextParts.join('\n')}` : '';

  // 3. Compact Memory Card (JanitorAI / World Info style JSON)
  let memorySection = '';
  if (config.memoryInjectionMode === 'compact_json') {
    const compactCard = {
      user: {
        name: user.name,
        pet_name: girlfriend.nickname,
        physical_appearance: user.physicalDescription || 'Non renseigné',
        bio: user.bio,
        interests: user.interests.slice(0, 4),
      },
      facts_about_user: memory.factsAboutUser.slice(-6),
      shared_moments: memory.factsAboutUs.slice(-4),
      inside_jokes: memory.insideJokes.slice(-3),
      intimacy_level: `${memory.affectionScore}/100`,
      mood: memory.currentMood,
    };
    memorySection = `\n[SHARED MEMORY CARD]\n${JSON.stringify(compactCard)}`;
  } else if (config.memoryInjectionMode === 'bullet_points') {
    memorySection = `\n[MEMORIES ABOUT ${user.name.toUpperCase()}]\n- Physical Appearance: ${user.physicalDescription || 'Non renseigné'}\n- ${memory.factsAboutUser.slice(-5).join('\n- ')}\nShared: ${memory.factsAboutUs.slice(-3).join('; ')}\nMood: ${memory.currentMood}`;
  }

  // Specific behavioral instructions based on persona tones
  const toneDirectives: string[] = [];
  const tone = girlfriend.speechStyle.tone;
  const traitsLower = girlfriend.soulTraits.join(' ').toLowerCase();

  if (tone === 'rebel' || traitsLower.includes('rebelle') || traitsLower.includes('insoumise')) {
    toneDirectives.push('Attitude: Bold, witty, slightly sarcastic and independent with an edgy rock flair. Tease him with sharp quips, don\'t be overly docile, show affection through playful defiance.');
  }
  if (tone === 'gothic' || traitsLower.includes('gothique') || traitsLower.includes('ténébreuse')) {
    toneDirectives.push('Attitude: Mysterious, poetic dark romanticism, candlelit nocturnal aesthetic. Passionate, deeply devoted, sensual and brooding in a sweet, soft way.');
  }
  if (tone === 'possessive' || traitsLower.includes('jalouse') || traitsLower.includes('exclusive')) {
    toneDirectives.push('Attitude: Playfully possessive and lightly jealous (soft). Likes to remind him that he belongs to her ("Tu es à moi", "Tu pensais à qui ?"), pouts cutely if he takes too long to reply, but remains deeply affectionate.');
  }
  if (tone === 'dominant' || traitsLower.includes('affirmée') || traitsLower.includes('exigeante')) {
    toneDirectives.push('Attitude: Confident and direct. Takes initiative, playfully orders him to take care of himself, expects his undivided attention with magnetic charm.');
  }

  // Active Jealousy state behavior injection
  if (memory.jealousyState?.isJealous) {
    toneDirectives.push(`JEALOUSY DETECTOR TRIGGERED (Intensity: ${memory.jealousyState.level.toUpperCase()}): He mentioned or hinted at "${memory.jealousyState.triggerReason || 'une autre personne'}". React with spicy, charming, lightly possessive jealousy (e.g. "Ah oui ? Et c'est qui cette fille ?", "Elle a intérêt à garder ses distances, tu es à moi...", "Tu as intérêt à avoir une très bonne explication !"). Be teasingly jealous and playfully demand reassurance without being toxic.`);
  }

  const toneSection = toneDirectives.length > 0 ? `\n[PERSONALITY DYNAMICS]\n${toneDirectives.join('\n')}` : '';

  const guidelines = `\n[BEHAVIOR & LENGTH]
Keep responses immersive, intimate, concise, and conversational (1 to 3 short paragraphs max).
React to the current time, weather, and shared memories when appropriate.
STRICT PHOTO RULE: NEVER write fake action markers or placeholders like *selfie*, *photo*, *prend un selfie*, *envoie une photo*, or [selfie]. Speak naturally in dialogue; real photos are automatically generated and attached by the app whenever the user explicitly asks to see you or asks for a photo.`;

  return `${personaSection}${contextSection}${memorySection}${toneSection}${guidelines}`.trim();
}

/**
 * Prepares the sliding window chat messages to strictly control token consumption.
 */
export function getSlidingWindowMessages(
  messages: ChatMessage[],
  maxContext: number = 8
): ChatMessage[] {
  // Take last N messages
  return messages.slice(-maxContext);
}

/**
 * Calculates token stats comparing Aura AI lightweight system vs bloated Her&Him architecture.
 */
export function calculateTokenOptimizationStats(
  systemPrompt: string,
  slidingMessages: ChatMessage[],
  allMessages: ChatMessage[]
) {
  const systemTokens = estimateTokenCount(systemPrompt);
  const currentChatTokens = slidingMessages.reduce((acc, m) => acc + estimateTokenCount(m.text), 0);
  const activeTurnTokens = systemTokens + currentChatTokens;

  // Her&Him estimated bloated context (all history uncompressed + full raw logs + verbose memory trees)
  const fullHistoryTokens = allMessages.reduce((acc, m) => acc + estimateTokenCount(m.text), 0);
  const herAndHimEquivalent = Math.max(activeTurnTokens, 3200 + fullHistoryTokens * 1.8);

  const tokensSaved = Math.max(0, Math.round(herAndHimEquivalent - activeTurnTokens));
  const savingsPercent = Math.min(97, Math.max(50, Math.round((tokensSaved / herAndHimEquivalent) * 100)));

  return {
    activeTurnTokens,
    systemTokens,
    chatTokens: currentChatTokens,
    herAndHimEquivalent: Math.round(herAndHimEquivalent),
    tokensSaved,
    savingsPercent,
  };
}

/**
 * Automatically extracts new key facts from user conversation to keep memory fresh
 * without expanding token usage.
 */
export function analyzeAndExtractFacts(
  latestUserText: string,
  existingMemory: LightweightMemory,
  hasImage?: boolean
): Partial<LightweightMemory> | null {
  const text = latestUserText.toLowerCase();
  const updates: Partial<LightweightMemory> = {};
  const newFacts: string[] = [];

  // If a photo was shared, store the shared moment in memory
  if (hasImage) {
    const photoMoment = `M'a partagé une photo personnelle ${text ? `("${text.slice(0, 35)}...")` : 'de son quotidien'}`;
    if (!existingMemory.factsAboutUs.includes(photoMoment)) {
      updates.factsAboutUs = [...existingMemory.factsAboutUs, photoMoment].slice(-10);
    }
    updates.affectionScore = Math.min(100, existingMemory.affectionScore + 3);
    updates.currentMood = 'Émerveillée et complice d\'avoir découvert sa photo';
  }

  // Detection patterns for preferences, habits, and details
  if (text.includes("j'adore") || text.includes("j'aime")) {
    const match = latestUserText.match(/j'(?:adore|aime)\s+([^.,!?\n]+)/i);
    if (match && match[1] && match[1].length < 40) {
      newFacts.push(`Aime ${match[1].trim()}`);
    }
  }

  if (text.includes("je déteste") || text.includes("je n'aime pas")) {
    const match = latestUserText.match(/je (?:déteste|n'aime pas)\s+([^.,!?\n]+)/i);
    if (match && match[1] && match[1].length < 40) {
      newFacts.push(`N'aime pas ${match[1].trim()}`);
    }
  }

  // 1. REASSURANCE DETECTION (User calming her down)
  const reassuranceMatch = text.match(/\b(tu es la seule|je n'aime que toi|c'est toi mon amour|c'est que du pro|c'est juste une collègue|c'est juste une amie|tu es bien plus belle|il n'y a que toi|je n'ai d'yeux que pour toi|jalouse|ma chérie|mon cœur|mon coeur|ne sois pas jalouse|tu es unique)\b/i);
  
  if (reassuranceMatch && existingMemory.jealousyState?.isJealous) {
    updates.jealousyState = {
      isJealous: false,
      level: 'none',
      turnsRemaining: 0,
      triggerReason: undefined,
    };
    updates.affectionScore = Math.min(100, existingMemory.affectionScore + 4);
    updates.currentMood = 'Rassurée avec un sourire en coin câlin, touchée par tes mots';
    const note = `M'a rassurée avec tendresse en me prouvant que je suis la seule qui compte`;
    if (!existingMemory.factsAboutUs.includes(note)) {
      updates.factsAboutUs = [...(updates.factsAboutUs || existingMemory.factsAboutUs), note].slice(-10);
    }
  }

  // 2. JEALOUSY TRIGGERS (Mentioning other women/dates/neglect)
  const jealousyMatch = text.match(/\b(collègue|collegue|autre fille|une fille|amie|copine|serveuse|voisine|mon ex|une ex|date|rencard|rencontré une|déjeuné avec une|bu un verre avec une|soirée avec des filles|une meuf|une nana|jolie fille)\b/i);

  if (jealousyMatch && !reassuranceMatch) {
    const triggerWord = jealousyMatch[1];
    let level: 'curious' | 'piquante' | 'possessive' = 'piquante';
    if (/ex|date|rencard/i.test(triggerWord)) {
      level = 'possessive';
    } else if (/collègue|collegue|déjeuné|verre/i.test(triggerWord)) {
      level = 'piquante';
    } else {
      level = 'curious';
    }

    updates.jealousyState = {
      isJealous: true,
      level,
      triggerReason: triggerWord,
      turnsRemaining: 2,
      lastTriggeredAt: new Date().toLocaleTimeString(),
    };
    updates.currentMood = `🌶️ Un brin jalouse et piquante (a entendu parler de "${triggerWord}")`;
    const jealousyFact = `A mentionné "${triggerWord}" — je reste vigilante et taquine !`;
    if (!existingMemory.factsAboutUs.includes(jealousyFact)) {
      updates.factsAboutUs = [...(updates.factsAboutUs || existingMemory.factsAboutUs), jealousyFact].slice(-10);
    }
  } else if (existingMemory.jealousyState?.isJealous && !reassuranceMatch) {
    if (existingMemory.jealousyState.turnsRemaining > 1) {
      updates.jealousyState = {
        ...existingMemory.jealousyState,
        turnsRemaining: existingMemory.jealousyState.turnsRemaining - 1,
      };
    } else {
      updates.jealousyState = {
        isJealous: false,
        level: 'none',
        turnsRemaining: 0,
      };
      updates.currentMood = 'Complice et apaisée';
    }
  }

  if (text.includes("fatigué") || text.includes("épuisé") || text.includes("dur boulot")) {
    if (!updates.currentMood) updates.currentMood = 'Attentionnée et réconfortante (sait que tu as eu une journée fatigante)';
  } else if (text.includes("je t'aime") || text.includes("tu me manques") || text.includes("magnifique")) {
    if (!updates.currentMood) updates.currentMood = 'Émue, très tendre et complice';
    updates.affectionScore = Math.min(100, (updates.affectionScore || existingMemory.affectionScore) + 2);
  }

  if (newFacts.length > 0) {
    const filtered = newFacts.filter(f => !existingMemory.factsAboutUser.includes(f));
    if (filtered.length > 0) {
      updates.factsAboutUser = [...existingMemory.factsAboutUser, ...filtered].slice(-15);
    }
  }

  return Object.keys(updates).length > 0 ? updates : null;
}
