import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import net from 'net';
import dns from 'node:dns/promises';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const app = express();
app.set('trust proxy', 1);

// Body-size limits: 1MB default, 25MB strictly for image-bearing routes
const smallJsonParser = express.json({ limit: '1mb' });
const largeJsonParser = express.json({ limit: '25mb' });
const IMAGE_HEAVY_PATHS = new Set([
  '/api/state',
  '/api/upload-image',
  '/api/chat',
  '/api/nanogpt/chat',
  '/api/nanogpt/generate-image',
  '/api/openrouter/chat',
  '/api/openrouter/generate-image',
  '/api/groq/chat',
  '/api/generate-image',
]);

app.use((req, res, next) => {
  if (IMAGE_HEAVY_PATHS.has(req.path)) {
    return largeJsonParser(req, res, next);
  }
  return smallJsonParser(req, res, next);
});

// Lightweight in-memory rate limiter for /api/*
interface RateLimitBucket {
  count: number;
  resetAt: number;
}

function createRateLimiter(windowMs: number, maxRequests: number, errorMessage: string) {
  const buckets = new Map<string, RateLimitBucket>();

  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets.entries()) {
      if (bucket.resetAt <= now) buckets.delete(key);
    }
  }, Math.max(windowMs, 60_000));
  if (typeof cleanupTimer.unref === 'function') cleanupTimer.unref();

  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const clientIp = req.ip || req.socket.remoteAddress || 'local';
    const now = Date.now();
    const existing = buckets.get(clientIp);
    if (!existing || existing.resetAt <= now) {
      buckets.set(clientIp, { count: 1, resetAt: now + windowMs });
      return next();
    }
    if (existing.count >= maxRequests) {
      const retryAfterSec = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfterSec));
      return res.status(429).json({ error: errorMessage });
    }
    existing.count += 1;
    return next();
  };
}

const generalApiLimiter = createRateLimiter(60_000, 180, 'Trop de requêtes API. Réessayez dans quelques instants.');
const authLoginLimiter = createRateLimiter(5 * 60_000, 15, 'Trop de tentatives de connexion. Patientez quelques minutes.');
const sensitiveApiLimiter = createRateLimiter(60_000, 40, 'Limite de requêtes atteinte pour cette opération. Patientez un moment.');

app.use('/api', generalApiLimiter);

// Optional AUTH_TOKEN protection for all /api/* routes (including /api/images)
const AUTH_TOKEN = (process.env.AUTH_TOKEN || '').trim();
const SESSION_COOKIE_NAME = 'aura_session';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function sha256Buffer(input: string): Buffer {
  return crypto.createHash('sha256').update(input, 'utf8').digest();
}

function timingSafeMatch(a: string, b: string): boolean {
  if (!a || !b) return false;
  return crypto.timingSafeEqual(sha256Buffer(a), sha256Buffer(b));
}

function parseCookies(cookieHeader?: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;
  for (const part of cookieHeader.split(';')) {
    const eqIdx = part.indexOf('=');
    if (eqIdx === -1) continue;
    const key = part.slice(0, eqIdx).trim();
    const val = part.slice(eqIdx + 1).trim();
    if (key) {
      try {
        cookies[key] = decodeURIComponent(val);
      } catch {
        cookies[key] = val;
      }
    }
  }
  return cookies;
}

function createSignedSessionCookieValue(): string {
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const payload = `${expiresAt}`;
  const sig = crypto.createHmac('sha256', AUTH_TOKEN).update(`aura-v1:${payload}`).digest('hex');
  return `${payload}.${sig}`;
}

function verifySignedSessionCookie(cookieVal?: string): boolean {
  if (!cookieVal || !AUTH_TOKEN) return false;
  const parts = cookieVal.split('.');
  if (parts.length !== 2) return false;
  const [expiresStr, providedSig] = parts;
  const expiresAt = Number(expiresStr);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return false;
  const expectedSig = crypto.createHmac('sha256', AUTH_TOKEN).update(`aura-v1:${expiresStr}`).digest('hex');
  return timingSafeMatch(providedSig, expectedSig);
}

function isRequestAuthenticated(req: express.Request): boolean {
  if (!AUTH_TOKEN) return true;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const bearer = authHeader.slice(7).trim();
    if (timingSafeMatch(bearer, AUTH_TOKEN)) return true;
  }
  const cookies = parseCookies(req.headers.cookie);
  return verifySignedSessionCookie(cookies[SESSION_COOKIE_NAME]);
}

function buildSessionCookieString(value: string, maxAgeSeconds: number, isSecure: boolean): string {
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAgeSeconds}`,
  ];
  if (isSecure) {
    parts.push('Secure');
  }
  return parts.join('; ');
}

app.get('/api/auth/status', (req, res) => {
  res.json({
    authRequired: Boolean(AUTH_TOKEN),
    authenticated: isRequestAuthenticated(req),
  });
});

app.post('/api/auth/login', authLoginLimiter, (req, res) => {
  if (!AUTH_TOKEN) {
    return res.json({ success: true, authRequired: false });
  }
  const submitted = typeof req.body?.token === 'string' ? req.body.token.trim() : '';
  if (!timingSafeMatch(submitted, AUTH_TOKEN)) {
    return res.status(401).json({ error: 'Jeton d’accès invalide' });
  }
  const sessionVal = createSignedSessionCookieValue();
  const isSecure = Boolean(req.secure || req.headers['x-forwarded-proto'] === 'https');
  res.setHeader('Set-Cookie', buildSessionCookieString(sessionVal, Math.floor(SESSION_TTL_MS / 1000), isSecure));
  return res.json({ success: true, authRequired: true });
});

app.post('/api/auth/logout', (req, res) => {
  const isSecure = Boolean(req.secure || req.headers['x-forwarded-proto'] === 'https');
  res.setHeader('Set-Cookie', buildSessionCookieString('', 0, isSecure));
  return res.json({ success: true });
});

app.use('/api', (req, res, next) => {
  if (!AUTH_TOKEN) return next();
  if (req.path === '/auth/status' || req.path === '/auth/login' || req.path === '/auth/logout') {
    return next();
  }
  if (!isRequestAuthenticated(req)) {
    return res.status(401).json({ error: 'Authentification requise', authRequired: true });
  }
  return next();
});

// SSRF Validator: blocks cloud metadata & dangerous schemes while preserving local Ollama/ComfyUI/XTTS endpoints
const BLOCKED_METADATA_HOSTS = new Set([
  '169.254.169.254',
  'metadata.google.internal',
  'metadata.goog',
  'metadata',
  'instance-data',
  '100.100.100.200',
  'fd00:ec2::254',
  '0.0.0.0',
]);

function isBlockedIpAddress(rawIp: string, disallowPrivate: boolean): boolean {
  let ip = rawIp.trim().toLowerCase();
  if (ip.startsWith('::ffff:')) {
    ip = ip.slice(7);
  }
  if (net.isIPv4(ip)) {
    const octets = ip.split('.').map(Number);
    if (octets.length !== 4 || octets.some(n => Number.isNaN(n))) return true;
    const [a, b] = octets;
    // Link-local & cloud metadata (169.254.0.0/16)
    if (a === 169 && b === 254) return true;
    // Current network / unspecified (0.0.0.0/8)
    if (a === 0) return true;
    // Alibaba Cloud metadata
    if (ip === '100.100.100.200') return true;
    // Multicast & reserved (224.0.0.0/4+)
    if (a >= 224) return true;
    if (disallowPrivate) {
      if (a === 127) return true;
      if (a === 10) return true;
      if (a === 172 && b >= 16 && b <= 31) return true;
      if (a === 192 && b === 168) return true;
      if (a === 100 && b >= 64 && b <= 127) return true;
    }
    return false;
  }
  if (net.isIPv6(ip)) {
    if (ip === '::' || ip === '0:0:0:0:0:0:0:0') return true;
    // Link-local fe80::/10
    if (/^fe[89ab]/.test(ip)) return true;
    // AWS IPv6 metadata
    if (ip === 'fd00:ec2::254') return true;
    // Multicast ff00::/8
    if (ip.startsWith('ff')) return true;
    if (disallowPrivate) {
      if (ip === '::1' || ip.startsWith('fc') || ip.startsWith('fd')) return true;
    }
    return false;
  }
  return true;
}

async function validateExternalEndpointUrl(
  rawUrl: string,
  options: { disallowPrivate?: boolean } = {}
): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    throw new Error('URL invalide');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Protocole non autorisé (http/https uniquement)');
  }
  if (parsed.username || parsed.password) {
    throw new Error('Identifiants intégrés dans l’URL interdits');
  }

  const hostname = parsed.hostname.replace(/^\[|\]$/g, '').replace(/\.$/, '').toLowerCase();
  if (!hostname) {
    throw new Error('Nom d’hôte manquant');
  }
  if (BLOCKED_METADATA_HOSTS.has(hostname)) {
    throw new Error('Adresse de métadonnées cloud bloquée (SSRF)');
  }

  const disallowPrivate = Boolean(options.disallowPrivate);
  if (disallowPrivate && (hostname === 'localhost' || hostname === 'host.docker.internal' || hostname.endsWith('.local'))) {
    throw new Error('Hôte privé ou local interdit pour cette requête');
  }

  if (net.isIP(hostname)) {
    if (isBlockedIpAddress(hostname, disallowPrivate)) {
      throw new Error('Adresse IP cible bloquée par la politique SSRF');
    }
    return parsed;
  }

  if (hostname === 'localhost' || hostname === 'host.docker.internal') {
    return parsed;
  }

  try {
    const resolved = await dns.lookup(hostname, { all: true });
    for (const entry of resolved) {
      if (isBlockedIpAddress(entry.address, disallowPrivate)) {
        throw new Error('Résolution DNS vers une adresse IP bloquée (SSRF)');
      }
    }
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('SSRF')) {
      throw err;
    }
    // Allow hostname connection attempt to fail naturally in fetch if local alias (e.g. docker service name)
  }

  return parsed;
}

// Persistent API Keys & State storage in data/
const DATA_DIR = path.resolve(process.env.DATA_DIR || 'data');
const KEYS_FILE = path.join(DATA_DIR, 'keys.json');
const STATE_FILE = path.join(DATA_DIR, 'app_state.json');
const IMAGES_DIR = path.join(DATA_DIR, 'images');
const LOGS_FILE = path.join(DATA_DIR, 'app.log');
const LOGS_BACKUP_FILE = path.join(DATA_DIR, 'app.log.old');
const MAX_LOG_SIZE_BYTES = 500 * 1024; // 500 KB limit before rotation

function clearServerLogs() {
  for (const logPath of [LOGS_FILE, LOGS_BACKUP_FILE]) {
    try {
      if (fs.existsSync(logPath)) {
        fs.unlinkSync(logPath);
      }
    } catch {
      // ignore
    }
  }
}

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(IMAGES_DIR)) {
  fs.mkdirSync(IMAGES_DIR, { recursive: true });
}

// Serve images static directory (protected by /api auth middleware when AUTH_TOKEN is set)
app.use(
  '/api/images',
  express.static(IMAGES_DIR, {
    setHeaders: (res) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
    },
  })
);

interface StoredApiKeys {
  groqApiKey?: string;
  openRouterApiKey?: string;
  geminiApiKey?: string;
  nanoGptApiKey?: string;
}

function getStoredKeys(): StoredApiKeys {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(KEYS_FILE)) {
      const raw = fs.readFileSync(KEYS_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.warn('Erreur lecture keys.json:', err);
  }
  return {};
}

function saveStoredKeys(newKeys: Partial<StoredApiKeys>): StoredApiKeys {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const current = getStoredKeys();
    const updated: StoredApiKeys = { ...current };
    if (typeof newKeys.groqApiKey === 'string' && newKeys.groqApiKey.trim()) {
      updated.groqApiKey = newKeys.groqApiKey.trim();
    }
    if (typeof newKeys.openRouterApiKey === 'string' && newKeys.openRouterApiKey.trim()) {
      updated.openRouterApiKey = newKeys.openRouterApiKey.trim();
    }
    if (typeof newKeys.geminiApiKey === 'string' && newKeys.geminiApiKey.trim()) {
      updated.geminiApiKey = newKeys.geminiApiKey.trim();
    }
    if (typeof newKeys.nanoGptApiKey === 'string' && newKeys.nanoGptApiKey.trim()) {
      updated.nanoGptApiKey = newKeys.nanoGptApiKey.trim();
    }
    fs.writeFileSync(KEYS_FILE, JSON.stringify(updated, null, 2), 'utf-8');
    return updated;
  } catch (err) {
    console.error('Erreur écriture keys.json:', err);
    throw err;
  }
}

function deleteStoredKey(provider: string): StoredApiKeys {
  const current = getStoredKeys();
  const updated: StoredApiKeys = { ...current };
  if (provider === 'groq') delete updated.groqApiKey;
  else if (provider === 'openrouter') delete updated.openRouterApiKey;
  else if (provider === 'gemini') delete updated.geminiApiKey;
  else if (provider === 'nanogpt') delete updated.nanoGptApiKey;
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(KEYS_FILE, JSON.stringify(updated, null, 2), 'utf-8');
  return updated;
}

function getKeyStatusResponse() {
  const stored = getStoredKeys();
  return {
    hasGeminiKey: Boolean(stored.geminiApiKey || process.env.GEMINI_API_KEY),
    hasGroqKey: Boolean(stored.groqApiKey),
    hasOpenRouterKey: Boolean(stored.openRouterApiKey),
    hasNanoGptKey: Boolean(stored.nanoGptApiKey),
  };
}

// Initialise from env if keys.json is fresh
const initialEnvGeminiKey = process.env.GEMINI_API_KEY;
if (initialEnvGeminiKey) {
  const current = getStoredKeys();
  if (!current.geminiApiKey) {
    saveStoredKeys({ geminiApiKey: initialEnvGeminiKey });
  }
}

function getGeminiClient(clientKey?: string): GoogleGenAI | null {
  const stored = getStoredKeys();
  const effectiveKey = (clientKey || stored.geminiApiKey || process.env.GEMINI_API_KEY || '').trim();
  if (!effectiveKey) return null;
  return new GoogleGenAI({ apiKey: effectiveKey });
}

// Keys management endpoints (NEVER expose raw keys to the client; only booleans)
app.get('/api/keys', (_req, res) => {
  res.json(getKeyStatusResponse());
});

app.post('/api/keys', sensitiveApiLimiter, (req, res) => {
  try {
    const { groqApiKey, openRouterApiKey, geminiApiKey, nanoGptApiKey } = req.body || {};
    saveStoredKeys({ groqApiKey, openRouterApiKey, geminiApiKey, nanoGptApiKey });
    res.json({ success: true, ...getKeyStatusResponse() });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erreur sauvegarde des clés';
    res.status(500).json({ error: msg });
  }
});

app.delete('/api/keys/:provider', sensitiveApiLimiter, (req, res) => {
  try {
    const provider = String(req.params.provider || '').toLowerCase();
    if (!['groq', 'openrouter', 'gemini', 'nanogpt'].includes(provider)) {
      return res.status(400).json({ error: 'Fournisseur invalide' });
    }
    deleteStoredKey(provider);
    res.json({ success: true, ...getKeyStatusResponse() });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erreur suppression de clé';
    res.status(500).json({ error: msg });
  }
});

// Proxy API chat endpoint for Gemini with server key & Vision support
app.post('/api/chat', async (req, res) => {
  try {
    const { systemPrompt, messages, latestMessage, userImage, model, apiKey: clientKey } = req.body;
    const activeAi = getGeminiClient(clientKey);
    if (!activeAi) {
      return res.status(503).json({ error: 'GEMINI_API_KEY non configurée sur le serveur' });
    }

    const contents: any[] = (messages || []).map((m: { role: string; content: string }) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    // Build latest user turn with optional inline image (Multimodal Vision)
    const latestUserParts: any[] = [];
    if (userImage && typeof userImage === 'string') {
      const match = userImage.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
      if (match) {
        latestUserParts.push({
          inlineData: {
            mimeType: match[1],
            data: match[2],
          }
        });
      }
    }
    latestUserParts.push({
      text: latestMessage || (userImage ? "Regarde cette photo que je viens de prendre pour toi !" : "")
    });

    contents.push({ role: 'user', parts: latestUserParts });

    const chosenModel = (model && model !== 'gemini-2.5-flash' && model !== 'gemini-2.5-pro') ? model : 'gemini-3.1-flash-lite';

    const response = await activeAi.models.generateContent({
      model: chosenModel,
      contents,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.85,
      }
    });

    const reply = response.text || '';
    const tokensUsed = Math.ceil(((systemPrompt?.length || 0) + reply.length + (latestMessage?.length || 0)) / 3.8);
    res.json({ text: reply, tokensUsed });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Gemini error';
    console.error('Server Gemini error:', errorMessage);
    res.status(500).json({ error: errorMessage });
  }
});

// Endpoint to check backend capabilities & env status
app.get('/api/config-status', (_req, res) => {
  const stored = getStoredKeys();
  res.json({
    hasGeminiKey: Boolean(stored.geminiApiKey || process.env.GEMINI_API_KEY),
    hasGroqKey: Boolean(stored.groqApiKey),
    hasOpenRouterKey: Boolean(stored.openRouterApiKey),
    hasNanoGptKey: Boolean(stored.nanoGptApiKey),
    port: PORT,
  });
});

// Endpoint to dynamically list available models for Groq, OpenRouter, Local, or Gemini (supports POST body and GET query)
async function handleModelsRequest(req: express.Request, res: express.Response) {
  const provider = String(req.body?.provider ?? req.query.provider ?? 'gemini');
  const clientKey = String(req.headers['x-api-key'] ?? req.body?.apiKey ?? req.query.apiKey ?? '');
  const endpoint = String(req.body?.endpoint ?? req.query.endpoint ?? 'http://localhost:11434');
  const type = String(req.body?.type ?? req.query.type ?? 'chat'); // 'chat' or 'image'

  const storedKeys = getStoredKeys();

  try {
    if (provider === 'gemini') {
      return res.json({
        provider: 'gemini',
        isLive: true,
        models: [
          { id: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash Lite', tag: '⚡ Recommandé Petit Budget & Rapide', isVision: true, isDefault: true },
          { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash', tag: 'Équilibré & Vif', isVision: true },
          { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash', tag: 'Haute Fidélité Multimodale', isVision: true },
          { id: 'gemini-4-argon', name: 'Gemini 4 Argon', tag: 'Raisonnement & Émotions profonds', isVision: true },
        ],
      });
    }

    if (provider === 'groq') {
      const effectiveGroqKey = (clientKey || storedKeys.groqApiKey || '').trim();

      const GROQ_CATALOG_MODELS = [
        { id: 'deepseek-r1-distill-llama-70b', name: 'DeepSeek R1 Distill Llama 70B', tag: '🧠 Raisonnement R1 Profond', category: '🧠 Raisonnement & Réflexion', isVision: false, isPopular: true },
        { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B Versatile', tag: '⭐ Recommandé Groq (Idéal Chat)', category: '⭐ Conversation & Romance', isVision: false, isDefault: true, isPopular: true },
        { id: 'llama-3.3-70b-specdec', name: 'Llama 3.3 70B Speculative', tag: '⚡ Décodage Spéculatif Ultra-Rapide', category: '⭐ Conversation & Romance', isVision: false },
        { id: 'llama-3.1-70b-versatile', name: 'Llama 3.1 70B Versatile', tag: 'Llama 3.1 Haute Fidélité', category: '⭐ Conversation & Romance', isVision: false },
        { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B Instant', tag: '⚡ 1200 tokens/sec Vitesse Pure', category: '⚡ Vitesse Éclair', isVision: false, isPopular: true },
        { id: 'llama-3.2-11b-vision-preview', name: 'Llama 3.2 11B Vision', tag: '👁️ Vision Multimodale Photos', category: '👁️ Vision Multimodale', isVision: true, isPopular: true },
        { id: 'llama-3.2-90b-vision-preview', name: 'Llama 3.2 90B Vision', tag: '👁️ Vision Haute Définition', category: '👁️ Vision Multimodale', isVision: true },
        { id: 'deepseek-r1-distill-qwen-32b', name: 'DeepSeek R1 Distill Qwen 32B', tag: '🧠 R1 Raisonnement 32B', category: '🧠 Raisonnement & Réflexion', isVision: false },
        { id: 'qwen-2.5-32b', name: 'Qwen 2.5 32B', tag: 'Excellence Multilingue & Nuances', category: '🌐 Qwen & Modèles Spécialisés', isVision: false, isPopular: true },
        { id: 'qwen-2.5-coder-32b', name: 'Qwen 2.5 Coder 32B', tag: 'Logique & Rigueur', category: '🌐 Qwen & Modèles Spécialisés', isVision: false },
        { id: 'llama-3.2-3b-preview', name: 'Llama 3.2 3B', tag: 'Compact Léger', category: '⚡ Vitesse Éclair', isVision: false },
        { id: 'llama-3.2-1b-preview', name: 'Llama 3.2 1B', tag: 'Micro Modèle Ultra-Rapide', category: '⚡ Vitesse Éclair', isVision: false },
        { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B (32k)', tag: 'Grand Contexte 32k MoE', category: '🌐 Qwen & Modèles Spécialisés', isVision: false },
        { id: 'gemma2-9b-it', name: 'Google Gemma 2 9B IT', tag: 'Google Open-Weights', category: '🌐 Qwen & Modèles Spécialisés', isVision: false },
      ];

      if (!effectiveGroqKey) {
        return res.json({
          provider: 'groq',
          requiresKey: true,
          isLive: false,
          models: GROQ_CATALOG_MODELS,
        });
      }

      try {
        const groqRes = await fetch('https://api.groq.com/openai/v1/models', {
          headers: {
            Authorization: `Bearer ${effectiveGroqKey}`,
            'Content-Type': 'application/json',
          },
          signal: AbortSignal.timeout(8000),
        });

        if (groqRes.ok) {
          const groqData = await groqRes.json();
          const allGroqModels = (groqData.data || []) as Array<{ id: string; active?: boolean }>;

          // Filter out whisper, guard, audio, embeddings
          const liveChatModels = allGroqModels
            .filter(m => !m.id.includes('whisper') && !m.id.includes('guard') && !m.id.includes('embed'))
            .map(m => {
              const known = GROQ_CATALOG_MODELS.find(k => k.id === m.id);
              const isVision = m.id.includes('vision');
              return {
                id: m.id,
                name: known ? known.name : m.id,
                tag: isVision ? '👁️ Chat + Vision (Photos)' : (known ? known.tag : 'Actif sur votre compte'),
                category: isVision ? '👁️ Chat + Vision (Recommandé)' : (known ? known.category : 'Autres Modèles Actifs'),
                isVision,
                isPopular: isVision || m.id.includes('70b') || m.id.includes('r1'),
              };
            });

          // Sort Vision models first so user immediately sees Chat + Vision models
          liveChatModels.sort((a, b) => {
            if (a.isVision && !b.isVision) return -1;
            if (!a.isVision && b.isVision) return 1;
            if (a.isPopular && !b.isPopular) return -1;
            if (!a.isPopular && b.isPopular) return 1;
            return a.name.localeCompare(b.name);
          });

          const recommendedVisionModel = liveChatModels.find(m => m.isVision)?.id || 'llama-3.2-11b-vision-preview';

          return res.json({
            provider: 'groq',
            isLive: true,
            recommendedVisionModel,
            models: liveChatModels,
          });
        } else {
          const errData = await groqRes.json().catch(() => ({}));
          return res.status(groqRes.status).json({
            error: errData.error?.message || `Erreur Groq (${groqRes.status}) - Clé API invalide ou refusée`,
          });
        }
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : 'Erreur réseau';
        return res.status(502).json({
          error: `Impossible de contacter l'API Groq en direct (${errorMsg})`,
        });
      }
    }

    if (provider === 'openrouter') {
      const effectiveOpenRouterKey = (clientKey || storedKeys.openRouterApiKey || '').trim();
      const headers: Record<string, string> = {};
      if (effectiveOpenRouterKey) headers['Authorization'] = `Bearer ${effectiveOpenRouterKey}`;

      const orRes = await fetch('https://openrouter.ai/api/v1/models', {
        headers,
        signal: AbortSignal.timeout(10000),
      });

      if (!orRes.ok) {
        return res.status(orRes.status).json({ error: 'Impossible de joindre OpenRouter en direct' });
      }

      const orData = await orRes.json();
      const rawModels = (orData.data || []) as any[];

      if (type === 'image') {
        // Strict filtering: ONLY real models that actually output images (exclude openrouter/auto routers)
        const imageModels = rawModels
          .filter(m => {
            if (m.id.startsWith('openrouter/auto')) return false;
            const outMods = m.architecture?.output_modalities || [];
            const modality = m.architecture?.modality || '';
            const isTextToImage = outMods.includes('image') || 
                                  modality.includes('->image') || 
                                  modality.includes('->text+image') || 
                                  modality.split('->')[1]?.includes('image');
            const hasImageName = m.id.toLowerCase().includes('flux') ||
                                 m.id.toLowerCase().includes('diffusion') ||
                                 m.id.toLowerCase().includes('dall-e') ||
                                 m.id.toLowerCase().endsWith('-image') ||
                                 m.id.toLowerCase().includes('image-preview');
            const isPureVisionInput = modality.includes('image->text') && !isTextToImage;
            return (isTextToImage || hasImageName) && !isPureVisionInput;
          })
          .map(m => {
            const inMods = m.architecture?.input_modalities || [];
            const modality = m.architecture?.modality || '';
            const supportsFaceReference = inMods.includes('image') || modality.includes('text+image->') || modality.includes('+image->');
            const pricingTag = m.pricing?.image 
              ? `${m.pricing.image}$/img` 
              : (m.pricing?.prompt ? `${(Number(m.pricing.prompt) * 1000000).toFixed(2)}$/1M` : 'Modèle Image');
            return {
              id: m.id,
              name: m.name || m.id,
              tag: supportsFaceReference ? `📸 Face Persistante (${pricingTag})` : `🖼️ Texte->Image (${pricingTag})`,
              supportsFaceReference,
              description: m.description?.slice(0, 100) || '',
            };
          });

        // Place Nano Banana / Gemini Flash Image first, then other face-reference models
        const preferredOrder = [
          'google/gemini-2.5-flash-image',
          'google/gemini-3.1-flash-lite-image',
          'google/gemini-3.1-flash-image',
          'google/gemini-3.1-flash-image-preview',
          'openai/gpt-5-image-mini',
          'openai/gpt-5-image',
        ];
        imageModels.sort((a, b) => {
          const idxA = preferredOrder.indexOf(a.id);
          const idxB = preferredOrder.indexOf(b.id);
          if (idxA !== -1 && idxB !== -1) return idxA - idxB;
          if (idxA !== -1) return -1;
          if (idxB !== -1) return 1;
          if (a.supportsFaceReference && !b.supportsFaceReference) return -1;
          if (!a.supportsFaceReference && b.supportsFaceReference) return 1;
          return a.name.localeCompare(b.name);
        });

        return res.json({ provider: 'openrouter', type: 'image', isLive: true, models: imageModels });
      }

      // Text/Chat models (all 400+ real-time models)
      const popularModelIds = [
        'meta-llama/llama-3.3-70b-instruct',
        'meta-llama/llama-3.2-11b-vision-instruct',
        'deepseek/deepseek-chat',
        'deepseek/deepseek-r1',
        'anthropic/claude-3.5-sonnet',
        'mistralai/mistral-large-2411',
        'google/gemini-2.0-flash-001',
        'openai/gpt-4o-mini',
      ];

      const mapped = rawModels.map(m => {
        const isVision = m.architecture?.input_modalities?.includes('image') || m.id.includes('vision');
        const isPopular = popularModelIds.includes(m.id);
        let tag = '';
        if (isPopular) tag = '⭐ Populaire';
        if (isVision) tag = tag ? `${tag} • 👁️ Vision` : '👁️ Vision';

        return {
          id: m.id,
          name: m.name || m.id,
          tag,
          isVision,
          isPopular,
          contextLength: m.context_length,
        };
      });

      // Sort popular models first, then alphabetical
      mapped.sort((a, b) => {
        if (a.isPopular && !b.isPopular) return -1;
        if (!a.isPopular && b.isPopular) return 1;
        return a.name.localeCompare(b.name);
      });

      return res.json({ provider: 'openrouter', type: 'chat', isLive: true, models: mapped });
    }

    if (provider === 'nanogpt') {
      const effectiveNanoKey = (clientKey || storedKeys.nanoGptApiKey || '').trim();
      const headers: Record<string, string> = {};
      if (effectiveNanoKey) headers['Authorization'] = `Bearer ${effectiveNanoKey}`;

      const SUBSCRIPTION_IMAGE_IDS = ['qwen-image', 'z-image-turbo', 'hidream', 'chroma'];

      if (type === 'image') {
        const FALLBACK_IMAGE_MODELS = [
          {
            id: 'qwen-image',
            name: 'Qwen Image',
            tag: '💎 Abo 12$ (100/j) • 📸 Face Persistante (Img2Img)',
            supportsFaceReference: true,
            isSubscriptionIncluded: true,
          },
          {
            id: 'z-image-turbo',
            name: 'Z Image Turbo',
            tag: '💎 Abo 12$ (100/j) • ⚡ Photoréal Ultra-Rapide',
            supportsFaceReference: false,
            isSubscriptionIncluded: true,
          },
          {
            id: 'hidream',
            name: 'HiDream',
            tag: '💎 Abo 12$ (100/j) • 🎨 Haute Fidélité',
            supportsFaceReference: false,
            isSubscriptionIncluded: true,
          },
          {
            id: 'chroma',
            name: 'Chroma',
            tag: '💎 Abo 12$ (100/j) • 🔓 Artistique / Uncensored',
            supportsFaceReference: false,
            isSubscriptionIncluded: true,
          },
        ];

        try {
          const imgRes = await fetch('https://nano-gpt.com/api/v1/image-models', {
            headers,
            signal: AbortSignal.timeout(10000),
          });
          if (imgRes.ok) {
            const imgData = await imgRes.json();
            const rawImgs = (imgData.data || []) as any[];
            const mappedImgs = rawImgs.map(m => {
              const isSub = SUBSCRIPTION_IMAGE_IDS.includes(m.id) || Boolean(m.subscription?.included);
              const supportsFaceReference = Boolean(m.capabilities?.image_to_image);
              const badges: string[] = [];
              if (isSub) badges.push('💎 Abo 12$ (100/j)');
              if (supportsFaceReference) badges.push('📸 Face Persistante');
              else badges.push('🖼️ Texte→Image');
              return {
                id: m.id,
                name: m.name || m.id,
                tag: badges.join(' • '),
                supportsFaceReference,
                isSubscriptionIncluded: isSub,
                description: m.description?.slice(0, 110) || '',
              };
            });

            mappedImgs.sort((a, b) => {
              const idxA = SUBSCRIPTION_IMAGE_IDS.indexOf(a.id);
              const idxB = SUBSCRIPTION_IMAGE_IDS.indexOf(b.id);
              if (idxA !== -1 && idxB !== -1) return idxA - idxB;
              if (idxA !== -1) return -1;
              if (idxB !== -1) return 1;
              if (a.isSubscriptionIncluded && !b.isSubscriptionIncluded) return -1;
              if (!a.isSubscriptionIncluded && b.isSubscriptionIncluded) return 1;
              if (a.supportsFaceReference && !b.supportsFaceReference) return -1;
              if (!a.supportsFaceReference && b.supportsFaceReference) return 1;
              return a.name.localeCompare(b.name);
            });

            return res.json({
              provider: 'nanogpt',
              type: 'image',
              isLive: true,
              models: mappedImgs,
            });
          }
        } catch (err) {
          console.warn('NanoGPT image-models fallback:', err);
        }

        return res.json({
          provider: 'nanogpt',
          type: 'image',
          isLive: false,
          models: FALLBACK_IMAGE_MODELS,
        });
      }

      // NanoGPT Chat / Text / Vision / Tools models
      try {
        const txtRes = await fetch('https://nano-gpt.com/api/v1/models?detailed=true', {
          headers,
          signal: AbortSignal.timeout(12000),
        });
        if (!txtRes.ok) {
          return res.status(txtRes.status).json({ error: `Impossible de joindre NanoGPT (${txtRes.status})` });
        }
        const txtData = await txtRes.json();
        const rawModels = (txtData.data || []) as any[];

        const mapped = rawModels.map(m => {
          const isVision = Boolean(m.capabilities?.vision || m.architecture?.input_modalities?.includes('image'));
          const supportsTools = Boolean(m.capabilities?.tool_calling);
          const isReasoning = Boolean(m.capabilities?.reasoning);
          const isSubscriptionIncluded = Boolean(m.subscription?.included);
          const isPopular = isSubscriptionIncluded && (
            m.id.includes('deepseek') ||
            m.id.includes('qwen') ||
            m.id.includes('llama') ||
            m.id.includes('glm') ||
            m.id.includes('mistral') ||
            isVision
          );

          const tags: string[] = [];
          if (isSubscriptionIncluded) tags.push('💎 Abo 12$');
          if (isVision) tags.push('👁️ Vision');
          if (supportsTools) tags.push('🛠️ Outils');
          if (isReasoning) tags.push('🧠 Raisonnement');

          return {
            id: m.id,
            name: m.name || m.id,
            tag: tags.join(' • '),
            isVision,
            supportsTools,
            isReasoning,
            isSubscriptionIncluded,
            isPopular,
            contextLength: m.context_length,
          };
        });

        mapped.sort((a, b) => {
          if (a.isSubscriptionIncluded && !b.isSubscriptionIncluded) return -1;
          if (!a.isSubscriptionIncluded && b.isSubscriptionIncluded) return 1;
          if (a.isVision && !b.isVision) return -1;
          if (!a.isVision && b.isVision) return 1;
          if (a.isPopular && !b.isPopular) return -1;
          if (!a.isPopular && b.isPopular) return 1;
          return a.name.localeCompare(b.name);
        });

        const recommendedVisionModel = mapped.find(m => m.isSubscriptionIncluded && m.isVision)?.id ||
                                       mapped.find(m => m.isVision)?.id ||
                                       mapped[0]?.id;

        return res.json({
          provider: 'nanogpt',
          type: 'chat',
          isLive: Boolean(effectiveNanoKey) || mapped.length > 0,
          hasKey: Boolean(effectiveNanoKey),
          recommendedVisionModel,
          subscriptionCount: mapped.filter(m => m.isSubscriptionIncluded).length,
          models: mapped,
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Erreur NanoGPT';
        return res.status(502).json({ error: `Impossible de contacter l'API NanoGPT (${msg})` });
      }
    }

    if (provider === 'local') {
      const cleanUrl = endpoint.replace(/\/v1\/?$/, '');
      try {
        await validateExternalEndpointUrl(cleanUrl, { disallowPrivate: false });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'URL locale non autorisée';
        return res.status(400).json({ error: msg });
      }
      try {
        const tagRes = await fetch(`${cleanUrl}/api/tags`, {
          redirect: 'error',
          signal: AbortSignal.timeout(4000),
        });
        if (tagRes.ok) {
          const tagData = await tagRes.json();
          const models = (tagData.models || []).map((m: any) => ({
            id: m.name,
            name: m.name,
            tag: m.details?.parameter_size ? `${m.details.parameter_size}` : 'Local',
            isVision: m.name.includes('vision') || m.name.includes('llava'),
          }));
          return res.json({ provider: 'local', models });
        }
      } catch {
        // Fallback below
      }

      return res.json({
        provider: 'local',
        models: [
          { id: 'llama3.2-vision', name: 'llama3.2-vision', tag: '👁️ Vision Recommandé', isVision: true },
          { id: 'mistral', name: 'mistral:latest', tag: 'Texte Rapide', isVision: false },
          { id: 'llama3.1', name: 'llama3.1:latest', tag: 'Général', isVision: false },
        ],
      });
    }

    return res.status(400).json({ error: 'Provider non supporté' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erreur récupération modèles';
    res.status(500).json({ error: msg });
  }
}

app.get('/api/models', handleModelsRequest);
app.post('/api/models', handleModelsRequest);

// Proxy endpoint for Gemini native image generation
app.post('/api/generate-image', sensitiveApiLimiter, async (req, res) => {
  try {
    const { prompt, aspectRatio, apiKey: clientKey, referenceImage } = req.body;
    const activeAi = getGeminiClient(clientKey);
    if (!activeAi) {
      return res.status(503).json({ error: 'GEMINI_API_KEY non configurée' });
    }

    const parts: any[] = [];

    // If an authentic portrait reference image is passed (base64)
    if (referenceImage && typeof referenceImage === 'string' && referenceImage.startsWith('data:image/')) {
      const match = referenceImage.match(/^data:([^;]+);base64,(.+)$/);
      if (match && match[2]) {
        parts.push({
          inlineData: {
            mimeType: match[1] || 'image/jpeg',
            data: match[2],
          },
        });
        parts.push({
          text: `Preserve the exact same facial identity, face structure, eye color, facial features, and likeness of the woman shown in this reference portrait photograph. Generate a realistic new candid photo of this exact same woman in this new context: ${prompt}`,
        });
      }
    }

    if (parts.length === 0) {
      parts.push({
        text: prompt || 'photo portrait photograph of a beautiful French woman',
      });
    }

    const response = await activeAi.models.generateContent({
      model: 'gemini-3.1-flash-lite-image',
      contents: {
        parts,
      },
      config: {
        imageConfig: {
          aspectRatio: aspectRatio === '1:1' ? '1:1' : aspectRatio === '3:4' ? '3:4' : '9:16',
        },
      },
    });

    let imageUrl = '';
    for (const part of response.candidates?.[0]?.content?.parts ?? []) {
      if (part.inlineData?.data) {
        const mime = part.inlineData.mimeType || 'image/jpeg';
        imageUrl = `data:${mime};base64,${part.inlineData.data}`;
        break;
      }
    }

    if (!imageUrl) {
      throw new Error('Aucune image retournée par Gemini');
    }

    const savedUrl = saveBase64ToDisk(imageUrl);
    res.json({ imageUrl: savedUrl });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erreur de génération image Gemini';
    console.warn('Server image generation warning:', msg);
    res.status(500).json({ error: msg });
  }
});

// Proxy endpoint for NanoGPT Chat Completions (OpenAI-compatible + Vision)
app.post('/api/nanogpt/chat', async (req, res) => {
  try {
    const { model, messages, temperature, max_tokens, apiKey: clientKey } = req.body;
    const stored = getStoredKeys();
    const effectiveKey = (clientKey || stored.nanoGptApiKey || '').trim();
    if (!effectiveKey) {
      return res.status(401).json({ error: 'Clé API NanoGPT manquante' });
    }

    const ngRes = await fetch('https://nano-gpt.com/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${effectiveKey}`,
      },
      body: JSON.stringify({
        model: model || 'z-ai/glm-5.3-flash',
        messages,
        temperature: typeof temperature === 'number' ? temperature : 0.85,
        max_tokens: max_tokens || 1000,
      }),
      signal: AbortSignal.timeout(45000),
    });

    if (!ngRes.ok) {
      const errText = await ngRes.text().catch(() => '');
      return res.status(ngRes.status).json({ error: errText || `NanoGPT HTTP ${ngRes.status}` });
    }

    const data = await ngRes.json();
    const text = data.choices?.[0]?.message?.content || '';
    const tokensUsed = data.usage?.total_tokens || 0;
    res.json({ text, tokensUsed });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erreur chat NanoGPT';
    console.error('NanoGPT chat proxy error:', msg);
    res.status(500).json({ error: msg });
  }
});

// Helper to resolve reference image from either data URL or /api/images/... on disk
function resolveReferenceImageToDataUrl(referenceImage?: string): string {
  if (!referenceImage || typeof referenceImage !== 'string') return '';
  if (referenceImage.startsWith('data:image/')) {
    return referenceImage;
  }
  if (referenceImage.startsWith('/api/images/')) {
    const safeName = path.basename(referenceImage.replace('/api/images/', ''));
    const resolvedImagesDir = path.resolve(IMAGES_DIR);
    const localFile = path.resolve(resolvedImagesDir, safeName);
    if (localFile.startsWith(resolvedImagesDir + path.sep) && fs.existsSync(localFile)) {
      const ext = path.extname(safeName).toLowerCase().replace('.', '');
      const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'webp' ? 'image/webp' : 'image/png';
      const buf = fs.readFileSync(localFile);
      return `data:${mime};base64,${buf.toString('base64')}`;
    }
  }
  return '';
}

function extractOpenRouterImageUrlServer(data: any): string {
  const msg = data?.choices?.[0]?.message;
  if (!msg) return '';
  const imgFromImages = msg.images?.[0];
  if (imgFromImages?.image_url?.url) return imgFromImages.image_url.url;
  if (imgFromImages?.url) return imgFromImages.url;
  if (typeof imgFromImages === 'string') return imgFromImages;
  if (Array.isArray(msg.content)) {
    const imgBlock = msg.content.find((c: any) => c.type === 'image_url' || c.image_url?.url || c.inline_data);
    if (imgBlock?.image_url?.url) return imgBlock.image_url.url;
    if (imgBlock?.inline_data?.data) return `data:image/jpeg;base64,${imgBlock.inline_data.data}`;
  }
  if (Array.isArray(msg.parts)) {
    const part = msg.parts.find((p: any) => p.image_url?.url || p.inline_data);
    if (part?.image_url?.url) return part.image_url.url;
    if (part?.inline_data?.data) return `data:image/jpeg;base64,${part.inline_data.data}`;
  }
  if (typeof msg.content === 'string') {
    const match = msg.content.match(/\((data:image\/[^)]+|https?:\/\/[^)]+)\)/);
    if (match && match[1]) return match[1];
    const directDataMatch = msg.content.match(/(data:image\/[a-zA-Z+]+;base64,[A-Za-z0-9+/=]+)/);
    if (directDataMatch && directDataMatch[1]) return directDataMatch[1];
  }
  return '';
}

// Proxy endpoint for Groq Chat Completions (keys stay on server)
app.post('/api/groq/chat', async (req, res) => {
  try {
    const { model, messages, temperature, max_tokens, reasoning_effort, apiKey: clientKey } = req.body || {};
    const stored = getStoredKeys();
    const effectiveKey = (clientKey || stored.groqApiKey || '').trim();
    if (!effectiveKey) {
      return res.status(401).json({ error: 'Clé API Groq manquante' });
    }

    const chosenModel = model || 'llama-3.3-70b-versatile';
    const payload: Record<string, any> = {
      model: chosenModel,
      messages,
      temperature: typeof temperature === 'number' ? temperature : 0.85,
      max_tokens: max_tokens || 1000,
    };
    if (reasoning_effort) {
      payload.reasoning_effort = reasoning_effort;
    }

    const gRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${effectiveKey}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(45000),
    });

    if (!gRes.ok) {
      const errText = await gRes.text().catch(() => '');
      return res.status(gRes.status).json({ error: errText || `Groq HTTP ${gRes.status}` });
    }

    const data = await gRes.json();
    const text = data.choices?.[0]?.message?.content || '';
    const tokensUsed = data.usage?.total_tokens || 0;
    res.json({ text, tokensUsed });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erreur chat Groq';
    console.error('Groq chat proxy error:', msg);
    res.status(500).json({ error: msg });
  }
});

// Proxy endpoint for OpenRouter Chat Completions (keys stay on server)
app.post('/api/openrouter/chat', async (req, res) => {
  try {
    const { model, messages, temperature, max_tokens, reasoning_effort, apiKey: clientKey } = req.body || {};
    const stored = getStoredKeys();
    const effectiveKey = (clientKey || stored.openRouterApiKey || '').trim();
    if (!effectiveKey) {
      return res.status(401).json({ error: 'Clé API OpenRouter manquante' });
    }

    const chosenModel = model || 'meta-llama/llama-3.3-70b-instruct';
    const payload: Record<string, any> = {
      model: chosenModel,
      messages,
      temperature: typeof temperature === 'number' ? temperature : 0.85,
      max_tokens: max_tokens || 1000,
    };
    if (reasoning_effort) {
      payload.reasoning_effort = reasoning_effort;
    }

    const orRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${effectiveKey}`,
        'HTTP-Referer': String(req.headers.origin || `http://localhost:${PORT}`),
        'X-Title': 'Aura AI Companion',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(45000),
    });

    if (!orRes.ok) {
      const errText = await orRes.text().catch(() => '');
      return res.status(orRes.status).json({ error: errText || `OpenRouter HTTP ${orRes.status}` });
    }

    const data = await orRes.json();
    const text = data.choices?.[0]?.message?.content || '';
    const tokensUsed = data.usage?.total_tokens || 0;
    res.json({ text, tokensUsed });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erreur chat OpenRouter';
    console.error('OpenRouter chat proxy error:', msg);
    res.status(500).json({ error: msg });
  }
});

// Proxy endpoint for OpenRouter Image Generation (keys stay on server)
app.post('/api/openrouter/generate-image', sensitiveApiLimiter, async (req, res) => {
  try {
    const { prompt, model, apiKey: clientKey, referenceImage, mode } = req.body || {};
    const stored = getStoredKeys();
    const effectiveKey = (clientKey || stored.openRouterApiKey || '').trim();
    if (!effectiveKey) {
      return res.status(401).json({ error: 'Clé API OpenRouter manquante' });
    }

    const chosenModel = (model && String(model).includes('/') && !String(model).startsWith('openrouter/auto'))
      ? String(model).trim()
      : 'google/gemini-2.5-flash-image';

    const resolvedRefDataUrl = resolveReferenceImageToDataUrl(referenceImage);
    const userContent: any[] = [];
    if (resolvedRefDataUrl) {
      userContent.push({
        type: 'image_url',
        image_url: { url: resolvedRefDataUrl },
      });
      userContent.push({
        type: 'text',
        text: `Preserve the exact same facial identity, face shape, eyes, hair color, and likeness of the woman in this reference portrait photo. Generate a photorealistic candid selfie photo: ${prompt}`,
      });
    } else {
      const prefix = mode === 'portrait'
        ? 'Generate a photorealistic candid portrait photograph'
        : 'Generate a photorealistic candid selfie photo';
      userContent.push({
        type: 'text',
        text: `${prefix}: ${prompt}`,
      });
    }

    const orRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${effectiveKey}`,
        'HTTP-Referer': String(req.headers.origin || `http://localhost:${PORT}`),
        'X-Title': 'Aura AI Image',
      },
      body: JSON.stringify({
        model: chosenModel,
        messages: [{ role: 'user', content: userContent }],
        modalities: ['image', 'text'],
      }),
      signal: AbortSignal.timeout(45000),
    });

    if (!orRes.ok) {
      const errData = await orRes.json().catch(() => ({}));
      const msg = errData?.error?.message || JSON.stringify(errData) || `HTTP ${orRes.status}`;
      return res.status(orRes.status).json({ error: msg });
    }

    const data = await orRes.json();
    const rawImageUrl = extractOpenRouterImageUrlServer(data);
    if (!rawImageUrl) {
      return res.status(502).json({ error: 'OpenRouter HTTP 200 mais aucune image dans la réponse' });
    }

    if (rawImageUrl.startsWith('http')) {
      try {
        await validateExternalEndpointUrl(rawImageUrl, { disallowPrivate: true });
        const dl = await fetch(rawImageUrl, { redirect: 'error', signal: AbortSignal.timeout(15000) });
        if (dl.ok) {
          const mime = dl.headers.get('content-type') || 'image/png';
          const buf = Buffer.from(await dl.arrayBuffer());
          const ext = mime.includes('jpeg') || mime.includes('jpg') ? 'jpg' : mime.includes('webp') ? 'webp' : 'png';
          const filename = `img_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`;
          fs.writeFileSync(path.join(IMAGES_DIR, filename), buf);
          return res.json({ imageUrl: `/api/images/${filename}`, modelUsed: chosenModel });
        }
      } catch {
        // fallback below
      }
      return res.json({ imageUrl: rawImageUrl, modelUsed: chosenModel });
    }

    const savedUrl = saveBase64ToDisk(rawImageUrl);
    return res.json({ imageUrl: savedUrl, modelUsed: chosenModel });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erreur génération image OpenRouter';
    console.warn('OpenRouter image proxy warning:', msg);
    res.status(500).json({ error: msg });
  }
});

// Proxy endpoint for NanoGPT Image Generation (HiDream, Chroma, Z Image Turbo, Qwen Image, etc.)
app.post('/api/nanogpt/generate-image', sensitiveApiLimiter, async (req, res) => {
  try {
    const { prompt, model, aspectRatio, apiKey: clientKey, referenceImage } = req.body;
    const stored = getStoredKeys();
    const effectiveKey = (clientKey || stored.nanoGptApiKey || '').trim();
    if (!effectiveKey) {
      return res.status(401).json({ error: 'Clé API NanoGPT manquante' });
    }

    const chosenModel = (model || 'z-image-turbo').trim();
    const ratio = aspectRatio || '3:4';

    // Format exact supported size & prompt limit per NanoGPT model
    let size = '768x1024';
    let safePrompt = String(prompt || 'candid photorealistic portrait of a woman');

    if (chosenModel.startsWith('z-image-turbo')) {
      // Z Image Turbo uses '*' separator and max_prompt_characters: 1200
      size = ratio === '1:1' ? '1024*1024' : ratio === '9:16' ? '720*1280' : '1024*1536';
      if (safePrompt.length > 1180) {
        safePrompt = safePrompt.slice(0, 1180);
      }
    } else if (chosenModel === 'hidream' || chosenModel.startsWith('hidream-i1')) {
      size = ratio === '1:1' ? '1024x1024' : ratio === '9:16' ? '768x1360' : '880x1168';
    } else {
      // qwen-image, chroma, etc.
      size = ratio === '1:1' ? '1024x1024' : ratio === '9:16' ? '576x1024' : '768x1024';
    }

    const supportsImg2Img = chosenModel.includes('qwen-image') ||
                            chosenModel.includes('image-to-image') ||
                            chosenModel.includes('edit') ||
                            chosenModel.includes('hidream-e');

    // Résoudre l'image de référence même si le client a envoyé un chemin local (/api/images/img_...)
    const resolvedRefDataUrl = resolveReferenceImageToDataUrl(referenceImage);

    const useReference = Boolean(supportsImg2Img && resolvedRefDataUrl);
    const maxLen = chosenModel.startsWith('z-image-turbo') ? 1180 : 2900;
    const identityPrefixedPrompt = useReference && !/reference (?:photo|portrait|image)/i.test(safePrompt)
      ? `Preserve strictly and exclusively the face, facial features, eyes, hair color, and likeness from the reference portrait photo. IGNORE and completely replace the background, environment, and clothing of the reference image, adopting the new clothing and setting specified in this prompt. New candid photograph: ${safePrompt}`
      : safePrompt;
    const finalPrompt = identityPrefixedPrompt.slice(0, maxLen);

    const basePayload: Record<string, any> = {
      model: chosenModel,
      prompt: finalPrompt,
      size,
      n: 1,
      response_format: 'b64_json',
      ...(useReference ? {
        imageDataUrl: resolvedRefDataUrl,
        image_url: resolvedRefDataUrl,
        image: resolvedRefDataUrl,
        images: [resolvedRefDataUrl],
      } : {}),
    };

    const tryNanoGptImageRequest = async (payload: Record<string, any>) => {
      return fetch('https://nano-gpt.com/api/v1/images/generations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${effectiveKey}`,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(60000),
      });
    };

    let usedReferenceImage = false;
    let ngRes: Response;
    if (useReference) {
      usedReferenceImage = true;
      ngRes = await tryNanoGptImageRequest({
        ...basePayload,
        imageDataUrl: resolvedRefDataUrl,
      });
      // Fallback cleanly to pure text-to-image (with original safePrompt) if provider rejects imageDataUrl
      if (!ngRes.ok && (ngRes.status === 400 || ngRes.status === 422)) {
        const refErr = await ngRes.text().catch(() => '');
        console.warn(`NanoGPT Img2Img fallback to txt2img (${ngRes.status}):`, refErr);
        usedReferenceImage = false;
        ngRes = await tryNanoGptImageRequest({
          ...basePayload,
          prompt: safePrompt.slice(0, maxLen),
        });
      }
    } else {
      ngRes = await tryNanoGptImageRequest(basePayload);
    }

    if (!ngRes.ok) {
      const errData = await ngRes.text().catch(() => '');
      appendToLogFile({
        level: 'ERROR',
        category: 'IMAGE_GEN',
        message: `NanoGPT Image HTTP ${ngRes.status} (${chosenModel})`,
        details: { model: chosenModel, size, usedReferenceImage, errData: errData.slice(0, 400) },
      });
      return res.status(ngRes.status).json({ error: errData || `NanoGPT Image HTTP ${ngRes.status}` });
    }

    const data = await ngRes.json();
    const item = data?.data?.[0];
    let rawImageUrl = '';
    if (item?.b64_json) {
      rawImageUrl = item.b64_json.startsWith('data:image/') ? item.b64_json : `data:image/png;base64,${item.b64_json}`;
    } else if (item?.url) {
      rawImageUrl = item.url;
    } else if (data?.imageDataUrl) {
      rawImageUrl = data.imageDataUrl;
    } else if (data?.url) {
      rawImageUrl = data.url;
    }

    if (!rawImageUrl) {
      return res.status(500).json({ error: 'Aucune image retournée par NanoGPT' });
    }

    // If NanoGPT returned a remote URL, validate and download locally
    if (rawImageUrl.startsWith('http')) {
      try {
        await validateExternalEndpointUrl(rawImageUrl, { disallowPrivate: true });
        const dl = await fetch(rawImageUrl, { redirect: 'error', signal: AbortSignal.timeout(15000) });
        if (dl.ok) {
          const mime = dl.headers.get('content-type') || 'image/png';
          const buf = Buffer.from(await dl.arrayBuffer());
          const ext = mime.includes('jpeg') || mime.includes('jpg') ? 'jpg' : mime.includes('webp') ? 'webp' : 'png';
          const filename = `img_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`;
          fs.writeFileSync(path.join(IMAGES_DIR, filename), buf);
          return res.json({ imageUrl: `/api/images/${filename}`, modelUsed: chosenModel, usedReferenceImage });
        }
      } catch {
        return res.json({ imageUrl: rawImageUrl, modelUsed: chosenModel, usedReferenceImage });
      }
    }

    const savedUrl = saveBase64ToDisk(rawImageUrl);
    appendToLogFile({
      level: 'INFO',
      category: 'IMAGE_GEN',
      message: `NanoGPT Image OK (${chosenModel})`,
      details: { modelUsed: chosenModel, size, usedReferenceImage, savedUrl },
    });
    res.json({ imageUrl: savedUrl, modelUsed: chosenModel, usedReferenceImage });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erreur génération image NanoGPT';
    console.warn('NanoGPT image proxy warning:', msg);
    res.status(500).json({ error: msg });
  }
});

// Compile & faithfully translate ALL French user-entered character & ambiance fields into a clean English portrait prompt
app.post('/api/compile-portrait-prompt', async (req, res) => {
  try {
    const { persona, llmConfig, mode } = req.body || {};
    if (!persona) {
      return res.json({ compiledPrompt: null });
    }

    const stored = getStoredKeys();
    const prefProvider = (llmConfig?.provider || '').trim();
    const prefModel = (llmConfig?.model || '').trim();
    const clientApiKey = (llmConfig?.apiKey || '').trim();
    const localEndpoint = (llmConfig?.localEndpoint || 'http://localhost:11434/v1').trim();

    const groqKey = (prefProvider === 'groq' && clientApiKey) ? clientApiKey : (stored.groqApiKey || '');
    const nanoKey = (prefProvider === 'nanogpt' && clientApiKey) ? clientApiKey : (stored.nanoGptApiKey || '');
    const orKey = (prefProvider === 'openrouter' && clientApiKey) ? clientApiKey : (stored.openRouterApiKey || '');

    const isSelfieMode = mode === 'selfie';
    const systemInstruction = isSelfieMode
      ? [
          'You are an expert photorealistic selfie photography prompt compiler (Qwen-Image, Z-Image-Turbo, Flux).',
          'You receive a JSON description of a woman + her requested outfit + a user selfie scene/request (often written in French, e.g. "devant le miroir").',
          'Translate and synthesize EVERY SINGLE field faithfully into ONE cohesive English candid selfie prompt (350 to 900 characters MAX).',
          'STRICT RULES:',
          '1. Preserve exact age, ethnicity, eye color, hair color, hair style, skin tone, body silhouette, bust proportions, and ALL customTraits/distinguishingFeatures.',
          '2. Translate and specify the exact outfit ("currentOutfitStyle") visibly on her.',
          '3. Translate and stage "userExtraPrompt" as the concrete camera angle, pose, lighting, and location (e.g. "devant le miroir" -> "standing in front of a mirror taking a candid mirror selfie holding a smartphone").',
          '4. Keep candid 35mm realistic smartphone/camera photography look, natural skin pores, NOT 3D/CGI/anime.',
          '5. Output ONLY the raw English prompt string. No quotes, no markdown, no bullet points, no French words.',
        ].join('\n')
      : [
          'You are an expert photorealistic portrait prompt translator for AI image generation (Qwen-Image, Z-Image-Turbo, Flux).',
          'You receive a JSON character sheet where users wrote free-text details in French.',
          'Translate and synthesize EVERY SINGLE field faithfully into ONE cohesive English photography prompt (400 to 920 characters MAX).',
          'STRICT RULES:',
          '1. Preserve exact age, ethnicity, eye color, hair color, hair style, skin tone, height, body silhouette, bust proportions.',
          '2. Translate and include ALL items from "customTraits" (freckles, scars, tattoos, glasses, piercings, dimples, beauty marks, nails, etc.) — drop NOTHING.',
          '3. Translate the exact "currentOutfitStyle" (every clothing item, fabric, color, cut, fit) and "mainStyle".',
          '4. Reflect "occupation", ALL "soulTraits" (passions/hobbies), and "tone"/"generalAttitude" in her facial expression, gaze, posture, subtle styling, and subtle scene clues.',
          '5. Translate and prominently integrate "userExtraPrompt" (mood, lighting, location, pose, props, camera framing). If userExtraPrompt describes a scene/pose/lighting, make it clearly visible.',
          '6. Keep total length under 920 characters. Photorealistic candid 35mm photography style, natural skin pores, NOT 3D/CGI/anime.',
          '7. Output ONLY the raw English prompt string. No quotes, no markdown, no bullet points, no French words.',
        ].join('\n');

    const userContent = JSON.stringify(persona);

    const callOpenAICompatible = async (url: string, apiKey: string, model: string, extraHeaders: Record<string, string> = {}) => {
      const r = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
          ...extraHeaders,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemInstruction },
            { role: 'user', content: userContent },
          ],
          temperature: 0.25,
          max_tokens: 350,
        }),
        signal: AbortSignal.timeout(7000),
      });
      if (!r.ok) return null;
      const d = await r.json();
      const raw = (d?.choices?.[0]?.message?.content || '').trim();
      // Strip potential <think> blocks from reasoning models or wrapping quotes
      const cleaned = raw
        .replace(/<think>[\s\S]*?<\/think>/gi, '')
        .replace(/^["'`]+|["'`]+$/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      return cleaned.length > 40 ? cleaned.slice(0, 950) : null;
    };

    type Candidate = { name: string; run: () => Promise<string | null> };
    const candidates: Candidate[] = [];

    if (prefProvider === 'local') {
      candidates.push({
        name: 'local',
        run: async () => {
          const targetUrl = `${localEndpoint.replace(/\/+$/, '')}/chat/completions`;
          await validateExternalEndpointUrl(targetUrl, { disallowPrivate: false });
          return callOpenAICompatible(targetUrl, 'ollama', prefModel || 'llama3.2-vision');
        },
      });
    }
    if (prefProvider === 'groq' && groqKey) {
      candidates.push({
        name: 'groq',
        run: () => callOpenAICompatible('https://api.groq.com/openai/v1/chat/completions', groqKey, prefModel || 'llama-3.3-70b-versatile'),
      });
    }
    if (prefProvider === 'nanogpt' && nanoKey) {
      candidates.push({
        name: 'nanogpt',
        run: () => callOpenAICompatible('https://nano-gpt.com/api/v1/chat/completions', nanoKey, prefModel || 'z-ai/glm-5.3-flash'),
      });
    }
    if (prefProvider === 'openrouter' && orKey) {
      candidates.push({
        name: 'openrouter',
        run: () => callOpenAICompatible('https://openrouter.ai/api/v1/chat/completions', orKey, prefModel || 'meta-llama/llama-3.3-70b-instruct'),
      });
    }

    // Automatic secondary fallbacks using any stored Cloud keys
    if (groqKey && prefProvider !== 'groq') {
      candidates.push({
        name: 'groq',
        run: () => callOpenAICompatible('https://api.groq.com/openai/v1/chat/completions', groqKey, 'llama-3.3-70b-versatile'),
      });
    }
    if (nanoKey && prefProvider !== 'nanogpt') {
      candidates.push({
        name: 'nanogpt',
        run: () => callOpenAICompatible('https://nano-gpt.com/api/v1/chat/completions', nanoKey, 'z-ai/glm-5.3-flash'),
      });
    }
    if (orKey && prefProvider !== 'openrouter') {
      candidates.push({
        name: 'openrouter',
        run: () => callOpenAICompatible('https://openrouter.ai/api/v1/chat/completions', orKey, 'meta-llama/llama-3.3-70b-instruct'),
      });
    }

    // Only try Gemini as last translator fallback if no cloud keys succeeded or if Gemini was explicitly selected with no cloud keys
    const hasCloudKeys = Boolean(groqKey || nanoKey || orKey);
    if (!hasCloudKeys) {
      const activeAi = getGeminiClient(clientApiKey);
      if (activeAi) {
        candidates.push({
          name: 'gemini',
          run: async () => {
            const resp = await activeAi.models.generateContent({
              model: prefModel && prefModel.startsWith('gemini-') ? prefModel : 'gemini-3.1-flash-lite',
              contents: [{ role: 'user', parts: [{ text: userContent }] }],
              config: { systemInstruction, temperature: 0.25 },
            });
            const cleaned = (resp.text || '').replace(/^["'`]+|["'`]+$/g, '').replace(/\s+/g, ' ').trim();
            return cleaned.length > 40 ? cleaned.slice(0, 950) : null;
          },
        });
      }
    }

    for (const c of candidates) {
      try {
        const result = await c.run();
        if (result) {
          return res.json({ compiledPrompt: result, translatedVia: c.name });
        }
      } catch {
        // try next translator
      }
    }

    res.json({ compiledPrompt: null });
  } catch (err) {
    console.warn('Compile portrait prompt warning:', err);
    res.json({ compiledPrompt: null });
  }
});

// Helper to convert base64 image strings to physical disk files in DATA_DIR/images
function saveBase64ToDisk(base64Str: string): string {
  if (!base64Str || typeof base64Str !== 'string') return base64Str;
  if (!base64Str.startsWith('data:image/')) return base64Str;

  try {
    const match = base64Str.match(/^data:image\/([a-zA-Z0-9+\-+.]+);base64,(.+)$/);
    if (!match || !match[2]) return base64Str;

    let ext = match[1] || 'jpeg';
    if (ext === 'jpeg' || ext === 'jpg') ext = 'jpg';
    else if (ext === 'png') ext = 'png';
    else if (ext === 'webp') ext = 'webp';
    else if (ext === 'svg+xml') ext = 'svg';

    const filename = `img_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`;
    const filePath = path.join(IMAGES_DIR, filename);
    const buffer = Buffer.from(match[2], 'base64');
    fs.writeFileSync(filePath, buffer);

    return `/api/images/${filename}`;
  } catch (err) {
    console.warn('Erreur sauvegarde base64 sur disque:', err);
    return base64Str;
  }
}

// Recursively inspects objects/arrays and saves any inline base64 images as disk files
function cleanseStateBase64(obj: any): any {
  if (obj === null || obj === undefined) return obj;

  if (typeof obj === 'string') {
    if (obj.startsWith('data:image/')) {
      return saveBase64ToDisk(obj);
    }
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => cleanseStateBase64(item));
  }

  if (typeof obj === 'object') {
    const cleansed: Record<string, any> = {};
    for (const key of Object.keys(obj)) {
      cleansed[key] = cleanseStateBase64(obj[key]);
    }
    return cleansed;
  }

  return obj;
}

// Strip API keys before persisting or returning app_state.json
function sanitizeStateSecrets(stateObj: any): any {
  if (!stateObj || typeof stateObj !== 'object') return stateObj;
  const copy = { ...stateObj };
  if (copy.llmConfig && typeof copy.llmConfig === 'object') {
    copy.llmConfig = { ...copy.llmConfig, apiKey: '' };
  }
  if (copy.selfieConfig && typeof copy.selfieConfig === 'object') {
    copy.selfieConfig = {
      ...copy.selfieConfig,
      openRouterApiKey: '',
      nanoGptApiKey: '',
    };
  }
  return copy;
}

// Persistent Server-side State Endpoints
app.get('/api/state', (_req, res) => {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const raw = fs.readFileSync(STATE_FILE, 'utf-8');
      const parsed = sanitizeStateSecrets(JSON.parse(raw));
      return res.json({ exists: true, state: parsed });
    }
    res.json({ exists: false });
  } catch (err: unknown) {
    res.json({ exists: false });
  }
});

app.post('/api/state', (req, res) => {
  try {
    const { state } = req.body;
    if (!state) {
      return res.status(400).json({ error: 'Données manquantes' });
    }
    const sanitized = sanitizeStateSecrets(state);
    const cleansed = cleanseStateBase64(sanitized);
    fs.writeFileSync(STATE_FILE, JSON.stringify(cleansed, null, 2), 'utf-8');
    res.json({ success: true, state: cleansed });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erreur sauvegarde état serveur';
    res.status(500).json({ error: msg });
  }
});

app.post('/api/upload-image', (req, res) => {
  try {
    const { image } = req.body;
    if (!image || typeof image !== 'string') {
      return res.status(400).json({ error: 'Image manquante' });
    }
    const savedUrl = saveBase64ToDisk(image);
    res.json({ url: savedUrl });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erreur upload image';
    res.status(500).json({ error: msg });
  }
});

app.post('/api/reset-state', sensitiveApiLimiter, (req, res) => {
  try {
    const { type } = req.body; // 'soft' | 'hard'

    if (type === 'hard') {
      // Hard reset: Delete app_state.json and wipe all image files in IMAGES_DIR
      if (fs.existsSync(STATE_FILE)) {
        fs.unlinkSync(STATE_FILE);
      }
      if (fs.existsSync(IMAGES_DIR)) {
        const files = fs.readdirSync(IMAGES_DIR);
        for (const file of files) {
          try {
            fs.unlinkSync(path.join(IMAGES_DIR, file));
          } catch {
            // ignore
          }
        }
      }
      clearServerLogs();
      // CRITICAL: keys.json is PRESERVED!
      return res.json({ success: true, message: 'Hard reset server state completed' });
    }

    if (type === 'soft') {
      // Soft reset: Keep girlfriend avatar if stored on disk, clear other selfies/photos
      if (fs.existsSync(STATE_FILE)) {
        try {
          const raw = fs.readFileSync(STATE_FILE, 'utf-8');
          const parsed = JSON.parse(raw);
          const avatarUrl = parsed.girlfriend?.appearance?.avatarUrl || '';
          const avatarFilename = avatarUrl.startsWith('/api/images/') ? avatarUrl.replace('/api/images/', '') : '';

          if (fs.existsSync(IMAGES_DIR)) {
            const files = fs.readdirSync(IMAGES_DIR);
            for (const file of files) {
              if (file !== avatarFilename) {
                try {
                  fs.unlinkSync(path.join(IMAGES_DIR, file));
                } catch {
                  // ignore
                }
              }
            }
          }
        } catch {
          // ignore
        }
      }
      clearServerLogs();
      return res.json({ success: true, message: 'Soft reset server images and logs cleaned' });
    }

    res.status(400).json({ error: 'Type de reset invalide' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erreur reset state';
    res.status(500).json({ error: msg });
  }
});

// Proxy endpoint for Local GPU TTS (XTTS-v2 / Piper / AllTalk) or custom TTS (SSRF protected)
app.post('/api/tts-proxy', async (req, res) => {
  try {
    const { endpoint, text, voice, speed } = req.body;
    if (!endpoint || typeof endpoint !== 'string') {
      return res.status(400).json({ error: 'Endpoint required' });
    }

    let validatedUrl: URL;
    try {
      validatedUrl = await validateExternalEndpointUrl(endpoint, { disallowPrivate: false });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Endpoint non autorisé';
      return res.status(400).json({ error: msg });
    }

    const ttsResponse = await fetch(validatedUrl.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: text,
        text,
        voice: voice || 'female',
        model: 'tts-1',
        speed: speed || 1.0,
      }),
      redirect: 'error',
      signal: AbortSignal.timeout(10000),
    });

    if (!ttsResponse.ok) {
      throw new Error(`TTS service returned ${ttsResponse.status}`);
    }

    const arrayBuffer = await ttsResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    res.setHeader('Content-Type', ttsResponse.headers.get('content-type') || 'audio/mpeg');
    res.send(buffer);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'TTS Proxy error';
    res.status(500).json({ error: errorMsg });
  }
});

// Server-side Log File with Automatic Rotation
function appendToLogFile(entry: any) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const timestamp = entry.timestamp || new Date().toISOString();
    const level = entry.level || 'INFO';
    const cat = entry.category || 'APP';
    const msg = entry.message || '';
    const detailsStr = entry.details ? ` | ${JSON.stringify(entry.details)}` : '';
    const line = `[${timestamp}] [${level}] [${cat}] ${msg}${detailsStr}\n`;

    if (fs.existsSync(LOGS_FILE)) {
      const stats = fs.statSync(LOGS_FILE);
      if (stats.size > MAX_LOG_SIZE_BYTES) {
        if (fs.existsSync(LOGS_BACKUP_FILE)) {
          fs.unlinkSync(LOGS_BACKUP_FILE);
        }
        fs.renameSync(LOGS_FILE, LOGS_BACKUP_FILE);
      }
    }
    fs.appendFileSync(LOGS_FILE, line, 'utf-8');
  } catch (e) {
    console.warn('Erreur écriture log:', e);
  }
}

app.post('/api/logs', (req, res) => {
  appendToLogFile(req.body);
  res.json({ ok: true });
});

app.get('/api/logs', (req, res) => {
  try {
    if (fs.existsSync(LOGS_FILE)) {
      const content = fs.readFileSync(LOGS_FILE, 'utf-8');
      const lines = content.trim().split('\n').filter(Boolean).slice(-200);
      return res.json({ logs: lines });
    }
    res.json({ logs: [] });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Log read error';
    res.status(500).json({ error: errorMsg });
  }
});

app.delete('/api/logs', (req, res) => {
  try {
    clearServerLogs();
    res.json({ ok: true });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Log clear error';
    res.status(500).json({ error: errorMsg });
  }
});

const isProd = process.env.NODE_ENV === 'production';
const PORT = Number(process.env.PORT) || 9876;

async function startServer() {
  if (!isProd) {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
    app.use('/src', express.static(path.resolve('src')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve('dist/index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();