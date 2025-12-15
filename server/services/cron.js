/**
 * Cron Jobs Service
 * 定时任务服务 - 每日积分自动刷新
 */
import cron from 'node-cron';
import db from '../database.js';
import config from '../config.js';

/**
 * 启动所有定时任务
 */
export function startCronJobs() {
    // 每天北京时间 00:00:00 刷新所有用户的每日积分
    // Cron 表达式: 秒 分 时 日 月 周
    cron.schedule('0 0 0 * * *', () => {
        console.log('[Cron] 执行每日积分刷新任务...');
        refreshAllDailyPoints();
    }, {
        timezone: 'Asia/Shanghai'
    });

    console.log('⏰ 定时任务已启动 (每日 00:00 刷新积分)');
}

/**
 * 批量刷新所有用户的每日积分
 * - 将所有用户的 daily_points 重置为 500
 * - 更新 daily_points_date 为当天日期
 * - 只更新那些日期不是今天的用户（幂等性）
 */
function refreshAllDailyPoints() {
    const startTime = Date.now();
    const today = new Date().toISOString().split('T')[0];
    const DAILY_POINTS = config.dailyLoginPoints || 500;

    try {
        // 批量更新所有用户
        const result = db.prepare(`
            UPDATE users 
            SET daily_points = ?, daily_points_date = ?
            WHERE daily_points_date != ? OR daily_points_date IS NULL
        `).run(DAILY_POINTS, today, today);

        const elapsed = Date.now() - startTime;
        console.log(`[Cron] ✅ 每日积分刷新完成 | 更新用户数: ${result.changes} | 耗时: ${elapsed}ms`);

        // 记录到积分日志（可选，批量插入会比较重，暂时只打日志）
        // 如果需要记录，可以在这里添加批量插入逻辑

    } catch (error) {
        console.error('[Cron] ❌ 每日积分刷新失败:', error);
    }
}

/**
 * 手动触发刷新（用于测试或管理员操作）
 */
export function manualRefreshDailyPoints() {
    console.log('[Cron] 手动触发每日积分刷新...');
    refreshAllDailyPoints();
}
