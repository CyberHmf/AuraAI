import { GirlfriendPersona, VoiceConfig } from '../types';

let currentUtterance: SpeechSynthesisUtterance | null = null;
let currentAudioElement: HTMLAudioElement | null = null;

export function stopSpeaking() {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
  if (currentAudioElement) {
    currentAudioElement.pause();
    currentAudioElement.currentTime = 0;
    currentAudioElement = null;
  }
}

/**
 * Returns all French and English speech voices detected by the browser.
 */
export function getAvailableBrowserVoices(): SpeechSynthesisVoice[] {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return [];
  const voices = window.speechSynthesis.getVoices();
  return voices.filter(v => v.lang.startsWith('fr') || v.lang.startsWith('en'));
}

/**
 * Synthesizes and plays speech using the configured provider:
 * 1. Web Speech API (Free, neural, zero token, client-side)
 * 2. Local GPU TTS endpoint (XTTS-v2 / Piper / AllTalk via proxy)
 */
export async function speakMessage(
  text: string,
  girlfriend: GirlfriendPersona,
  voiceConfig?: VoiceConfig,
  onStart?: () => void,
  onEnd?: () => void
): Promise<boolean> {
  stopSpeaking();

  // Strip asterisks action annotations for natural speech (e.g. *sourit*)
  const cleanText = text.replace(/\*[^*]+\*/g, '').trim();
  if (!cleanText) return false;

  const provider = voiceConfig?.provider || 'webspeech';

  // 1. LOCAL GPU TTS (XTTS-v2 / Piper / AllTalk)
  if (provider === 'local_gpu' && voiceConfig?.localGpuEndpoint) {
    try {
      if (onStart) onStart();
      const res = await fetch('/api/tts-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: voiceConfig.localGpuEndpoint,
          text: cleanText,
          voice: voiceConfig.edgeVoice || 'female_warm',
          speed: voiceConfig.rate || 1.0,
        }),
      });

      if (!res.ok) throw new Error('Local GPU TTS failed');
      const blob = await res.blob();
      const audioUrl = URL.createObjectURL(blob);
      const audio = new Audio(audioUrl);
      currentAudioElement = audio;
      audio.onended = () => {
        if (onEnd) onEnd();
        URL.revokeObjectURL(audioUrl);
      };
      audio.onerror = () => {
        if (onEnd) onEnd();
        URL.revokeObjectURL(audioUrl);
      };
      await audio.play();
      return true;
    } catch (err) {
      console.warn('Local GPU TTS failed, falling back to Web Speech API:', err);
      // Fallback to Web Speech API below
    }
  }

  // 2. WEB SPEECH API (Default, highly compatible, zero token cost)
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    if (onEnd) onEnd();
    return false;
  }

  const utterance = new SpeechSynthesisUtterance(cleanText);
  utterance.pitch = voiceConfig?.pitch ?? girlfriend.voice.pitch ?? 1.05;
  utterance.rate = voiceConfig?.rate ?? girlfriend.voice.rate ?? 0.95;
  utterance.lang = girlfriend.voice.lang || 'fr-FR';

  const voices = window.speechSynthesis.getVoices();
  const preferredVoice = voices.find(v => 
    v.lang.startsWith('fr') && 
    (v.name.includes('Amélie') || v.name.includes('Thomas') || v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Hortense') || v.name.includes('Julie'))
  ) || voices.find(v => v.lang.startsWith('fr'));

  if (preferredVoice) {
    utterance.voice = preferredVoice;
  }

  utterance.onstart = () => {
    if (onStart) onStart();
  };
  utterance.onend = () => {
    if (onEnd) onEnd();
  };
  utterance.onerror = () => {
    if (onEnd) onEnd();
  };

  currentUtterance = utterance;
  window.speechSynthesis.speak(utterance);
  return true;
}
