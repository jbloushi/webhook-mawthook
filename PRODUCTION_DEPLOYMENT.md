# Production Deployment (Quick Commands)

Canonical guide: [DEPLOY.md](./DEPLOY.md)

## One-pass command sequence

```bash
# 1) get code
cd /www/wwwroot
git clone https://github.com/jbloushi/webhook-mawthook.git
cd /www/wwwroot/webhook-mawthook

# 2) install deps + env
npm ci
cp .env.example .env
nano .env

# 3) prepare db and app
# if password has @, encode in DATABASE_URL as %40
npm run prisma:migrate:deploy
npm run build
grep "^DATABASE_URL=" .env

# 4) seed first admin
ADMIN_EMAIL=admin@yourdomain.com ADMIN_PASSWORD='StrongPass!ChangeMe' npm run prisma:seed

# 5) start/restart app service
sudo systemctl restart mawthook
sudo systemctl status mawthook --no-pager

# 6) verify
curl http://127.0.0.1:3000/api/health
```
