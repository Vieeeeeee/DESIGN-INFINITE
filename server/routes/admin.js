import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import db from '../database.js';
import config from '../config.js';

const router = Router();

// ============================================================================
// 管理员邮箱白名单 (从环境变量读取，逗号分隔)
// ============================================================================
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '869116322@qq.com').split(',').map(e => e.trim().toLowerCase());

/**
 * 管理员认证中间件
 * 检查用户是否在管理员白名单中
 */
function adminMiddleware(req, res, next) {
    if (!req.user || !req.user.email) {
        return res.status(401).json({ error: '未登录' });
    }

    const userEmail = req.user.email.toLowerCase();
    if (!ADMIN_EMAILS.includes(userEmail)) {
        return res.status(403).json({ error: '无管理员权限' });
    }

    next();
}

// ============================================================================
// GET /api/admin/stats - 获取总体统计数据
// ============================================================================
router.get('/stats', authMiddleware, adminMiddleware, (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        // 用户统计
        const userTotal = db.prepare('SELECT COUNT(*) as count FROM users WHERE email != ?').get('system@internal');
        const userToday = db.prepare(`SELECT COUNT(*) as count FROM users WHERE date(created_at) = ? AND email != ?`).get(today, 'system@internal');
        const userThisWeek = db.prepare(`SELECT COUNT(*) as count FROM users WHERE date(created_at) >= ? AND email != ?`).get(weekAgo, 'system@internal');
        const userThisMonth = db.prepare(`SELECT COUNT(*) as count FROM users WHERE date(created_at) >= ? AND email != ?`).get(monthAgo, 'system@internal');

        // 操作统计 - 生成 (从 points_log 表中提取)
        const generateTotal = db.prepare(`SELECT COUNT(*) as count FROM points_log WHERE reason LIKE '%生成图片%'`).get();
        const generateToday = db.prepare(`SELECT COUNT(*) as count FROM points_log WHERE reason LIKE '%生成图片%' AND date(created_at) = ?`).get(today);
        const generateThisWeek = db.prepare(`SELECT COUNT(*) as count FROM points_log WHERE reason LIKE '%生成图片%' AND date(created_at) >= ?`).get(weekAgo);
        const generateThisMonth = db.prepare(`SELECT COUNT(*) as count FROM points_log WHERE reason LIKE '%生成图片%' AND date(created_at) >= ?`).get(monthAgo);

        // 操作统计 - 放大
        const upscaleTotal = db.prepare(`SELECT COUNT(*) as count FROM points_log WHERE reason LIKE '%高清放大%'`).get();
        const upscaleToday = db.prepare(`SELECT COUNT(*) as count FROM points_log WHERE reason LIKE '%高清放大%' AND date(created_at) = ?`).get(today);
        const upscaleThisWeek = db.prepare(`SELECT COUNT(*) as count FROM points_log WHERE reason LIKE '%高清放大%' AND date(created_at) >= ?`).get(weekAgo);
        const upscaleThisMonth = db.prepare(`SELECT COUNT(*) as count FROM points_log WHERE reason LIKE '%高清放大%' AND date(created_at) >= ?`).get(monthAgo);

        // 签到统计 (从 points_log 提取)
        const checkInTotal = db.prepare(`SELECT COUNT(*) as count FROM points_log WHERE reason LIKE '%签到%'`).get();
        const checkInToday = db.prepare(`SELECT COUNT(*) as count FROM points_log WHERE reason LIKE '%签到%' AND date(created_at) = ?`).get(today);
        const checkInThisWeek = db.prepare(`SELECT COUNT(*) as count FROM points_log WHERE reason LIKE '%签到%' AND date(created_at) >= ?`).get(weekAgo);

        // 积分统计
        const pointsEarned = db.prepare(`SELECT COALESCE(SUM(points), 0) as total FROM points_log WHERE points > 0`).get();
        const pointsConsumed = db.prepare(`SELECT COALESCE(ABS(SUM(points)), 0) as total FROM points_log WHERE points < 0`).get();
        const pointsEarnedToday = db.prepare(`SELECT COALESCE(SUM(points), 0) as total FROM points_log WHERE points > 0 AND date(created_at) = ?`).get(today);
        const pointsConsumedToday = db.prepare(`SELECT COALESCE(ABS(SUM(points)), 0) as total FROM points_log WHERE points < 0 AND date(created_at) = ?`).get(today);

        // 邀请统计
        const invitesUsed = db.prepare(`SELECT COUNT(*) as count FROM invite_codes WHERE used_by IS NOT NULL`).get();
        const invitesTotal = db.prepare(`SELECT COUNT(*) as count FROM invite_codes`).get();
        const invitesToday = db.prepare(`SELECT COUNT(*) as count FROM invite_codes WHERE used_by IS NOT NULL AND date(used_at) = ?`).get(today);
        const invitesThisWeek = db.prepare(`SELECT COUNT(*) as count FROM invite_codes WHERE used_by IS NOT NULL AND date(used_at) >= ?`).get(weekAgo);

        // 活跃用户统计 (今天有操作记录的用户数)
        const activeUsersToday = db.prepare(`SELECT COUNT(DISTINCT user_id) as count FROM points_log WHERE date(created_at) = ?`).get(today);
        const activeUsersThisWeek = db.prepare(`SELECT COUNT(DISTINCT user_id) as count FROM points_log WHERE date(created_at) >= ?`).get(weekAgo);
        const activeUsersThisMonth = db.prepare(`SELECT COUNT(DISTINCT user_id) as count FROM points_log WHERE date(created_at) >= ?`).get(monthAgo);

        res.json({
            users: {
                total: userTotal?.count || 0,
                today: userToday?.count || 0,
                thisWeek: userThisWeek?.count || 0,
                thisMonth: userThisMonth?.count || 0,
            },
            activeUsers: {
                today: activeUsersToday?.count || 0,
                thisWeek: activeUsersThisWeek?.count || 0,
                thisMonth: activeUsersThisMonth?.count || 0,
            },
            generate: {
                total: generateTotal?.count || 0,
                today: generateToday?.count || 0,
                thisWeek: generateThisWeek?.count || 0,
                thisMonth: generateThisMonth?.count || 0,
            },
            upscale: {
                total: upscaleTotal?.count || 0,
                today: upscaleToday?.count || 0,
                thisWeek: upscaleThisWeek?.count || 0,
                thisMonth: upscaleThisMonth?.count || 0,
            },
            checkIn: {
                total: checkInTotal?.count || 0,
                today: checkInToday?.count || 0,
                thisWeek: checkInThisWeek?.count || 0,
            },
            points: {
                totalEarned: pointsEarned?.total || 0,
                totalConsumed: pointsConsumed?.total || 0,
                earnedToday: pointsEarnedToday?.total || 0,
                consumedToday: pointsConsumedToday?.total || 0,
            },
            invites: {
                used: invitesUsed?.count || 0,
                total: invitesTotal?.count || 0,
                today: invitesToday?.count || 0,
                thisWeek: invitesThisWeek?.count || 0,
                successRate: invitesTotal?.count > 0
                    ? Math.round((invitesUsed?.count / invitesTotal?.count) * 100)
                    : 0,
            },
        });
    } catch (error) {
        console.error('获取统计数据失败:', error);
        res.status(500).json({ error: '获取统计数据失败' });
    }
});

// ============================================================================
// GET /api/admin/growth - 获取用户增长数据 (过去30天)
// ============================================================================
router.get('/growth', authMiddleware, adminMiddleware, (req, res) => {
    try {
        const days = parseInt(req.query.days) || 30;

        // 生成过去N天的日期数组
        const dates = [];
        for (let i = days - 1; i >= 0; i--) {
            const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
            dates.push(date.toISOString().split('T')[0]);
        }

        // 获取每日注册数
        const growthData = dates.map(date => {
            const count = db.prepare(`
                SELECT COUNT(*) as count FROM users 
                WHERE date(created_at) = ? AND email != 'system@internal'
            `).get(date);
            return {
                date,
                count: count?.count || 0,
            };
        });

        // 计算总增长和日均
        const totalGrowth = growthData.reduce((sum, d) => sum + d.count, 0);
        const avgDaily = Math.round(totalGrowth / days * 10) / 10;

        res.json({
            data: growthData,
            summary: {
                total: totalGrowth,
                avgDaily,
                maxDay: Math.max(...growthData.map(d => d.count)),
            },
        });
    } catch (error) {
        console.error('获取增长数据失败:', error);
        res.status(500).json({ error: '获取增长数据失败' });
    }
});

// ============================================================================
// GET /api/admin/users - 获取用户列表 (分页)
// ============================================================================
router.get('/users', authMiddleware, adminMiddleware, (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
        const search = req.query.search || '';
        const offset = (page - 1) * limit;

        // 构建查询条件
        let whereClause = "WHERE u.email != 'system@internal'";
        const params = [];

        if (search) {
            whereClause += " AND u.email LIKE ?";
            params.push(`%${search}%`);
        }

        // 获取总数
        const totalResult = db.prepare(`SELECT COUNT(*) as count FROM users WHERE email != 'system@internal'${search ? ' AND email LIKE ?' : ''}`).get(...(search ? [`%${search}%`] : []));
        const total = totalResult?.count || 0;

        console.log('[Admin] Fetching users, total:', total, 'page:', page, 'limit:', limit);

        // 获取用户列表 - 简化查询，不使用JOIN
        let users;
        if (search) {
            users = db.prepare(`
                SELECT id, email, points, daily_points, daily_points_date, created_at, invited_by
                FROM users 
                WHERE email != 'system@internal' AND email LIKE ?
                ORDER BY created_at DESC
                LIMIT ? OFFSET ?
            `).all(`%${search}%`, limit, offset);
        } else {
            users = db.prepare(`
                SELECT id, email, points, daily_points, daily_points_date, created_at, invited_by
                FROM users 
                WHERE email != 'system@internal'
                ORDER BY created_at DESC
                LIMIT ? OFFSET ?
            `).all(limit, offset);
        }

        console.log('[Admin] Found users:', users?.length || 0);

        // 计算用户裂变层级的辅助函数
        function calculateUserLevel(userId, visited = new Set()) {
            if (visited.has(userId)) return 0; // 防止循环
            visited.add(userId);

            const user = db.prepare('SELECT invited_by FROM users WHERE id = ?').get(userId);
            if (!user || !user.invited_by) return 0; // 根用户/管理员

            return 1 + calculateUserLevel(user.invited_by, visited);
        }

        // 为每个用户获取邀请统计和邀请人信息
        const usersWithStats = users.map(user => {
            const inviteCount = db.prepare(`
                SELECT COUNT(*) as count FROM invite_codes 
                WHERE owner_id = ? AND used_by IS NOT NULL
            `).get(user.id);

            // 统计生成次数
            const generateCount = db.prepare(`
                SELECT COUNT(*) as count FROM points_log 
                WHERE user_id = ? AND reason LIKE '%生成%'
            `).get(user.id);

            // 统计放大次数
            const upscaleCount = db.prepare(`
                SELECT COUNT(*) as count FROM points_log 
                WHERE user_id = ? AND reason LIKE '%放大%'
            `).get(user.id);

            // 统计总消耗积分 (负数求和取绝对值)
            const consumedPoints = db.prepare(`
                SELECT COALESCE(ABS(SUM(points)), 0) as total 
                FROM points_log 
                WHERE user_id = ? AND points < 0
            `).get(user.id);

            // 获取邀请人邮箱
            let inviterEmail = null;
            if (user.invited_by) {
                const inviter = db.prepare('SELECT email FROM users WHERE id = ?').get(user.invited_by);
                inviterEmail = inviter?.email || null;
            }

            // 计算裂变层级
            const level = calculateUserLevel(user.id);

            return {
                id: user.id,
                email: user.email,
                points: user.points || 0,
                dailyPoints: user.daily_points || 0,
                createdAt: user.created_at,
                inviter: inviterEmail,
                invitedCount: inviteCount?.count || 0,
                // actionsCount: actionCount?.count || 0, // 废弃总数
                loginCount: user.login_count || 0, // 新增登录次数
                generateCount: generateCount?.count || 0, // 新增生成次数
                upscaleCount: upscaleCount?.count || 0, // 新增放大次数
                consumedPoints: consumedPoints?.total || 0, // 新增消耗积分
                level: level,
            };
        });

        res.json({
            users: usersWithStats,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        console.error('获取用户列表失败:', error);
        res.status(500).json({ error: '获取用户列表失败' });
    }
});

// ============================================================================
// GET /api/admin/user/:id - 获取单个用户详情
// ============================================================================
router.get('/user/:id', authMiddleware, adminMiddleware, (req, res) => {
    try {
        const userId = parseInt(req.params.id);

        const user = db.prepare(`
            SELECT 
                u.*,
                inviter.email as inviter_email
            FROM users u
            LEFT JOIN users inviter ON u.invited_by = inviter.id
            WHERE u.id = ?
        `).get(userId);

        if (!user) {
            return res.status(404).json({ error: '用户不存在' });
        }

        // 获取邀请码列表
        const inviteCodes = db.prepare(`
            SELECT 
                ic.code,
                ic.used_by,
                ic.used_at,
                ic.created_at,
                u.email as used_by_email
            FROM invite_codes ic
            LEFT JOIN users u ON ic.used_by = u.id
            WHERE ic.owner_id = ?
            ORDER BY ic.created_at ASC
        `).all(userId);

        // 获取积分记录
        const pointsLog = db.prepare(`
            SELECT * FROM points_log 
            WHERE user_id = ? 
            ORDER BY created_at DESC 
            LIMIT 50
        `).all(userId);

        res.json({
            user: {
                id: user.id,
                email: user.email,
                points: user.points || 0,
                dailyPoints: user.daily_points || 0,
                dailyPointsDate: user.daily_points_date,
                createdAt: user.created_at,
                inviter: user.inviter_email || null,
            },
            inviteCodes: inviteCodes.map(c => ({
                code: c.code,
                isUsed: c.used_by !== null,
                usedBy: c.used_by_email || null,
                usedAt: c.used_at,
                createdAt: c.created_at,
            })),
            pointsLog,
        });
    } catch (error) {
        console.error('获取用户详情失败:', error);
        res.status(500).json({ error: '获取用户详情失败' });
    }
});

// ============================================================================
// POST /api/admin/generate-codes - 为管理员生成邀请码
// ============================================================================
router.post('/generate-codes', authMiddleware, adminMiddleware, (req, res) => {
    try {
        const count = Math.min(10, Math.max(1, parseInt(req.body.count) || 5));
        const adminUserId = req.user.id;

        // 生成邀请码的字符集
        const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

        function generateCode() {
            let code = '';
            for (let i = 0; i < 6; i++) {
                code += CHARS.charAt(Math.floor(Math.random() * CHARS.length));
            }
            return code;
        }

        const generatedCodes = [];

        for (let i = 0; i < count; i++) {
            let code;
            let attempts = 0;

            // 确保邀请码唯一
            do {
                code = generateCode();
                attempts++;
            } while (
                db.prepare('SELECT id FROM invite_codes WHERE code = ?').get(code) &&
                attempts < 10
            );

            if (attempts < 10) {
                db.prepare('INSERT INTO invite_codes (code, owner_id) VALUES (?, ?)').run(code, adminUserId);
                generatedCodes.push(code);
            }
        }

        console.log(`[Admin] Generated ${generatedCodes.length} invite codes for user ${req.user.email}`);

        res.json({
            success: true,
            message: `成功生成 ${generatedCodes.length} 个邀请码`,
            codes: generatedCodes,
        });
    } catch (error) {
        console.error('生成邀请码失败:', error);
        res.status(500).json({ error: '生成邀请码失败' });
    }
});

export default router;
