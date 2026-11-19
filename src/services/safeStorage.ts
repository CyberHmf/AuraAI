/**
 * Safe Storage Service with Quota Safety & Automatic Eviction
 * Prevents QuotaExceededError from ever crashing the React application.
 */

import { logger } from './logger';

const memoryFallback = new Map<string, string>();

/**
 * Truncates / downsamples selfies array if storage quota is tight.
 * Keeps at most 8 selfies, strips huge unneeded data.
 */
function pruneSelfiesForStorage(value: string): string {
  try {
    const list = JSON.parse(value);
    if (Array.isArray(list)) {
      // Keep only last 8 selfies
      const recent = list.slice(-8);
      return JSON.stringify(recent);
    }
  } catch {
    // ignore
  }
  return value;
}

/**
 * Strips huge inline base64 images from older chat messages to save storage space.
 */
function pruneMessagesForStorage(value: string): string {
  try {
    const list = JSON.parse(value);
    if (Array.isArray(list)) {
      // Keep only last 20 messages, and strip userImage from messages older than 3
      const recent = list.slice(-20).map((msg: any, idx: number, arr: any[]) => {
        if (msg.userImage && idx < arr.length - 3) {
          return { ...msg, userImage: undefined };
        }
        return msg;
      });
      return JSON.stringify(recent);
    }
  } catch {
    // ignore
  }
  return value;
}

function stripBase64FromJSON(value: string): string {
  try {
    const obj = JSON.parse(value);
    const stripRecursive = (val: any): any => {
      if (typeof val === 'string' && val.startsWith('data:image/')) {
        return '';
      }
      if (Array.isArray(val)) {
        return val.map(stripRecursive);
      }
      if (val && typeof val === 'object') {
        const res: Record<string, any> = {};
        for (const k of Object.keys(val)) {
          res[k] = stripRecursive(val[k]);
        }
        return res;
      }
      return val;
    };
    return JSON.stringify(stripRecursive(obj));
  } catch {
    return value;
  }
}

export const safeStorage = {
  getItem(key: string): string | null {
    try {
      const val = localStorage.getItem(key);
      if (val !== null) return val;
    } catch (e) {
      logger.warn('STORAGE', `Erreur lecture localStorage pour "${key}"`, e);
    }
    return memoryFallback.get(key) || null;
  },

  setItem(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
      memoryFallback.set(key, value);
    } catch (err: any) {
      const isQuota = err?.name === 'QuotaExceededError' || 
                      err?.code === 22 || 
                      err?.code === 1014 || 
                      err?.message?.includes('quota') ||
                      err?.message?.includes('exceeded');

      if (isQuota) {
        logger.warn('STORAGE', `Quota localStorage dépassé pour "${key}". Nettoyage automatique en cours...`);

        try {
          // 1. Purger les chaînes base64 de l'objet en cours
          const stripped = stripBase64FromJSON(value);
          localStorage.setItem(key, stripped);
          memoryFallback.set(key, value);
          logger.info('STORAGE', `Nettoyage réussi : base64 expurgé de "${key}" pour le stockage local.`);
          return;
        } catch {
          // 2. Si ça échoue encore, purger les anciennes données de cache
          try {
            localStorage.removeItem('aura_selfies');
            localStorage.removeItem('aura_chat_messages');
            const stripped = stripBase64FromJSON(value);
            localStorage.setItem(key, stripped);
            memoryFallback.set(key, value);
            logger.info('STORAGE', `Nettoyage d'urgence réussi pour "${key}".`);
            return;
          } catch (retryErr) {
            logger.warn('STORAGE', `Bascule transparente en mémoire vive pour "${key}".`);
            memoryFallback.set(key, value);
          }
        }
      } else {
        logger.error('STORAGE', `Erreur inattendue localStorage pour "${key}"`, err);
        memoryFallback.set(key, value);
      }
    }
  },

  removeItem(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      logger.warn('STORAGE', `Erreur suppression localStorage "${key}"`, e);
    }
    memoryFallback.delete(key);
  },

  clearNonEssentials(): void {
    try {
      localStorage.removeItem('aura_selfies');
      logger.info('STORAGE', 'Nettoyage complet du cache des selfies effectué.');
    } catch (e) {
      logger.warn('STORAGE', 'Erreur nettoyage des selfies', e);
    }
  }
};
