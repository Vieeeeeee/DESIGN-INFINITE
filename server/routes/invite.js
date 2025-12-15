import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import db from '../database.js';

const router = Router();

// ============================================================================
// GET /api/invite/my-codes - 获取我的邀请码列表
// ============================================================================
router.get('/my-codes', authMiddleware, (req, res) => {
    const codes = db.prepare(`
    SELECT 
      ic.id,
      ic.code,
      ic.used_by,
      ic.used_at,
      ic.created_at,
      u.email as used_by_email
    FROM invite_codes ic
    LEFT JOIN users u ON ic.used_by = u.id
    WHERE ic.owner_id = ?
    ORDER BY ic.created_at ASC
  `).all(req.user.id);

    res.json({
        codes: codes.map(c => ({
            id: c.id,
            code: c.code,
            isUsed: c.used_by !== null,
            usedBy: c.used_by ? { id: c.used_by, email: c.used_by_email } : null,
            usedAt: c.used_at,
            createdAt: c.created_at,
        })),
    });
});

// ============================================================================
// GET /api/invite/stats - 邀请统计
// ============================================================================
router.get('/stats', authMiddleware, (req, res) => {
    const total = db.prepare(`
    SELECT COUNT(*) as count FROM invite_codes WHERE owner_id = ?
  `).get(req.user.id);

    const used = db.prepare(`
    SELECT COUNT(*) as count FROM invite_codes 
    WHERE owner_id = ? AND used_by IS NOT NULL
  `).get(req.user.id);

    const unused = db.prepare(`
    SELECT COUNT(*) as count FROM invite_codes 
    WHERE owner_id = ? AND used_by IS NULL
  `).get(req.user.id);

    // 获取通过邀请获得的积分总数
    const pointsEarned = db.prepare(`
    SELECT COALESCE(SUM(points), 0) as total FROM points_log 
    WHERE user_id = ? AND reason LIKE '邀请用户%'
  `).get(req.user.id);

    res.json({
        total: total.count,
        used: used.count,
        unused: unused.count,
        pointsEarned: pointsEarned.total,
    });
});

// ============================================================================
// GET /api/invite/validate/:code - 验证邀请码是否有效（注册前检查）
// ============================================================================
router.get('/validate/:code', (req, res) => {
    const code = req.params.code?.toUpperCase();

    if (!code) {
        return res.status(400).json({ valid: false, error: '请输入邀请码' });
    }

    const invite = db.prepare(`
    SELECT ic.*, u.email as owner_email
    FROM invite_codes ic
    JOIN users u ON ic.owner_id = u.id
    WHERE ic.code = ? AND ic.used_by IS NULL
  `).get(code);

    if (!invite) {
        return res.json({ valid: false, error: '邀请码无效或已被使用' });
    }

    res.json({
        valid: true,
        inviter: invite.owner_email.replace(/^(.{2}).*(@.*)$/, '$1***$2'), // 脱敏显示
    });
});

export default router;
