# Context Relay
> A model-agnostic context preservation layer for AI workflows.
> 

Context Relay is a Chrome extension paired with a lightweight distillation API that packages the meaningful state of any AI conversation and hands it off seamlessly to any other model.

[insert demo gif here]


## Why this exists

AI models have no memory across sessions **or across providers**. Every time you start a new conversation, switch between models (e.g., Claude ↔ ChatGPT), or hit a context window limit, you lose the accumulated reasoning, decisions, and state from prior exchanges. This isn’t just annoying — it breaks your cognitive flow.

Even if the manual effort of summarizing feels small, the damage is already done: you've interrupted a focused mental state. Deep work has a switching cost measured not in keystrokes, but in how long it takes to rebuild your thinking thread.

Context Relay removes that interruption.

### Key Problems Solved

- **Model lock-in from switching cost.**
    
    Different models excel at different tasks, but switching means starting over. Users stay on one model — not because it’s best, but because switching is costly.
    
- **Flow interruption.**
    
    Advanced AI users often navigate multiple models in parallel. Manually bridging context between them disrupts the productive mental zone where deep work actually happens.
    
- **Context limits and no persistent working state**
    
    Long sessions hit token limits and force resets. Across sessions, there’s no structured, portable “source of truth” for your work.
    

## How It Works

Context Relay acts like a **relay baton for thinking.**

1. **Capture** — The Chrome extension reads your active AI conversation from the current page
2. **Distill** — The API compresses it into a structured context packet (decisions, open questions, current task, artifacts)
3. **Relay** — You select a destination model, and the packet is injected as a priming prompt

```
Chrome Extension  →  Distillation API  →  Destination Model
(capture layer)      (compression +        (ChatGPT, Claude,
                      structuring)          or others)
```

**Supported sources:** Claude, ChatGPT (more coming soon)

**Supported destinations:** Claude, ChatGPT (more coming soon)


## Architecture & Tech Stack

**Chrome Extension (Frontend)**

- Manifest V3, vanilla JS
- Injects a “Handoff” button into AI chat interfaces
- Scrapes conversation via DOM
- Handles preview + programmatic send to destination models

**Distillation API (Backend)**

- Node.js + TypeScript (Hono)
- Uses LLM (Claude Haiku via Anthropic API) to compress conversations
- Produces structured, model-agnostic context packets
- Deployed on Railway (API hosting)

**Storage Layer**

- **Redis (Upstash)** — fast, temporary session storage (latest packets)
- **Postgres (Supabase)** — long-term, queryable storage

**Auth & Validation**

- JWT-based API keys
- Zod for schema validation


## Getting Started

Context Relay is open source under the MIT License. You can run it locally as your own Chrome extension using your own API keys. A publicly installable Chrome Web Store version is in progress, so no technical setup is required.

> **Status:** Early prototype. Core workflow (capture → distill → relay) is functional. Refinements ongoing.

**Planned features:** Multi-destination sync (send to multiple models at once); more source platforms (Gemini, etc.); and improved packet customization.
> 

### Prerequisites

- Node.js 18+
- An [Anthropic API key](https://console.anthropic.com/)
- A [Railway](https://railway.app/) account for API deployment
- [Upstash](https://upstash.com/) account for Redis
- [Supabase](https://supabase.com/) account for Postgres

*Free licenses are sufficient for this project.* 


### 1. Clone repo

```bash
git clone https://github.com/stephenie-l/context-relay
cd context-relay
npm install
```

### 2. Configure environment

Create `.env` in `/api`:

```
ANTHROPIC_API_KEY=your-anthropic-api-key-here
UPSTASH_REDIS_REST_URL=https://your-db.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-upstash-token-here
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-supabase-service-key-here
JWT_SECRET=any-long-random-string
```

### 3. Run API

```bash
cd api
npm run dev
```

### 4. Load Chrome extension

1. Open Chrome → `chrome://extensions/`
2. Enable **Developer Mode**
3. Click **Load unpacked**
4. Select `/extension` folder

### Optional: Customizations

- Change distillation model:
    
    `api/src/distill/engine.ts`
    
- Modify packet structure / logic:
    
    `api/src/distill/`
    
- Adjust API routes:
    
    `api/src/routes/`
    

## Built by

Built by [Stephenie Liew](https://stephenieliew.com/) — an AI builder exploring how humans think and work with AI systems.
