# MawthHook — WhatsApp Webhook Middleware

Middleware that sits between the **Meta WhatsApp Cloud API** and your downstream services (Chatwoot, custom webhooks, Slack, etc.). It receives incoming WhatsApp messages, stores them, and fans out to configured destinations with per-number routing and automatic retries.

```
Meta WhatsApp Cloud API
        │
        ▼
  POST /api/webhook/[accountId]      ◄── configured in Meta Developer Console
        │
        ├─ verify HMAC-SHA256 signature
        ├─ parse & store messages
        ├─ download media → uploads/
        └─ fan out to destinations
              ├─ Chatwoot
              ├─ Custom webhook
              └─ (retry on failure, exponential backoff ×5)

Chatwoot agent replies:
  POST /api/chatwoot/webhook → parse → Meta Send Message API → WhatsApp
```

## Features

- **Multi-number support** — manage multiple WhatsApp Business numbers from one dashboard
- **Destination routing** — each number routes to its own set of webhook destinations
- **Destination types** — Chatwoot, Custom, Slack (easily extensible)
- **Automatic retries** — failed deliveries retry with exponential backoff (5 attempts)
- **Chatwoot bidirectional** — inbound messages forwarded in; agent replies sent back to WhatsApp
- **Media handling** — auto-downloads images/audio/video/documents from WhatsApp
- **Dashboard** — manage accounts, destinations, view message logs and delivery analytics
- **Auth** — email/password login with JWT sessions
- **Docker-ready** — single `docker compose up` deploys everything

## Tech Stack

| Layer      | Technology |
|------------|------------|
| Framework  | Next.js (App Router, TypeScript) |
| Database   | PostgreSQL 16 + Prisma ORM |
| Auth       | bcrypt + JWT (jose for Edge middleware) |
| UI         | Tailwind CSS + Recharts + Lucide icons |
| Deployment | Docker Compose |

## Quick Start (local development)

```bash
# 1. Clone
git clone https://github.com/jbloushi/webhook-mawthook.git
cd webhook-mawthook

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
# Edit .env with your values (see .env.example for descriptions)

# 4. Start PostgreSQL (using Docker)
docker compose up db -d

# 5. Run migrations
npx prisma migrate deploy

# 6. Seed admin user
node prisma/seed.mjs

# 7. Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and log in.

## Production Deployment

See **[DEPLOY.md](./DEPLOY.md)** for the full guide covering:

- Docker Compose deployment on VPS
- aaPanel reverse proxy + SSL setup
- Meta WhatsApp webhook configuration
- Chatwoot integration
- Database backup/restore
- Troubleshooting

## Project Structure

```
src/
  middleware.ts                      # JWT auth (Edge)
  lib/
    prisma.ts                        # Prisma singleton
    encryption.ts                    # AES-256-GCM for stored tokens
    auth.ts                          # bcrypt + JWT helpers
    webhook-signature.ts             # Meta HMAC-SHA256 verification
    meta-api.ts                      # WhatsApp send message API
    media.ts                         # Download + store media
    delivery.ts                      # Fan-out + retry engine
    chatwoot.ts                      # Chatwoot webhook handler
  app/
    api/
      auth/                          # Login, register, session
      webhook/[accountId]/           # Meta webhook endpoint
      chatwoot/webhook/              # Chatwoot outbound replies
      accounts/                      # WhatsApp account CRUD
      destinations/                  # Destination CRUD
      analytics/                     # Stats aggregations
      media/[...path]/               # Serve stored media
    (dashboard)/dashboard/           # Dashboard pages
prisma/
  schema.prisma                      # Database schema (6 models)
  migrations/                        # Auto-applied on deploy
  seed.mjs                           # Initial admin user
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `DB_PASSWORD` | Yes | PostgreSQL password (used by docker-compose) |
| `ENCRYPTION_KEY` | Yes | 32-byte hex key for AES-256-GCM (`openssl rand -hex 32`) |
| `JWT_SECRET` | Yes | Secret for signing JWT tokens (`openssl rand -hex 32`) |
| `APP_URL` | Yes | Public URL, e.g. `https://webhook.yourdomain.com` |
| `CHATWOOT_WEBHOOK_SECRET` | Yes | Shared secret for Chatwoot webhook authentication |

## License

Private — Mawthook.
