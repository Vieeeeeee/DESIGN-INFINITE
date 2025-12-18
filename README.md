<div align="center">

<img src="public/favicon.svg" width="120" height="120" alt="Design Infinite Logo">

# DESIGN INFINITE

**AI-Driven Interior Design Reference Generator**

[![GitHub](https://img.shields.io/badge/GitHub-Vieeeeeee-181717?style=flat-square&logo=github)](https://github.com/Vieeeeeee/DESIGN-INFINITE)
[![License](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)

**English** | [简体中文](./README_zh-CN.md)

</div>

---

## ✨ Features

<div align="center">

| 🎨 **AI Generation** | 📐 **Multi-Space** | 🔍 **Upscaling** |
|:---:|:---:|:---:|
| Google Vertex AI (Gemini) <br> High-Quality Renders | Home & Commercial Spaces <br> Customized Scenes | One-Click Enhancement <br> 4x Detail Restoration |

| 🎁 **Points System** | 👥 **Referrals** | 🗃️ **Collections** |
|:---:|:---:|:---:|
| Daily Rewards <br> Sustainable Economy | User Growth engine <br> Bonus Credits | Inspiration Library <br> Organized Assets |

</div>

---

## 🛠️ Stack

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

## 🚀 Quick Start

### Prerequisites
- Node.js v18+
- npm / yarn

### Local Development

```bash
# 1. Clone Repository
git clone https://github.com/Vieeeeeee/DESIGN-INFINITE.git
cd DESIGN-INFINITE

# 2. Install Dependencies
npm install
cd server && npm install && cd ..

# 3. Environment Setup
cp .env.example .env.local
cp server/.env.example server/.env
# Edit .env.local and server/.env with your credentials

# 4. Start Backend
cd server && npm start

# 5. Start Frontend (New Terminal)
npm run dev

# 6. Open App
open http://localhost:3000
```

---

## 💎 Points System

| Action | Points | Description |
|:---|:---:|:---|
| **New User** | `+1000` | Permanent points via invitation code |
| **Referral** | `+500` | Permanent points per successful invite |
| **Daily Check-in** | `+500` | Daily refreshable points |
| **Generate Image** | `-100` | Standard generation cost |
| **Upscale** | `-50` | High-res enhancement cost |

> 💡 **Smart Consumption**: Daily points are consumed first. Permanent points are used only when daily points are exhausted.

---

## 📁 Project Structure

```
DESIGN-INFINITE/
├── App.tsx                 # Main Entry
├── components/             # React Components (Auth, Admin, Landing)
├── services/               # Frontend API Services
├── server/                 # Backend (Express)
│   ├── routes/             # API Routes
│   ├── services/           # Core Logic (Gemini, Vertex AI, Email)
│   └── middleware/         # Auth & Rate Limiting
└── .agent/workflows/       # Automation Workflows
```

---

## 📖 Deployment

Start a tailored deployment using our agentic workflows:

```bash
# View deployment guide
cat .agent/workflows/deploy.md
```

Detailed documentation available in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

---

<div align="center">

**MIT License**

Made with ❤️ by [Wu Wei](https://github.com/Vieeeeeee)

</div>
