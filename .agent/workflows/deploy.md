---
description: Deploy to production server (upload frontend and backend)
---

# Production Deployment (Locked Structure)
# Server: 43.132.214.236
# Frontend (build output): /www/generator/dist/
# Backend: /www/generator/server/
# Runtime persistent data: /www/generator/runtime/ (DO NOT rsync --delete here)

# 0) (可选) 预检查：确保目录结构存在
ssh root@43.132.214.236 "mkdir -p /www/generator/dist /www/generator/runtime/generated /www/generator/server"

# 1) Build Frontend (local)
npm run build

# 2) Upload Frontend (safe: only dist -> /www/generator/dist, allow delete)
rsync -avz --delete dist/ root@43.132.214.236:/www/generator/dist/

# 2.1) Nginx (once) - root 指向 dist；/generated 指向 runtime/generated
# - root: /www/generator/dist
# - location /generated/ { alias /www/generator/runtime/generated/; }
# 改完执行：
ssh root@43.132.214.236 "nginx -t && systemctl reload nginx"

# 3) Upload Backend (exclude persistent files)
rsync -avz \
  --exclude 'node_modules' \
  --exclude 'data.db' \
  --exclude '.env' \
  --exclude 'runtime' \
  server/ root@43.132.214.236:/www/generator/server/

# 4) Install deps (server) - prefer npm ci if lockfile exists
ssh root@43.132.214.236 "cd /www/generator/server && (npm ci --omit=dev --prefer-offline --no-audit || npm install --production --prefer-offline --no-audit)"

# 5) Restart PM2
ssh root@43.132.214.236 "pm2 restart generator-api || pm2 start /www/generator/server/index.js --name generator-api"

# 6) Quick sanity checks (optional)
# 6.1) 确认生成图落盘目录有新文件
ssh root@43.132.214.236 "ls -lt /www/generator/runtime/generated/ | head"
# 6.2) 确认线上 /generated/ 能访问（把 UUID 换成新生成的）
# curl -I https://api.abdc.online/generated/<uuid>.png