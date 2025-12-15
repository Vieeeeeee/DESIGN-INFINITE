import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import db from '../database.js';
import config from '../config.js';

const router = Router();

// ============================================================================
// GET /api/user/profile - 获取当前用户信息
// 自动刷新每日积分：如果是新的一天，自动重置为 500 积分
// ============================================================================
router.get('/profile', authMiddleware, (req, res) => {
    const DAILY_POINTS = config.dailyLoginPoints || 500;
    const today = new Date().toISOString().split('T')[0];

    let user = db.prepare(`
    SELECT id, email, points, daily_points, daily_points_date, created_at, invited_by
    FROM users WHERE id = ?
  `).get(req.user.id);

    if (!user) {
        return res.status(404).json({ error: '用户不存在' });
    }

    // 自动刷新每日积分：如果日期不是今天，自动重置为 500
    let dailyPoints = user.daily_points || 0;
    let dailyRefreshed = false;

    if (user.daily_points_date !== today) {
        dailyPoints = DAILY_POINTS;
        dailyRefreshed = true;
        db.prepare('UPDATE users SET daily_points = ?, daily_points_date = ? WHERE id = ?')
            .run(DAILY_POINTS, today, user.id);

        // 记录积分日志
        db.prepare(`
            INSERT INTO points_log (user_id, points, reason, created_at)
            VALUES (?, ?, ?, datetime('now'))
        `).run(user.id, DAILY_POINTS, '每日积分自动发放');
    }

    // 获取邀请人信息
    let inviter = null;
    if (user.invited_by) {
        inviter = db.prepare('SELECT id, email FROM users WHERE id = ?').get(user.invited_by);
    }

    // 获取邀请统计
    const inviteStats = db.prepare(`
    SELECT COUNT(*) as count FROM invite_codes 
    WHERE owner_id = ? AND used_by IS NOT NULL
  `).get(req.user.id);

    res.json({
        user: {
            id: user.id,
            email: user.email,
            points: user.points,           // 永久积分
            dailyPoints: dailyPoints,      // 每日积分（当天有效）
            totalPoints: user.points + dailyPoints, // 总可用积分
            hasCheckedInToday: true,       // 每日积分自动发放，始终为 true
            createdAt: user.created_at,
            inviter: inviter ? { id: inviter.id, email: inviter.email } : null,
        },
        stats: {
            invitedCount: inviteStats.count,
        },
        dailyRefreshed, // 标识是否刚刚刷新了每日积分
    });
});

// ============================================================================
// POST /api/user/check-in - 每日签到领取积分
// ============================================================================
router.post('/check-in', authMiddleware, (req, res) => {
    const userId = req.user.id;
    const today = new Date().toISOString().split('T')[0];
    const DAILY_POINTS = config.dailyLoginPoints || 500;

    // 获取当前用户
    const user = db.prepare('SELECT daily_points_date, points, daily_points FROM users WHERE id = ?').get(userId);
    if (!user) {
        return res.status(404).json({ error: '用户不存在' });
    }

    // 检查今天是否已签到
    if (user.daily_points_date === today) {
        return res.status(400).json({
            error: '今日已签到',
            dailyPoints: user.daily_points,
            hasCheckedInToday: true
        });
    }

    // 签到：重置每日积分为 500（不累积昨天的）
    db.prepare('UPDATE users SET daily_points = ?, daily_points_date = ? WHERE id = ?')
        .run(DAILY_POINTS, today, userId);

    // 记录积分日志
    db.prepare(`
        INSERT INTO points_log (user_id, points, reason, created_at)
        VALUES (?, ?, ?, datetime('now'))
    `).run(userId, DAILY_POINTS, '每日签到奖励');

    res.json({
        success: true,
        message: `签到成功！获得 ${DAILY_POINTS} 每日积分`,
        dailyPoints: DAILY_POINTS,
        totalPoints: user.points + DAILY_POINTS,
        hasCheckedInToday: true
    });
});

// ============================================================================
// GET /api/user/points-log - 获取积分记录
// ============================================================================
router.get('/points-log', authMiddleware, (req, res) => {
    const logs = db.prepare(`
    SELECT * FROM points_log 
    WHERE user_id = ? 
    ORDER BY created_at DESC 
    LIMIT 50
  `).all(req.user.id);

    res.json({ logs });
});

// ============================================================================
// POST /api/user/consume-points - 消耗积分 (生成/放大)
// 规则: 优先扣每日积分，不足时扣永久积分
// ============================================================================
router.post('/consume-points', authMiddleware, (req, res) => {
    const { amount = 100, action = 'generate' } = req.body;
    const userId = req.user.id;
    const today = new Date().toISOString().split('T')[0];

    // 验证 amount 参数
    if (typeof amount !== 'number' || amount <= 0 || amount > 10000) {
        return res.status(400).json({ error: '无效的积分数量' });
    }

    try {
        // 获取当前用户积分
        const user = db.prepare('SELECT points, daily_points, daily_points_date FROM users WHERE id = ?').get(userId);
        if (!user) {
            return res.status(404).json({ error: '用户不存在' });
        }

        // 计算当日可用积分（如果日期不是今天则为0）
        const dailyAvailable = user.daily_points_date === today ? (user.daily_points || 0) : 0;
        const permanentPoints = user.points || 0;
        const totalAvailable = dailyAvailable + permanentPoints;

        // 检查总积分是否足够
        if (totalAvailable < amount) {
            return res.status(400).json({
                error: '积分不足',
                currentPoints: permanentPoints,
                dailyPoints: dailyAvailable,
                totalPoints: totalAvailable,
                required: amount
            });
        }

        // 计算扣费分配：优先扣每日积分
        let remaining = amount;
        let dailyDeduct = Math.min(dailyAvailable, remaining);
        remaining -= dailyDeduct;
        let permanentDeduct = remaining;

        // 更新积分
        const newDailyPoints = dailyAvailable - dailyDeduct;
        const newPermanentPoints = permanentPoints - permanentDeduct;

        db.prepare('UPDATE users SET points = ?, daily_points = ? WHERE id = ?')
            .run(newPermanentPoints, newDailyPoints, userId);

        // 记录积分日志
        const actionLabels = {
            generate: '生成图片',
            upscale: '高清放大',
        };

        // 记录消耗明细
        let description = actionLabels[action] || action;
        if (dailyDeduct > 0 && permanentDeduct > 0) {
            description += ` (每日${dailyDeduct}+永久${permanentDeduct})`;
        } else if (dailyDeduct > 0) {
            description += ' (每日积分)';
        } else {
            description += ' (永久积分)';
        }

        db.prepare(`
            INSERT INTO points_log (user_id, points, reason, created_at)
            VALUES (?, ?, ?, datetime('now'))
        `).run(userId, -amount, description);

        res.json({
            success: true,
            newPoints: newPermanentPoints,
            newDailyPoints: newDailyPoints,
            totalPoints: newPermanentPoints + newDailyPoints,
            consumed: amount,
            action,
            breakdown: {
                fromDaily: dailyDeduct,
                fromPermanent: permanentDeduct
            }
        });
    } catch (error) {
        console.error('积分消耗失败:', error);
        res.status(500).json({ error: '积分消耗失败，请重试' });
    }
});

// ============================================================================
// GET /api/user/check-points - 检查积分是否足够（不扣费）
// ============================================================================
router.get('/check-points', authMiddleware, (req, res) => {
    const amount = parseInt(req.query.amount) || 100;
    const userId = req.user.id;
    const today = new Date().toISOString().split('T')[0];

    const user = db.prepare('SELECT points, daily_points, daily_points_date FROM users WHERE id = ?').get(userId);
    if (!user) {
        return res.status(404).json({ error: '用户不存在' });
    }

    const dailyAvailable = user.daily_points_date === today ? (user.daily_points || 0) : 0;
    const permanentPoints = user.points || 0;
    const totalAvailable = dailyAvailable + permanentPoints;
    const sufficient = totalAvailable >= amount;

    res.json({
        sufficient,
        totalPoints: totalAvailable,
        permanentPoints,
        dailyPoints: dailyAvailable,
        required: amount,
        shortage: sufficient ? 0 : amount - totalAvailable
    });
});

export default router;
