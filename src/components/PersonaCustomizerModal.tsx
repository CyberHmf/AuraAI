import React, { useState, useEffect, useRef } from 'react';
import { 
  X, UserCheck, Sparkles, Heart, Shirt, Sliders, 
  RotateCcw, Camera, Check, Plus, Trash2, Eye, HelpCircle, Loader2, RefreshCw, Code, Copy, ArrowRight, ArrowLeft, Upload
} from 'lucide-react';
import { GirlfriendPersona, UserPersona, BodyProfile, SelfieConfig, LLMConfig } from '../types';
import { createBlankCustomPersona, BLANK_CUSTOM_AVATAR_PLACEHOLDER } from '../data/presets';
import { generateInitialPortraitWithProtocol, compileVisualAnchorPrompt } from '../services/selfieService';
import { Globe } from 'lucide-react';

interface PersonaCustomizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  girlfriend: GirlfriendPersona;
  user: UserPersona;
  onSave: (updatedGirlfriend: GirlfriendPersona, updatedUser: UserPersona) => void;
  onTestSelfieRequest?: () => void;
  selfieConfig?: SelfieConfig;
  llmConfig?: LLMConfig;
  onRequestOpenRouterConfig?: () => void;
  retryPortraitTrigger?: number;
  retrySkipConfig?: boolean;
}

const ETHNICITY_OPTIONS = [
  { id: 'Caucasienne / Européenne', label: 'Caucasienne' },
  { id: 'Asiatique (Japonaise/Coréenne)', label: 'Asiatique' },
  { id: 'Latina / Métisse ambrée', label: 'Latina / Métisse' },
  { id: 'Afro / Ébène sculptée', label: 'Afro / Ébène' },
  { id: 'Moyen-Orientale / Méditerranéenne', label: 'Méditerranéenne' },
  { id: 'Scandinave / Nordique', label: 'Scandinave' },
];

const HEIGHT_OPTIONS: { id: 'petite' | 'moyenne' | 'grande'; label: string }[] = [
  { id: 'petite', label: 'Petite (~1m55)' },
  { id: 'moyenne', label: 'Moyenne (~1m65)' },
  { id: 'grande', label: 'Grande (~1m75)' },
];

const BODY_TYPE_OPTIONS: { id: 'fine' | 'petite' | 'athletique' | 'generouse' | 'pulpeuse' | 'sablier'; label: string; desc: string }[] = [
  { id: 'fine', label: 'Mince / Fine', desc: 'Silhouette fine et élancée' },
  { id: 'petite', label: 'Small / Petite', desc: 'Menue et délicate' },
  { id: 'athletique', label: 'Athlétique / Fit', desc: 'Tonique et sculptée' },
  { id: 'generouse', label: 'Généreuse / Douce', desc: 'Formes féminines douces' },
  { id: 'pulpeuse', label: 'Pulpeuse / Curvy', desc: 'Courbes voluptueuses' },
  { id: 'sablier', label: 'Sablier (Taille fine)', desc: 'Taille marquée & hanches' },
];

const BUST_OPTIONS: { id: 'petite' | 'moyenne' | 'generouse' | 'voluptueuse'; label: string }[] = [
  { id: 'petite', label: 'Menue / Petite' },
  { id: 'moyenne', label: 'Moyenne naturelle' },
  { id: 'generouse', label: 'Généreuse' },
  { id: 'voluptueuse', label: 'Voluptueuse' },
];

const ATTITUDE_OPTIONS = [
  { id: 'Souriante & lumineuse', label: 'Souriante & lumineuse' },
  { id: 'Pétillante & taquine', label: 'Pétillante & taquine' },
  { id: 'Mystérieuse & magnétique', label: 'Mystérieuse' },
  { id: 'Charismatique & affirmée', label: 'Charismatique' },
  { id: 'Sérieuse & intellectuelle', label: 'Sérieuse' },
  { id: 'Blasée & rebelle rock', label: 'Blasée / Rebelle' },
  { id: 'Douce & timide', label: 'Douce & timide' },
];

const STYLE_OPTIONS = [
  { id: 'Soigné & élégant chic', label: 'Soigné & élégant' },
  { id: 'Teen look / Casual branché', label: 'Teen look / Trendy' },
  { id: 'Négligé cosy décontracté', label: 'Négligé décontracté' },
  { id: 'Streetwear rock & cuir', label: 'Streetwear / Rock' },
  { id: 'Riche & haute couture', label: 'Riche / Haute couture' },
  { id: 'Bohème chic en lin', label: 'Bohème chic' },
  { id: 'Rétro vintage 90s', label: 'Vintage 90s' },
];

// Centres d'intérêt et passions concrètes (élimine la redondance avec la tonalité dominante)
const PASSIONS_AND_INTERESTS = [
  'Passionnée de cinéma & séries d\'auteur',
  'Amoureuse de musique & concerts live',
  'Gourmande & cuisine maison',
  'Créatrice de jeux vidéo & tech',
  'Lectrice passionnée & poésie',
  'Amie des chats & animaux',
  'Noctambule & balades sous les étoiles',
  'Passionnée de photo argentique',
  'Amoureuse de mode vintage & friperies',
  'Sportive & séances yoga/fitness',
  'Accro aux cafés en terrasse',
  'Voyageuse & nouvelles cultures',
];

const COMMON_HAIR_COLORS = [
  { label: 'Blond doré miel', short: 'Blond miel' },
  { label: 'Blond platine polaire', short: 'Blond platine' },
  { label: 'Blond cendré naturel', short: 'Blond cendré' },
  { label: 'Châtain clair reflets caramel', short: 'Châtain caramel' },
  { label: 'Brun chocolat profond', short: 'Brun chocolat' },
  { label: 'Noir corbeau soyeux', short: 'Noir corbeau' },
  { label: 'Roux cuivré flamboyant', short: 'Roux cuivré' },
  { label: 'Auburn reflets pourpres', short: 'Auburn' },
  { label: 'Pastel reflets lilas/rose', short: 'Pastel lilas' },
];

const COMMON_HAIR_STYLES = [
  { label: 'Ondulations douces mi-longues', short: 'Ondulations mi-longues' },
  { label: 'Longs lisses soyeux avec frange', short: 'Longs lisses + frange' },
  { label: 'Carré flou déstructuré (Bob)', short: 'Carré flou / Bob' },
  { label: 'Queue de cheval haute & mèches', short: 'Queue de cheval' },
  { label: 'Boucles aériennes volumineuses', short: 'Boucles volumineuses' },
  { label: 'Chignon messy casual chic', short: 'Chignon messy' },
  { label: 'Mi-longs dégradés wavy', short: 'Dégradé wavy' },
  { label: 'Tresses bohèmes élégantes', short: 'Tresses bohèmes' },
  { label: 'Coupe courte pixie rock', short: 'Pixie rock' },
];

const COMMON_EYE_COLORS = [
  { label: 'Vert émeraude pétillant', short: 'Vert émeraude' },
  { label: 'Bleu ciel profond', short: 'Bleu ciel' },
  { label: 'Bleu glacier perçant', short: 'Bleu glacier' },
  { label: 'Noisette doré chaleureux', short: 'Noisette doré' },
  { label: 'Brun chocolat intense', short: 'Brun chocolat' },
  { label: 'Gris ardoise magnétique', short: 'Gris ardoise' },
  { label: 'Ambre étincelant', short: 'Ambre' },
];

const COMMON_SKIN_TONES = [
  { label: 'Claire et lumineuse', short: 'Claire lumineuse' },
  { label: 'Pâle porcelaine délicate', short: 'Pâle porcelaine' },
  { label: 'Pêche dorée naturelle', short: 'Pêche dorée' },
  { label: 'Hâlée naturelle ensoleillée', short: 'Hâlée' },
  { label: 'Métisse ambrée soyeuse', short: 'Métisse ambrée' },
  { label: 'Ébène veloutée sculptée', short: 'Ébène veloutée' },
];

export const PersonaCustomizerModal: React.FC<PersonaCustomizerModalProps> = ({
  isOpen,
  onClose,
  girlfriend,
  user,
  onSave,
  onTestSelfieRequest,
  selfieConfig,
  llmConfig,
  onRequestOpenRouterConfig,
  retryPortraitTrigger = 0,
  retrySkipConfig = false,
}) => {
  const [activeTab, setActiveTab] = useState<'identity' | 'soul' | 'appearance' | 'user'>('identity');
  
  // Local editable states
  const [gf, setGf] = useState<GirlfriendPersona>(JSON.parse(JSON.stringify(girlfriend)));
  const [usr, setUsr] = useState<UserPersona>(JSON.parse(JSON.stringify(user)));
  const [newTrait, setNewTrait] = useState('');
  const [newOutfit, setNewOutfit] = useState('');
  const [showAnchorHelp, setShowAnchorHelp] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Initial Portrait Generator States
  const [activeGeneratingStep, setActiveGeneratingStep] = useState<string>('');
  const [isGeneratingPortrait, setIsGeneratingPortrait] = useState(false);
  const [previewGeneratedAvatar, setPreviewGeneratedAvatar] = useState<string | null>(null);
  const [customPortraitPrompt, setCustomPortraitPrompt] = useState('');
  const [selectedRatio, setSelectedRatio] = useState<'3:4' | '9:16'>('3:4');
  const [showJsonPreview, setShowJsonPreview] = useState(false);
  const [copiedJsonToast, setCopiedJsonToast] = useState(false);
  const [portraitRegenCount, setPortraitRegenCount] = useState(0);
  const [serverKeyStatus, setServerKeyStatus] = useState<{ hasNanoGptKey: boolean; hasOpenRouterKey: boolean }>({
    hasNanoGptKey: false,
    hasOpenRouterKey: false,
  });
  const userAvatarInputRef = useRef<HTMLInputElement>(null);
  const wasOpenRef = useRef(false);
  const lastHandledRetryRef = useRef(0);

  // Vérifier les clés serveur persistées dès l'ouverture / changement config pour afficher le routage exact
  useEffect(() => {
    if (!isOpen) return;
    fetch('/api/keys')
      .then(r => r.json())
      .then(data => {
        setServerKeyStatus({
          hasNanoGptKey: Boolean(data.hasNanoGptKey || data.nanoGptApiKey),
          hasOpenRouterKey: Boolean(data.hasOpenRouterKey || data.openRouterApiKey),
        });
      })
      .catch(() => {});
  }, [isOpen, selfieConfig?.provider, selfieConfig?.nanoGptApiKey, selfieConfig?.openRouterApiKey]);

  // Initialize BodyProfile with defaults if not present
  const currentBodyProfile: BodyProfile = gf.appearance.bodyProfile || {
    ethnicity: 'Caucasienne / Européenne',
    height: 'moyenne',
    bodyType: 'fine',
    bustSize: 'moyenne',
    generalAttitude: 'Souriante & lumineuse',
    mainStyle: 'Soigné & élégant chic',
    customTraits: 'Discrètes taches de rousseur sur le nez, regard complice, fossettes',
  };

  const updateBodyProfile = (updates: Partial<BodyProfile>) => {
    setGf(prev => {
      const existing = prev.appearance.bodyProfile || currentBodyProfile;
      const updatedProfile = { ...existing, ...updates };
      return {
        ...prev,
        appearance: {
          ...prev.appearance,
          faceAnchorPrompt: '',
          faceSeed: undefined,
          bodyProfile: updatedProfile,
        }
      };
    });
  };

  const updateAppearanceField = (updates: Partial<GirlfriendPersona['appearance']>) => {
    setGf(prev => ({
      ...prev,
      appearance: {
        ...prev.appearance,
        ...updates,
        faceAnchorPrompt: '',
        faceSeed: undefined,
      }
    }));
  };

  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      setGf(JSON.parse(JSON.stringify(girlfriend)));
      setUsr(JSON.parse(JSON.stringify(user)));
      setPreviewGeneratedAvatar(null);
      setCustomPortraitPrompt('');
      setShowJsonPreview(false);
      setPortraitRegenCount(0);
    }
    wasOpenRef.current = isOpen;
  }, [isOpen, girlfriend, user]);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const hasNanoKeyActive = Boolean(selfieConfig?.nanoGptApiKey?.trim() || serverKeyStatus.hasNanoGptKey);
  const hasOrKeyActive = Boolean(selfieConfig?.openRouterApiKey?.trim() || serverKeyStatus.hasOpenRouterKey);
  const hasCloudKeyActive = hasNanoKeyActive || hasOrKeyActive || selfieConfig?.provider === 'nanogpt' || selfieConfig?.provider === 'openrouter';
  const rawImgModel = (selfieConfig?.imageModel || '').trim();
  const hasValidOrModel = Boolean(rawImgModel && rawImgModel.includes('/') && !rawImgModel.startsWith('openrouter/auto'));
  const effectiveCloudDisplay: 'nanogpt' | 'openrouter' | 'gemini' =
    selfieConfig?.provider === 'nanogpt'
      ? 'nanogpt'
      : selfieConfig?.provider === 'openrouter'
      ? 'openrouter'
      : (hasOrKeyActive && hasValidOrModel)
      ? 'openrouter'
      : hasNanoKeyActive
      ? 'nanogpt'
      : hasOrKeyActive
      ? 'openrouter'
      : 'gemini';

  const handleGeneratePortrait = async (skipConfigPrompt: boolean = false) => {
    setIsGeneratingPortrait(true);
    const nextNonce = previewGeneratedAvatar ? portraitRegenCount + 1 : 0;
    setPortraitRegenCount(nextNonce);

    if (effectiveCloudDisplay === 'nanogpt') {
      const mName = (rawImgModel && rawImgModel !== 'flux' && !rawImgModel.includes('/')) ? rawImgModel : 'qwen-image';
      setActiveGeneratingStep(`Génération directe via NanoGPT (${mName})...`);
    } else if (effectiveCloudDisplay === 'openrouter') {
      const mName = hasValidOrModel ? rawImgModel.split('/').pop() : 'OpenRouter';
      setActiveGeneratingStep(`Génération directe via OpenRouter (${mName})...`);
    } else {
      setActiveGeneratingStep(
        skipConfigPrompt
          ? 'Génération du portrait en cours (Repli Flux AI)...'
          : 'Génération via Gemini (.env) puis Cloud / Flux AI...'
      );
    }

    try {
      const p = gf.appearance.bodyProfile || currentBodyProfile;
      const pendingTrait = newTrait.trim();
      const pendingOutfit = newOutfit.trim();

      const mergedSoulTraits = pendingTrait && !gf.soulTraits.includes(pendingTrait)
        ? [...gf.soulTraits, pendingTrait]
        : gf.soulTraits;
      const mergedOutfits = pendingOutfit && !gf.appearance.availableOutfits.includes(pendingOutfit)
        ? [...gf.appearance.availableOutfits, pendingOutfit]
        : gf.appearance.availableOutfits;
      const effectiveOutfit = pendingOutfit || gf.appearance.currentOutfitStyle;

      const updatedGf: GirlfriendPersona = {
        ...gf,
        soulTraits: mergedSoulTraits,
        appearance: {
          ...gf.appearance,
          currentOutfitStyle: effectiveOutfit,
          availableOutfits: mergedOutfits,
          faceAnchorPrompt: '',
          faceSeed: undefined,
          bodyProfile: p,
        }
      };

      if (pendingTrait || pendingOutfit) {
        setGf(updatedGf);
        if (pendingTrait) setNewTrait('');
        if (pendingOutfit) setNewOutfit('');
      }

      const res = await generateInitialPortraitWithProtocol(
        updatedGf,
        customPortraitPrompt,
        selectedRatio,
        selfieConfig,
        skipConfigPrompt,
        nextNonce,
        llmConfig
      );

      if (res.status === 'needs_openrouter_config') {
        // Sauvegarder immédiatement tout ce que l'utilisateur a déjà saisi SANS rien effacer
        onSave(updatedGf, usr);
        triggerToast('Configuration Image Cloud requise (profil conservé)');
        onRequestOpenRouterConfig?.();
        return;
      }

      if (res.status === 'success' && res.url) {
        setPreviewGeneratedAvatar(res.url);
        if (res.providerUsed === 'gemini') {
          triggerToast(`Portrait officiel de ${gf.name} généré avec succès via Gemini (.env) !`);
        } else if (res.providerUsed === 'nanogpt') {
          const shortModel = (rawImgModel && rawImgModel !== 'flux' && !rawImgModel.includes('/')) ? rawImgModel : 'qwen-image';
          triggerToast(`Portrait de ${gf.name} généré via NanoGPT (${shortModel}) !`);
        } else if (res.providerUsed === 'openrouter') {
          const shortModel = rawImgModel?.split('/').pop() || 'OpenRouter';
          triggerToast(`Portrait de ${gf.name} généré via OpenRouter (${shortModel}) !`);
        } else {
          triggerToast(`Portrait de ${gf.name} généré via Flux AI Photoreal (repli) !`);
        }
      } else {
        triggerToast("Erreur lors de la génération du portrait");
      }
    } catch (err) {
      triggerToast("Erreur lors de la génération du portrait");
    } finally {
      setIsGeneratingPortrait(false);
      setActiveGeneratingStep('');
    }
  };

  useEffect(() => {
    if (isOpen && retryPortraitTrigger > 0 && retryPortraitTrigger !== lastHandledRetryRef.current) {
      lastHandledRetryRef.current = retryPortraitTrigger;
      handleGeneratePortrait(Boolean(retrySkipConfig));
    }
  }, [isOpen, retryPortraitTrigger, retrySkipConfig]);

  if (!isOpen) return null;

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(gf, null, 2));
    setCopiedJsonToast(true);
    setTimeout(() => setCopiedJsonToast(false), 2000);
  };

  const handleNewCustomPersona = () => {
    const blank = createBlankCustomPersona();
    setGf(blank);
    setPreviewGeneratedAvatar(null);
    setCustomPortraitPrompt('');
    setActiveTab('identity');
    triggerToast("Nouveau profil vierge prêt ! Définissez son prénom et ses critères.");
  };

  const handleUserAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 8 * 1024 * 1024) {
        triggerToast("L'image est trop volumineuse (max 8 Mo)");
        return;
      }
      const reader = new FileReader();
      reader.onload = async () => {
        if (typeof reader.result === 'string') {
          const rawBase64 = reader.result;
          let finalUrl = rawBase64;

          try {
            const res = await fetch('/api/upload-image', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ image: rawBase64 }),
            });
            if (res.ok) {
              const data = await res.json();
              if (data.url) finalUrl = data.url;
            }
          } catch (err) {
            console.warn('Erreur upload avatar Him:', err);
          }

          const updatedUsr = { ...usr, avatarUrl: finalUrl };
          setUsr(updatedUsr);
          onSave(gf, updatedUsr);
          triggerToast("Photo de profil ('Him') enregistrée sur le serveur ! 👤");
        }
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  const handleRemoveUserAvatar = () => {
    const updatedUsr = { ...usr, avatarUrl: '' };
    setUsr(updatedUsr);
    onSave(gf, updatedUsr);
    triggerToast("Photo de profil de 'Him' supprimée");
  };

  const handleAdoptAvatar = async () => {
    if (previewGeneratedAvatar) {
      let finalAvatarUrl = previewGeneratedAvatar;

      if (previewGeneratedAvatar.startsWith('data:image/')) {
        try {
          const res = await fetch('/api/upload-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: previewGeneratedAvatar }),
          });
          if (res.ok) {
            const data = await res.json();
            if (data.url) finalAvatarUrl = data.url;
          }
        } catch (e) {
          console.warn('Erreur upload avatar compagne:', e);
        }
      }

      const p = gf.appearance.bodyProfile || currentBodyProfile;
      const tempGf: GirlfriendPersona = {
        ...gf,
        appearance: {
          ...gf.appearance,
          avatarUrl: finalAvatarUrl,
          faceSeed: undefined,
          bodyProfile: p,
        },
      };
      const compiledAnchor = compileVisualAnchorPrompt(tempGf);

      const updatedGf: GirlfriendPersona = {
        ...tempGf,
        id: gf.id.startsWith('claire-') ? `custom-${Date.now()}` : gf.id,
        appearance: {
          ...tempGf.appearance,
          faceAnchorPrompt: compiledAnchor,
        }
      };
      setGf(updatedGf);
      // Immediately propagate to App and localStorage!
      onSave(updatedGf, usr);
      triggerToast(`Portrait de ${gf.name} adopté ! Définis maintenant ton profil ('Him') 👤`);
      setActiveTab('user');
    }
  };


  const handleToggleTrait = (trait: string) => {
    if (gf.soulTraits.includes(trait)) {
      setGf({
        ...gf,
        soulTraits: gf.soulTraits.filter(t => t !== trait)
      });
    } else {
      setGf({
        ...gf,
        soulTraits: [...gf.soulTraits, trait]
      });
    }
  };

  const handleAddCustomTrait = () => {
    if (newTrait.trim() && !gf.soulTraits.includes(newTrait.trim())) {
      setGf({
        ...gf,
        soulTraits: [...gf.soulTraits, newTrait.trim()]
      });
      setNewTrait('');
    }
  };

  const handleAddOutfit = () => {
    if (newOutfit.trim() && !gf.appearance.availableOutfits.includes(newOutfit.trim())) {
      setGf({
        ...gf,
        appearance: {
          ...gf.appearance,
          faceAnchorPrompt: '',
          faceSeed: undefined,
          availableOutfits: [...gf.appearance.availableOutfits, newOutfit.trim()],
          currentOutfitStyle: newOutfit.trim()
        }
      });
      setNewOutfit('');
    }
  };

  const handleSaveAll = () => {
    const p = gf.appearance.bodyProfile || currentBodyProfile;
    const tempGf: GirlfriendPersona = {
      ...gf,
      id: gf.id.startsWith('claire-') && previewGeneratedAvatar ? `custom-${Date.now()}` : gf.id,
      appearance: {
        ...gf.appearance,
        avatarUrl: previewGeneratedAvatar || gf.appearance.avatarUrl,
        faceSeed: undefined,
        bodyProfile: p,
      }
    };
    const finalGf: GirlfriendPersona = {
      ...tempGf,
      appearance: {
        ...tempGf.appearance,
        faceAnchorPrompt: compileVisualAnchorPrompt(tempGf),
      }
    };
    onSave(finalGf, usr);
    triggerToast('Personnalisation enregistrée !');
    setTimeout(() => {
      onClose();
    }, 400);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md">
      <div className="w-full max-w-3xl max-h-[92vh] flex flex-col rounded-3xl bg-[#0f111a] border border-slate-800 shadow-2xl overflow-hidden text-slate-100 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#131622]/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-rose-500 to-pink-500 p-0.5 shadow-lg shadow-rose-500/20">
              <img 
                src={gf.appearance.avatarUrl} 
                alt={gf.name} 
                className="w-full h-full rounded-2xl object-cover" 
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-white">Personnalisation de {gf.name}</h2>
                <span className="text-xs text-rose-400 font-medium px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20">
                  {gf.relationshipStatus}
                </span>
              </div>
              <p className="text-xs text-slate-400">Configure son âme, son apparence et le prompt visage pour les selfies</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Custom Persona Header Strip */}
        <div className="px-6 py-2.5 bg-[#0b0c13] border-b border-slate-800/80 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-rose-300">Profil sur-mesure 100% Personnalisé</span>
            <span className="text-[11px] text-slate-500 hidden sm:inline">· Définis ses traits, son style et génère son portrait officiel</span>
          </div>
          <button
            type="button"
            onClick={handleNewCustomPersona}
            className="text-xs px-3 py-1.5 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-slate-300 hover:text-white transition flex items-center gap-1.5 whitespace-nowrap"
          >
            <RotateCcw className="w-3.5 h-3.5 text-purple-400" />
            <span>Réinitialiser à zéro</span>
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 px-6 bg-[#131622]/40 shrink-0">
          <button
            onClick={() => setActiveTab('identity')}
            className={`flex items-center gap-2 py-3 px-3.5 text-xs font-medium border-b-2 transition ${
              activeTab === 'identity'
                ? 'border-rose-500 text-rose-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>1. Identité & Élocution</span>
          </button>

          <button
            onClick={() => setActiveTab('soul')}
            className={`flex items-center gap-2 py-3 px-3.5 text-xs font-medium border-b-2 transition ${
              activeTab === 'soul'
                ? 'border-rose-500 text-rose-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Heart className="w-3.5 h-3.5" />
            <span>2. Âme & Personnalité</span>
          </button>

          <button
            onClick={() => setActiveTab('appearance')}
            className={`flex items-center gap-2 py-3 px-3.5 text-xs font-medium border-b-2 transition ${
              activeTab === 'appearance'
                ? 'border-rose-500 text-rose-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>3. Apparence & Selfies</span>
          </button>

          <button
            onClick={() => setActiveTab('user')}
            className={`flex items-center gap-2 py-3 px-3.5 text-xs font-medium border-b-2 transition ${
              activeTab === 'user'
                ? 'border-rose-500 text-rose-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>4. Ton Profil ("Him")</span>
          </button>
        </div>

        {/* Tab Content Body (Scrollable) */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-200">
          
          {/* TAB 1: IDENTITÉ & ÉLOCUTION */}
          {activeTab === 'identity' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Prénom de la compagne</label>
                  <input
                    type="text"
                    value={gf.name}
                    onChange={(e) => setGf({ ...gf, name: e.target.value })}
                    className="w-full text-xs bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-rose-500"
                    placeholder="Ex: Sarah, Emma, Elena, Claire..."
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Surnom qu'elle te donne</label>
                  <input
                    type="text"
                    value={gf.nickname}
                    onChange={(e) => setGf({ ...gf, nickname: e.target.value })}
                    className="w-full text-xs bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-rose-500"
                    placeholder="Mon amour, Alex, Chaton, Babe..."
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Âge</label>
                  <input
                    type="number"
                    min={18}
                    max={60}
                    value={gf.age}
                    onChange={(e) => setGf({ ...gf, age: parseInt(e.target.value) || 22 })}
                    className="w-full text-xs bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-rose-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Statut relationnel</label>
                  <select
                    value={gf.relationshipStatus}
                    onChange={(e) => setGf({ ...gf, relationshipStatus: e.target.value as any })}
                    className="w-full text-xs bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-rose-500"
                  >
                    <option value="girlfriend">Petite amie officielle (Girlfriend)</option>
                    <option value="fiancée">Fiancée amoureuse</option>
                    <option value="crush">Crush réciproque & séduction</option>
                    <option value="close_friend">Confidente très proche</option>
                    <option value="companion">Compagne de vie</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Métier / Passion au quotidien</label>
                <input
                  type="text"
                  value={gf.occupation}
                  onChange={(e) => setGf({ ...gf, occupation: e.target.value })}
                  className="w-full text-xs bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-rose-500"
                  placeholder="Ex: Artiste indépendante, game designer, professeure, photographe..."
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Premier message d'accueil initial dans le chat (Greeting)</label>
                <textarea
                  rows={3}
                  value={gf.initialGreeting || `*te sourit doucement en s'asseyant à côté de toi* Coucou ${usr.nickname || 'mon cœur'}... Je suis tellement heureuse que tu sois là. Comment se passe ta journée ? Raconte-moi tout ✨`}
                  onChange={(e) => setGf({ ...gf, initialGreeting: e.target.value })}
                  className="w-full text-xs bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-slate-200 focus:outline-none focus:border-rose-500"
                  placeholder="Ex: *te sourit doucement en s'asseyant à côté de toi* Coucou..."
                />
                <p className="text-[11px] text-slate-500 mt-1">Ce message s'affiche au tout début de la discussion ou lors d'une réinitialisation de chat.</p>
              </div>

              {/* Speech Quirks toggles */}
              <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
                <h3 className="text-xs font-semibold text-white">Options de style dans le chat</h3>
                
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-xs text-slate-300">
                    Actions d'émotions entre astérisques (ex: <em>*sourit tendrement*</em>)
                  </span>
                  <input
                    type="checkbox"
                    checked={gf.speechStyle.useActionEmotes}
                    onChange={(e) => setGf({
                      ...gf,
                      speechStyle: { ...gf.speechStyle, useActionEmotes: e.target.checked }
                    })}
                    className="rounded accent-rose-500 w-4 h-4"
                  />
                </label>

                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-xs text-slate-300">
                    Utilisation naturelle d'émojis affectueux (💕, ✨, ☕)
                  </span>
                  <input
                    type="checkbox"
                    checked={gf.speechStyle.useEmojis}
                    onChange={(e) => setGf({
                      ...gf,
                      speechStyle: { ...gf.speechStyle, useEmojis: e.target.checked }
                    })}
                    className="rounded accent-rose-500 w-4 h-4"
                  />
                </label>
              </div>

              {/* Navigation button to next tab */}
              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setActiveTab('soul')}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-xs font-semibold text-white flex items-center gap-1.5 transition shadow-md shadow-rose-500/20 active:scale-95"
                >
                  <span>Passer à 2. Âme & Personnalité →</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: ÂME & PERSONNALITÉ */}
          {activeTab === 'soul' && (
            <div className="space-y-6">
              {/* Tonalité dominante (Style relationnel & élocution) */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  1. Tonalité dominante & Tempérament
                </label>
                <p className="text-[11px] text-slate-500 mb-3">
                  Définit la façon dont {gf.name} s'exprime, te taquine ou te réconforte au quotidien.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'affectionate', label: 'Tendrement affectueuse', desc: 'Chaleureuse, câline et attentionnée' },
                    { id: 'teasing', label: 'Taquine & complice', desc: 'Pleine d\'esprit, joueuse et piquante' },
                    { id: 'rebel', label: 'Rebelle & insoumise', desc: 'Insolente, rock et indépendante' },
                    { id: 'gothic', label: 'Gothique & mystérieuse', desc: 'Ténébreuse, poétique et romantique' },
                    { id: 'possessive', label: 'Possessive & exclusive (soft)', desc: 'Protectrice, passionnée et piquante' },
                    { id: 'dominant', label: 'Affirmée & charismatique', desc: 'Sûre d\'elle, prend les devants' },
                    { id: 'poetic', label: 'Poétique & profonde', desc: 'Sensible aux détails, contemplative' },
                    { id: 'shy', label: 'Douce & discrètement timide', desc: 'Réservée, tendre et rougissante' }
                  ].map(item => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setGf({
                        ...gf,
                        speechStyle: { ...gf.speechStyle, tone: item.id as any }
                      })}
                      className={`p-3 rounded-2xl border text-left transition ${
                        gf.speechStyle.tone === item.id
                          ? 'border-rose-500 bg-rose-500/20 text-rose-200 shadow-sm shadow-rose-500/10 font-semibold'
                          : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700 hover:text-slate-300'
                      }`}
                    >
                      <div className="text-xs font-semibold text-white">{item.label}</div>
                      <div className="text-[10px] text-slate-400 mt-1 leading-snug">{item.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Passions, Centres d'intérêt & Vibe concrète */}
              <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
                <label className="block text-xs font-semibold text-slate-300">
                  2. Passions & Centres d'intérêt (sujets qu'elle abordera spontanément)
                </label>
                <div className="flex flex-wrap gap-2">
                  {PASSIONS_AND_INTERESTS.map(passion => {
                    const active = gf.soulTraits.includes(passion);
                    return (
                      <button
                        key={passion}
                        type="button"
                        onClick={() => handleToggleTrait(passion)}
                        className={`text-xs px-3 py-1.5 rounded-xl border transition flex items-center gap-1.5 ${
                          active
                            ? 'border-rose-500/60 bg-rose-500/20 text-rose-200 font-medium'
                            : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                        }`}
                      >
                        {active && <Check className="w-3 h-3 text-rose-400" />}
                        <span>{passion}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Ajout d'une passion personnalisée */}
                <div className="flex gap-2 pt-1">
                  <input
                    type="text"
                    value={newTrait}
                    onChange={(e) => setNewTrait(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddCustomTrait()}
                    placeholder="Ajouter une autre passion (ex: Fan d'astronomie et télescopes)..."
                    className="flex-1 text-xs bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-rose-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomTrait}
                    className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-white flex items-center gap-1 transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Ajouter</span>
                  </button>
                </div>
              </div>

              {/* Bio & Histoire */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  3. Histoire personnelle, souvenirs & ce qui la fait vibrer
                </label>
                <textarea
                  rows={4}
                  value={gf.bio}
                  onChange={(e) => setGf({ ...gf, bio: e.target.value })}
                  className="w-full text-xs bg-slate-900 border border-slate-800 rounded-xl p-3 text-slate-200 focus:outline-none focus:border-rose-500 leading-relaxed"
                  placeholder="Décris son histoire, ses souvenirs, ce qui la fait vibrer au quotidien..."
                />
              </div>

              {/* Navigation étape suivante */}
              <div className="pt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setActiveTab('identity')}
                  className="px-4 py-2 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-xs font-medium text-slate-400 hover:text-white flex items-center gap-1.5 transition"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>← Retour à l'Identité</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('appearance')}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-xs font-semibold text-white flex items-center gap-1.5 shadow-md shadow-rose-500/20 transition active:scale-95"
                >
                  <span>Passer à 3. Apparence & Portrait →</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: APPARENCE & SELFIES (Core feature for consistent faces) */}
          {activeTab === 'appearance' && (
            <div className="space-y-6">

              {/* ÉTAPE INDICATEUR */}
              <div className="p-3.5 rounded-2xl bg-gradient-to-r from-rose-950/20 via-slate-900 to-purple-950/20 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 text-slate-300">
                  <span className="w-5 h-5 rounded-full bg-rose-500/20 text-rose-400 font-bold flex items-center justify-center text-[11px] border border-rose-500/30">1</span>
                  <span><strong>Étape 1 :</strong> Choisissez ses critères morphologiques, visage, coiffure et tenue ci-dessous</span>
                </div>
                <div className="flex items-center gap-2 text-purple-300">
                  <span className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-300 font-bold flex items-center justify-center text-[11px] border border-purple-500/30">2</span>
                  <span><strong>Étape 2 :</strong> Générez son portrait officiel en bas de page 📸</span>
                </div>
              </div>

              {/* CRITÈRES PHYSIQUES & MORPHOLOGIQUES STRUCTURÉS */}
              <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-5">
                <div className="flex items-center gap-2 text-xs font-bold text-white border-b border-slate-800 pb-2">
                  <Sliders className="w-4 h-4 text-rose-400" />
                  <span>Critères Morphologiques & Physiques Persistants</span>
                </div>

                {/* 1. ÂGE */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-slate-300">Âge de {gf.name}</label>
                    <span className="text-xs font-bold text-rose-400 font-mono bg-rose-500/10 px-2 py-0.5 rounded-lg border border-rose-500/20">
                      {gf.age} ans
                    </span>
                  </div>
                  <input
                    type="range"
                    min={18}
                    max={50}
                    step={1}
                    value={gf.age}
                    onChange={(e) => setGf({ ...gf, age: parseInt(e.target.value, 10) })}
                    className="w-full accent-rose-500 cursor-pointer"
                  />
                </div>

                {/* 2. TYPE / ORIGINE ETHNIQUE */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-2">Origine / Type ethnique</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {ETHNICITY_OPTIONS.map(opt => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => updateBodyProfile({ ethnicity: opt.id })}
                        className={`text-xs px-3 py-2 rounded-xl border text-center transition ${
                          (gf.appearance.bodyProfile?.ethnicity || currentBodyProfile.ethnicity) === opt.id
                            ? 'border-rose-500 bg-rose-500/20 text-rose-200 font-semibold shadow-sm'
                            : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:text-white hover:border-slate-700'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3. TAILLE & STATURE */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-2">Taille & Stature</label>
                  <div className="grid grid-cols-3 gap-2">
                    {HEIGHT_OPTIONS.map(opt => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => updateBodyProfile({ height: opt.id })}
                        className={`text-xs px-3 py-2 rounded-xl border text-center transition ${
                          (gf.appearance.bodyProfile?.height || currentBodyProfile.height) === opt.id
                            ? 'border-rose-500 bg-rose-500/20 text-rose-200 font-semibold shadow-sm'
                            : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:text-white hover:border-slate-700'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 4. SILHOUETTE & MORPHOLOGIE */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-2">Apparence & Silhouette (Morphologie)</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {BODY_TYPE_OPTIONS.map(opt => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => updateBodyProfile({ bodyType: opt.id })}
                        className={`p-2.5 rounded-xl border text-left transition ${
                          (gf.appearance.bodyProfile?.bodyType || currentBodyProfile.bodyType) === opt.id
                            ? 'border-rose-500 bg-rose-500/20 text-rose-200 font-semibold shadow-sm'
                            : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <div className="text-xs font-semibold text-white">{opt.label}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">{opt.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 5. TAILLE DE LA POITRINE */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-2">Taille de la poitrine</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {BUST_OPTIONS.map(opt => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => updateBodyProfile({ bustSize: opt.id })}
                        className={`text-xs px-3 py-2 rounded-xl border text-center transition ${
                          (gf.appearance.bodyProfile?.bustSize || currentBodyProfile.bustSize) === opt.id
                            ? 'border-rose-500 bg-rose-500/20 text-rose-200 font-semibold shadow-sm'
                            : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:text-white hover:border-slate-700'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 6. ATTITUDE GÉNÉRALE & REGARD */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-2">Attitude générale & Regard</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {ATTITUDE_OPTIONS.map(opt => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => updateBodyProfile({ generalAttitude: opt.id })}
                        className={`text-xs px-3 py-2 rounded-xl border text-center transition ${
                          (gf.appearance.bodyProfile?.generalAttitude || currentBodyProfile.generalAttitude) === opt.id
                            ? 'border-purple-500 bg-purple-500/20 text-purple-200 font-semibold shadow-sm'
                            : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:text-white hover:border-slate-700'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 7. STYLE VESTIMENTAIRE PRINCIPAL */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-2">Style vestimentaire principal</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {STYLE_OPTIONS.map(opt => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => updateBodyProfile({ mainStyle: opt.id })}
                        className={`text-xs px-3 py-2 rounded-xl border text-center transition ${
                          (gf.appearance.bodyProfile?.mainStyle || currentBodyProfile.mainStyle) === opt.id
                            ? 'border-purple-500 bg-purple-500/20 text-purple-200 font-semibold shadow-sm'
                            : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:text-white hover:border-slate-700'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 8. YEUX, CHEVEUX & TEINT */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1 border-t border-slate-800/80">
                  {/* Hair Style */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-slate-300">Coupe & Coiffure</label>
                      <span className="text-[10px] text-slate-500">Cliquez ou saisissez</span>
                    </div>
                    <input
                      type="text"
                      value={gf.appearance.hairStyle}
                      onChange={(e) => updateAppearanceField({ hairStyle: e.target.value })}
                      className="w-full text-xs bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-rose-500"
                      placeholder="Ex: Ondulations douces, longs avec frange..."
                    />
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {COMMON_HAIR_STYLES.map(s => {
                        const isSelected = gf.appearance.hairStyle === s.label;
                        return (
                          <button
                            key={s.label}
                            type="button"
                            onClick={() => updateAppearanceField({ hairStyle: s.label })}
                            className={`text-[11px] px-2.5 py-1 rounded-lg border transition ${
                              isSelected
                                ? 'border-rose-500/60 bg-rose-500/20 text-rose-200 font-medium shadow-sm'
                                : 'border-slate-800 bg-slate-950/70 text-slate-400 hover:text-white hover:border-slate-700'
                            }`}
                          >
                            {s.short}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Hair Color */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-slate-300">Couleur des cheveux</label>
                      <span className="text-[10px] text-slate-500">Blonds, bruns, roux...</span>
                    </div>
                    <input
                      type="text"
                      value={gf.appearance.hairColor}
                      onChange={(e) => updateAppearanceField({ hairColor: e.target.value })}
                      className="w-full text-xs bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-rose-500"
                      placeholder="Ex: Blond doré miel, châtain reflets caramel..."
                    />
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {COMMON_HAIR_COLORS.map(c => {
                        const isSelected = gf.appearance.hairColor === c.label;
                        return (
                          <button
                            key={c.label}
                            type="button"
                            onClick={() => updateAppearanceField({ hairColor: c.label })}
                            className={`text-[11px] px-2.5 py-1 rounded-lg border transition ${
                              isSelected
                                ? 'border-rose-500/60 bg-rose-500/20 text-rose-200 font-medium shadow-sm'
                                : 'border-slate-800 bg-slate-950/70 text-slate-400 hover:text-white hover:border-slate-700'
                            }`}
                          >
                            {c.short}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Eye Color */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-slate-300">Couleur des yeux</label>
                      <span className="text-[10px] text-slate-500">Cliquez ou saisissez</span>
                    </div>
                    <input
                      type="text"
                      value={gf.appearance.eyeColor}
                      onChange={(e) => updateAppearanceField({ eyeColor: e.target.value })}
                      className="w-full text-xs bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-rose-500"
                    />
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {COMMON_EYE_COLORS.map(eColor => {
                        const isSelected = gf.appearance.eyeColor === eColor.label;
                        return (
                          <button
                            key={eColor.label}
                            type="button"
                            onClick={() => updateAppearanceField({ eyeColor: eColor.label })}
                            className={`text-[11px] px-2.5 py-1 rounded-lg border transition ${
                              isSelected
                                ? 'border-rose-500/60 bg-rose-500/20 text-rose-200 font-medium shadow-sm'
                                : 'border-slate-800 bg-slate-950/70 text-slate-400 hover:text-white hover:border-slate-700'
                            }`}
                          >
                            {eColor.short}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Skin Tone */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-slate-300">Teint & Grain de peau</label>
                      <span className="text-[10px] text-slate-500">Cliquez ou saisissez</span>
                    </div>
                    <input
                      type="text"
                      value={gf.appearance.skinTone}
                      onChange={(e) => updateAppearanceField({ skinTone: e.target.value })}
                      className="w-full text-xs bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-rose-500"
                    />
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {COMMON_SKIN_TONES.map(t => {
                        const isSelected = gf.appearance.skinTone === t.label;
                        return (
                          <button
                            key={t.label}
                            type="button"
                            onClick={() => updateAppearanceField({ skinTone: t.label })}
                            className={`text-[11px] px-2.5 py-1 rounded-lg border transition ${
                              isSelected
                                ? 'border-rose-500/60 bg-rose-500/20 text-rose-200 font-medium shadow-sm'
                                : 'border-slate-800 bg-slate-950/70 text-slate-400 hover:text-white hover:border-slate-700'
                            }`}
                          >
                            {t.short}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* 9. AUTRES TRAITS DISTINCTIFS (Champ libre avec virgules) */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Autres traits importants (séparés par des virgules)
                  </label>
                  <textarea
                    rows={2}
                    value={gf.appearance.bodyProfile?.customTraits ?? currentBodyProfile.customTraits}
                    onChange={(e) => updateBodyProfile({ customTraits: e.target.value })}
                    placeholder="Ex: discrètes taches de rousseur sur le nez, fossettes quand elle rit, petit grain de beauté sur la pommette, lunettes fines..."
                    className="w-full text-xs bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-200 focus:outline-none focus:border-purple-500 leading-relaxed"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Ces détails uniques sont persistés dans son JSON et réinjectés à chaque prompt pour maintenir sa signature visuelle.
                  </span>
                </div>
              </div>

              {/* Wardrobe & Outfits */}
              <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
                <div className="flex items-center gap-2 mb-3">
                  <Shirt className="w-4 h-4 text-rose-400" />
                  <h3 className="text-xs font-semibold text-white">Garde-robe & Tenue Actuelle</h3>
                </div>

                <div className="space-y-2 mb-3">
                  {gf.appearance.availableOutfits.map((outfit) => (
                    <div 
                      key={outfit} 
                      onClick={() => updateAppearanceField({ currentOutfitStyle: outfit })}
                      className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition ${
                        gf.appearance.currentOutfitStyle === outfit
                          ? 'border-rose-500/60 bg-rose-500/10 text-rose-200'
                          : 'border-slate-800 bg-slate-950/50 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 text-xs">
                        <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                          gf.appearance.currentOutfitStyle === outfit
                            ? 'border-rose-500 bg-rose-500'
                            : 'border-slate-600'
                        }`}>
                          {gf.appearance.currentOutfitStyle === outfit && <Check className="w-2.5 h-2.5 text-white" />}
                        </div>
                        <span>{outfit}</span>
                      </div>
                      {gf.appearance.currentOutfitStyle === outfit && (
                        <span className="text-[10px] text-rose-400 font-medium">Tenue active</span>
                      )}
                    </div>
                  ))}
                </div>

                {/* Add Custom Outfit */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newOutfit}
                    onChange={(e) => setNewOutfit(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddOutfit()}
                    placeholder="Ajouter une nouvelle tenue (ex: Robe noire de soirée)..."
                    className="flex-1 text-xs bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-rose-500"
                  />
                  <button
                    onClick={handleAddOutfit}
                    className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-white flex items-center gap-1 transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Ajouter</span>
                  </button>
                </div>
              </div>

              {/* STUDIO DE CRÉATION PHYSIQUE & PORTRAIT INITIAL (Étape finale après tous les critères) */}
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-purple-950/40 via-[#161828] to-slate-900 border border-purple-500/40 shadow-xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-white">
                    <Sparkles className="w-4 h-4 text-purple-400" />
                    <span>Studio Portrait & Ancre Visuelle de {gf.name} (Étape Finale)</span>
                  </div>

                  {/* Protocole Actif (Direct Cloud si clé saisie, sinon Gemini .env) */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] px-2 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 flex items-center gap-1.5">
                      {effectiveCloudDisplay === 'nanogpt' ? (
                        <>
                          <span className="text-indigo-400 font-semibold">
                            1. NanoGPT ({rawImgModel && !rawImgModel.includes('/') && rawImgModel !== 'flux' ? rawImgModel : 'qwen-image'})
                          </span>
                          <span className="text-slate-600">→</span>
                          <span className="text-purple-400 font-semibold">2. Flux AI (Repli)</span>
                        </>
                      ) : effectiveCloudDisplay === 'openrouter' ? (
                        <>
                          <span className="text-sky-400 font-semibold">
                            1. OpenRouter ({hasValidOrModel ? rawImgModel.split('/').pop() : 'À configurer'})
                          </span>
                          <span className="text-slate-600">→</span>
                          <span className="text-purple-400 font-semibold">2. Flux AI (Repli)</span>
                        </>
                      ) : (
                        <>
                          <span className="text-rose-400 font-semibold">1. Gemini (.env)</span>
                          <span className="text-slate-600">→</span>
                          <span className="text-sky-400 font-semibold">2. Cloud</span>
                          <span className="text-slate-600">→</span>
                          <span className="text-purple-400 font-semibold">3. Flux AI</span>
                        </>
                      )}
                    </span>
                    {onRequestOpenRouterConfig && (
                      <button
                        type="button"
                        onClick={() => {
                          const p = gf.appearance.bodyProfile || currentBodyProfile;
                          onSave({ ...gf, appearance: { ...gf.appearance, faceAnchorPrompt: '', faceSeed: undefined, bodyProfile: p } }, usr);
                          onRequestOpenRouterConfig();
                        }}
                        className="text-[10px] px-2.5 py-1 rounded-lg border border-sky-500/30 bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 font-medium flex items-center gap-1 transition"
                        title="Configurer ou modifier votre clé et modèle image (NanoGPT ou OpenRouter)"
                      >
                        <Globe className="w-3 h-3" />
                        <span>{effectiveCloudDisplay === 'nanogpt' ? 'Config NanoGPT' : 'Config Cloud'}</span>
                      </button>
                    )}
                  </div>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  {hasCloudKeyActive
                    ? `Tous vos critères (âge, morphologie, poitrine, yeux, cheveux, tenue, personnalité et traits distinctifs) sont compilés en direct pour ${effectiveCloudDisplay === 'nanogpt' ? 'NanoGPT' : 'OpenRouter'} (Gemini .env ignoré car votre clé Cloud est configurée).`
                    : `Tous vos critères (âge, morphologie, poitrine, yeux, cheveux, tenue, personnalité et traits distinctifs) sont compilés dans le prompt maître (Gemini .env en priorité, puis NanoGPT / OpenRouter ou Flux AI).`}
                </p>

                {/* Ratio selector pills */}
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-[11px] text-slate-400 font-medium">Cadrage du portrait :</span>
                  <button
                    type="button"
                    onClick={() => setSelectedRatio('3:4')}
                    className={`text-xs px-3 py-1 rounded-xl border transition ${
                      selectedRatio === '3:4'
                        ? 'border-purple-500 bg-purple-500/20 text-purple-200 font-semibold'
                        : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:text-white'
                    }`}
                  >
                    Buste Complet 3:4 (Recommandé)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedRatio('9:16')}
                    className={`text-xs px-3 py-1 rounded-xl border transition ${
                      selectedRatio === '9:16'
                        ? 'border-purple-500 bg-purple-500/20 text-purple-200 font-semibold'
                        : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:text-white'
                    }`}
                  >
                    Plein Écran 9:16
                  </button>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 items-center pt-1">
                  {/* Avatar Preview */}
                  <div className={`relative ${selectedRatio === '3:4' ? 'w-32 sm:w-36 aspect-[3/4]' : 'w-32 sm:w-36 aspect-[9/16]'} rounded-2xl overflow-hidden border-2 border-purple-500/50 bg-black shrink-0 shadow-xl flex items-center justify-center`}>
                    <img
                      src={previewGeneratedAvatar || gf.appearance.avatarUrl}
                      alt={gf.name}
                      className="w-full h-full object-cover object-top"
                    />
                    {isGeneratingPortrait && (
                      <div className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center gap-2 text-white p-2 text-center backdrop-blur-sm">
                        <Loader2 className="w-7 h-7 animate-spin text-rose-400" />
                        <span className="text-[11px] text-rose-200 font-medium leading-tight">
                          {activeGeneratingStep || 'Génération du portrait en cours...'}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Actions & Prompt */}
                  <div className="flex-1 space-y-2.5 w-full">
                    <label className="block text-[11px] text-slate-300 font-medium">
                      Précisions d'ambiance pour ce portrait (optionnel) :
                    </label>
                    <input
                      type="text"
                      value={customPortraitPrompt}
                      onChange={(e) => setCustomPortraitPrompt(e.target.value)}
                      placeholder="Ex: grand sourire radieux, lunettes fines, dans sa chambre cosy..."
                      className="w-full text-xs bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-purple-500"
                    />

                    <div className="flex flex-wrap gap-2 pt-1">
                      <button
                        type="button"
                        disabled={isGeneratingPortrait}
                        onClick={() => handleGeneratePortrait(false)}
                        className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-xs font-semibold text-white flex items-center gap-2 transition active:scale-95 disabled:opacity-50 shadow-md shadow-purple-600/20"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>
                          {previewGeneratedAvatar
                            ? "Régénérer un autre essai 🔄"
                            : "Générer le Portrait Officiel 📸"}
                        </span>
                      </button>

                      {previewGeneratedAvatar && (
                        <button
                          type="button"
                          onClick={handleAdoptAvatar}
                          className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white flex items-center gap-2 transition active:scale-95 shadow-md shadow-emerald-600/20 animate-pulse"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>✨ Adopter ce Portrait & Définir 'Him' →</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setShowJsonPreview(!showJsonPreview)}
                        className="px-3 py-2 rounded-xl border border-slate-800 bg-slate-900/80 hover:bg-slate-800 text-xs text-slate-300 hover:text-white flex items-center gap-1.5 transition"
                      >
                        <Code className="w-3.5 h-3.5 text-purple-400" />
                        <span>{showJsonPreview ? "Masquer JSON" : "Voir JSON Persistant (Complet)"}</span>
                      </button>
                    </div>

                    {/* JSON Persistant Complet & Copie */}
                    {showJsonPreview && (
                      <div className="mt-2 p-3 rounded-2xl bg-black/80 border border-slate-800 text-[11px] font-mono text-emerald-400 space-y-2">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                          <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                            JSON Persistant Complet ({gf.name}) :
                          </span>
                          <button
                            type="button"
                            onClick={handleCopyJson}
                            className="px-2 py-0.5 rounded-lg bg-emerald-950/60 border border-emerald-500/30 text-[10px] text-emerald-300 hover:bg-emerald-900/60 flex items-center gap-1 transition"
                          >
                            <Copy className="w-3 h-3" />
                            <span>{copiedJsonToast ? "Copié !" : "Copier le JSON"}</span>
                          </button>
                        </div>
                        <pre className="overflow-x-auto max-h-56 leading-relaxed select-all">
                          {JSON.stringify(gf, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* TAB 4: TON PROFIL ("HIM") */}
          {activeTab === 'user' && (
            <div className="space-y-5">
              <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-xs font-semibold text-white">Profil & Avatar de "Him" (Toi)</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Ces détails permettent à {gf.name} de savoir à qui elle parle, de visualiser précisément ton physique et de personnaliser vos échanges.
                  </p>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-purple-500/10 border border-purple-500/20 text-[11px] text-purple-300 shrink-0">
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>JanitorAI Compatible</span>
                </div>
              </div>

              {/* SECTION AVATAR IMPORTÉ POUR "HIM" */}
              <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-3">
                <label className="block text-xs font-semibold text-slate-300">
                  Photo de profil de "Him" (Avatar personnel importé depuis ton appareil)
                </label>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl border-2 border-slate-700 bg-slate-950 overflow-hidden flex items-center justify-center shrink-0 shadow-md">
                    {usr.avatarUrl ? (
                      <img
                        src={usr.avatarUrl}
                        alt="Avatar Him"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-slate-500">
                        <UserCheck className="w-6 h-6 text-slate-600" />
                        <span className="text-[9px] mt-0.5">Sans photo</span>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 space-y-2">
                    <input
                      ref={userAvatarInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleUserAvatarUpload}
                      className="hidden"
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => userAvatarInputRef.current?.click()}
                        className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-white flex items-center gap-1.5 transition border border-slate-700"
                      >
                        <Upload className="w-3.5 h-3.5 text-rose-400" />
                        <span>{usr.avatarUrl ? "Changer de photo" : "Importer ma photo"}</span>
                      </button>

                      {usr.avatarUrl && (
                        <button
                          type="button"
                          onClick={handleRemoveUserAvatar}
                          className="px-3 py-2 rounded-xl border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-xs font-medium text-red-300 flex items-center gap-1 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Supprimer</span>
                        </button>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Photo personnelle privée stockée uniquement sur ton appareil. Effacée automatiquement en cas de Hard Reset.
                    </p>
                  </div>
                </div>
              </div>

              {/* PRÉNOM & GENRE */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Ton prénom</label>
                  <input
                    type="text"
                    value={usr.name}
                    onChange={(e) => setUsr({ ...usr, name: e.target.value })}
                    className="w-full text-xs bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-rose-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Genre</label>
                  <input
                    type="text"
                    value={usr.gender}
                    onChange={(e) => setUsr({ ...usr, gender: e.target.value })}
                    className="w-full text-xs bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-rose-500"
                  />
                </div>
              </div>

              {/* DESCRIPTION PHYSIQUE DE HIM (AVANT LE MÉTIER / BIO) */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Ton apparence physique & style (transmis à {gf.name})
                </label>
                <textarea
                  rows={2}
                  value={usr.physicalDescription || ''}
                  onChange={(e) => setUsr({ ...usr, physicalDescription: e.target.value })}
                  className="w-full text-xs bg-slate-900 border border-slate-800 rounded-xl p-3 text-slate-200 focus:outline-none focus:border-rose-500 leading-relaxed"
                  placeholder="Ex: Brun aux yeux noisette, 1m80, barbe soignée de 3 jours, silhouette athlétique, style moderne & décontracté..."
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Permet à {gf.name} de savoir à quoi tu ressembles et de te complimenter dans les conversations !
                </span>
              </div>

              {/* CE QUE TU FAIS DANS LA VIE */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Ce que tu fais dans la vie</label>
                <input
                  type="text"
                  value={usr.bio}
                  onChange={(e) => setUsr({ ...usr, bio: e.target.value })}
                  className="w-full text-xs bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-rose-500"
                />
              </div>

              {/* NOTES SUR VOTRE COMPLICITÉ */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Notes sur votre complicité & habitudes</label>
                <textarea
                  rows={3}
                  value={usr.relationshipNotes}
                  onChange={(e) => setUsr({ ...usr, relationshipNotes: e.target.value })}
                  className="w-full text-xs bg-slate-900 border border-slate-800 rounded-xl p-3 text-slate-200 focus:outline-none focus:border-rose-500 leading-relaxed"
                  placeholder="Ex: On aime écouter de la musique tard le soir, se chambrer gentiment..."
                />
              </div>
            </div>
          )}

        </div>

        {/* Footer Actions: STRICTEMENT ÉTAPE PAR ÉTAPE (Pas de validation prématurée) */}
        <div className="px-6 py-4 border-t border-slate-800 bg-[#131622]/90 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">
              {activeTab === 'identity' && "Étape 1/4 · Identité & Style"}
              {activeTab === 'soul' && "Étape 2/4 · Âme & Tonalité"}
              {activeTab === 'appearance' && "Étape 3/4 · Portrait Officiel"}
              {activeTab === 'user' && "Étape 4/4 · Ton Profil ('Him')"}
            </span>
            {toastMessage && (
              <span className="text-xs text-rose-400 font-medium animate-pulse ml-2">
                {toastMessage}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white transition"
            >
              Annuler
            </button>

            {/* In Tab 1: Proceed to Soul */}
            {activeTab === 'identity' && (
              <button
                type="button"
                onClick={() => setActiveTab('soul')}
                className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white flex items-center gap-1.5 transition"
              >
                <span>Continuer vers l'Âme →</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}

            {/* In Tab 2: Proceed to Appearance (NO premature save button) */}
            {activeTab === 'soul' && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('identity')}
                  className="px-3.5 py-2 rounded-xl border border-slate-800 bg-slate-900/60 text-xs text-slate-400 hover:text-white transition"
                >
                  ← Retour
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('appearance')}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-xs font-semibold text-white flex items-center gap-1.5 shadow-md shadow-rose-500/20 transition active:scale-95"
                >
                  <span>Continuer vers le Portrait →</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* In Tab 3: Official portrait adoption or updates */}
            {activeTab === 'appearance' && (
              previewGeneratedAvatar ? (
                <button
                  type="button"
                  onClick={handleAdoptAvatar}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-xs font-semibold text-white shadow-lg shadow-emerald-600/25 transition active:scale-95 flex items-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  <span>✨ Adopter ce Portrait & Passer à 'Him' →</span>
                </button>
              ) : gf.appearance.avatarUrl && gf.appearance.avatarUrl !== BLANK_CUSTOM_AVATAR_PLACEHOLDER ? (
                <button
                  type="button"
                  onClick={() => setActiveTab('user')}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-xs font-semibold text-white shadow-lg shadow-rose-500/25 transition active:scale-95 flex items-center gap-2"
                >
                  <span>Passer à mon profil ("Him") →</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  type="button"
                  disabled
                  className="px-5 py-2.5 rounded-xl bg-slate-800 text-slate-500 text-xs font-medium cursor-not-allowed flex items-center gap-1.5"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Générez son portrait ci-dessus pour continuer 📸</span>
                </button>
              )
            )}

            {/* In Tab 4: User Profile Save & Launch Chat */}
            {activeTab === 'user' && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('appearance')}
                  className="px-3.5 py-2 rounded-xl border border-slate-800 bg-slate-900/60 text-xs text-slate-400 hover:text-white transition"
                >
                  ← Portrait
                </button>
                <button
                  type="button"
                  onClick={handleSaveAll}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-xs font-semibold text-white shadow-lg shadow-rose-500/25 transition active:scale-95 flex items-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  <span>✨ Terminer & Lancer le Chat avec {gf.name} 🚀</span>
                </button>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
