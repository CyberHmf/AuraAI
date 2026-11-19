import React, { useState } from 'react';
import { 
  X, RotateCcw, AlertTriangle, Trash2, CheckCircle2, 
  Sparkles, ShieldAlert, MessageSquareOff, HeartHandshake
} from 'lucide-react';
import { GirlfriendPersona } from '../types';

interface ResetConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  girlfriend: GirlfriendPersona;
  onSoftReset: () => void;
  onHardReset: () => void;
}

export const ResetConfirmModal: React.FC<ResetConfirmModalProps> = ({
  isOpen,
  onClose,
  girlfriend,
  onSoftReset,
  onHardReset,
}) => {
  const [hardConfirmationInput, setHardConfirmationInput] = useState('');
  const [activeStep, setActiveStep] = useState<'selection' | 'soft_done' | 'hard_confirm'>('selection');

  if (!isOpen) return null;

  const handleExecuteSoftReset = () => {
    onSoftReset();
    setActiveStep('soft_done');
    setTimeout(() => {
      setActiveStep('selection');
      onClose();
    }, 1600);
  };

  const handleExecuteHardReset = () => {
    if (hardConfirmationInput.trim().toUpperCase() === 'RESET') {
      onHardReset();
      setHardConfirmationInput('');
      setActiveStep('selection');
      onClose();
    }
  };

  const handleClose = () => {
    setHardConfirmationInput('');
    setActiveStep('selection');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md">
      <div className="w-full max-w-xl rounded-3xl bg-[#0f111a] border border-slate-800 shadow-2xl overflow-hidden text-slate-100 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#131622]/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-slate-800 flex items-center justify-center text-slate-300">
              <RotateCcw className="w-4 h-4 text-rose-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Options de Réinitialisation</h2>
              <p className="text-xs text-slate-400">Nettoyage de la mémoire ou réinitialisation d'usine</p>
            </div>
          </div>

          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">

          {/* SUCCESS MESSAGE AFTER SOFT RESET */}
          {activeStep === 'soft_done' && (
            <div className="py-8 flex flex-col items-center justify-center text-center space-y-3">
              <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h3 className="text-base font-semibold text-white">Remise à zéro Soft effectuée !</h3>
              <p className="text-xs text-slate-400 max-w-sm">
                L'historique de discussion et la mémoire ont été réinitialisés. Le profil et le portrait de <strong>{girlfriend.name}</strong> restent scrupuleusement conservés.
              </p>
            </div>
          )}

          {/* MAIN SELECTION VIEW */}
          {activeStep === 'selection' && (
            <div className="space-y-4">
              
              {/* OPTION 1: SOFT RESET */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-[#141824] border border-slate-800 hover:border-slate-700 transition">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 shrink-0">
                      <MessageSquareOff className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-white">1. Remise à zéro SOFT</h3>
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          Recommandé
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Vide les messages de chat, l'album de photos/selfies, la mémoire relationnelle et les logs.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-3 my-3 rounded-xl bg-slate-950/70 border border-slate-800 text-[11px] text-slate-300 space-y-1">
                  <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Préserve scrupuleusement :</span>
                  </div>
                  <p className="pl-5 text-slate-400">
                    • Le profil de ta compagne <strong>{girlfriend.name}</strong> (nom, bio, personnalité, tenue)<br />
                    • Son <strong>portrait avatar d'origine</strong> et son prompt d'ancre faciale<br />
                    • Ton profil utilisateur ("Him") et tes configurations de modèle/TTS
                  </p>
                </div>

                <button
                  onClick={handleExecuteSoftReset}
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 hover:text-white text-xs font-semibold text-slate-200 border border-slate-700/80 transition flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
                  <span>Effectuer la remise à zéro SOFT</span>
                </button>
              </div>

              {/* OPTION 2: HARD RESET TRIGGER */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-red-950/20 to-slate-900 border border-red-900/30">
                <div className="flex items-start gap-3 mb-2">
                  <div className="w-9 h-9 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-red-200">2. Remise à zéro COMPLÈTE (Hard)</h3>
                    <p className="text-xs text-red-300/70 mt-0.5">
                      Action irréversible : effacement total de l'application et retour à l'état d'usine.
                    </p>
                  </div>
                </div>

                <p className="text-[11px] text-slate-400 mb-3 pl-12">
                  Efface l'intégralité du stockage local : profil et photo de la Girlfriend, photo importée et profil de "Him", mémoire, selfies, historiques, logs et paramètres.
                </p>

                <div className="pl-12">
                  <button
                    onClick={() => setActiveStep('hard_confirm')}
                    className="py-2 px-3.5 rounded-xl bg-red-950/40 hover:bg-red-900/40 text-xs font-medium text-red-300 border border-red-800/50 transition flex items-center gap-1.5"
                  >
                    <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                    <span>Détails & confirmation d'effacement total...</span>
                  </button>
                </div>
              </div>

            </div>
          )}

          {/* STEP: HARD RESET CONFIRMATION SCREEN */}
          {activeStep === 'hard_confirm' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-red-950/40 border border-red-500/40 space-y-2">
                <div className="flex items-center gap-2 text-red-300 text-xs font-semibold">
                  <ShieldAlert className="w-4 h-4 text-red-400" />
                  <span>Avertissement de suppression définitive</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Cette action est <strong>irréversible</strong>. Tout sera supprimé (tes messages, tes souvenirs accumulés, tes photos, la photo de profil importée de "Him", les personnalisations de {girlfriend.name} et tes clés d'API).
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Pour confirmer, tape le mot <span className="text-red-400 font-mono font-bold">RESET</span> ci-dessous :
                </label>
                <input
                  type="text"
                  value={hardConfirmationInput}
                  onChange={(e) => setHardConfirmationInput(e.target.value)}
                  placeholder="Tape RESET"
                  className="w-full text-xs font-mono bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-red-500 uppercase tracking-widest"
                />
              </div>

              <div className="flex items-center justify-between gap-3 pt-2">
                <button
                  onClick={() => setActiveStep('selection')}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white transition"
                >
                  Retour
                </button>
                <button
                  disabled={hardConfirmationInput.trim().toUpperCase() !== 'RESET'}
                  onClick={handleExecuteHardReset}
                  className={`px-5 py-2.5 rounded-xl text-xs font-semibold transition flex items-center gap-2 ${
                    hardConfirmationInput.trim().toUpperCase() === 'RESET'
                      ? 'bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/30'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                  }`}
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Tout effacer définitivement</span>
                </button>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        {activeStep === 'selection' && (
          <div className="px-6 py-3.5 border-t border-slate-800 bg-[#131622]/60 flex items-center justify-end">
            <button
              onClick={handleClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white transition"
            >
              Fermer
            </button>
          </div>
        )}

      </div>
    </div>
  );
};
