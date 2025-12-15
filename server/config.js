import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isProd = process.env.NODE_ENV === 'production';

// 验证 JWT Secret 安全性
const jwtSecret = process.env.JWT_SECRET || 'default-secret-change-me';
if (jwtSecret === 'default-secret-change-me') {
    if (isProd) {
        console.error('❌ 生产环境必须设置 JWT_SECRET 环境变量！');
        process.exit(1);
    } else {
        console.warn('⚠️  警告: 使用默认 JWT_SECRET，请在 .env 文件中设置安全的密钥');
    }
}

export default {
    // JWT
    jwtSecret,
    jwtExpiresIn: '7d',

    // SMTP
    smtp: {
        host: process.env.SMTP_HOST || 'smtp.qq.com',
        port: parseInt(process.env.SMTP_PORT || '465'),
        secure: parseInt(process.env.SMTP_PORT || '465') === 465, // 465用SSL, 587用STARTTLS
        auth: {
            user: process.env.SMTP_USER || '',
            pass: process.env.SMTP_PASS || '',
        },
    },

    // 应用配置
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',

    // 积分系统配置 (参见 README.md 积分系统规则)
    inviteRewardPoints: parseInt(process.env.INVITE_REWARD_POINTS || '500'),  // 邀请一人获得积分
    inviteCodesPerUser: parseInt(process.env.INVITE_CODES_PER_USER || '10'),  // 每用户邀请码数量
    dailyLoginPoints: parseInt(process.env.DAILY_LOGIN_POINTS || '500'),      // 每日签到积分
    newUserPoints: parseInt(process.env.NEW_USER_POINTS || '1000'),           // 新用户注册积分
    consumePerGenerate: parseInt(process.env.CONSUME_PER_GENERATE || '100'),  // 生成一次消耗
    consumePerUpscale: parseInt(process.env.CONSUME_PER_UPSCALE || '50'),     // 放大一次消耗

    // 验证码配置
    verificationCodeExpireMinutes: 10,

    // 静态资源配置
    generatedDir: process.env.GENERATED_DIR || (isProd ? '/www/generator/runtime/generated' : path.join(__dirname, '../generated')),

    // 图片 URL 前缀
    staticUrlBase: process.env.STATIC_URL_BASE || 'http://localhost:3001/generated',
};
