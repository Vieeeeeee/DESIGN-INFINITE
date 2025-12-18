<div align="center">

<img src="public/favicon.svg" width="120" height="120" alt="Design Infinite Logo">

# 设计无限生成器 | DESIGN INFINITE

**AI 驱动的高端室内设计参考图生成引擎**

[![GitHub](https://img.shields.io/badge/GitHub-Vieeeeeee-181717?style=flat-square&logo=github)](https://github.com/Vieeeeeee/DESIGN-INFINITE)
[![License](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)

[English](./README.md) | **简体中文**

</div>

---

## ✨ 功能特性

<div align="center">

| 🎨 **AI 图像生成** | 📐 **多空间类型** | 🔍 **高清放大** |
|:---:|:---:|:---:|
| Google Vertex AI (Gemini) <br> 高质量渲染 | 家装 & 工装空间 <br> 定制化场景 | 一键放大修复 <br> 4倍细节还原 |

| 🎁 **积分系统** | 👥 **邀请奖励** | 🗃️ **灵感收藏** |
|:---:|:---:|:---:|
| 每日签到 <br> 可持续的积分经济 | 用户增长引擎 <br> 额外奖励 | 灵感库 <br> 有序管理素材 |

</div>

---

## 🛠️ 技术架构

<div align="center">

![React](https://img.shields.io/badge/React_18-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)

![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=express&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-07405E?style=for-the-badge&logo=sqlite&logoColor=white)
![Google Cloud](https://img.shields.io/badge/Google_Cloud-4285F4?style=for-the-badge&logo=google-cloud&logoColor=white)

</div>

---

## 🚀 快速开始

### 环境要求
- Node.js v18+
- npm 或 yarn

### 本地开发

```bash
# 1. 克隆仓库
git clone https://github.com/Vieeeeeee/DESIGN-INFINITE.git
cd DESIGN-INFINITE

# 2. 安装依赖
npm install
cd server && npm install && cd ..

# 3. 配置环境
cp .env.example .env.local
cp server/.env.example server/.env
# 编辑 .env.local 和 server/.env 填入必要配置

# 4. 启动后端
cd server && npm start

# 5. 启动前端 (新建终端窗口)
npm run dev

# 6. 访问应用
open http://localhost:3000
```

---

## 💎 积分系统

| 操作 | 积分 | 说明 |
|:---|:---:|:---|
| **新用户注册** | `+1000` | 永久积分 (需邀请码) |
| **邀请新用户** | `+500` | 永久积分 (每成功邀请一人) |
| **每日签到** | `+500` | 每日积分 (每日刷新) |
| **生成图片** | `-100` | 标准生成消耗 |
| **高清放大** | `-50` | 高清修复消耗 |

> 💡 **智能扣费**: 优先消耗每日积分，不足时扣除永久积分。

---

## 📁 项目结构

```
DESIGN-INFINITE/
├── App.tsx                 # 主入口
├── components/             # React 组件 (认证, 管理后台, 落地页)
├── services/               # 前端 API 服务
├── server/                 # 后端服务 (Express)
│   ├── routes/             # API 路由
│   ├── services/           # 核心逻辑 (Gemini, Vertex AI, 邮件)
│   └── middleware/         # 认证与限流
└── .agent/workflows/       # 自动化工作流
```

---

## 📖 部署

使用我们的智能代理工作流进行定制部署:

```bash
# 查看部署指南
cat .agent/workflows/deploy.md
```

详细文档请参阅 [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

---

<div align="center">

**MIT License**

Made with ❤️ by [Wu Wei](https://github.com/Vieeeeeee)

</div>
