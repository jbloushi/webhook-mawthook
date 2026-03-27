# Deploying MawthHook on VPS + aaPanel

This guide covers pulling, configuring, and deploying MawthHook on a VPS managed with **aaPanel** (BT Panel).

---

## Prerequisites

| Requirement       | Minimum  | Notes |
|--------------------|----------|-------|
| VPS (Ubuntu/Debian)| 1 vCPU, 1 GB RAM | 2 GB+ recommended |
| aaPanel installed  | v7+      | [install.aapanel.com](https://www.aapanel.com/new/download.html) |
| Docker + Docker Compose | v24+ / v2+ | Install via aaPanel → Docker Manager |
| Domain name        | —        | e.g. `webhook.yourdomain.com` |

---

## Step 1 — Install Docker via aaPanel

1. Log in to your **aaPanel** dashboard
2. Go to **App Store** → search **Docker Manager** → Install
3. Verify Docker is running:

```bash
docker --version
docker compose version
```

---

## Step 2 — Clone the repository

```bash
# Pick a directory (e.g. /www/wwwroot/)
cd /www/wwwroot
git clone https://github.com/jbloushi/webhook-mawthook.git
cd webhook-mawthook
```

---

## Step 3 — Configure environment

```bash
cp .env.example .env
nano .env
```

Fill in every value:

```dotenv
# Database — keep "db" as the hostname (Docker service name)
DATABASE_URL="postgresql://mawthook:YOUR_STRONG_PASSWORD@db:5432/mawthook?schema=public"
DB_PASSWORD="YOUR_STRONG_PASSWORD"        # same password as above

# Security — generate each with:  openssl rand -hex 32
ENCRYPTION_KEY="<paste 64-char hex>"
JWT_SECRET="<paste 64-char hex>"

# Public URL (no trailing slash) — must match your domain / reverse proxy
APP_URL="https://webhook.yourdomain.com"

# Chatwoot webhook secret (any random string you choose)
CHATWOOT_WEBHOOK_SECRET="some-random-secret"
```

> **Tip:** Generate secrets quickly:
> ```bash
> openssl rand -hex 32   # run twice, one for each key
> openssl rand -base64 24  # for webhook secret
> ```

---

## Step 4 — Build and start

```bash
docker compose up -d --build
```

This will:
- Build the Next.js app in a multi-stage Docker image
- Start PostgreSQL 16
- Run Prisma migrations automatically on first boot
- Expose the app on port **3000**

Check logs:

```bash
docker compose logs -f app    # app logs
docker compose logs -f db     # postgres logs
```

Wait until you see `✓ Ready in ...` in the app logs.

---

## Step 5 — Create the first admin user

```bash
# Default credentials (admin@mawthook.com / changeme123)
docker compose exec app node prisma/seed.mjs

# Or with custom credentials
docker compose exec app sh -c \
  'ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=YourSecurePass node prisma/seed.mjs'
```

> ⚠ **Change the password** after your first login via the dashboard, or use custom credentials above.

---

## Step 6 — Set up reverse proxy in aaPanel

1. In aaPanel, go to **Website** → **Add Site**
2. Enter your domain: `webhook.yourdomain.com`
3. Set document root to any directory (we won't serve static files from it)
4. After creating the site, click on the site name → **Reverse Proxy** → **Add Reverse Proxy**:

| Field         | Value                        |
|---------------|------------------------------|
| Proxy Name    | `mawthook`                   |
| Target URL    | `http://127.0.0.1:3000`      |
| Send Domain   | `$host`                      |

5. Enable **SSL** (recommended — Meta requires HTTPS for webhook URLs):
   - Go to the site → **SSL** → **Let's Encrypt** → Issue certificate
   - Enable **Force HTTPS**

6. Add WebSocket support (click **Edit** on the proxy config and add):

```nginx
# Inside the location block that aaPanel created:
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
proxy_read_timeout 86400;
```

---

## Step 7 — Configure Meta WhatsApp webhook

1. Go to [Meta Developers](https://developers.facebook.com/) → Your App → **WhatsApp** → **Configuration**
2. Under **Webhook**, click **Edit**:

| Field              | Value |
|--------------------|-------|
| Callback URL       | `https://webhook.yourdomain.com/api/webhook/<ACCOUNT_ID>` |
| Verify Token       | The verify token you set when creating the WhatsApp Account in the dashboard |

3. Subscribe to: `messages`

> Get your `<ACCOUNT_ID>` from the MawthHook dashboard after adding a WhatsApp account.

---

## Step 8 — Configure Chatwoot webhook (optional)

In your Chatwoot instance:

1. Go to **Settings** → **Integrations** → **Webhooks** → **Add webhook**:

| Field  | Value |
|--------|-------|
| URL    | `https://webhook.yourdomain.com/api/chatwoot/webhook?secret=YOUR_CHATWOOT_WEBHOOK_SECRET` |
| Events | `message_created` |

---

## Common operations

### View logs
```bash
cd /www/wwwroot/webhook-mawthook
docker compose logs -f          # all services
docker compose logs -f app      # app only
docker compose logs -f db       # database only
```

### Pull updates and redeploy
```bash
cd /www/wwwroot/webhook-mawthook
git pull origin main
docker compose up -d --build
```

Migrations run automatically on container start — no manual step needed.

### Restart services
```bash
docker compose restart app      # restart app only
docker compose restart          # restart everything
```

### Access database directly
```bash
docker compose exec db psql -U mawthook -d mawthook
```

### Backup database
```bash
docker compose exec db pg_dump -U mawthook mawthook > backup_$(date +%Y%m%d).sql
```

### Restore database
```bash
cat backup_20260327.sql | docker compose exec -T db psql -U mawthook -d mawthook
```

### Stop everything
```bash
docker compose down             # stop containers (data preserved)
docker compose down -v          # stop + DELETE all data (volumes)
```

---

## Firewall / aaPanel security

In aaPanel → **Security**:

- **Allow** port `80` and `443` (HTTP/HTTPS) — needed for web traffic
- **Allow** port `3000` only if you need direct access (not recommended — use reverse proxy)
- **Block** port `5432` from external access — PostgreSQL should only be reachable internally

---

## Folder structure on VPS

```
/www/wwwroot/webhook-mawthook/
├── .env                   ← your secrets (never commit this)
├── docker-compose.yml     ← orchestration
├── Dockerfile             ← app build
├── prisma/
│   ├── schema.prisma      ← database schema
│   ├── migrations/        ← auto-applied on start
│   └── seed.mjs           ← initial admin user
└── (everything else is built inside the Docker image)

Docker volumes (persistent data):
  webhook-mawthook_pgdata    ← PostgreSQL data
  webhook-mawthook_uploads   ← downloaded WhatsApp media files
```

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `port 3000 already in use` | `docker compose down` then retry, or change the port mapping in `docker-compose.yml` |
| `ECONNREFUSED` to database | Check `docker compose ps` — is `db` healthy? Check `DB_PASSWORD` matches in both `DATABASE_URL` and `DB_PASSWORD` |
| Prisma migration fails | Check `docker compose logs app` for details. Ensure `DATABASE_URL` is correct |
| Meta webhook verification fails | Ensure the **Verify Token** in Meta matches the one in your WhatsApp Account settings in the dashboard |
| SSL certificate error | Re-issue via aaPanel → Site → SSL → Let's Encrypt |
| 502 Bad Gateway | App hasn't started yet — check `docker compose logs -f app` |
| Media files not loading | Ensure the `uploads` volume is mounted. Check `docker compose exec app ls uploads/` |
