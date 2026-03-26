# VoiceAid — AI Health Companion

A voice-powered AI health companion designed for elderly users, featuring medical consultations, medicine reminders, and emergency assistance.

## Tech Stack

- **Frontend**: React + TypeScript + Vite
- **Styling**: Tailwind CSS + shadcn/ui
- **Backend**: Supabase (Auth, Database, Edge Functions)
- **AI**: OpenAI API (via Supabase Edge Functions)
- **Text-to-Speech**: ElevenLabs API

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [Supabase CLI](https://supabase.com/docs/guides/cli) (optional, for edge functions)
- An [OpenAI API key](https://platform.openai.com/api-keys)
- An [ElevenLabs API key](https://elevenlabs.io/) (for text-to-speech)

### 1. Clone & Install

```bash
git clone <your-repo-url>
cd health-companion-ai-main
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and fill in your Supabase credentials:

```bash
cp .env.example .env
```

Edit `.env` with your Supabase project URL and anon key.

### 3. Run Locally

```bash
npm run dev
```

The app will be available at `http://localhost:8080`.

### 4. Supabase Edge Function Secrets

The AI chat and voice triage features require API keys set as Supabase secrets:

```bash
supabase secrets set OPENAI_API_KEY=sk-...
supabase secrets set ELEVENLABS_API_KEY=...
```

### 5. Build for Production

```bash
npm run build
npm run preview
```

## Project Structure

```
src/
├── components/     # Reusable UI components
├── hooks/          # Custom React hooks (auth, speech, etc.)
├── integrations/   # Supabase client & types
├── pages/          # Route pages (Landing, Dashboard, Consultation, etc.)
├── lib/            # Utility functions
└── types/          # TypeScript type definitions

supabase/
├── functions/      # Edge functions (medical-chat, voice-triage, text-to-speech)
└── migrations/     # Database migration files
```

## Features

- 🎙️ **Voice-First Interface** — speak your symptoms, get matched to the right specialist
- 🩺 **AI Medical Consultations** — chat with AI specialists in an elder-friendly format
- 💊 **Medicine Reminders** — track medications with timely alerts
- 🚨 **Emergency SOS** — one-tap emergency assistance
- 👨‍👩‍👧 **Caregiver Portal** — remote monitoring for family members

## License

MIT
