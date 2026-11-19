# 💖 Aura AI — Lightweight AI Companion & Girlfriend PWA

> 🌐 **English (current)** · **[Version Française (README_FR.MD)](./README_FR.MD)**

<p align="center">
  <img src="./public/logo.png" alt="Aura AI Logo" width="112" />
</p>

**Aura AI** is a privacy-first, ultra-lightweight **AI Companion & Girlfriend Progressive Web App (PWA)** built with React, TypeScript, Tailwind CSS, and an Express/Node.js backend.  
It is engineered from the ground up to solve **massive token bloat** in roleplay/companion apps using a compact *JanitorAI / World-Info* JSON memory card architecture, while delivering **consistent facial identity across selfies**, **multimodal vision**, **dual SMS & In Real Life (IRL) chat modes**, **voice notes**, **live weather/time/news awareness**, and **full local or cloud BYOK (Bring Your Own Key) freedom**.

---

## ⚡ Why Aura AI? (Token & Architecture Efficiency)

| Criteria | Traditional Companion Apps | Aura AI |
| :--- | :--- | :--- |
| **Per-Turn Memory** | Full raw history + verbose logs | **Compact JanitorAI JSON card (~40 tokens)** |
| **Active Chat Window** | Unlimited / poorly truncated (5,000–15,000 tok) | **Configurable sliding window (4–16 messages)** |
| **Average Cost per Turn** | ~15,000+ tokens | **~450–1,800 tokens (~95% token savings)** |
| **Model & API Freedom** | Vendor lock-in or expensive subscriptions | **100% BYOK: Ollama Local, Groq, OpenRouter, NanoGPT, Gemini** |
| **Image Consistency** | Random face on every generation | **Locked face & hair identity via Face Anchor + Img2Img crop** |
| **Data Persistence** | Browser-only or opaque cloud DB | **Local server disk persistence (`data/`) + safe client storage** |
| **Mobile Experience** | Desktop-oriented web UI | **Installable Full-Screen PWA (iOS & Android, zero Service Worker)** |

---

## ✨ Complete Feature Overview

### 1. 🎭 Deep 4-Step Persona & User ("Him") Customization
- **Step 1 — Identity & Speech Style**: Name, pet name/nickname, age, relationship status (*Girlfriend*, *Fiancée*, *Crush*, *Friend with benefits*), occupation, **customizable initial greeting message** (also directly editable inline in the chat), emoji usage, action emotes, verbosity, and **9 distinct speech tones** (*Affectionate, Teasing, Poetic, Sassy, Shy, Rebel, Gothic, Possessive, Dominant*).
- **Step 2 — Soul & Personality**: Custom bio, selectable passions/interests, and free-form traits automatically synchronized into the compact JSON prompt.
- **Step 3 — Appearance, Body Profile & Official Portrait**:
  - Detailed physical traits: ethnicity, height, body type, bust size, attitude, clothing style, eye color, hair style, hair color, skin tone, distinguishing marks, and wardrobe/outfits.
  - **Automatic French-to-English Portrait Prompt Compiler** (`/api/compile-portrait-prompt`): Translates user-entered French physical traits and optional ambiance notes into clean, photographic English prompts.
  - **Smart Cloud Routing**: If a **NanoGPT** or **OpenRouter** key is configured, portrait generation routes directly to your selected provider without hitting exhausted fallback quotas; otherwise supports Gemini (`.env`), ComfyUI, or Pollinations Flux.
- **Step 4 — Your Profile ("Him")**: Upload your own avatar photo, set your name, gender, physical description, bio, interests, and relationship notes so your companion knows who she is talking to and naturally remembers your details.

### 2. 📸 Consistent Selfie Generation & Facial Persistence (Img2Img)
- **Strict Identity Preservation**: Generated selfies use an invariant `faceAnchorPrompt` combined with **automatic upper-center face-and-shoulders cropping** (`cropFaceAndShouldersForVision`) before sending the reference image to Img2Img models (such as **NanoGPT `qwen-image`**).
- **Scene & Outfit Freedom**: Explicit prompt directives force the image model to discard the reference portrait's original background and clothes while preserving the exact face, eyes, and hairstyle.
- **Natural Chat Detection + Custom Selfie Modal**: Ask naturally in chat (*"Montre-moi à quoi tu ressembles"*, *"Envoie-moi un selfie devant le miroir"*) or pick/customize scenarios (*Fresh out of the shower, Cozy in bed, Mirror outfit check, Parisian café terrace, Candlelit gothic, Rock street, Sunset walk, Study night, Gym, Evening dress*).
- **Private Selfie Album**: All generated photos are saved locally on disk (`data/images/`) and browsable in the **Private Album** modal with lightboxes and favorites.

### 3. 💬 Dual Chat Modes: SMS vs. In Real Life (IRL)
- **💬 SMS Mode**: Realistic smartphone texting style — strictly forbids asterisk roleplay gestures for authentic texting immersion.
- **✨ In Real Life (IRL) Mode**: Physical face-to-face immersion describing touches, glances, smiles, and body language inside `*asterisks*`.
- **IRL Quick-Action Shortcuts**: One-tap shortcut bar right above the chat input (`*te sourit doucement*`, `*prend ta main*`, `*rougit légèrement*`, etc.) in IRL mode.
- **Auto-Expanding Vertical Input & Emoji Bar**: Multi-line input expands vertically as you type long messages (`Enter` to send, `Shift+Enter` for newline) plus a quick emoji bar.

### 4. 🧠 Lightweight JSON Memory, Dynamic Diary & Jealousy Detector
- **Token Optimization Dashboard**: Real-time token counter showing active turn tokens vs. classic bloated history, plus a configurable sliding window slider (4 to 16 messages) and injection format selector (*Compact JSON*, *Bullet Points*, *Minimal*).
- **Real Profile Sync & Automatic Extraction**: Automatically syncs your "Him" profile details and extracts new likes/dislikes and shared photo moments from conversations.
- **Dynamic Affection Gauge**: Starts at **35/100** on fresh/soft-reset relationships and evolves dynamically through interactions, shared photos, and reassurance.
- **Secret Diary**: Initialized with your real profile name and **automatically adds new diary entries every 6 messages** reflecting your latest conversations and current mood.
- **🌶️ Semantic Jealousy Detector**: Mentioning a colleague, ex, or date triggers a playful/spicy jealousy state (*Curious*, *Piquante*, *Possessive*) with an alert banner and a *"La rassurer 💕"* quick-action button.

### 5. 👁️ Multimodal Vision, 🎙️ Voice Notes & 🌍 Live Real-World Context
- **Multimodal Photo Vision**: Upload photos from your device into the chat; compatible vision models (Ollama Vision, Gemini, OpenRouter, NanoGPT, Groq) analyze the image and store the memory.
- **WhatsApp-Style Voice Notes & TTS**: Animated audio waveform bubbles (`1x`, `1.5x`, `2x` speed + expandable transcript + whisper mode) powered by free browser **Web Speech API** or a local GPU TTS server (**XTTS-v2 / Piper / AllTalk** via `/api/tts-proxy`).
- **Live Real-World Context**: Optional injection of local time of day, live weather for any chosen city, and current cultural headlines.

### 6. 🧹 Dual Reset System & Live Debug Logs
- **Interactive Debug Logs Modal** (`/api/logs` + circular client rotation): Tracks `LLM_CHAT`, `VISION_INPUT`, `IMAGE_GEN`, `STORAGE`, and `RUNTIME` events with JSON inspection and `.txt` export.
- **Soft Reset**: Clears chat history, generated selfies, volatile memory, resets affection to **35%**, rebuilds initial diary/memory from your active profile, **and clears client/server logs** — while preserving your companion's custom profile, original portrait, your "Him" profile, and API keys.
- **Hard Reset** (protected by `RESET` confirmation): Wipes all local and server state, images, and logs back to factory defaults while **preserving your saved API keys** in `data/keys.json`.

---

## 🛠️ Supported AI Providers (BYOK)

Configure everything directly in the **Moteurs & LLM** settings panel inside the app:

| Category | Supported Providers | Notes |
| :--- | :--- | :--- |
| **Chat & Vision LLMs** | **Ollama / LM Studio (Local)**, **Groq**, **OpenRouter**, **NanoGPT**, **Google Gemini** | Live model list fetching, Vision badge detection, and manual model ID override |
| **Image & Selfie Gen** | **NanoGPT** (`qwen-image`, `z-image-turbo`, `hidream`, `chroma`), **OpenRouter**, **Gemini**, **ComfyUI (Local)**, **Pollinations (Flux)** | Supports Img2Img face reference on NanoGPT (`qwen-image`) & Gemini |
| **Text-to-Speech (TTS)** | **Web Speech API** (Browser native), **Local GPU TTS** (XTTS-v2 / Piper / AllTalk) | Free offline-capable browser synthesis or local GPU proxy |

> 🔒 **API Key Security**: User-entered API keys are stored locally in your server's `data/keys.json` (excluded from Git via `.gitignore`). **Raw keys are never returned to the browser** by `GET /api/keys` or `/api/state` (only `has*Key` booleans are exposed), and **all** cloud provider requests (Gemini, Groq, OpenRouter, NanoGPT) as well as local TTS/Ollama calls are proxied server-side through Express.

---

## 🔒 Security & Public Deployment

Aura AI is designed primarily as a **self-hosted private companion app**:
- **Localhost Binding by Default**: `docker-compose.yml` binds to `127.0.0.1:9876` so the container is not accidentally exposed to your LAN or the public internet.
- **Optional App Authentication (`AUTH_TOKEN`)**: Set `AUTH_TOKEN` in `.env` to lock all `/api/*` routes (including `/api/keys`, `/api/state`, `/api/logs`, `/api/images/*`, and `/api/reset-state`) behind an `HttpOnly` HMAC-signed session cookie + unlock screen.
- **SSRF & Payload Hardening**: Local proxy endpoints (`/api/tts-proxy`, `/api/models`, `/api/compile-portrait-prompt`, image downloaders) restrict protocols to `http:`/`https:`, block cloud metadata & link-local IPs (`169.254.0.0/16`, `metadata.google.internal`, `100.100.100.200`, `fe80::/10`), and disable HTTP redirects, while still allowing `localhost`, `host.docker.internal`, and LAN hosts for Ollama/ComfyUI/XTTS-v2. Rate limiting and scoped body size limits (`1mb` default, `25mb` only on image-bearing endpoints) are enforced.
- ⚠️ **Never expose Aura AI directly to the public internet without protection**: If you host it on a VPS or custom domain, **always** set a strong `AUTH_TOKEN` and serve it behind an **HTTPS reverse proxy** (Caddy, Nginx, Traefik, or Cloudflare Tunnel) with access control.

---

## 🐳 Quick Start with Docker (Recommended)

### Method 1: Docker Compose
1. **Clone the repository**:
   ```bash
   git clone <YOUR_REPO_URL>
   cd aura-ai
   ```
2. *(Optional)* **Configure environment variables**:
   ```bash
   cp .env.example .env
   ```
3. **Build and launch**:
   ```bash
   docker compose up -d --build
   ```
4. **Open in your browser**:  
   👉 **`http://localhost:9876`** (or the custom `PORT` you configured in `.env`).
5. **Stop the container**:
   ```bash
   docker compose down
   ```

### Method 2: Docker CLI
```bash
# 1. Build the Docker image
docker build -t aura-ai .

# 2. Run on port 9876 (bound to localhost) with persistent local volume and host access
docker run -d \
  -p 127.0.0.1:9876:9876 \
  -v $(pwd)/data:/app/data \
  --add-host=host.docker.internal:host-gateway \
  --name aura-ai \
  aura-ai
```

> 💡 **Connecting to Local Services (Ollama / ComfyUI / XTTS-v2) from Docker**:  
> Use `http://host.docker.internal:11434/v1` (Ollama), `http://host.docker.internal:8188` (ComfyUI), or `http://host.docker.internal:8020/v1/audio/speech` (Local TTS).

---

## 💻 Local Setup with Node.js (Without Docker)

### Prerequisites
- **Node.js** v20 or higher
- **npm** (or `bun`)

```bash
# 1. Install dependencies
npm ci

# 2. (Optional) Copy environment template
cp .env.example .env

# 3. Start in development mode
npm run dev

# Or build and run in production mode:
npm run build
npm start
```

By default, the Express server listens on `PORT` (`9876` in `.env.example`, `Dockerfile`, and `docker-compose.yml`).

---

## ⚙️ Environment Variables (`.env.example`)

All environment variables are **optional** because API keys can be configured directly from the in-app **Moteurs & LLM** modal:

| Variable | Default | Description |
| :--- | :--- | :--- |
| `PORT` | `9876` | HTTP port for the Express + Vite server |
| `AUTH_TOKEN` | `""` | Optional access token locking all `/api/*` endpoints (strongly recommended if behind a reverse proxy) |
| `GEMINI_API_KEY` | `""` | Optional Google Gemini API key for server-side chat/vision/image calls |
| `DATA_DIR` | `./data` | Directory where `keys.json`, `app_state.json`, `app.log`, and `images/` are persisted |
| `APP_URL` | `http://localhost:9876` | Optional base URL reference |

---

## 📱 Mobile PWA Installation

Aura AI includes a full Web App Manifest (`manifest.webmanifest`), adaptive icons, and mobile bottom tab navigation **without any intrusive Service Worker caching**:
- **iOS (Safari)**: Tap **Share** ⬆️ → **Add to Home Screen**.
- **Android (Chrome)**: Tap **Install App** (or use the in-app PWA install prompt).

---

## 📂 Project Architecture

```text
├── server.ts                  # Express backend: API proxies (Gemini, NanoGPT, OpenRouter, Groq, Ollama, TTS), disk persistence & logs
├── index.html                 # HTML entry point & PWA/OpenGraph metadata
├── Dockerfile                 # Multi-purpose Node 20 Alpine production container
├── docker-compose.yml         # Ready-to-run Docker Compose stack with ./data volume
├── .env.example               # Environment configuration template (no secrets)
├── public/                    # Static assets, SVG/PNG logos, favicons, manifest.webmanifest
└── src/
    ├── App.tsx                # Core state management, server/localStorage sync, chat orchestration & resets
    ├── data/presets.ts        # Blank custom persona factory & dynamic initial memory builder
    ├── types/index.ts         # TypeScript domain models
    ├── services/
    │   ├── llmService.ts      # Multi-provider chat & multimodal vision client
    │   ├── selfieService.ts   # Portrait compiler & consistent Img2Img selfie pipeline
    │   ├── memoryService.ts   # Low-token JanitorAI JSON prompt builder & fact/jealousy extraction
    │   ├── imageUtils.ts      # Upper-center face & shoulders cropper for consistent Img2Img
    │   ├── contextService.ts  # Live weather, time & news context fetcher
    │   ├── speechService.ts   # Web Speech API & Local GPU TTS playback
    │   ├── safeStorage.ts     # Quota-safe localStorage wrapper with image pruning
    │   └── logger.ts          # Client/server circular trace logger
    └── components/            # Modular UI (ChatView, PersonaCustomizerModal, LLMSettingsModal, DiaryModal, TokenMemoryModal, SelfieGalleryModal, LogsModal, etc.)
```

---

## 📄 License

Distributed under the **Apache-2.0 License**. See [`LICENSE`](./LICENSE) for details.
