import express from 'express';
import cors from 'cors';
import path from 'path';
import config from './config.js';
import { initDatabase } from './database.js';
import { testEmailConnection } from './services/email.js';
import { startCronJobs } from './services/cron.js';

// 路由
import authRoutes from './routes/auth.js';
import userRoutes from './routes/user.js';
import inviteRoutes from './routes/invite.js';
import adminRoutes from './routes/admin.js';
import geminiRoutes from './routes/gemini.js';

const app = express();
const PORT = process.env.PORT || 3001;

// ============================================================================
// 中间件
// ============================================================================
// 允许多个本地开发端口和生产域名
const allowedOrigins = [
    // 本地开发
    'http://localhost:3000',
    'http://localhost:3002',
    'http://localhost:5173',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3002',
    'http://127.0.0.1:5173',
    // 生产环境
    'https://www.abdc.online',
    'https://abdc.online',
    config.frontendUrl,
].filter(Boolean);

app.use(cors({
    origin: function (origin, callback) {
        // 允许无 origin 的请求（如 curl）
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        return callback(null, false);
    },
    credentials: true,
}));

app.use(express.json({ limit: '50mb' }));

// 请求日志
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} ${req.path}`);
    next();
});

// ============================================================================
// 路由挂载
// ============================================================================
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/invite', inviteRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', geminiRoutes);

// 本地开发: 静态文件服务 (生产环境由 Nginx 处理)
const STATIC_DIR = process.env.STATIC_DIR || '/www/generator/runtime/generated';
if (STATIC_DIR.startsWith('./') || STATIC_DIR.startsWith('../')) {
    const absoluteStaticDir = path.resolve(process.cwd(), STATIC_DIR);
    app.use('/generated', express.static(absoluteStaticDir, {
        setHeaders: (res) => {
            res.setHeader('Access-Control-Allow-Origin', '*');
        }
    }));
    console.log(`📁 本地静态文件服务: /generated -> ${absoluteStaticDir}`);
}

// 健康检查
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ============================================================================
// 错误处理
// ============================================================================
app.use((err, req, res, next) => {
    console.error('服务器错误:', err);
    res.status(500).json({ error: '服务器内部错误' });
});

// 404 处理
app.use((req, res) => {
    res.status(404).json({ error: '接口不存在' });
});

// ============================================================================
// 启动服务器
// ============================================================================
async function startServer() {
    // 初始化数据库
    await initDatabase();

    // 启动定时任务
    startCronJobs();

    app.listen(PORT, async () => {
        console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🚀 设计参考生成器 API 服务器                              ║
║                                                           ║
║   端口: ${PORT}                                              ║
║   前端: ${config.frontendUrl}                          ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
    `);

        // 测试邮件连接
        if (config.smtp.auth.user) {
            await testEmailConnection();
        } else {
            console.log('⚠️  未配置邮件服务，请在 .env 中配置 SMTP 信息');
        }
    });
}

startServer().catch(console.error);
