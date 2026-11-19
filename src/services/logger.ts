/**
 * Robust Textual Logging System with Circular Rotation & Server Sync
 * Captures all LLM, Vision, Image, Storage, and Runtime errors for seamless debugging.
 */

export type LogCategory = 'LLM_CHAT' | 'VISION_INPUT' | 'IMAGE_GEN' | 'STORAGE' | 'RUNTIME' | 'NETWORK';
export type LogLevel = 'INFO' | 'WARN' | 'ERROR';

export interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  category: LogCategory;
  message: string;
  details?: any;
  provider?: string;
  model?: string;
}

const MAX_CLIENT_LOGS = 100;
let logsMemory: LogEntry[] = [];
let listeners: Array<(logs: LogEntry[]) => void> = [];

// Load previous logs from sessionStorage if available
try {
  const saved = sessionStorage.getItem('aura_runtime_logs');
  if (saved) {
    logsMemory = JSON.parse(saved).slice(-MAX_CLIENT_LOGS);
  }
} catch {
  // ignore
}

function notifyListeners() {
  listeners.forEach(fn => fn([...logsMemory]));
}

function persistLogs() {
  try {
    sessionStorage.setItem('aura_runtime_logs', JSON.stringify(logsMemory));
  } catch {
    // ignore
  }
}

// Forward error/warn and IMAGE_GEN logs to server asynchronously (best effort, no crash)
async function sendToServer(entry: LogEntry) {
  try {
    if (entry.level === 'ERROR' || entry.level === 'WARN' || entry.category === 'IMAGE_GEN') {
      fetch('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry),
      }).catch(() => {});
    }
  } catch {
    // ignore
  }
}

function addLog(level: LogLevel, category: LogCategory, message: string, details?: any, meta?: { provider?: string; model?: string }) {
  const now = new Date();
  const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}.${now.getMilliseconds().toString().padStart(3, '0')}`;

  let safeDetails: any = details;
  if (details instanceof Error) {
    safeDetails = {
      name: details.name,
      message: details.message,
      stack: details.stack?.slice(0, 300),
    };
  } else if (typeof details === 'object' && details !== null) {
    try {
      // Avoid circular or giant blobs
      safeDetails = JSON.parse(JSON.stringify(details));
    } catch {
      safeDetails = String(details);
    }
  }

  const entry: LogEntry = {
    id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: timeStr,
    level,
    category,
    message,
    details: safeDetails,
    provider: meta?.provider,
    model: meta?.model,
  };

  // Console output
  const prefix = `[${entry.timestamp}] [${entry.level}] [${entry.category}]`;
  if (level === 'ERROR') {
    console.error(prefix, message, safeDetails || '');
  } else if (level === 'WARN') {
    console.warn(prefix, message, safeDetails || '');
  } else {
    console.log(prefix, message, safeDetails || '');
  }

  // Circular rotation
  logsMemory.push(entry);
  if (logsMemory.length > MAX_CLIENT_LOGS) {
    logsMemory.shift();
  }

  persistLogs();
  notifyListeners();
  sendToServer(entry);

  return entry;
}

export const logger = {
  info(category: LogCategory, message: string, details?: any, meta?: { provider?: string; model?: string }) {
    return addLog('INFO', category, message, details, meta);
  },

  warn(category: LogCategory, message: string, details?: any, meta?: { provider?: string; model?: string }) {
    return addLog('WARN', category, message, details, meta);
  },

  error(category: LogCategory, message: string, details?: any, meta?: { provider?: string; model?: string }) {
    return addLog('ERROR', category, message, details, meta);
  },

  getLogs(): LogEntry[] {
    return [...logsMemory];
  },

  clear() {
    logsMemory = [];
    try {
      sessionStorage.removeItem('aura_runtime_logs');
    } catch {
      // ignore
    }
    notifyListeners();
  },

  subscribe(fn: (logs: LogEntry[]) => void) {
    listeners.push(fn);
    fn([...logsMemory]);
    return () => {
      listeners = listeners.filter(l => l !== fn);
    };
  },
};

// Global browser error listeners to intercept any uncaught errors
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    logger.error('RUNTIME', `Uncaught Error: ${event.message}`, {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      error: event.error,
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    logger.error('RUNTIME', `Unhandled Promise Rejection: ${event.reason?.message || String(event.reason)}`, {
      reason: event.reason,
    });
  });
}
