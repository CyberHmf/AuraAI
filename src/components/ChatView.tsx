import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, Camera, Volume2, VolumeX, Sparkles, Heart, 
  Sun, Zap, ChevronRight, Image as ImageIcon, X, Loader2, RotateCcw, Mic, Flame,
  RefreshCw, Trash2, Pencil, Check
} from 'lucide-react';
import { GirlfriendPersona, UserPersona, ChatMessage, RealWorldContext, SelfieItem, VoiceConfig, LightweightMemory, ChatMode, SelfieConfig, LLMConfig } from '../types';
import { speakMessage, stopSpeaking } from '../services/speechService';
import { VoiceNoteBubble } from './VoiceNoteBubble';
import { UserPhotoModal } from './UserPhotoModal';

interface ChatViewProps {
  girlfriend: GirlfriendPersona;
  user: UserPersona;
  messages: ChatMessage[];
  memory?: LightweightMemory;
  chatMode: ChatMode;
  onToggleChatMode: (mode: ChatMode) => void;
  onSendMessage: (text: string, userImage?: string) => Promise<void>;
  onTriggerSelfie: (title: string, snippet: string, customOutfit?: string) => Promise<void>;
  onOpenPortrait: () => void;
  onOpenCustomSelfieModal: () => void;
  onOpenCustomizer: () => void;
  onOpenGallery: () => void;
  onOpenMemory: () => void;
  onOpenSettings: () => void;
  onOpenReset?: () => void;
  isTyping: boolean;
  isGeneratingSelfie?: boolean;
  context: RealWorldContext;
  activeTokens: number;
  tokensSaved: number;
  voiceConfig?: VoiceConfig;
  selfieConfig?: SelfieConfig;
  llmConfig?: LLMConfig;
  onUpdateGreeting?: (newGreeting: string) => void;
  onDeleteMessage?: (msgId: string) => void;
  onReloadMessage?: (msgId: string) => Promise<void>;
}

export const ChatView: React.FC<ChatViewProps> = ({
  girlfriend,
  user,
  messages,
  memory,
  chatMode,
  onToggleChatMode,
  onSendMessage,
  onTriggerSelfie,
  onOpenPortrait,
  onOpenCustomSelfieModal,
  onOpenCustomizer,
  onOpenGallery,
  onOpenMemory,
  onOpenSettings,
  onOpenReset,
  isTyping,
  isGeneratingSelfie = false,
  context,
  activeTokens,
  tokensSaved,
  voiceConfig,
  selfieConfig,
  llmConfig,
  onUpdateGreeting,
  onDeleteMessage,
  onReloadMessage,
}) => {
  const [inputText, setInputText] = useState('');
  const [selectedUserImage, setSelectedUserImage] = useState<string | null>(null);
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);
  const [reloadingMsgId, setReloadingMsgId] = useState<string | null>(null);
  const [enlargedPhoto, setEnlargedPhoto] = useState<SelfieItem | null>(null);
  const [enlargedUserPhoto, setEnlargedUserPhoto] = useState<string | null>(null);
  const [isGreetingModalOpen, setIsGreetingModalOpen] = useState(false);
  const [greetingDraft, setGreetingDraft] = useState('');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUserPhotoModalOpen, setIsUserPhotoModalOpen] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  // Handle image file selection from user device
  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 8 * 1024 * 1024) {
        setUploadError("L'image est trop volumineuse (maximum 8 Mo).");
        setTimeout(() => setUploadError(null), 4500);
        e.target.value = '';
        return;
      }
      setUploadError(null);
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setSelectedUserImage(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
    // Reset file input value to allow selecting same file again
    e.target.value = '';
  };

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if ((!inputText.trim() && !selectedUserImage) || isTyping) return;
    const text = inputText.trim();
    const imageToSend = selectedUserImage || undefined;
    setInputText('');
    setSelectedUserImage(null);
    await onSendMessage(text, imageToSend);
  };

  const handleToggleVoice = async (msg: ChatMessage) => {
    if (speakingMsgId === msg.id) {
      stopSpeaking();
      setSpeakingMsgId(null);
    } else {
      setSpeakingMsgId(msg.id);
      await speakMessage(
        msg.text,
        girlfriend,
        voiceConfig,
        () => setSpeakingMsgId(msg.id),
        () => setSpeakingMsgId(null)
      );
    }
  };

  // Format asterisk actions *sourit* into elegant italics with subtle pink glow
  const renderFormattedText = (text: string) => {
    const parts = text.split(/(\*[^*]+\*)/g);
    return parts.map((part, index) => {
      if (part.startsWith('*') && part.endsWith('*')) {
        const actionText = part.slice(1, -1);
        return (
          <em key={index} className="text-rose-300/90 font-normal not-italic block my-1 text-[12px] bg-rose-500/10 px-2.5 py-1 rounded-lg border border-rose-500/15 w-fit">
            * {actionText} *
          </em>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#090a10] relative">
      
      {/* Top Ambient Bar: Avatar Click + Mode Switch + Her Mood + Token Efficiency Pill */}
      <div className="px-3 sm:px-4 py-2 bg-[#0e1018]/90 border-b border-slate-800/60 flex items-center justify-between text-xs shrink-0 gap-2 flex-wrap">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onOpenPortrait}
            className="flex items-center gap-2 group cursor-pointer hover:opacity-90 transition text-left"
            title="Cliquer pour afficher son portrait officiel en grand 📸"
          >
            <div className="w-7 h-7 rounded-full overflow-hidden border border-rose-500/40 group-hover:border-rose-400 group-hover:scale-105 transition shadow-sm bg-black">
              <img
                src={girlfriend.appearance.avatarUrl}
                alt={girlfriend.name}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-slate-200 font-medium group-hover:text-rose-300 transition">{girlfriend.name}</span>
            </div>
          </button>
          <span className="text-slate-500 hidden md:inline">· Tenue : <span className="text-rose-300">{girlfriend.appearance.currentOutfitStyle}</span></span>
        </div>

        {/* Chat Mode Switch: Messages (SMS) vs In Real Life (IRL) */}
        <div className="flex items-center bg-slate-900/90 border border-slate-800 p-0.5 rounded-xl shadow-inner">
          <button
            type="button"
            onClick={() => onToggleChatMode('message')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition flex items-center gap-1.5 ${
              chatMode === 'message'
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Mode SMS : style SMS/WhatsApp réaliste, sans astérisques d'actions"
          >
            <span>💬 SMS</span>
          </button>
          <button
            type="button"
            onClick={() => onToggleChatMode('irl')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition flex items-center gap-1.5 ${
              chatMode === 'irl'
                ? 'bg-pink-500/25 text-pink-200 border border-pink-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Mode In Real Life : présence physique dans la pièce, gestes et regards décrits entre astérisques"
          >
            <Sparkles className="w-3 h-3 text-pink-400" />
            <span>In Real Life</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onOpenMemory}
            className="flex items-center gap-1.5 text-[11px] text-emerald-400/90 bg-emerald-950/40 border border-emerald-500/20 px-2 py-0.5 rounded-lg hover:bg-emerald-950/60 transition"
          >
            <Zap className="w-3 h-3 text-emerald-400" />
            <span className="hidden xs:inline">{activeTokens} tok (~95% économisés)</span>
            <span className="xs:hidden">{activeTokens} tok</span>
          </button>
        </div>
      </div>

      {/* Messages Stream */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4 max-w-4xl w-full mx-auto">
        
        {/* Dynamic Jealousy Alert Banner */}
        {memory?.jealousyState?.isJealous && (
          <div className="p-3.5 rounded-2xl bg-gradient-to-r from-red-950/70 via-rose-950/40 to-slate-900 border border-red-500/40 shadow-lg shadow-red-950/30 flex items-center justify-between gap-3 text-xs animate-in fade-in slide-in-from-top-1 mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-red-500/20 border border-red-500/30 flex items-center justify-center text-red-400 shrink-0">
                <Flame className="w-4 h-4 text-red-400 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-red-200">
                    {girlfriend.name} est jalouse {memory.jealousyState.level === 'possessive' ? 'et possessive' : 'et piquée'} ! 🌶️
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-500/30 font-medium">
                    Trigger : "{memory.jealousyState.triggerReason}"
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 mt-0.5">
                  Elle a besoin de savoir que tu n'as d'yeux que pour elle. Rassure-la vite !
                </p>
              </div>
            </div>

            <button
              onClick={() => onSendMessage(`Ne sois pas jalouse mon amour, tu es la seule et l'unique pour moi 💕`)}
              className="text-[11px] font-semibold px-3 py-1.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white shadow-md shadow-red-600/25 transition shrink-0 whitespace-nowrap active:scale-95 flex items-center gap-1"
            >
              <Heart className="w-3 h-3 fill-white" />
              <span>La rassurer</span>
            </button>
          </div>
        )}

        {/* Companion Welcome / Icebreaker Banner */}
        <div className="p-4 rounded-3xl bg-gradient-to-br from-slate-900/80 via-[#13111f]/70 to-[#0e0c17] border border-slate-800 text-center space-y-2 mb-2">
          <div 
            onClick={onOpenPortrait}
            className="w-16 h-16 rounded-full mx-auto p-0.5 bg-gradient-to-tr from-rose-500 to-pink-500 shadow-xl shadow-rose-500/20 cursor-pointer hover:scale-105 transition"
            title="Cliquer pour afficher son portrait officiel en grand 📸"
          >
            <img
              src={girlfriend.appearance.avatarUrl}
              alt={girlfriend.name}
              className="w-full h-full rounded-full object-cover"
            />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-white font-display">
              {girlfriend.name}, {girlfriend.age} ans
            </h1>
            <p className="text-xs text-rose-300/90 font-medium">
              {girlfriend.relationshipStatus === 'girlfriend' ? 'Ta petite amie' : girlfriend.relationshipStatus} · {girlfriend.occupation}
            </p>
          </div>
          <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
            "{girlfriend.bio.slice(0, 140)}..."
          </p>

          <div className="flex items-center justify-center gap-2 pt-1">
            <button
              onClick={onOpenCustomizer}
              className={`text-[11px] px-3 py-1.5 rounded-xl border transition flex items-center gap-1.5 font-medium ${
                girlfriend.appearance.avatarUrl.startsWith('data:image/svg+xml')
                  ? 'bg-gradient-to-r from-rose-500 to-purple-600 text-white border-transparent shadow-lg shadow-rose-500/25 animate-pulse'
                  : 'text-rose-300 hover:text-white bg-rose-500/10 border-rose-500/20'
              }`}
            >
              <span>{girlfriend.appearance.avatarUrl.startsWith('data:image/svg+xml') ? "📸 Générer son portrait officiel" : "Modifier ses traits & tenue"}</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Message List */}
        {messages.map((msg, index) => {
          if (msg.isSystemDivider) {
            // Ne pas afficher de séparateur si l'utilisateur n'a jamais tapé de message avant,
            // ou si l'élément précédent était déjà un séparateur
            const hasUserMsgBefore = messages.slice(0, index).some(m => m.sender === 'user');
            const isDuplicate = index > 0 && messages[index - 1]?.isSystemDivider;
            if (!hasUserMsgBefore || isDuplicate) {
              return null;
            }

            const isIrl = msg.chatMode === 'irl' || msg.text?.includes('Real Life') || msg.text?.includes('Présentiel');
            return (
              <div key={msg.id} className="py-2.5 flex items-center justify-center gap-3 my-2 select-none animate-in fade-in">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-700/60 to-slate-800" />
                <div className="flex items-center gap-2 px-3.5 py-1 rounded-full bg-slate-900/90 border border-slate-800/90 text-[11px] font-medium shadow-sm">
                  {isIrl ? (
                    <>
                      <Sparkles className="w-3.5 h-3.5 text-pink-400" />
                      <span className="text-pink-300 font-semibold">Mode Présentiel (IRL)</span>
                      <span className="text-slate-500">· Gestes & immersion</span>
                    </>
                  ) : (
                    <>
                      <span>💬</span>
                      <span className="text-rose-300 font-semibold">Mode Messages SMS</span>
                      <span className="text-slate-500">· Textos complices</span>
                    </>
                  )}
                </div>
                <div className="h-px flex-1 bg-gradient-to-r from-slate-800 via-slate-700/60 to-transparent" />
              </div>
            );
          }

          const isUser = msg.sender === 'user';
          return (
            <div
              key={msg.id}
              className={`flex items-end gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}
            >
              {/* Girlfriend Avatar */}
              {!isUser && (
                <div 
                  onClick={onOpenPortrait}
                  className="w-8 h-8 rounded-full overflow-hidden shrink-0 border border-rose-500/30 cursor-pointer hover:scale-105 hover:border-rose-400 transition shadow-sm bg-black"
                  title="Cliquer pour afficher son portrait en grand 📸"
                >
                  <img
                    src={girlfriend.appearance.avatarUrl}
                    alt={girlfriend.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              {/* Bubble Body */}
              <div
                className={`max-w-[85%] sm:max-w-[75%] rounded-3xl p-4 shadow-sm text-xs leading-relaxed space-y-2.5 ${
                  isUser
                    ? 'bg-gradient-to-r from-rose-600 to-pink-600 text-white rounded-br-sm'
                    : 'bg-[#141624] border border-slate-800 text-slate-200 rounded-bl-sm'
                }`}
              >
                {/* Photo sent by USER (Vision Feature) */}
                {msg.userImage && (
                  <div
                    onClick={() => setEnlargedUserPhoto(msg.userImage!)}
                    className="rounded-2xl overflow-hidden max-w-[240px] bg-black/40 border border-white/20 cursor-pointer group relative shadow-lg"
                  >
                    <img
                      src={msg.userImage}
                      alt="Photo envoyée"
                      className="w-full h-auto max-h-[220px] object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute bottom-1 right-2 bg-black/60 px-1.5 py-0.5 rounded text-[9px] text-white">
                      Photo analysée 👁️
                    </div>
                  </div>
                )}

                {/* Selfie Card if message has one */}
                {msg.selfie && (
                  <div
                    onClick={() => setEnlargedPhoto(msg.selfie!)}
                    className="w-[240px] sm:w-[260px] aspect-[9/16] rounded-2xl overflow-hidden bg-black/40 border border-slate-700/60 cursor-pointer group relative shadow-lg shrink-0 my-1"
                  >
                    <img
                      src={msg.selfie.url}
                      alt={msg.selfie.scenarioTitle}
                      className="w-full h-full object-cover object-top block transition-transform duration-300 group-hover:scale-105"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />
                    <div className="absolute bottom-2.5 left-2.5 right-2.5 text-white pointer-events-none">
                      <span className="text-[11px] text-rose-300 font-semibold block">{msg.selfie.scenarioTitle}</span>
                      <span className="text-[10px] text-slate-300 block">{msg.selfie.timestamp}</span>
                    </div>
                  </div>
                )}

                {/* Voice Note Bubble (WhatsApp style) */}
                {msg.voiceNote && (
                  <div className="my-1">
                    <VoiceNoteBubble
                      voiceNote={msg.voiceNote}
                      girlfriend={girlfriend}
                      voiceConfig={voiceConfig}
                    />
                  </div>
                )}

                {/* Text content (hidden if voiceNote already has transcript and no standalone text) */}
                {msg.text && !msg.voiceNote && (
                  <div className="whitespace-pre-wrap break-words">
                    {renderFormattedText(msg.text)}
                  </div>
                )}

                {/* Bottom metadata (timestamp + audio TTS button for girlfriend) */}
                <div className={`flex items-center justify-between gap-3 pt-1 text-[10px] ${
                  isUser ? 'text-rose-200/80' : 'text-slate-500'
                }`}>
                  <span>{msg.timestamp}</span>

                  {!isUser && (() => {
                    const isWelcome = msg.id === 'msg-welcome' || msg.id.startsWith('msg-welcome');
                    let lastUserIdx = -1;
                    for (let i = messages.length - 1; i >= 0; i--) {
                      if (messages[i].sender === 'user') {
                        lastUserIdx = i;
                        break;
                      }
                    }
                    const lastMsg = messages[messages.length - 1];
                    const hasEarlierGfReplyAfterLastUser =
                      lastUserIdx !== -1 &&
                      messages.slice(lastUserIdx + 1, index).some(m => m.sender === 'girlfriend' && !m.isSystemDivider);
                    const canReload =
                      !isWelcome &&
                      lastUserIdx !== -1 &&
                      lastMsg?.id === msg.id &&
                      index > lastUserIdx &&
                      !hasEarlierGfReplyAfterLastUser;

                    return (
                      <div className="flex items-center gap-1.5 flex-wrap justify-end">
                        {isWelcome && onUpdateGreeting && (
                          <button
                            onClick={() => {
                              setGreetingDraft(msg.text);
                              setIsGreetingModalOpen(true);
                            }}
                            className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] text-pink-300 hover:text-white bg-pink-500/15 border border-pink-500/30 transition"
                            title="Modifier le premier message d'accueil directement"
                          >
                            <Pencil className="w-2.5 h-2.5" />
                            <span>Modifier</span>
                          </button>
                        )}
                        <button
                          onClick={() => handleToggleVoice(msg)}
                          className={`flex items-center gap-1 px-2 py-0.5 rounded-md transition ${
                            speakingMsgId === msg.id
                              ? 'bg-rose-500/30 text-rose-300 animate-pulse'
                              : 'hover:text-slate-300 hover:bg-slate-800'
                          }`}
                          title="Écouter la voix de la compagne"
                        >
                          {speakingMsgId === msg.id ? (
                            <>
                              <VolumeX className="w-3 h-3 text-rose-400" />
                              <span>Stop</span>
                            </>
                          ) : (
                            <>
                              <Volume2 className="w-3 h-3 text-rose-400" />
                              <span>Écouter</span>
                            </>
                          )}
                        </button>
                        {canReload && onReloadMessage && (
                          <button
                            onClick={async () => {
                              if (speakingMsgId === msg.id) {
                                stopSpeaking();
                                setSpeakingMsgId(null);
                              }
                              setReloadingMsgId(msg.id);
                              try {
                                await onReloadMessage(msg.id);
                              } finally {
                                setReloadingMsgId(null);
                              }
                            }}
                            disabled={isTyping || isGeneratingSelfie}
                            className="flex items-center gap-1 px-2 py-0.5 rounded-md hover:text-purple-300 hover:bg-purple-500/10 transition disabled:opacity-40 disabled:cursor-not-allowed"
                            title="Régénérer une nouvelle réponse au dernier message"
                          >
                            <RefreshCw className={`w-3 h-3 text-purple-400 ${reloadingMsgId === msg.id ? 'animate-spin' : ''}`} />
                            <span>Régénérer</span>
                          </button>
                        )}
                        {!isWelcome && onDeleteMessage && (
                          <button
                            onClick={() => {
                              if (speakingMsgId === msg.id) {
                                stopSpeaking();
                                setSpeakingMsgId(null);
                              }
                              onDeleteMessage(msg.id);
                            }}
                            disabled={isTyping || isGeneratingSelfie}
                            className="flex items-center gap-1 px-2 py-0.5 rounded-md hover:text-rose-300 hover:bg-rose-500/10 transition disabled:opacity-40 disabled:cursor-not-allowed"
                            title={msg.selfie ? "Supprimer cette réponse et l'image générée" : "Supprimer ce message"}
                          >
                            <Trash2 className="w-3 h-3 text-slate-400" />
                            <span>Supprimer</span>
                          </button>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* User Avatar ('Him') */}
              {isUser && (
                <div
                  onClick={onOpenCustomizer}
                  className="w-8 h-8 rounded-full overflow-hidden shrink-0 border border-slate-700/80 bg-slate-800 flex items-center justify-center cursor-pointer hover:border-rose-500/50 transition shadow-sm"
                  title="Ton profil ('Him') - Cliquer pour modifier"
                >
                  {user.avatarUrl ? (
                    <img
                      src={user.avatarUrl}
                      alt={user.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-[11px] font-bold text-rose-300">
                      {user.name ? user.name.slice(0, 1).toUpperCase() : 'H'}
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Typing indicator */}
        {isTyping && (
          <div className="flex items-center gap-2 text-xs text-rose-300 pl-11">
            <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-bounce" style={{ animationDelay: '300ms' }} />
              <span className="ml-1 text-[11px] text-slate-400">{girlfriend.name} regarde & écrit...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Thumb-Zone Quick Action Chips */}
      <div className="px-4 py-2 bg-[#0b0c13]/80 border-t border-slate-800/60 overflow-x-auto flex items-center gap-2 shrink-0">
        <button
          onClick={() => setIsUserPhotoModalOpen(true)}
          className="text-xs px-3 py-1.5 rounded-xl border border-purple-500/30 bg-purple-500/10 text-purple-200 hover:bg-purple-500/20 active:scale-95 transition whitespace-nowrap shrink-0 flex items-center gap-1.5"
        >
          <ImageIcon className="w-3.5 h-3.5 text-purple-400" />
          <span>Lui envoyer une photo 📷</span>
        </button>

        <button
          onClick={() => onSendMessage("Envoie-moi une note vocale mon amour, j'ai tellement envie d'entendre ta voix... 🎙️")}
          className="text-xs px-3 py-1.5 rounded-xl border border-rose-500/40 bg-rose-500/15 text-rose-200 hover:bg-rose-500/25 active:scale-95 transition whitespace-nowrap shrink-0 flex items-center gap-1.5 font-medium shadow-sm shadow-rose-500/10"
        >
          <Mic className="w-3.5 h-3.5 text-rose-400" />
          <span>Note vocale WhatsApp 🎙️</span>
        </button>

        <button
          onClick={() => onTriggerSelfie('Sortie de douche & serviette', 'fresh out of warm shower, fluffy white towel wrapped around hair, glowing skin, playful selfie')}
          className="text-xs px-3 py-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20 active:scale-95 transition whitespace-nowrap shrink-0 flex items-center gap-1.5"
        >
          <Sparkles className="w-3.5 h-3.5 text-rose-300" />
          <span>Sortie de douche 🧖‍♀️</span>
        </button>

        <button
          onClick={() => onTriggerSelfie('Sous la couette au lit', 'cozy late night in bed under duvet, delicate silk camisole, messy wavy hair, bedside lamp')}
          className="text-xs px-3 py-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20 active:scale-95 transition whitespace-nowrap shrink-0 flex items-center gap-1.5"
        >
          <Heart className="w-3.5 h-3.5 text-pink-400" />
          <span>Sous la couette 🌙</span>
        </button>

        <button
          onClick={() => onSendMessage("J'ai croisé une collègue super sympa tout à l'heure, on a bu un café ensemble...")}
          className="text-xs px-3 py-1.5 rounded-xl border border-red-500/30 bg-red-500/10 text-red-200 hover:bg-red-500/20 active:scale-95 transition whitespace-nowrap shrink-0 flex items-center gap-1.5"
          title="Tester le détecteur de jalousie"
        >
          <Flame className="w-3.5 h-3.5 text-red-400" />
          <span>Tester la jalousie 🌶️</span>
        </button>

        <button
          type="button"
          onClick={onOpenCustomSelfieModal}
          className="text-xs px-3 py-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20 active:scale-95 transition whitespace-nowrap shrink-0 flex items-center gap-1.5 font-medium shadow-sm"
          title="Demander un selfie personnalisé avec ton propre prompt et décor"
        >
          <Camera className="w-3.5 h-3.5 text-rose-400" />
          <span>Autre selfie 📸</span>
        </button>

        {onOpenReset && (
          <button
            type="button"
            onClick={onOpenReset}
            className="text-xs px-3 py-1.5 rounded-xl border border-slate-800 bg-slate-900/60 text-slate-400 hover:text-rose-400 hover:border-slate-700 active:scale-95 transition whitespace-nowrap shrink-0 flex items-center gap-1.5"
            title="Options de réinitialisation (Soft & Hard)"
          >
            <RotateCcw className="w-3 h-3 text-slate-500" />
            <span>Reset / Vider</span>
          </button>
        )}
      </div>

      {/* Selected Image Attachment Preview Bar */}
      {selectedUserImage && (
        <div className="px-4 py-2 bg-slate-900/90 border-t border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="relative w-12 h-12 rounded-xl overflow-hidden border border-purple-500/50 bg-black">
              <img src={selectedUserImage} alt="Aperçu" className="w-full h-full object-cover" />
            </div>
            <div className="text-xs">
              <span className="text-purple-300 font-semibold block">Photo prête à envoyer</span>
              <span className="text-[10px] text-slate-400">Elle va l'analyser avec sa vision et s'en souvenir</span>
            </div>
          </div>
          <button
            onClick={() => setSelectedUserImage(null)}
            className="w-7 h-7 rounded-lg bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Hidden File Input for Image Upload / Camera */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImageFileChange}
        accept="image/*"
        className="hidden"
      />

      {/* Input Bar */}
      <form onSubmit={handleSend} className="p-2.5 sm:p-3.5 bg-[#0e1018] border-t border-slate-800/80 shrink-0 pb-safe space-y-2">
        {/* IRL Actions Shortcut Bar (Only in In Real Life mode) */}
        {chatMode === 'irl' && (
          <div className="flex items-center gap-1.5 max-w-4xl mx-auto px-1 overflow-x-auto pb-1 scrollbar-none">
            <span className="text-[10px] text-pink-400 font-semibold tracking-wider uppercase mr-1 shrink-0">Actions IRL :</span>
            {[
              { label: '✨ Sourire', text: ' *te sourit doucement* ' },
              { label: '🤝 Main', text: ' *prend ta main dans la sienne* ' },
              { label: '😳 Rougir', text: ' *rougit légèrement en baissant les yeux* ' },
              { label: '👀 Regard', text: ' *te regarde droit dans les yeux avec tendresse* ' },
              { label: '🫂 Câlin', text: ' *s\'approche pour un câlin chaleureux* ' },
            ].map((act) => (
              <button
                key={act.label}
                type="button"
                onClick={() => setInputText((prev) => prev ? `${prev}${act.text}` : act.text.trim())}
                className="text-[11px] px-2.5 py-1 rounded-lg bg-pink-500/10 hover:bg-pink-500/20 text-pink-200 border border-pink-500/30 transition whitespace-nowrap shrink-0 active:scale-95 shadow-sm"
                title={`Insérer l'action ${act.label}`}
              >
                {act.label}
              </button>
            ))}
          </div>
        )}

        {/* Quick 5 Emojis Bar */}
        <div className="flex items-center gap-1.5 max-w-4xl mx-auto px-1">
          <span className="text-[10px] text-slate-500 font-semibold tracking-wider uppercase mr-1">Émojis :</span>
          {['❤️', '🥰', '😉', '✨', '🔥'].map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => setInputText((prev) => prev + emoji)}
              className="w-7 h-7 rounded-lg bg-slate-900/70 hover:bg-rose-500/20 text-sm flex items-center justify-center transition active:scale-125 border border-slate-800/80 hover:border-rose-500/40"
              title={`Ajouter ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>

        {/* Inline upload error toast (no browser alert) */}
        {uploadError && (
          <div className="max-w-4xl mx-auto mb-2 px-3 py-1.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between gap-2">
            <span>{uploadError}</span>
            <button
              type="button"
              onClick={() => setUploadError(null)}
              className="text-rose-300 hover:text-white transition"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <div className="flex items-center gap-2 max-w-4xl mx-auto">
          {/* Send photo trigger */}
          <button
            type="button"
            onClick={() => setIsUserPhotoModalOpen(true)}
            className="w-10 h-10 rounded-2xl flex items-center justify-center text-purple-400 hover:text-purple-300 hover:bg-purple-950/40 border border-purple-500/30 transition shrink-0"
            title="Lui envoyer une photo (importer ou générer avec ton portrait)"
          >
            <ImageIcon className="w-4 h-4" />
          </button>

          {/* Selfie gallery trigger */}
          <button
            type="button"
            onClick={onOpenGallery}
            className="w-10 h-10 rounded-2xl flex items-center justify-center text-slate-400 hover:text-rose-400 hover:bg-slate-900 border border-slate-800 transition shrink-0"
            title="Ouvrir la galerie selfies"
          >
            <Camera className="w-4 h-4" />
          </button>

          <textarea
            rows={1}
            value={inputText}
            onChange={(e) => {
              setInputText(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={selectedUserImage ? "Ajoute un mot avec ta photo (ex: Regarde ce que je mange !)..." : `Écris à ${girlfriend.name}...`}
            className="flex-1 text-xs sm:text-sm bg-slate-900/90 border border-slate-800 rounded-2xl px-4 py-3 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-rose-500/85 transition resize-none overflow-y-auto max-h-32 leading-relaxed"
          />

          {!inputText.trim() && !selectedUserImage ? (
            <button
              type="button"
              onClick={() => onSendMessage("Envoie-moi une note vocale mon amour, dis-moi ce que tu penses là tout de suite 🎙️")}
              className="w-10 h-10 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 border border-rose-500/30 flex items-center justify-center transition active:scale-95 shrink-0"
              title="Demander une note vocale WhatsApp"
            >
              <Mic className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={(!inputText.trim() && !selectedUserImage) || isTyping}
              className="w-10 h-10 rounded-2xl bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white flex items-center justify-center transition disabled:opacity-40 active:scale-95 shrink-0 shadow-md shadow-rose-500/20"
            >
              <Send className="w-4 h-4" />
            </button>
          )}
        </div>
      </form>

      {/* Lightbox for tapped selfies */}
      {enlargedPhoto && (
        <div 
          onClick={() => setEnlargedPhoto(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/90 backdrop-blur-md cursor-pointer"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-xs sm:max-w-sm w-full rounded-3xl overflow-hidden bg-slate-900 border border-slate-800 shadow-2xl flex flex-col"
          >
            <div className="relative w-full aspect-[9/16] bg-black overflow-hidden flex items-center justify-center">
              <img
                src={enlargedPhoto.url}
                alt={enlargedPhoto.scenarioTitle}
                className="w-full h-full object-cover object-top block"
              />
            </div>
            <div className="p-4 bg-slate-900 text-xs">
              <span className="text-rose-400 font-semibold block text-sm">{enlargedPhoto.scenarioTitle}</span>
              <p className="text-slate-200 mt-1 italic leading-relaxed">"{enlargedPhoto.caption}"</p>
              <div className="mt-2 text-[10px] text-slate-400 flex items-center justify-between">
                <span>Tenue : {enlargedPhoto.outfitUsed}</span>
                <span className="text-slate-500">{enlargedPhoto.timestamp}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox for user photo */}
      {enlargedUserPhoto && (
        <div 
          onClick={() => setEnlargedUserPhoto(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md cursor-pointer"
        >
          <div className="relative max-w-sm sm:max-w-md rounded-3xl overflow-hidden bg-slate-900 border border-slate-800 shadow-2xl p-2">
            <img
              src={enlargedUserPhoto}
              alt="Photo envoyée"
              className="w-full h-auto max-h-[80vh] object-contain rounded-2xl"
            />
          </div>
        </div>
      )}

      {/* Custom Aura AI Modal for editing the initial greeting message */}
      {isGreetingModalOpen && onUpdateGreeting && (
        <div
          onClick={() => setIsGreetingModalOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/90 backdrop-blur-md animate-in fade-in duration-200"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setIsGreetingModalOpen(false);
            }}
            className="relative w-full max-w-lg rounded-3xl bg-[#0e1018] border border-rose-500/30 shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-slate-800/80 flex items-center justify-between bg-[#121420]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full overflow-hidden border border-rose-500/40 bg-black shrink-0">
                  <img
                    src={girlfriend.appearance.avatarUrl}
                    alt={girlfriend.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-white font-display flex items-center gap-1.5">
                    <span>Personnaliser le message d'accueil</span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Définis la toute première phrase et l'ambiance de {girlfriend.name}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsGreetingModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const trimmed = greetingDraft.trim();
                if (!trimmed) return;
                onUpdateGreeting(trimmed);
                setIsGreetingModalOpen(false);
              }}
              className="p-4 sm:p-6 space-y-4 text-xs"
            >
              <div className="space-y-2">
                <label className="text-[11px] font-semibold text-rose-300 uppercase tracking-wider flex items-center justify-between">
                  <span>Message d'ouverture :</span>
                  <span className="text-[10px] text-slate-500 normal-case font-normal">
                    *actions* entre astérisques supportées
                  </span>
                </label>
                <textarea
                  rows={4}
                  autoFocus
                  value={greetingDraft}
                  onChange={(e) => setGreetingDraft(e.target.value)}
                  placeholder={`Ex: *te sourit tendrement* Coucou mon cœur, tu m'as tellement manqué aujourd'hui... ✨`}
                  className="w-full bg-slate-900/90 border border-slate-800 focus:border-rose-500/80 rounded-2xl p-3.5 text-slate-100 placeholder:text-slate-500 focus:outline-none transition leading-relaxed resize-none text-xs sm:text-sm"
                  required
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsGreetingModalOpen(false)}
                  className="flex-1 py-2.5 px-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold transition text-xs"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={!greetingDraft.trim()}
                  className="flex-1 py-2.5 px-4 rounded-2xl bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white font-semibold transition disabled:opacity-50 shadow-lg shadow-rose-500/20 text-xs flex items-center justify-center gap-1.5 active:scale-95"
                >
                  <Check className="w-4 h-4" />
                  <span>Enregistrer</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal choice: Upload user photo OR Generate AI photo with User portrait persistence */}
      <UserPhotoModal
        isOpen={isUserPhotoModalOpen}
        onClose={() => setIsUserPhotoModalOpen(false)}
        girlfriend={girlfriend}
        user={user}
        selfieConfig={selfieConfig}
        llmConfig={llmConfig}
        onPickLocalFile={() => fileInputRef.current?.click()}
        onAttachGeneratedPhoto={(dataUrl) => {
          setUploadError(null);
          setSelectedUserImage(dataUrl);
        }}
        onOpenUserProfile={onOpenCustomizer}
      />

    </div>
  );
};
