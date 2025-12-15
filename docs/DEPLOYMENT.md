# 部署结构与原则

本文档定义服务器目录结构和部署规则，**所有部署操作必须遵守**。

## 目录结构

```
/www/generator/
├── dist/               # 前端构建产物（可全量覆盖）
│   ├── index.html
│   ├── assets/
│   └── ...
├── runtime/            # 运行时数据（禁止部署覆盖）
│   └── generated/      # 用户生成的图片
└── server/             # 后端代码
    ├── index.js
    ├── data.db         # SQLite 数据库（禁止覆盖）
    ├── .env            # 环境配置（禁止覆盖）
    └── node_modules/   # 依赖（禁止覆盖）
```

## 核心原则

### 1. `dist/` —— 可安全覆盖

- **内容**：Vite 构建输出的静态前端文件
- **部署**：允许 `rsync --delete` 全量覆盖
- **备份**：无需备份，可从源码重新构建

```bash
rsync -avz --delete dist/ <SERVER>:/www/generator/dist/
```

### 2. `runtime/` —— 禁止覆盖

- **内容**：用户生成的图片等运行时数据
- **部署**：绝对不能被部署脚本触及
- **备份**：需要定期备份

```bash
# ❌ 错误：会删除用户数据
rsync --delete ... /www/generator/

# ✅ 正确：只覆盖 dist/
rsync --delete dist/ .../www/generator/dist/
```

### 3. `server/` —— 需排除敏感文件

- **可覆盖**：`.js` 源码、`package.json` 等
- **禁止覆盖**：`.env`、`data.db`、`node_modules/`

```bash
rsync -avz \
  --exclude 'node_modules' \
  --exclude 'data.db' \
  --exclude '.env' \
  server/ <SERVER>:/www/generator/server/
```

## Nginx 配置要点

```nginx
server {
    # 前端静态文件
    root /www/generator/dist;
    index index.html;

    # 用户生成图片（永久存储）
    location ^~ /generated/ {
        alias /www/generator/runtime/generated/;
        add_header Cache-Control "public, max-age=2592000, immutable";
        try_files $uri =404;
    }

    # API 代理
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        # ...
    }

    # SPA 路由回退
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

## 备份与恢复

### 自动备份（已配置）

数据库每小时自动备份，由 crontab 触发：

```bash
# 查看定时任务
crontab -l | grep backup
```

**备份位置**: `/www/generator/runtime/backups/db/`

**保留策略**:
- 最近 48 小时：全部保留（小时级）
- 超过 2 天：只保留每日 00:00 的备份
- 超过 30 天：自动删除

### 手动备份

```bash
# SSH 登录后执行
/usr/local/bin/backup_generator_db.sh

# 查看备份文件
ls -lah /www/generator/runtime/backups/db/
```

### 数据库回滚

```bash
# 1. 查看可用备份
restore_generator_db.sh

# 2. 回滚到指定备份（会自动停止/重启服务）
restore_generator_db.sh data.20251214T174824Z.sqlite.zst
```

**回滚流程**:
1. 解压 `.zst` 备份文件
2. 校验数据库完整性 (`PRAGMA integrity_check`)
3. 停止 PM2 服务
4. 备份当前数据库到 `data.db.bak.<timestamp>`
5. 替换为备份版本
6. 重启 PM2 服务

### 备份脚本位置

| 脚本 | 路径 | 用途 |
|------|------|------|
| 备份脚本 | `/usr/local/bin/backup_generator_db.sh` | 创建数据库快照 |
| 恢复脚本 | `/usr/local/bin/restore_generator_db.sh` | 从备份恢复 |
| 备份日志 | `/var/log/backup_generator.log` | cron 执行日志 |

### 需要备份的数据

| 路径 | 内容 | 备份方式 |
|------|------|----------|
| `/www/generator/server/data.db` | SQLite 数据库 | 自动（每小时） |
| `/www/generator/runtime/generated/` | 用户生成图片 | 手动/按需 |
| `/www/generator/server/.env` | 环境配置 | 变更后手动 |

---

## 权限设置

```bash
# 确保 nginx/www 用户可写入 generated
chown -R www:www /www/generator/runtime
chmod -R 755 /www/generator/runtime
chmod -R 775 /www/generator/runtime/generated
```

---

> ⚠️ **违反上述原则可能导致用户数据丢失！**
