import React, { useState, useEffect } from 'react';
import { 
  X, Terminal, Trash2, Copy, Check, Download, AlertTriangle, 
  Info, AlertCircle, RefreshCw, Filter, Layers, Database, Image as ImageIcon, MessageSquare
} from 'lucide-react';
import { logger, LogEntry, LogCategory, LogLevel } from '../services/logger';

interface LogsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LogsModal: React.FC<LogsModalProps> = ({ isOpen, onClose }) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedLevel, setSelectedLevel] = useState<string>('ALL');
  const [copied, setCopied] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const unsubscribe = logger.subscribe((newLogs) => {
      setLogs(newLogs);
    });
    return () => unsubscribe();
  }, [isOpen]);

  if (!isOpen) return null;

  const filteredLogs = logs.filter(log => {
    if (selectedCategory !== 'ALL' && log.category !== selectedCategory) return false;
    if (selectedLevel !== 'ALL' && log.level !== selectedLevel) return false;
    return true;
  });

  const handleCopyLogs = () => {
    const text = logs.map(l => {
      const details = l.details ? ` | ${JSON.stringify(l.details)}` : '';
      return `[${l.timestamp}] [${l.level}] [${l.category}] ${l.message}${details}`;
    }).join('\n');

    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      // fallback
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleDownloadLogs = () => {
    const text = logs.map(l => {
      const details = l.details ? ` | ${JSON.stringify(l.details, null, 2)}` : '';
      return `[${l.timestamp}] [${l.level}] [${l.category}] ${l.message}${details}`;
    }).join('\n\n');

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aura-logs-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClearLogs = async () => {
    logger.clear();
    setLogs([]);
    try {
      await fetch('/api/logs', { method: 'DELETE' });
    } catch {
      // ignore
    }
  };

  const getLevelBadge = (level: LogLevel) => {
    switch (level) {
      case 'ERROR':
        return (
          <span className="flex items-center gap-1 text-[10px] font-bold text-red-400 bg-red-950/60 border border-red-500/40 px-2 py-0.5 rounded-full">
            <AlertCircle className="w-3 h-3" />
            ERROR
          </span>
        );
      case 'WARN':
        return (
          <span className="flex items-center gap-1 text-[10px] font-bold text-amber-400 bg-amber-950/60 border border-amber-500/40 px-2 py-0.5 rounded-full">
            <AlertTriangle className="w-3 h-3" />
            WARN
          </span>
        );
      case 'INFO':
      default:
        return (
          <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-500/40 px-2 py-0.5 rounded-full">
            <Info className="w-3 h-3" />
            INFO
          </span>
        );
    }
  };

  const getCategoryIcon = (cat: LogCategory) => {
    switch (cat) {
      case 'LLM_CHAT': return <MessageSquare className="w-3 h-3 text-sky-400" />;
      case 'VISION_INPUT': return <Layers className="w-3 h-3 text-purple-400" />;
      case 'IMAGE_GEN': return <ImageIcon className="w-3 h-3 text-rose-400" />;
      case 'STORAGE': return <Database className="w-3 h-3 text-amber-400" />;
      default: return <Terminal className="w-3 h-3 text-slate-400" />;
    }
  };

  const errorCount = logs.filter(l => l.level === 'ERROR').length;
  const warnCount = logs.filter(l => l.level === 'WARN').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-in fade-in">
      <div className="w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl bg-[#0d0f17] border border-slate-800 shadow-2xl overflow-hidden text-slate-100">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#111422] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-white">Journal des Logs & Débogage</h2>
                <span className="text-[10px] bg-slate-800 text-slate-300 border border-slate-700 px-2 py-0.5 rounded-full font-mono">
                  {logs.length} / 100 max (rotation FIFO)
                </span>
                {errorCount > 0 && (
                  <span className="text-[10px] bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-0.5 rounded-full font-semibold animate-pulse">
                    {errorCount} {errorCount > 1 ? 'erreurs' : 'erreur'}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">Traçabilité complète : LLM texte, Vision, Modèles Images, Stockage & Quotas</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyLogs}
              className="text-xs px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition flex items-center gap-1.5 border border-slate-700"
              title="Copier tout le log dans le presse-papier"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
              <span>{copied ? 'Copié !' : 'Copier'}</span>
            </button>

            <button
              onClick={handleDownloadLogs}
              className="text-xs px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition flex items-center gap-1.5 border border-slate-700"
              title="Télécharger fichier .txt"
            >
              <Download className="w-3.5 h-3.5 text-slate-400" />
              <span className="hidden sm:inline">Exporter .txt</span>
            </button>

            <button
              onClick={handleClearLogs}
              className="text-xs px-3 py-1.5 rounded-xl bg-red-950/40 hover:bg-red-900/50 text-red-300 border border-red-500/30 transition flex items-center gap-1.5"
              title="Effacer l'historique"
            >
              <Trash2 className="w-3.5 h-3.5 text-red-400" />
              <span className="hidden sm:inline">Effacer</span>
            </button>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition ml-2"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Informative Diagnostic Banner */}
        <div className="px-6 py-2.5 bg-gradient-to-r from-slate-900 via-[#131626] to-slate-900 border-b border-slate-800/80 text-[11px] text-slate-300 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>
              <strong>Principe actif :</strong> Texte pur = prompt système + conversation (0 token image). Vision = uniquement si photo utilisateur jointe. Image Gen = envoi vers modèle image dédié.
            </span>
          </div>
          <span className="text-[10px] text-slate-500 font-mono hidden md:inline">Rotation serveur : 500 Ko max</span>
        </div>

        {/* Filter bar */}
        <div className="px-6 py-3 bg-[#0a0c13] border-b border-slate-800 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-slate-400 flex items-center gap-1 mr-1">
              <Filter className="w-3.5 h-3.5" />
              Catégorie :
            </span>
            {[
              { id: 'ALL', label: 'Toutes' },
              { id: 'LLM_CHAT', label: '💬 Chat LLM' },
              { id: 'VISION_INPUT', label: '👁️ Vision' },
              { id: 'IMAGE_GEN', label: '📸 Images' },
              { id: 'STORAGE', label: '💾 Stockage' },
              { id: 'RUNTIME', label: '⚡ Runtime' },
            ].map(cat => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`text-[11px] px-2.5 py-1 rounded-lg border transition ${
                  selectedCategory === cat.id
                    ? 'bg-purple-500/20 border-purple-500/50 text-purple-300 font-semibold'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            {[
              { id: 'ALL', label: 'Tous niveaux' },
              { id: 'ERROR', label: `Erreurs (${errorCount})` },
              { id: 'WARN', label: `Alertes (${warnCount})` },
            ].map(lvl => (
              <button
                key={lvl.id}
                type="button"
                onClick={() => setSelectedLevel(lvl.id)}
                className={`text-[11px] px-2.5 py-1 rounded-lg border transition ${
                  selectedLevel === lvl.id
                    ? 'bg-rose-500/20 border-rose-500/50 text-rose-300 font-semibold'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {lvl.label}
              </button>
            ))}
          </div>
        </div>

        {/* Logs Feed */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-2 font-mono text-xs bg-[#08090f]">
          {filteredLogs.length === 0 ? (
            <div className="text-center py-12 text-slate-500 space-y-2">
              <Terminal className="w-8 h-8 mx-auto text-slate-600 opacity-60" />
              <p>Aucun événement enregistré pour ces filtres.</p>
              <p className="text-[11px] text-slate-600">Toutes les requêtes, erreurs et avertissements s'afficheront ici en direct.</p>
            </div>
          ) : (
            filteredLogs.slice().reverse().map(log => {
              const isExpanded = expandedLogId === log.id;
              return (
                <div
                  key={log.id}
                  className={`p-3 rounded-xl border transition-all ${
                    log.level === 'ERROR'
                      ? 'bg-red-950/20 border-red-500/30 hover:border-red-500/50'
                      : log.level === 'WARN'
                      ? 'bg-amber-950/15 border-amber-500/30 hover:border-amber-500/50'
                      : 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5 flex-1 min-w-0">
                      <div className="mt-0.5 shrink-0">
                        {getCategoryIcon(log.category)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          {getLevelBadge(log.level)}
                          <span className="text-[10px] text-slate-400 bg-slate-800/80 px-1.5 py-0.5 rounded">
                            {log.category}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            {log.timestamp}
                          </span>
                          {log.provider && (
                            <span className="text-[10px] text-sky-400 bg-sky-950/40 border border-sky-500/30 px-1.5 py-0.5 rounded">
                              {log.provider} {log.model ? `· ${log.model}` : ''}
                            </span>
                          )}
                        </div>
                        <p className={`break-words text-xs leading-relaxed ${
                          log.level === 'ERROR' ? 'text-red-300 font-medium' : log.level === 'WARN' ? 'text-amber-200' : 'text-slate-200'
                        }`}>
                          {log.message}
                        </p>
                      </div>
                    </div>

                    {log.details && (
                      <button
                        type="button"
                        onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                        className="text-[10px] text-slate-400 hover:text-white bg-slate-800 px-2 py-1 rounded border border-slate-700 shrink-0"
                      >
                        {isExpanded ? 'Réduire' : 'Détails JSON'}
                      </button>
                    )}
                  </div>

                  {/* Expanded JSON details */}
                  {isExpanded && log.details && (
                    <div className="mt-2.5 pt-2 border-t border-slate-800/80 text-[11px] overflow-x-auto">
                      <pre className="text-slate-300 bg-black/60 p-2.5 rounded-lg border border-slate-800 max-h-60 overflow-y-auto">
                        {typeof log.details === 'object' ? JSON.stringify(log.details, null, 2) : String(log.details)}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-[#10121d] flex items-center justify-between text-xs text-slate-400 shrink-0">
          <span>Aura AI Trace & Health Monitor</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-medium transition shadow-sm"
          >
            Fermer
          </button>
        </div>

      </div>
    </div>
  );
};
