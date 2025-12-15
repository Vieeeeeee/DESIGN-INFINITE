<div align="center">

# 设计无限生成器 | DESIGN INFINITE

**AI 驱动的室内设计参考图生成工具**

[![GitHub](https://img.shields.io/badge/GitHub-Vieeeeeee-181717?style=flat-square&logo=github)](https://github.com/Vieeeeeee/DESIGN-INFINITE)

</div>

---

## ✨ 功能特性

- 🎨 **AI 图像生成** — 基于 Google Vertex AI (Gemini) 生成高质量室内设计参考图
- 📐 **多空间类型** — 支持家装空间、工装空间等多种场景配置
- 🔍 **高清放大** — 一键放大修复生成的图像
- 🎁 **积分系统** — 完善的积分获取与消费机制
- 👥 **邀请奖励** — 邀请新用户获得积分奖励
- 🗃️ **灵感收藏** — 收藏喜欢的设计参考图

---

## 📁 项目结构

```
DESIGN-INFINITE/
├── App.tsx                 # 主应用入口
├── components/             # React 组件
│   ├── auth/               # 认证相关组件
│   ├── admin/              # 管理后台
│   └── landing/            # 落地页
├── services/               # API 服务层
├── config/                 # 配置文件
├── server/                 # 后端 Express 服务
│   ├── routes/             # API 路由
│   ├── services/           # 后端服务 (VertexAI, 邮件等)
│   └── middleware/         # 中间件
├── docs/                   # 文档
└── .agent/workflows/       # 自动化工作流
```

---

## 🚀 快速开始

### 环境要求

- Node.js v18+
- npm 或 yarn

### 本地运行

```bash
# 1. 克隆仓库
git clone https://github.com/Vieeeeeee/DESIGN-INFINITE.git
cd DESIGN-INFINITE

# 2. 安装依赖
npm install
cd server && npm install && cd ..

# 3. 配置环境变量
cp .env.example .env.local
cp server/.env.example server/.env
# 编辑 .env.local 和 server/.env 填入必要配置

# 4. 启动后端
cd server && npm start

# 5. 启动前端 (新终端)
npm run dev

# 6. 访问
open http://localhost:3000
```

---

## 🔧 环境变量配置

### 前端 (.env.local)

```bash
# API 基础地址（开发环境留空使用代理）
VITE_API_BASE_URL=
```

### 后端 (server/.env)

```bash
# JWT 密钥
JWT_SECRET=your-secret-key

# 邮件服务 (SMTP)
SMTP_HOST=smtp.example.com
SMTP_PORT=465
SMTP_USER=your-email
SMTP_PASS=your-password

# Google Vertex AI
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
GCP_PROJECT_ID=your-project-id
GCP_LOCATION=us-central1
```

---

## 💎 积分系统

### 积分获取

| 场景 | 积分数量 | 说明 |
|------|----------|------|
| 新用户注册 | +1000 永久积分 | 使用邀请码注册 |
| 邀请新用户 | +500 永久积分 | 被邀请人注册成功 |
| 每日签到 | 500 每日积分 | 每天可领取，不累积 |

### 积分消耗

| 操作 | 消耗积分 |
|------|----------|
| 生成图片 | 100 积分 |
| 高清放大 | 50 积分 |

> 💡 消费时优先使用每日积分，不足时扣除永久积分

---

## 🛠️ 技术栈

| 层级 | 技术 |
|------|------|
| **前端** | React 18 + TypeScript + Vite |
| **样式** | Tailwind CSS + 自定义 CSS |
| **后端** | Node.js + Express |
| **数据库** | SQLite (better-sqlite3) |
| **AI** | Google Vertex AI (Gemini) |
| **部署** | Nginx + PM2 + Cloudflare CDN |

---

## 📖 部署

详细部署说明请参阅 [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)

使用工作流一键部署:

```bash
# 查看部署流程
cat .agent/workflows/deploy.md
```

---

## 📄 许可证

MIT License

---

<div align="center">
Made with ❤️ by <a href="https://github.com/Vieeeeeee">Wu Wei</a>
</div>
