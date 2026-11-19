import React, { useState } from 'react';
import { Lock, ArrowRight, Loader2, ShieldCheck } from 'lucide-react';
import { BrandLogo } from './BrandLogo';

interface AuthGateProps {
  onAuthenticated: () => void;
}

export const AuthGate: React.FC<AuthGateProps> = ({ onAuthenticated }) => {
  const [token, setToken] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Jeton d’accès invalide');
        return;
      }
      onAuthenticated();
    } catch {
      setError('Impossible de contacter le serveur');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#090a10] text-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-3xl bg-[#0f111a] border border-slate-800 shadow-2xl overflow-hidden">
        <div className="p-6 bg-gradient-to-r from-rose-950/40 via-[#161828] to-purple-950/40 border-b border-slate-800 flex items-center gap-3.5">
          <BrandLogo className="w-12 h-12 rounded-2xl shadow-lg shadow-rose-500/20 shrink-0" />
          <div>
            <div className="flex items-center gap-2 text-[11px] font-semibold text-rose-400 uppercase tracking-wider">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Accès Protégé</span>
            </div>
            <h1 className="text-lg font-bold text-white mt-0.5">Aura AI — Espace Privé</h1>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <p className="text-xs text-slate-400 leading-relaxed">
            Cette instance est protégée par un jeton d’accès (<code className="text-slate-300 font-mono">AUTH_TOKEN</code>). Saisissez-le pour déverrouiller vos conversations, selfies et réglages.
          </p>

          <div>
            <label htmlFor="auth-token-input" className="block text-xs font-medium text-slate-300 mb-1.5">
              Jeton d’accès
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
              <input
                id="auth-token-input"
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Entrez votre AUTH_TOKEN..."
                autoFocus
                className="w-full text-sm font-mono bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3.5 py-2.5 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-rose-500"
              />
            </div>
          </div>

          {error && (
            <div className="p-2.5 rounded-xl bg-red-950/40 border border-red-500/30 text-xs text-red-300">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={!token.trim() || isSubmitting}
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-rose-500 via-pink-500 to-purple-600 hover:from-rose-600 hover:to-purple-700 disabled:opacity-50 text-white font-semibold text-sm shadow-lg shadow-rose-500/20 flex items-center justify-center gap-2 transition"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Vérification...</span>
              </>
            ) : (
              <>
                <span>Déverrouiller</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
