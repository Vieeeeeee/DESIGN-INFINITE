import { Router } from 'express';
import bcrypt from 'bcrypt';
import db from '../database.js';
import config from '../config.js';
import { generateToken } from '../middleware/auth.js';
import { sendVerificationEmail } from '../services/email.js';
import {
    generateVerificationCode,
    generateInviteCode,
    getCodeExpireTime,
    isValidEmail,
    validatePassword,
} from '../utils/helpers.js';

const router = Router();

// ============================================================================
// POST /api/auth/send-code - 发送验证码
// ============================================================================
router.post('/send-code', async (req, res) => {
    try {
        const { email, type = 'register' } = req.body;

        if (!email || !isValidEmail(email)) {
            return res.status(400).json({ error: '请输入有效的邮箱地址' });
        }

        // 检查是否频繁发送（1 分钟内只能发一次）
        const recentCode = db.prepare(`
      SELECT * FROM verification_codes 
      WHERE email = ? AND type = ? AND created_at > datetime('now', '-1 minutes')
      ORDER BY created_at DESC LIMIT 1
    `).get(email, type);

        if (recentCode) {
            return res.status(429).json({ error: '请稍后再试，验证码发送太频繁' });
        }

        // 注册时检查邮箱是否已存在
        if (type === 'register') {
            const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
            if (existingUser) {
                return res.status(400).json({ error: '该邮箱已被注册' });
            }
        }

        // 重置密码时检查邮箱是否存在
        if (type === 'reset_password') {
            const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
            if (!existingUser) {
                return res.status(400).json({ error: '该邮箱未注册' });
            }
        }

        // 生成验证码
        const code = generateVerificationCode();
        const expiresAt = getCodeExpireTime();

        // 保存验证码
        db.prepare(`
      INSERT INTO verification_codes (email, code, type, expires_at)
      VALUES (?, ?, ?, ?)
    `).run(email, code, type, expiresAt);

        // 发送邮件
        await sendVerificationEmail(email, code, type);

        res.json({ message: '验证码已发送，请查收邮件' });
    } catch (error) {
        console.error('发送验证码失败:', error);
        res.status(500).json({ error: '发送验证码失败，请稍后再试' });
    }
});

// ============================================================================
// POST /api/auth/register - 用户注册
// ============================================================================
// ============================================================================
// POST /api/auth/register - 用户注册
// ============================================================================
router.post('/register', async (req, res) => {
    try {
        const { email, password, verificationCode, inviteCode } = req.body;

        // 参数验证
        if (!email || !isValidEmail(email)) {
            return res.status(400).json({ error: '请输入有效的邮箱地址' });
        }

        const passwordValidation = validatePassword(password);
        if (!passwordValidation.valid) {
            return res.status(400).json({ error: passwordValidation.message });
        }

        if (!verificationCode) {
            return res.status(400).json({ error: '请输入验证码' });
        }

        if (!inviteCode) {
            return res.status(400).json({ error: '请输入邀请码' });
        }

        // 使用事务处理注册流程，防止竞争条件
        const registerTransaction = db.transaction(async () => {
            // 1. 验证邮箱验证码
            const validCode = db.prepare(`
                SELECT * FROM verification_codes 
                WHERE email = ? AND code = ? AND type = 'register' 
                AND used = 0 AND expires_at > datetime('now')
                ORDER BY created_at DESC LIMIT 1
            `).get(email, verificationCode);

            if (!validCode) {
                throw new Error('验证码无效或已过期');
            }

            // 2. 检查邮箱是否已存在
            const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
            if (existingUser) {
                throw new Error('该邮箱已被注册');
            }

            // 3. 验证并锁定邀请码 (原子操作，防止并发使用)
            const invite = db.prepare(`
                SELECT * FROM invite_codes WHERE code = ? AND used_by IS NULL
            `).get(inviteCode.toUpperCase());

            if (!invite) {
                throw new Error('邀请码无效或已被使用');
            }

            // 4. 创建用户
            const passwordHash = await bcrypt.hash(password, 10);
            const initialPoints = 1000;
            const result = db.prepare(`
                INSERT INTO users (email, password_hash, invited_by, points, login_count)
                VALUES (?, ?, ?, ?, 1)
            `).run(email, passwordHash, invite.owner_id, initialPoints);

            const newUserId = result.lastInsertRowid;

            // 5. 标记验证码已使用
            db.prepare('UPDATE verification_codes SET used = 1 WHERE id = ?').run(validCode.id);

            // 6. 标记邀请码已使用 (再次确保原子性，虽然 SELECT FOR UPDATE 不支持，但在同一事务中通常安全)
            // 注意：SQLite 默认事务是 SERIALIZABLE，所以这里的 SELECT -> UPDATE 是安全的
            const updateInvite = db.prepare(`
                UPDATE invite_codes 
                SET used_by = ?, used_at = datetime('now') 
                WHERE id = ? AND used_by IS NULL
            `).run(newUserId, invite.id);

            if (updateInvite.changes === 0) {
                throw new Error('邀请码已被使用');
            }

            // 7. 给邀请人增加积分
            db.prepare('UPDATE users SET points = points + ? WHERE id = ?')
                .run(config.inviteRewardPoints, invite.owner_id);

            // 8. 记录积分变动
            db.prepare(`
                INSERT INTO points_log (user_id, points, reason)
                VALUES (?, ?, ?)
            `).run(invite.owner_id, config.inviteRewardPoints, `邀请用户 ${email} 注册`);

            // 9. 为新用户生成邀请码
            const inviteCodes = [];
            for (let i = 0; i < config.inviteCodesPerUser; i++) {
                let code;
                let attempts = 0;
                do {
                    code = generateInviteCode();
                    attempts++;
                } while (
                    db.prepare('SELECT id FROM invite_codes WHERE code = ?').get(code) &&
                    attempts < 10
                );

                if (attempts < 10) {
                    db.prepare('INSERT INTO invite_codes (code, owner_id) VALUES (?, ?)').run(code, newUserId);
                    inviteCodes.push(code);
                }
            }

            return {
                newUserId,
                inviteCodes,
                initialPoints
            };
        });

        // 执行事务
        const { newUserId, inviteCodes, initialPoints } = await registerTransaction();

        // 生成 Token
        const token = generateToken(newUserId);

        res.json({
            message: '注册成功',
            token,
            user: {
                id: newUserId,
                email,
                points: initialPoints,
            },
            inviteCodes,
        });

    } catch (error) {
        console.error('注册失败:', error);
        const errorMessage = error.message || '注册失败，请稍后再试';
        // 如果是已知的业务错误，返回 400
        if (['验证码无效或已过期', '该邮箱已被注册', '邀请码无效或已被使用', '邀请码已被使用'].includes(errorMessage)) {
            return res.status(400).json({ error: errorMessage });
        }
        res.status(500).json({ error: '注册失败，请稍后再试' });
    }
});

// ============================================================================
// POST /api/auth/login - 用户登录
// ============================================================================
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: '请输入邮箱和密码' });
        }

        // 查询用户
        const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

        if (!user) {
            return res.status(400).json({ error: '邮箱或密码错误' });
        }

        // 验证密码
        const validPassword = await bcrypt.compare(password, user.password_hash);

        if (!validPassword) {
            return res.status(400).json({ error: '邮箱或密码错误' });
        }

        // 更新登录次数 (login_count + 1)
        db.prepare('UPDATE users SET login_count = COALESCE(login_count, 0) + 1 WHERE id = ?').run(user.id);

        // 每日登录积分 (每天重置为 500，不累积)
        const DAILY_LOGIN_POINTS = 500;
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

        let dailyPoints = user.daily_points || 0;
        let isNewDay = user.daily_points_date !== today;

        if (isNewDay) {
            // 新的一天，重置每日积分为 500
            dailyPoints = DAILY_LOGIN_POINTS;
            db.prepare('UPDATE users SET daily_points = ?, daily_points_date = ? WHERE id = ?')
                .run(DAILY_LOGIN_POINTS, today, user.id);
        }

        // 生成 Token
        const token = generateToken(user.id);

        res.json({
            message: isNewDay ? `登录成功！今日可用积分已刷新为 ${DAILY_LOGIN_POINTS}` : '登录成功',
            token,
            user: {
                id: user.id,
                email: user.email,
                points: user.points,         // 永久积分（邀请、注册获得）
                dailyPoints: dailyPoints,    // 每日积分（每天重置为500）
            },
            dailyRefreshed: isNewDay,
        });
    } catch (error) {
        console.error('登录失败:', error);
        res.status(500).json({ error: '登录失败，请稍后再试' });
    }
});

// ============================================================================
// POST /api/auth/reset-password - 重置密码
// ============================================================================
router.post('/reset-password', async (req, res) => {
    try {
        const { email, password, verificationCode } = req.body;

        // 参数验证
        if (!email || !isValidEmail(email)) {
            return res.status(400).json({ error: '请输入有效的邮箱地址' });
        }

        const passwordValidation = validatePassword(password);
        if (!passwordValidation.valid) {
            return res.status(400).json({ error: passwordValidation.message });
        }

        if (!verificationCode) {
            return res.status(400).json({ error: '请输入验证码' });
        }

        // 验证邮箱验证码
        const validCode = db.prepare(`
      SELECT * FROM verification_codes 
      WHERE email = ? AND code = ? AND type = 'reset_password' 
        AND used = 0 AND expires_at > datetime('now')
      ORDER BY created_at DESC LIMIT 1
    `).get(email, verificationCode);

        if (!validCode) {
            return res.status(400).json({ error: '验证码无效或已过期' });
        }

        // 查找用户
        const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
        if (!user) {
            return res.status(400).json({ error: '该邮箱未注册' });
        }

        // 更新密码
        const passwordHash = await bcrypt.hash(password, 10);
        db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, user.id);

        // 标记验证码已使用
        db.prepare('UPDATE verification_codes SET used = 1 WHERE id = ?').run(validCode.id);

        res.json({ message: '密码重置成功，请使用新密码登录' });
    } catch (error) {
        console.error('重置密码失败:', error);
        res.status(500).json({ error: '重置密码失败，请稍后再试' });
    }
});

// ============================================================================
// POST /api/auth/init-admin - 初始化管理员（仅在无用户时可用）
// ============================================================================
router.post('/init-admin', async (req, res) => {
    try {
        // 检查是否已有用户
        const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
        if (userCount.count > 0) {
            return res.status(403).json({ error: '系统已初始化，无法创建管理员' });
        }

        const { email, password } = req.body;

        if (!email || !isValidEmail(email)) {
            return res.status(400).json({ error: '请输入有效的邮箱地址' });
        }

        const passwordValidation = validatePassword(password);
        if (!passwordValidation.valid) {
            return res.status(400).json({ error: passwordValidation.message });
        }

        // 创建管理员用户
        const passwordHash = await bcrypt.hash(password, 10);
        const result = db.prepare(`
      INSERT INTO users (email, password_hash, points)
      VALUES (?, ?, ?)
    `).run(email, passwordHash, 1000); // 给管理员一些初始积分

        const newUserId = result.lastInsertRowid;

        // 为管理员生成邀请码
        const inviteCodes = [];
        for (let i = 0; i < config.inviteCodesPerUser; i++) {
            let code;
            let attempts = 0;
            do {
                code = generateInviteCode();
                attempts++;
            } while (
                db.prepare('SELECT id FROM invite_codes WHERE code = ?').get(code) &&
                attempts < 10
            );

            if (attempts < 10) {
                db.prepare('INSERT INTO invite_codes (code, owner_id) VALUES (?, ?)').run(code, newUserId);
                inviteCodes.push(code);
            }
        }

        // 生成 Token
        const token = generateToken(newUserId);

        res.json({
            message: '管理员初始化成功',
            token,
            user: {
                id: newUserId,
                email,
                points: 1000,
            },
            inviteCodes,
        });
    } catch (error) {
        console.error('初始化管理员失败:', error);
        res.status(500).json({ error: '初始化失败，请稍后再试' });
    }
});

// ============================================================================
// GET /api/auth/check-init - 检查系统是否需要初始化
// ============================================================================
router.get('/check-init', (req, res) => {
    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
    res.json({ needsInit: userCount.count === 0 });
});

export default router;
