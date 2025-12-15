---
description: Deploy to production server (upload frontend and backend)
---

# Production Deployment (Locked Structure)
# Server: Configured in ~/.ssh/config as 'generator-server'
# Frontend (build output): /www/generator/dist/
# Backend: /www/generator/server/
# Runtime persistent data: /www/generator/runtime/ (DO NOT rsync --delete here)

# ============================================
# SETUP: Add to ~/.ssh/config
# ============================================
# Host generator-server
#     HostName <YOUR_SERVER_IP>
#     User root
#     IdentityFile ~/.ssh/id_rsa

# 0) (可选) 预检查：确保目录结构存在
ssh generator-server "mkdir -p /www/generator/dist /www/generator/runtime/generated /www/generator/server"

// turbo
# 1) Build Frontend (local)
npm run build

// turbo
# 2) Upload Frontend (safe: only dist -> /www/generator/dist, allow delete)
rsync -avz --delete dist/ generator-server:/www/generator/dist/

# 2.1) Nginx (once) - root 指向 dist；/generated 指向 runtime/generated
# - root: /www/generator/dist
# - location /generated/ { alias /www/generator/runtime/generated/; }
# 改完执行：
ssh generator-server "nginx -t && systemctl reload nginx"

// turbo
# 3) Upload Backend (exclude persistent files)
rsync -avz \
  --exclude 'node_modules' \
  --exclude 'data.db' \
  --exclude '.env' \
  --exclude 'runtime' \
  server/ generator-server:/www/generator/server/

// turbo
# 4) Install deps (server) - prefer npm ci if lockfile exists
ssh generator-server "cd /www/generator/server && (npm ci --omit=dev --prefer-offline --no-audit || npm install --production --prefer-offline --no-audit)"

// turbo
# 5) Restart PM2
ssh generator-server "pm2 restart generator-api || pm2 start /www/generator/server/index.js --name generator-api"

# 6) Quick sanity checks (optional)
# 6.1) 确认生成图落盘目录有新文件
ssh generator-server "ls -lt /www/generator/runtime/generated/ | head"