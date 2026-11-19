import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Volume2, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { GirlfriendPersona, VoiceNoteData, VoiceConfig } from '../types';
import { speakMessage, stopSpeaking } from '../services/speechService';

interface VoiceNoteBubbleProps {
  voiceNote: VoiceNoteData;
  girlfriend: GirlfriendPersona;
  voiceConfig?: VoiceConfig;
  senderName?: string;
  avatarUrl?: string;
}

export const VoiceNoteBubble: React.FC<VoiceNoteBubbleProps> = ({
  voiceNote,
  girlfriend,
  voiceConfig,
  senderName = girlfriend.name,
  avatarUrl = girlfriend.appearance.avatarUrl,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackProgress, setPlaybackProgress] = useState(0); // 0 to 1
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackRate, setPlaybackRate] = useState<1 | 1.5 | 2>(1);
  const [showTranscript, setShowTranscript] = useState(false);

  const duration = voiceNote.durationSeconds || Math.max(5, Math.ceil(voiceNote.transcript.length / 15));
  const progressTimerRef = useRef<number | null>(null);

  // Generate waveform if not provided
  const waveformBars = voiceNote.waveform && voiceNote.waveform.length > 0 
    ? voiceNote.waveform 
    : [35, 55, 75, 40, 85, 100, 60, 45, 90, 70, 50, 80, 95, 65, 40, 85, 70, 55, 90, 60, 45, 75, 85, 40, 60, 50];

  const handleTogglePlay = async () => {
    if (isPlaying) {
      stopSpeaking();
      setIsPlaying(false);
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
      return;
    }

    setIsPlaying(true);
    const startTime = Date.now();
    const effectiveDuration = duration / playbackRate;

    // Simulate progress ticks
    if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    progressTimerRef.current = window.setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000;
      const progress = Math.min(1, elapsed / effectiveDuration);
      setPlaybackProgress(progress);
      setCurrentTime(Math.min(duration, Math.round(elapsed * playbackRate)));

      if (progress >= 1) {
        if (progressTimerRef.current) clearInterval(progressTimerRef.current);
        setIsPlaying(false);
        setPlaybackProgress(0);
        setCurrentTime(0);
      }
    }, 100);

    // Speak audio using Web Speech or Local GPU TTS
    await speakMessage(
      voiceNote.transcript,
      girlfriend,
      voiceConfig ? { ...voiceConfig, rate: voiceConfig.rate * playbackRate } : undefined,
      () => setIsPlaying(true),
      () => {
        setIsPlaying(false);
        if (progressTimerRef.current) clearInterval(progressTimerRef.current);
        setPlaybackProgress(0);
        setCurrentTime(0);
      }
    );
  };

  const handleCycleSpeed = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextRate = playbackRate === 1 ? 1.5 : playbackRate === 1.5 ? 2 : 1;
    setPlaybackRate(nextRate);
  };

  useEffect(() => {
    return () => {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    };
  }, []);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col space-y-2 max-w-sm sm:max-w-md w-full">
      {/* WhatsApp / Telegram Styled Voice Note Container */}
      <div className="p-3.5 rounded-2xl bg-gradient-to-br from-slate-900/90 via-[#131522] to-slate-900/80 border border-rose-500/30 shadow-lg shadow-black/40">
        
        {/* Top Header inside bubble: avatar + name + status */}
        <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-slate-800/60">
          <div className="flex items-center gap-2">
            <div className="relative w-6 h-6 rounded-full overflow-hidden border border-rose-500/40">
              <img src={avatarUrl} alt={senderName} className="w-full h-full object-cover" />
              {isPlaying && (
                <div className="absolute inset-0 bg-rose-500/30 animate-pulse" />
              )}
            </div>
            <span className="text-[11px] font-semibold text-rose-300 truncate">
              {voiceNote.isWhisper ? 'Chuchotement secret 🤫' : `Message vocal de ${senderName}`}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={handleCycleSpeed}
              className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-slate-800 text-rose-400 hover:bg-slate-700 transition"
              title="Vitesse de lecture"
            >
              {playbackRate}x
            </button>
            <span className="text-[10px] font-mono text-slate-400">
              {isPlaying ? formatTime(currentTime) : formatTime(duration)}
            </span>
          </div>
        </div>

        {/* Audio Player Controls & Waveform */}
        <div className="flex items-center gap-3">
          {/* Play/Pause Button */}
          <button
            type="button"
            onClick={handleTogglePlay}
            className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-transform active:scale-95 shadow-md ${
              isPlaying
                ? 'bg-gradient-to-tr from-rose-600 to-pink-500 text-white shadow-rose-500/30'
                : 'bg-rose-500/20 text-rose-400 border border-rose-500/40 hover:bg-rose-500/30'
            }`}
          >
            {isPlaying ? (
              <Pause className="w-4 h-4 fill-white" />
            ) : (
              <Play className="w-4 h-4 ml-0.5 fill-rose-400" />
            )}
          </button>

          {/* Animated Waveform Visualizer */}
          <div className="flex-1 flex items-center gap-0.5 sm:gap-1 h-8 overflow-hidden px-1">
            {waveformBars.map((barHeight, idx) => {
              const barProgress = idx / waveformBars.length;
              const isPassed = playbackProgress >= barProgress;
              const isCurrent = Math.abs(playbackProgress - barProgress) < 0.05 && isPlaying;

              return (
                <div
                  key={idx}
                  style={{ height: `${Math.max(18, Math.min(100, barHeight))}%` }}
                  className={`w-1 rounded-full transition-all duration-150 ${
                    isPassed
                      ? 'bg-gradient-to-t from-rose-500 to-pink-400'
                      : 'bg-slate-700/80 hover:bg-slate-600'
                  } ${isCurrent ? 'scale-y-125 bg-white' : ''}`}
                />
              );
            })}
          </div>
        </div>

        {/* Transcript Disclosure Accordion */}
        <div className="mt-2.5 pt-2 border-t border-slate-800/50 flex flex-col">
          <button
            onClick={() => setShowTranscript(!showTranscript)}
            className="flex items-center justify-between text-[10px] text-slate-400 hover:text-slate-200 transition"
          >
            <span>{showTranscript ? 'Masquer la transcription' : 'Afficher le texte'}</span>
            {showTranscript ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>

          {showTranscript && (
            <p className="mt-2 text-xs text-slate-200 italic leading-relaxed bg-black/30 p-2.5 rounded-xl border border-slate-800">
              "{voiceNote.transcript}"
            </p>
          )}
        </div>

      </div>
    </div>
  );
};
