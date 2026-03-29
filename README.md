# MawthHook — WhatsApp Webhook Middleware

Middleware that sits between the **Meta WhatsApp Cloud API** and your downstream services (Chatwoot, custom webhooks, Slack, etc.). It receives incoming WhatsApp messages, stores them, and fans out to configured destinations with per-number routing and automatic retries.

## Features

- Multi-number WhatsApp account support
- Destination routing (Chatwoot, custom webhook, Slack-ready)
- Retry engine with exponential backoff
- Chatwoot bidirectional sync
- Media download and local serving
- Dashboard for accounts, destinations, messages, and analytics
- JWT session auth

## Requirements (No Docker)

- Node.js 20+
- npm 10+
- PostgreSQL 16+ (native service install)

## Full Local Setup (No Docker)

### 1) Clone + install

```bash
cd ~/projects
git clone https://github.com/jbloushi/webhook-mawthook.git
cd ~/projects/webhook-mawthook
npm install
cp .env.example .env
```

### 2) Create PostgreSQL DB + user

```bash
sudo -u postgres psql
```

```sql
CREATE USER mawthook WITH PASSWORD 'CHANGE_ME';
CREATE DATABASE mawthook OWNER mawthook;
\q
```

### 3) Configure environment

```bash
cd ~/projects/webhook-mawthook
nano .env
```

Set at minimum:
- `DATABASE_URL`
- `ENCRYPTION_KEY` (`openssl rand -hex 32`)
- `JWT_SECRET` (`openssl rand -hex 32`)
- `APP_URL` (use `http://localhost:3000` locally)
- `CHATWOOT_WEBHOOK_SECRET`

### 4) Migrate + seed admin + run

```bash
cd ~/projects/webhook-mawthook
npm run prisma:migrate:deploy
ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD='ChangeMeNow123!' npm run prisma:seed
npm run dev
```

Open `http://localhost:3000` and log in with the seeded admin credentials.

## Production (VPS + aaPanel, No Docker)

Use **[DEPLOY.md](./DEPLOY.md)** for the full VPS runbook, including:
- exact `cd` paths
- install commands
- systemd service config
- admin seed commands
- update/redeploy commands

## Useful Scripts

```bash
npm run lint
npm run typecheck
npm run build
npm run prisma:generate
npm run prisma:migrate:deploy
npm run prisma:seed
```
