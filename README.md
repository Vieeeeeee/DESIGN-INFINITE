<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# 设计无限生成器 | DESIGN INFINITE

AI 驱动的室内设计参考图生成工具。

🌐 **线上地址**: https://abdc.online  
📡 **API 域名**: https://api.abdc.online

---

## 目录结构 | Project Structure

```
设计参考无限生成器/
├── App.tsx                 # 主应用入口
├── components/             # React 组件
├── services/               # API 服务层
├── server/                 # 后端 Express 服务
│   ├── routes/             # API 路由
│   ├── services/           # 后端服务 (VertexAI, 邮件等)
│   └── data.db             # SQLite 数据库
├── docs/                   # 文档
│   └── DEPLOYMENT.md       # 部署结构与原则
├── dist/                   # 构建输出 (git ignored)
└── .agent/workflows/       # 部署脚本
    └── deploy.md           # 一键部署流程
```

### 服务器目录结构 (Production)

```
/www/generator/
├── dist/               # 前端构建产物（可 rsync --delete）
├── runtime/generated/  # 用户生成图片（永久存储，禁止覆盖）
└── server/             # 后端代码
```

> ⚠️ 详细部署规则见 [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)

---

## 本地运行 | Run Locally

**前置条件:** Node.js v18+

1. 安装依赖:
   ```bash
   npm install
   cd server && npm install
   ```

2. 配置环境变量:
   - 复制 `.env.example` → `.env.local` 并设置 `GEMINI_API_KEY`
   - 复制 `server/.env.example` → `server/.env` 并配置 SMTP + JWT

3. 启动服务:
   ```bash
   # 启动后端
   cd server && npm start
   
   # 启动前端 (新终端)
   npm run dev
   ```

4. 访问: http://localhost:3000

---

## 部署 | Deployment

使用 `/deploy` 工作流一键部署到生产服务器：

```bash
# 查看部署脚本
cat .agent/workflows/deploy.md

# 或手动执行各步骤
npm run build
rsync -avz --delete dist/ root@43.132.214.236:/www/generator/dist/
rsync -avz --exclude 'node_modules' --exclude 'data.db' --exclude '.env' server/ root@43.132.214.236:/www/generator/server/
ssh root@43.132.214.236 "cd /www/generator/server && npm ci --omit=dev && pm2 restart generator-api"
```

---

## 积分系统规则 | Points System Protocol

> ⚠️ **重要**: 此文档为系统级规则文档，任何代码修改必须遵循以下规则，确保积分系统的一致性和稳定性。

### 一、积分类型

| 类型 | 说明 | 存储字段 |
|------|------|----------|
| **永久积分** | 通过注册、邀请获得，不会过期 | `users.points` |
| **每日积分** | 每天登录可领取，当日有效，不累积 | `users.daily_points` + `users.daily_points_date` |

### 二、积分获取规则

| 场景 | 积分数量 | 规则说明 |
|------|----------|----------|
| **新用户注册** | +1000 永久积分 | 使用有效邀请码完成注册后自动发放 |
| **邀请新用户** | +500 永久积分 | 被邀请人完成注册后，邀请人获得奖励 |
| **每日签到** | 500 每日积分 | 每天首次登录/签到时刷新，**不可累积**到第二天 |

### 三、积分消耗规则

| 操作 | 消耗积分 | 优先级说明 |
|------|----------|------------|
| **生成图片** | 100 积分 | 优先扣每日积分，不足时扣永久积分 |
| **高清放大** | 50 积分 | 优先扣每日积分，不足时扣永久积分 |

### 四、邀请码系统

| 规则项 | 说明 |
|--------|------|
| **邀请码数量** | 每个新用户自动获得 **10 个** 邀请码 |
| **邀请码格式** | 6 位大写字母数字组合 |
| **使用限制** | 每个邀请码仅可使用一次 |
| **状态展示** | 已使用的邀请码在用户界面显示为划线状态 |

#### 分享链接机制

用户可以通过分享链接邀请新用户：

```
分享链接格式: https://abdc.online/?invite=XXXXXX
```

**流程说明**：
1. 老用户在用户中心点击「复制链接」获取分享链接
2. 新用户点击链接，自动跳转到注册页面
3. 邀请码自动填入，显示"来自 xxx 的邀请"提示
4. 新用户完成注册后，老用户自动获得 500 永久积分

### 五、积分扣费逻辑 (伪代码)

```javascript
function consumePoints(userId, amount) {
  const user = getUser(userId);
  const today = getCurrentDate();
  
  // 1. 检查每日积分是否是今天的
  let dailyAvailable = 0;
  if (user.daily_points_date === today) {
    dailyAvailable = user.daily_points;
  }
  
  // 2. 计算总可用积分
  const totalAvailable = dailyAvailable + user.points;
  
  if (totalAvailable < amount) {
    throw new Error('积分不足');
  }
  
  // 3. 优先扣每日积分
  let remaining = amount;
  let dailyDeduct = Math.min(dailyAvailable, remaining);
  remaining -= dailyDeduct;
  
  // 4. 不足部分扣永久积分
  let permanentDeduct = remaining;
  
  // 5. 更新数据库
  user.daily_points -= dailyDeduct;
  user.points -= permanentDeduct;
  
  return { success: true, newTotal: user.points + user.daily_points };
}
```

### 六、数据库表结构

```sql
-- 用户表
CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  points INTEGER DEFAULT 0,              -- 永久积分
  daily_points INTEGER DEFAULT 0,        -- 每日积分
  daily_points_date VARCHAR(10),         -- 每日积分的日期 (YYYY-MM-DD)
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  invited_by INTEGER REFERENCES users(id)
);

-- 邀请码表
CREATE TABLE invite_codes (
  id INTEGER PRIMARY KEY,
  code VARCHAR(16) UNIQUE NOT NULL,
  owner_id INTEGER NOT NULL REFERENCES users(id),
  used_by INTEGER REFERENCES users(id),  -- NULL = 未使用
  used_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 积分记录表
CREATE TABLE points_log (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  amount INTEGER NOT NULL,               -- 正数=获得, 负数=消耗
  type VARCHAR(20) NOT NULL,             -- 'earn' | 'consume' | 'daily'
  description VARCHAR(255) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 七、配置项 (server/config.js)

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `inviteRewardPoints` | 500 | 邀请一人获得的积分 |
| `inviteCodesPerUser` | 10 | 每个用户的邀请码数量 |
| `DAILY_LOGIN_POINTS` | 500 | 每日签到积分 |
| `CONSUME_PER_GENERATE` | 100 | 生成一次消耗积分 |
| `CONSUME_PER_UPSCALE` | 50 | 放大一次消耗积分 |

### 八、安全规则

1. **积分检查**: 在执行任何消耗操作前，必须先调用 API 验证积分是否充足
2. **原子操作**: 积分扣费和操作执行必须是原子操作，失败时回滚
3. **日志记录**: 所有积分变动必须记录到 `points_log` 表
4. **防刷机制**: 每日积分不可累积，每天只能领取一次

---

## 技术栈 | Tech Stack

| 层级 | 技术 |
|------|------|
| **前端** | React 18 + TypeScript + Vite |
| **样式** | Tailwind CSS + 自定义 CSS (Yohji Yamamoto 风格) |
| **后端** | Node.js + Express |
| **数据库** | SQLite (better-sqlite3) |
| **AI** | Google Vertex AI (Gemini 3 Pro Image) |
| **部署** | Nginx + PM2 + Cloudflare CDN |

---

## 相关文档

- [部署结构与原则](docs/DEPLOYMENT.md) - 服务器目录、备份策略、Nginx 配置
- [部署工作流](.agent/workflows/deploy.md) - 一键部署命令

---

## 许可证 | License

MIT License - Created by Wu Wei
