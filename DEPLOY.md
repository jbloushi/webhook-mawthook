# Deploying MawthHook on VPS + aaPanel (No Docker)

This runbook uses native installs only: **Node.js + PostgreSQL + systemd + aaPanel reverse proxy**.

## Full Setup Commands (copy/paste order)

### 1) Install system packages

```bash
sudo apt update
sudo apt install -y curl git build-essential postgresql postgresql-contrib
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v
npm -v
psql --version
```

### 2) Pull code and install dependencies

```bash
cd /www/wwwroot
git clone https://github.com/jbloushi/webhook-mawthook.git
cd /www/wwwroot/webhook-mawthook
npm ci
cp .env.example .env
```

### 3) Create DB and DB user

```bash
sudo -u postgres psql
```

```sql
CREATE USER mawthook WITH PASSWORD 'CHANGE_ME';
CREATE DATABASE mawthook OWNER mawthook;
\q
```

### 4) Configure app environment

```bash
cd /www/wwwroot/webhook-mawthook
nano .env
```

Use this as a base:

```dotenv
DATABASE_URL="postgresql://mawthook:CHANGE_ME@127.0.0.1:5432/mawthook?schema=public"
DB_PASSWORD="CHANGE_ME"
ENCRYPTION_KEY="<openssl rand -hex 32>"
JWT_SECRET="<openssl rand -hex 32>"
APP_URL="https://webhook.yourdomain.com"
CHATWOOT_WEBHOOK_SECRET="<random-secret>"
```

Important:
- If DB password includes special characters (like `@`), URL-encode it in `DATABASE_URL`.
- Example password `blue@123KDD` becomes `blue%40123KDD` inside `DATABASE_URL`.

### 5) Build database + app

```bash
cd /www/wwwroot/webhook-mawthook
npm run prisma:migrate:deploy
npm run build
grep "^DATABASE_URL=" .env
node -e 'require("dotenv").config(); console.log(process.env.DATABASE_URL ? "DATABASE_URL loaded" : "DATABASE_URL missing")'
```

### 6) Seed admin user

Default seed:

```bash
cd /www/wwwroot/webhook-mawthook
npm run prisma:seed
```

Custom credentials seed (recommended):

```bash
cd /www/wwwroot/webhook-mawthook
ADMIN_EMAIL=admin@yourdomain.com ADMIN_PASSWORD='StrongPass!ChangeMe' npm run prisma:seed
```

### 7) Create systemd service

Create `/etc/systemd/system/mawthook.service`:

```ini
[Unit]
Description=MawthHook Next.js App
After=network.target postgresql.service

[Service]
Type=simple
User=www
Group=www
WorkingDirectory=/www/wwwroot/webhook-mawthook
Environment=NODE_ENV=production
EnvironmentFile=/www/wwwroot/webhook-mawthook/.env
ExecStart=/usr/bin/npm run start -- -p 3000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable mawthook
sudo systemctl start mawthook
sudo systemctl status mawthook --no-pager
curl http://127.0.0.1:3000/api/health
```

### 8) Configure aaPanel reverse proxy + SSL

1. aaPanel → **Website** → **Add Site** (`webhook.yourdomain.com`)
2. Site → **Reverse Proxy** → target `http://127.0.0.1:3000`
3. Site → **SSL** → Let's Encrypt → enable Force HTTPS

Recommended proxy headers:

```nginx
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
```

## Update / Redeploy Commands

```bash
cd /www/wwwroot/webhook-mawthook
git pull origin main
npm ci
npm run prisma:migrate:deploy
npm run build
grep "^DATABASE_URL=" .env
node -e 'require("dotenv").config(); console.log(process.env.DATABASE_URL ? "DATABASE_URL loaded" : "DATABASE_URL missing")'
sudo systemctl restart mawthook
sudo systemctl status mawthook --no-pager
curl https://webhook.yourdomain.com/api/health
```

## Troubleshooting

Common issues:
- `P1000 authentication failed`: your DB password in `DATABASE_URL` is wrong or not URL-encoded.
- `Environment variable not found: DATABASE_URL`: `.env` is missing/empty or you are running commands outside the project path.

```bash
# Ensure env exists in project root
cd /www/wwwroot/webhook-mawthook
ls -la .env

# Validate DB login directly
psql "postgresql://mawthook:YOUR_PASSWORD@127.0.0.1:5432/mawthook" -c "select 1;"

# App logs
journalctl -u mawthook -f

# Local health
curl http://127.0.0.1:3000/api/health

# Public health
curl https://webhook.yourdomain.com/api/health
```
