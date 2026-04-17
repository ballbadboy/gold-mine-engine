# Gold Mine Engine

> Self-optimizing growth system — affiliate + SEO + ads loop that learns from its own data.

## Status

🚧 **Sprint 0:** Foundation (Next.js 16 + Supabase + Claude API)

## Stack

- **Framework:** Next.js 16 (App Router) + TypeScript + Tailwind CSS 4
- **Package Manager:** pnpm
- **Database:** Supabase (Postgres + pgvector)
- **AI:** Claude (primary) / Gemini Flash (bulk) / OpenRouter (fallback)
- **Hosting:** Vercel

## Quick Start

```bash
pnpm install
cp .env.example .env.local    # fill in values
pnpm dev                       # http://localhost:3000
```

## Project Structure

```
gold-mine-engine/
├── src/
│   ├── app/              # Next.js App Router
│   ├── components/       # UI components
│   ├── lib/              # Shared utilities
│   │   ├── supabase/     # DB client
│   │   ├── ai/           # LLM providers
│   │   └── loop/         # OODA loop engine
│   └── types/            # TypeScript types
├── public/               # Static assets
├── .env.example          # Environment template
└── .env.local            # Your secrets (git-ignored)
```

## Related

- **Strategy:** See `../../01-Strategy/` (Obsidian vault in parent folder)
- **Tech Architecture:** `../../03-Execution/Tech-Architecture.md`
- **Shopee Bot (reference):** github.com/ballbadboy/shopee-affiliate-bot

## License

Private. Do not distribute.
