import jwt from 'jsonwebtoken';
import config from '../config.js';
import db from '../database.js';

/**
 * JWT 认证中间件
 * 验证请求头中的 Bearer Token
 */
export function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: '未提供认证令牌' });
    }

    const token = authHeader.substring(7);

    try {
        const decoded = jwt.verify(token, config.jwtSecret);

        // 查询用户是否存在
        const user = db.prepare('SELECT id, email, points FROM users WHERE id = ?').get(decoded.userId);

        if (!user) {
            return res.status(401).json({ error: '用户不存在' });
        }

        req.user = user;
        next();
    } catch (error) {
        return res.status(401).json({ error: '无效的认证令牌' });
    }
}

/**
 * 生成 JWT Token
 * @param {number} userId 用户 ID
 * @returns {string} JWT Token
 */
export function generateToken(userId) {
    return jwt.sign({ userId }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
}
