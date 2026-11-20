import React, { useState } from 'react';
import {
  X,
  Upload,
  Sparkles,
  Wand2,
  RefreshCw,
  Check,
  Loader2,
  User,
  Image as ImageIcon,
  AlertCircle,
} from 'lucide-react';
import { GirlfriendPersona, UserPersona, SelfieConfig, LLMConfig } from '../types';
import { generateUserPhoto } from '../services/userPhotoService';

interface UserPhotoModalProps {
  isOpen: boolean;
  onClose: () => void;
  girlfriend: GirlfriendPersona;
  user: UserPersona;
  selfieConfig?: SelfieConfig;
  llmConfig?: LLMConfig;
  onPickLocalFile: () => void;
  onAttachGeneratedPhoto: (dataUrl: string) => void;
  onOpenUserProfile: () => void;
}

const USER_SCENE_PRESETS = [
  {
    label: '☕ En terrasse',
    prompt: 'Selfie souriant assis en terrasse de café avec un espresso au soleil, tenue décontractée chic',
  },
  {
    label: '🪞 Devant le miroir',
    prompt: 'Selfie devant le miroir en tenue casual moderne (t-shirt ajusté et jean), sourire naturel',
  },
  {
    label: '🏋️‍♂️ Salle de sport',
    prompt: 'Selfie après ma séance de sport à la salle, t-shirt de sport, air énergique et confiant',
  },
  {
    label: '💻 Au bureau / télétravail',
    prompt: 'À mon bureau devant mon ordinateur avec une tasse de café, regard complice vers la caméra',
  },
  {
    label: '🌙 En soirée',
    prompt: 'En soirée dans un bar lounge tamisé, veste élégante, sourire charmeur',
  },
];

export const UserPhotoModal: React.FC<UserPhotoModalProps> = ({
  isOpen,
  onClose,
  girlfriend,
  user,
  selfieConfig,
  llmConfig,
  onPickLocalFile,
  onAttachGeneratedPhoto,
  onOpenUserProfile,
}) => {
  const [scenePrompt, setScenePrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedPreview, setGeneratedPreview] = useState<string | null>(null);
  const [generatedMeta, setGeneratedMeta] = useState<{ providerUsed: string; usedRef: boolean } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const activeConfig: SelfieConfig = selfieConfig || {
    provider: 'pollinations',
    comfyEndpoint: 'http://localhost:8188',
    openRouterApiKey: '',
    nanoGptApiKey: '',
    imageModel: 'flux',
    aspectRatio: '3:4',
    enablePhotoRequests: true,
  };

  const hasUserPortrait = Boolean(user.avatarUrl && !user.avatarUrl.startsWith('data:image/svg'));

  const handleGenerate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!scenePrompt.trim() || isGenerating) return;

    setIsGenerating(true);
    setErrorMsg(null);
    try {
      const result = await generateUserPhoto(user, activeConfig, scenePrompt.trim(), llmConfig);
      setGeneratedPreview(result.dataUrlForVision);
      setGeneratedMeta({
        providerUsed: result.providerUsed,
        usedRef: result.usedReferenceImage,
      });
    } catch (err: any) {
      setErrorMsg(err?.message || 'Impossible de générer la photo pour le moment.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleUsePhoto = () => {
    if (!generatedPreview) return;
    onAttachGeneratedPhoto(generatedPreview);
    setGeneratedPreview(null);
    setGeneratedMeta(null);
    onClose();
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/90 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && !isGenerating) onClose();
        }}
        className="relative w-full max-w-lg rounded-3xl bg-[#0e1018] border border-purple-500/30 shadow-2xl flex flex-col max-h-[92vh] overflow-hidden"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800/80 flex items-center justify-between bg-[#121420]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-500 to-rose-500 flex items-center justify-center text-white shadow-md shadow-purple-500/25">
              <ImageIcon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white font-display">
                Envoyer une photo à {girlfriend.name}
              </h3>
              <p className="text-[11px] text-slate-400">
                Importe une image ou génère-la avec ton portrait persistant
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isGenerating}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-5 text-xs flex-1">
          {/* Option 1: Upload from device */}
          <button
            type="button"
            disabled={isGenerating}
            onClick={() => {
              onClose();
              onPickLocalFile();
            }}
            className="w-full p-3.5 rounded-2xl bg-slate-900/80 hover:bg-slate-800/90 border border-slate-700/80 hover:border-purple-500/50 transition flex items-center justify-between group text-left disabled:opacity-50"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-300 group-hover:scale-105 transition">
                <Upload className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs sm:text-sm font-semibold text-white block">
                  Importer une photo depuis mon appareil
                </span>
                <span className="text-[11px] text-slate-400">
                  Choisir une image ou un selfie déjà présent sur ton PC / téléphone
                </span>
              </div>
            </div>
            <span className="text-[11px] font-medium text-purple-300 px-2.5 py-1 rounded-lg bg-purple-500/10 border border-purple-500/20 shrink-0">
              Parcourir
            </span>
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-800" />
            <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
              Ou générer avec l’IA
            </span>
            <div className="h-px flex-1 bg-slate-800" />
          </div>

          {/* Option 2: AI Generation with User Portrait Persistence */}
          <form onSubmit={handleGenerate} className="space-y-4">
            {/* User Face Reference Card */}
            <div
              className={`p-3 rounded-2xl border flex items-center justify-between gap-3 ${
                hasUserPortrait
                  ? 'bg-emerald-950/20 border-emerald-500/30'
                  : 'bg-amber-950/20 border-amber-500/30'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-xl overflow-hidden border border-slate-700 bg-slate-900 flex items-center justify-center shrink-0">
                  {hasUserPortrait ? (
                    <img
                      src={user.avatarUrl}
                      alt={user.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="w-5 h-5 text-amber-400" />
                  )}
                </div>
                <div className="min-w-0">
                  {hasUserPortrait ? (
                    <>
                      <span className="text-xs font-semibold text-emerald-300 flex items-center gap-1">
                        <Check className="w-3.5 h-3.5 shrink-0" />
                        <span>Persistance du portrait de {user.name} active</span>
                      </span>
                      <p className="text-[11px] text-slate-400 truncate">
                        {user.physicalDescription || 'Ton visage et tes traits seront injectés dans la scène'}
                      </p>
                    </>
                  ) : (
                    <>
                      <span className="text-xs font-semibold text-amber-300 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>Aucun portrait dans ton profil</span>
                      </span>
                      <p className="text-[11px] text-slate-400">
                        Génération basée sur ta description physique. Tu peux importer ta photo dans Profil.
                      </p>
                    </>
                  )}
                </div>
              </div>

              {!hasUserPortrait && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenUserProfile();
                  }}
                  className="px-2.5 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-200 text-[11px] font-medium shrink-0 transition"
                >
                  Mon Profil
                </button>
              )}
            </div>

            {/* Quick scene chips */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-purple-300 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                <span>Idées de scènes rapides :</span>
              </label>
              <div className="flex flex-wrap gap-1.5">
                {USER_SCENE_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    disabled={isGenerating}
                    onClick={() => setScenePrompt(preset.prompt)}
                    className="px-2.5 py-1.5 rounded-xl text-[11px] bg-slate-900 hover:bg-purple-500/15 border border-slate-800 hover:border-purple-500/30 text-slate-300 hover:text-purple-200 transition active:scale-95 disabled:opacity-50"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Scene prompt textarea */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-200 uppercase tracking-wider flex items-center justify-between">
                <span>Décris ta photo / scène :</span>
                <span className="text-[10px] text-slate-500 normal-case font-normal">
                  Moteur : {activeConfig.provider} ({activeConfig.imageModel || 'auto'})
                </span>
              </label>
              <textarea
                rows={3}
                value={scenePrompt}
                onChange={(e) => setScenePrompt(e.target.value)}
                disabled={isGenerating}
                placeholder="Ex: Selfie souriant dans ma voiture avec des lunettes de soleil, ou en train de cuisiner à la maison en t-shirt noir..."
                className="w-full bg-slate-900/90 border border-slate-800 focus:border-purple-500/80 rounded-2xl p-3 text-slate-100 placeholder:text-slate-500 focus:outline-none transition leading-relaxed resize-none text-xs disabled:opacity-60"
                required
              />
            </div>

            {errorMsg && (
              <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">
                {errorMsg}
              </div>
            )}

            {/* Generated Preview */}
            {generatedPreview && (
              <div className="p-3 rounded-2xl bg-slate-900/80 border border-purple-500/40 space-y-3">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-purple-300 font-semibold flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Aperçu généré ({generatedMeta?.providerUsed})</span>
                  </span>
                  {generatedMeta?.usedRef && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                      Portrait préservé ✓
                    </span>
                  )}
                </div>

                <div className="w-48 mx-auto aspect-[3/4] rounded-2xl overflow-hidden border border-slate-700 bg-black shadow-lg">
                  <img
                    src={generatedPreview}
                    alt="Aperçu photo utilisateur"
                    className="w-full h-full object-cover object-top"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleGenerate()}
                    disabled={isGenerating}
                    className="flex-1 py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold transition text-xs flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
                    <span>Régénérer</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleUsePhoto}
                    disabled={isGenerating}
                    className="flex-1 py-2.5 px-3 rounded-xl bg-gradient-to-r from-purple-500 to-rose-500 hover:from-purple-600 hover:to-rose-600 text-white font-semibold transition text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-purple-500/20"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Joindre au chat</span>
                  </button>
                </div>
              </div>
            )}

            {/* Generate / Cancel footer */}
            {!generatedPreview && (
              <div className="flex items-center gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isGenerating}
                  className="flex-1 py-2.5 px-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold transition text-xs disabled:opacity-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={!scenePrompt.trim() || isGenerating}
                  className="flex-1 py-2.5 px-4 rounded-2xl bg-gradient-to-r from-purple-500 to-rose-500 hover:from-purple-600 hover:to-rose-600 text-white font-semibold transition disabled:opacity-50 shadow-lg shadow-purple-500/20 text-xs flex items-center justify-center gap-2 active:scale-95"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Génération en cours...</span>
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-4 h-4" />
                      <span>Générer ma photo</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};
