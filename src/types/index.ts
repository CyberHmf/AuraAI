export interface BodyProfile {
  ethnicity: string;
  height: 'petite' | 'moyenne' | 'grande';
  bodyType: 'fine' | 'petite' | 'athletique' | 'generouse' | 'pulpeuse' | 'sablier';
  bustSize: 'petite' | 'moyenne' | 'generouse' | 'voluptueuse';
  generalAttitude: string;
  mainStyle: string;
  customTraits: string;
}

export type RelationshipStatus = 'girlfriend' | 'crush' | 'fiancée' | 'friend_with_benefits';

export interface GirlfriendPersona {
  id: string;
  name: string;
  nickname: string;
  age: number;
  relationshipStatus: RelationshipStatus;
  occupation: string;
  bio: string;
  initialGreeting?: string;
  soulTraits: string[];
  speechStyle: {
    language: 'fr' | 'en';
    tone: 'affectionate' | 'teasing' | 'poetic' | 'sassy' | 'shy' | 'rebel' | 'gothic' | 'possessive' | 'dominant';
    useEmojis: boolean;
    useActionEmotes: boolean; // e.g. *te regarde avec tendresse*
    verbosity: 'concise' | 'balanced' | 'expressive';
  };
  appearance: {
    avatarUrl: string;
    faceAnchorPrompt: string; // Invariant facial description for all generated selfies
    eyeColor: string;
    hairStyle: string;
    hairColor: string;
    skinTone: string;
    distinguishingFeatures: string[];
    currentOutfitStyle: string;
    availableOutfits: string[];
    bodyProfile?: BodyProfile;
    faceSeed?: number; // Deterministic persistent seed for facial consistency without base64 token bloat
  };
  voice: {
    pitch: number;
    rate: number;
    lang: string;
    enabled: boolean;
  };
}

export interface UserPersona {
  name: string;
  nickname: string;
  gender: string;
  avatarUrl?: string; // Custom uploaded avatar photo for 'Him'
  physicalDescription?: string; // Physical traits (height, eyes, hair, style) for girlfriend immersion
  bio: string;
  interests: string[];
  relationshipNotes: string;
}

export interface DiaryEntry {
  id: string;
  date: string;
  time: string;
  title: string;
  content: string;
  mood: string;
  relatedTopic?: string;
}

export interface JealousyState {
  isJealous: boolean;
  level: 'none' | 'curious' | 'piquante' | 'possessive';
  triggerReason?: string;
  turnsRemaining: number;
  lastTriggeredAt?: string;
}

export interface LightweightMemory {
  factsAboutUser: string[];
  factsAboutUs: string[];
  insideJokes: string[];
  affectionScore: number; // 0 to 100
  currentMood: string;
  jealousyState?: JealousyState;
  diaryEntries: DiaryEntry[];
  lastCompressedAt?: string;
}

export interface RealWorldContext {
  city: string;
  temperature: number;
  weatherCondition: string;
  weatherCode: number;
  isDay: boolean;
  currentTime: string;
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
  recentNewsHeadlines: string[];
  injectWeather: boolean;
  injectNews: boolean;
  injectTime: boolean;
}

export type LLMProvider = 'gemini' | 'openrouter' | 'groq' | 'nanogpt' | 'local';

export interface LLMConfig {
  provider: LLMProvider;
  apiKey: string;
  model: string;
  localEndpoint: string;
  maxContextMessages: number; // Sliding window size (e.g. 6-10 messages to save tokens)
  temperature: number;
  memoryInjectionMode: 'compact_json' | 'bullet_points' | 'minimal';
}

export type ImageProvider = 'pollinations' | 'gemini' | 'comfyui' | 'openrouter' | 'nanogpt';

export interface SelfieConfig {
  provider: ImageProvider;
  comfyEndpoint: string;
  openRouterApiKey: string;
  nanoGptApiKey?: string;
  imageModel: string;
  aspectRatio: '9:16' | '1:1' | '3:4';
  enablePhotoRequests: boolean;
}

export interface SelfieItem {
  id: string;
  url: string;
  scenarioTitle: string;
  caption: string;
  timestamp: string;
  outfitUsed: string;
  location?: string;
  isFavorite: boolean;
}

export type VoiceProvider = 'webspeech' | 'edge_tts' | 'local_gpu' | 'custom_api';

export interface VoiceConfig {
  provider: VoiceProvider;
  edgeVoice: string; // e.g. 'fr-FR-VivienneMultilingualNeural' or 'fr-FR-DeniseNeural'
  localGpuEndpoint: string; // e.g. 'http://localhost:8020/v1/audio/speech' (XTTS-v2 / Piper / AllTalk GPU)
  autoPlay: boolean;
  pitch: number;
  rate: number;
}

export interface VoiceNoteData {
  durationSeconds: number;
  transcript: string;
  waveform: number[];
  audioBlobUrl?: string;
  isWhisper?: boolean;
}

export type ChatMode = 'message' | 'irl';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'girlfriend';
  text: string;
  timestamp: string;
  userImage?: string; // Base64 image sent by user for Vision analysis
  selfie?: SelfieItem;
  voiceNote?: VoiceNoteData;
  reactionMood?: 'jealous' | 'tender' | 'spicy' | 'playful';
  audioGenerated?: boolean;
  tokenCountEstimate?: number;
  isError?: boolean;
  isSystemDivider?: boolean;
  chatMode?: ChatMode;
}
