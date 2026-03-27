# MawthHook — Production Deployment Guide (VPS + aaPanel)

**Status:** ✅ Audit Passed — Ready to Deploy
**Prerequisite:** Read [AUDIT.md](./AUDIT.md) for code review details

---

## Prerequisites

Before starting, you must have:

1. **VPS Access**
   - SSH access to your VPS (Ubuntu/Debian preferred)
   - aaPanel installed and running (`admin/password` access)
   - Docker + Docker Compose available

2. **DNS Control**
   - `webhook.mawthook.io` domain under your control
   - Ability to create A/CNAME records

3. **Meta WhatsApp Setup**
   - Meta app ID: `1538784437175135`
   - WhatsApp Business Account created
   - Phone number registered and verified
   - Currently configured webhook on your local machine (ngrok)

4. **Chatwoot Setup**
   - Chatwoot instance running at `https://inbox.mawthook.io`
   - Inbox created for WhatsApp channel
   - API access token available

---

## Step-by-Step Deployment

### 1. SSH into VPS and Clone Repository

```bash
# SSH into VPS
ssh root@your-vps-ip

# Create project directory
mkdir -p /www/wwwroot
cd /www/wwwroot

# Clone the repository
git clone https://github.com/jbloushi/webhook-mawthook.git
cd webhook-mawthook
```

### 2. Generate Production Secrets

Generate strong random secrets for encryption and JWT:

```bash
# Generate ENCRYPTION_KEY (32 bytes = 256-bit)
ENCRYPTION_KEY=$(openssl rand -hex 32)
echo "ENCRYPTION_KEY=$ENCRYPTION_KEY"

# Generate JWT_SECRET
JWT_SECRET=$(openssl rand -hex 32)
echo "JWT_SECRET=$JWT_SECRET"

# Generate DB_PASSWORD
DB_PASSWORD=$(openssl rand -base64 24)
echo "DB_PASSWORD=$DB_PASSWORD"

# Copy and save these values — you'll need them next
```

### 3. Create Production .env File

```bash
# Edit .env with your values
nano .env
```

Paste and fill in:

```dotenv
# Database
DATABASE_URL="postgresql://mawthook:YOUR_DB_PASSWORD@db:5432/mawthook?schema=public"
DB_PASSWORD="YOUR_DB_PASSWORD"

# Security (paste the generated values above)
ENCRYPTION_KEY="YOUR_ENCRYPTION_KEY"
JWT_SECRET="YOUR_JWT_SECRET"

# Public URL (must match your domain)
APP_URL="https://webhook.mawthook.io"

# Chatwoot Integration
CHATWOOT_BASE_URL="https://inbox.mawthook.io"
CHATWOOT_API_TOKEN="xGv6AaXKQ31X5erfefXvCLnt"
CHATWOOT_WEBHOOK_SECRET="uSpmVTMGiRnnvCf6rMwrhAu7"
CHATWOOT_ACCOUNT_ID="1"
```

> Replace `YOUR_DB_PASSWORD`, `YOUR_ENCRYPTION_KEY`, `YOUR_JWT_SECRET` with your generated values.

### 4. Build and Start Docker Containers

```bash
# Pull latest code
git pull origin master

# Build Docker image (first time, ~3-5 min)
docker compose build

# Start containers
docker compose up -d

# Verify containers are running
docker compose ps
```

Expected output:
```
NAME                     IMAGE                  COMMAND                 SERVICE   STATUS
webhook-mawthook-app-1   webhook-mawthook-app  "docker-entrypoint..."  app       Up (healthy)
webhook-mawthook-db-1    postgres:16-alpine    "docker-entrypoint..."  db        Up (healthy)
```

### 5. Create Initial Admin User

```bash
# Seed admin account
docker compose exec app node prisma/seed.mjs
```

Output:
```
✅ Admin user created
   Email:    admin@mawthook.com
   Password: changeme123
   ID:       92f55bc6-19ed-4957-b063-88b74622df3c

⚠  Change the password after first login!
```

### 6. Configure aaPanel Reverse Proxy

1. **Log into aaPanel**
   - Navigate to http://your-vps-ip:7800

2. **Create Site**
   - Click **Website** → **Add Site**
   - Domain: `webhook.mawthook.io`
   - Select **Pure static** (document root doesn't matter)
   - Click **Create**

3. **Configure Reverse Proxy**
   - Click on `webhook.mawthook.io` site → **Reverse Proxy** → **Add Reverse Proxy**

   ```
   Proxy Name:      mawthook
   Target URL:      http://127.0.0.1:3000
   Send Domain:     $host
   ```

   - Click **Submit**

4. **Enable SSL (HTTPS)**
   - Site name → **SSL** → **Let's Encrypt**
   - Auto-renew: **On**
   - Click **Apply for certificate**
   - After success: **Force HTTPS** → **On**

5. **Add WebSocket Support** (for any real-time features)
   - Site name → **Reverse Proxy** → Click the mawthook proxy → **Edit**
   - Add these headers in the nginx config:

   ```nginx
   proxy_http_version 1.1;
   proxy_set_header Upgrade $http_upgrade;
   proxy_set_header Connection "upgrade";
   proxy_set_header X-Real-IP $remote_addr;
   proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
   proxy_set_header X-Forwarded-Proto $scheme;
   ```

   - **Save**

### 7. Verify Application

```bash
# Check app logs
docker compose logs app

# Test API endpoint
curl https://webhook.mawthook.io/api/health
# Should return 200 (or 404 if no /health endpoint)

# Test login
curl https://webhook.mawthook.io/api/auth/login \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@mawthook.com","password":"changeme123"}'
# Should return JWT token
```

---

## Step 8: Configure Meta WhatsApp Webhook

1. **Get Your Account ID from Dashboard**
   - Open https://webhook.mawthook.io
   - Log in with `admin@mawthook.com` / `changeme123`
   - Go to **Dashboard** → **Accounts**
   - Click on your WhatsApp account
   - Copy the **Account ID** from the page

2. **Update Meta Developer Console**
   - Go to [Meta Developers](https://developers.facebook.com/)
   - Select your app → **WhatsApp** → **Configuration**
   - Under **Webhook**, click **Edit**:

   | Field | Value |
   |-------|-------|
   | **Callback URL** | `https://webhook.mawthook.io/api/webhook/<ACCOUNT_ID>` |
   | **Verify Token** | (from your dashboard account details) |

   - Subscribe to: `messages`
   - **Save**

3. **Test Webhook**
   - In Meta console, click **Test** next to your callback URL
   - Should show ✅ **Verified**

---

## Step 9: Configure Chatwoot Webhook

1. **In Chatwoot Admin**
   - Go to **Settings** → **Integrations** → **Webhooks** → **Add webhook**

   | Field | Value |
   |-------|-------|
   | **URL** | `https://webhook.mawthook.io/api/chatwoot/webhook?secret=uSpmVTMGiRnnvCf6rMwrhAu7` |
   | **Events** | `message_created` |

   - **Create**

2. **Test Webhook in MawthHook**
   - Go to **Dashboard** → **Accounts** → your account
   - Link your Chatwoot inbox (if available in UI)
   - Or manually add Chatwoot destination:
     - **Dashboard** → **Destinations** → **Add Destination**
     - Name: `Chatwoot`
     - Type: `Chatwoot`
     - URL: `https://inbox.mawthook.io/webhooks/whatsapp/YOUR_INBOX_ID`
     - Headers: `{"api_access_token": "xGv6AaXKQ31X5erfefXvCLnt"}`
     - **Save**

---

## Step 10: End-to-End Test

### Send a WhatsApp Message

1. **From your phone**, send a message to your WhatsApp Business number
2. **In MawthHook Dashboard**, go to **Messages**
   - Should see your message within seconds
   - Status: `received`
3. **In Chatwoot**, check your inbox
   - Message should appear within 10 seconds
   - Ready for agent to reply

### Reply from Chatwoot

1. **In Chatwoot**, type a reply to the customer message
2. **Send** the reply
3. **Check your phone**
   - WhatsApp message should arrive within 10 seconds

---

## Post-Deployment Checklist

- [ ] ✅ Containers running healthily (`docker compose ps`)
- [ ] ✅ Admin user created and can log in
- [ ] ✅ SSL certificate active (green 🔒 in browser)
- [ ] ✅ Meta webhook verified in developers console
- [ ] ✅ Chatwoot webhook configured
- [ ] ✅ Test message sent and received in MawthHook
- [ ] ✅ Test message forwarded to Chatwoot
- [ ] ✅ Test reply from Chatwoot sent back to WhatsApp
- [ ] ✅ Changed admin password (if using production credentials)

---

## Monitoring & Maintenance

### View Logs

```bash
# All services
docker compose logs -f

# App only
docker compose logs -f app

# Database only
docker compose logs -f db
```

### Backup Database

```bash
# Full backup
docker compose exec db pg_dump -U mawthook mawthook > backup_$(date +%Y%m%d_%H%M%S).sql

# Store backup safely
scp backup_*.sql your-local-machine:/backups/
```

### Update to Latest Code

```bash
# Pull latest
git pull origin master

# Rebuild and restart
docker compose up -d --build

# Migrations run automatically
docker compose logs app | grep "migration"
```

### Health Check

```bash
# Check if app is responding
curl https://webhook.mawthook.io/api/auth/me \
  -H "Authorization: Bearer <your-jwt-token>"
# Should return your user info
```

### Troubleshooting

| Issue | Solution |
|-------|----------|
| Port 3000 in use | `docker compose down` then `docker compose up -d` |
| Database won't connect | Check `DB_PASSWORD` in `.env` matches Docker config |
| Webhook not delivering | Check app logs: `docker compose logs app` |
| Messages not appearing | Verify Meta webhook signature (check AUDIT.md) |
| Let's Encrypt cert fails | Ensure DNS is pointing to VPS IP and port 80/443 open |

---

## Security Notes

⚠️ **Important:**

1. **Change Default Password**
   - Log in to dashboard immediately
   - Go to user profile → change password
   - Never use `changeme123` in production

2. **Backup Secrets**
   - Save `.env` file in a secure location
   - Backup `ENCRYPTION_KEY` and `JWT_SECRET`
   - If lost, you'll need to regenerate all encrypted tokens

3. **Firewall Rules**
   - Allow: Port 80 (HTTP) — for Let's Encrypt
   - Allow: Port 443 (HTTPS) — for HTTPS traffic
   - Allow: Port 7800 (aaPanel) — restrict to your IP
   - Block: Port 5432 (PostgreSQL) — internal only

4. **Regular Backups**
   - Automate database backups daily
   - Store backups off-site (AWS S3, Google Cloud Storage, etc.)
   - Test restore procedure monthly

---

## Next Steps

✅ **Deployment complete!** Your MawthHook instance is live at:
- **Dashboard:** https://webhook.mawthook.io
- **Webhook Endpoint:** https://webhook.mawthook.io/api/webhook/[account-id]
- **API:** https://webhook.mawthook.io/api/*

**Your system is now ready to:**
- Receive WhatsApp messages via Meta API
- Store and log messages in PostgreSQL
- Forward to Chatwoot and custom destinations
- Retry failed deliveries with exponential backoff
- Manage multiple WhatsApp numbers from one dashboard

For support or questions, refer to:
- [README.md](./README.md) — Project overview
- [DEPLOY.md](./DEPLOY.md) — Original deployment guide
- [AUDIT.md](./AUDIT.md) — Code security review
- GitHub Issues: https://github.com/jbloushi/webhook-mawthook/issues

---

**Happy messaging! 🚀**
