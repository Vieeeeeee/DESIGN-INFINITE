import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { adminApi } from '../../services/api';
import './AdminDashboard.css';

interface Stats {
    users: { total: number; today: number; thisWeek: number; thisMonth: number };
    activeUsers: { today: number; thisWeek: number; thisMonth: number };
    generate: { total: number; today: number; thisWeek: number; thisMonth: number };
    upscale: { total: number; today: number; thisWeek: number; thisMonth: number };
    checkIn: { total: number; today: number; thisWeek: number };
    points: { totalEarned: number; totalConsumed: number; earnedToday: number; consumedToday: number };
    invites: { used: number; total: number; today: number; thisWeek: number; successRate: number };
}

interface GrowthData {
    data: { date: string; count: number }[];
    summary: { total: number; avgDaily: number; maxDay: number };
}

interface User {
    id: number;
    email: string;
    points: number;
    dailyPoints: number;
    createdAt: string;
    inviter: string | null;
    invitedCount: number;
    // actionsCount: number; // Removed
    loginCount: number;
    generateCount: number;
    upscaleCount: number;
    consumedPoints: number;
    level: number; // 裂变层级
}

interface Pagination {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

type TimePeriod = 'today' | 'week' | 'month' | 'total';

export function AdminDashboard() {
    const { user, isLoggedIn } = useAuth();
    const navigate = useNavigate();

    const [stats, setStats] = useState<Stats | null>(null);
    const [growth, setGrowth] = useState<GrowthData | null>(null);
    const [users, setUsers] = useState<User[]>([]);
    const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
    const [search, setSearch] = useState('');
    const [searchInput, setSearchInput] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'overview' | 'users'>('overview');
    const [timePeriod, setTimePeriod] = useState<TimePeriod>('today');

    // 生成邀请码状态
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedCodes, setGeneratedCodes] = useState<string[]>([]);

    // Check authentication
    useEffect(() => {
        if (!isLoggedIn) {
            navigate('/login');
        }
    }, [isLoggedIn, navigate]);

    // Load stats and growth data
    useEffect(() => {
        async function loadData() {
            try {
                setLoading(true);
                setError(null);

                const [statsData, growthData] = await Promise.all([
                    adminApi.getStats(),
                    adminApi.getGrowth(30),
                ]);

                setStats(statsData);
                setGrowth(growthData);
            } catch (err: any) {
                console.error('Failed to load admin data:', err);
                setError(err.message || '加载数据失败');
            } finally {
                setLoading(false);
            }
        }

        if (isLoggedIn) {
            loadData();
        }
    }, [isLoggedIn]);

    // Load users
    useEffect(() => {
        async function loadUsers() {
            try {
                console.log('[Admin] Loading users, page:', pagination.page, 'search:', search);
                const data = await adminApi.getUsers(pagination.page, 20, search);
                console.log('[Admin] Users response:', data);
                setUsers(data.users || []);
                setPagination(prev => ({
                    ...prev,
                    total: data.pagination?.total || 0,
                    totalPages: data.pagination?.totalPages || 0
                }));
            } catch (err: any) {
                console.error('[Admin] Failed to load users:', err);
                setUsers([]);
            }
        }

        if (isLoggedIn && activeTab === 'users') {
            loadUsers();
        }
    }, [isLoggedIn, activeTab, pagination.page, search]);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setSearch(searchInput);
        setPagination(prev => ({ ...prev, page: 1 }));
    };

    // 生成邀请码
    const handleGenerateCodes = async () => {
        try {
            setIsGenerating(true);
            const result = await adminApi.generateCodes(5);
            setGeneratedCodes(result.codes || []);
            // 3秒后清除显示
            setTimeout(() => setGeneratedCodes([]), 10000);
        } catch (err: any) {
            console.error('生成邀请码失败:', err);
            alert('生成邀请码失败: ' + (err.message || '未知错误'));
        } finally {
            setIsGenerating(false);
        }
    };

    const getStatValue = (statObj: { total?: number; today?: number; thisWeek?: number; thisMonth?: number }, period: TimePeriod) => {
        if (period === 'today') return statObj.today || 0;
        if (period === 'week') return statObj.thisWeek || 0;
        if (period === 'month') return statObj.thisMonth || 0;
        return statObj.total || 0;
    };

    if (loading) {
        return (
            <div className="admin-loading">
                <div className="admin-spinner"></div>
                <p>加载中...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="admin-error">
                <h2>访问被拒绝</h2>
                <p>{error}</p>
                <button onClick={() => navigate('/app')}>返回应用</button>
            </div>
        );
    }

    return (
        <div className="admin-container">
            {/* Header */}
            <header className="admin-header">
                <div className="admin-header-left">
                    <h1>管理后台</h1>
                    <span className="admin-badge">Admin</span>
                </div>
                <div className="admin-header-right">
                    <button
                        onClick={handleGenerateCodes}
                        className="admin-generate-btn"
                        disabled={isGenerating}
                    >
                        {isGenerating ? '生成中...' : '🎟️ 生成5个邀请码'}
                    </button>
                    <span className="admin-user">{user?.email}</span>
                    <button onClick={() => navigate('/app')} className="admin-back-btn">
                        返回应用
                    </button>
                </div>
            </header>

            {/* 生成的邀请码显示 */}
            {generatedCodes.length > 0 && (
                <div className="admin-generated-codes">
                    <span className="codes-label">✅ 新生成的邀请码:</span>
                    <div className="codes-list">
                        {generatedCodes.map((code, idx) => (
                            <span key={idx} className="code-item" onClick={() => {
                                navigator.clipboard.writeText(code);
                            }}>{code}</span>
                        ))}
                    </div>
                    <span className="codes-hint">点击复制 · 10秒后消失</span>
                </div>
            )}

            {/* Tabs */}
            <div className="admin-tabs">
                <button
                    className={`admin-tab ${activeTab === 'overview' ? 'active' : ''}`}
                    onClick={() => setActiveTab('overview')}
                >
                    📊 数据概览
                </button>
                <button
                    className={`admin-tab ${activeTab === 'users' ? 'active' : ''}`}
                    onClick={() => setActiveTab('users')}
                >
                    👥 用户管理
                </button>
            </div>

            {/* Content */}
            <main className="admin-content">
                {activeTab === 'overview' && stats && (
                    <>
                        {/* Time Period Selector */}
                        <div className="time-period-selector">
                            <button
                                className={timePeriod === 'today' ? 'active' : ''}
                                onClick={() => setTimePeriod('today')}
                            >
                                今日
                            </button>
                            <button
                                className={timePeriod === 'week' ? 'active' : ''}
                                onClick={() => setTimePeriod('week')}
                            >
                                本周
                            </button>
                            <button
                                className={timePeriod === 'month' ? 'active' : ''}
                                onClick={() => setTimePeriod('month')}
                            >
                                本月
                            </button>
                            <button
                                className={timePeriod === 'total' ? 'active' : ''}
                                onClick={() => setTimePeriod('total')}
                            >
                                累计
                            </button>
                        </div>

                        {/* Stats Cards */}
                        <section className="admin-stats-grid">
                            <div className="admin-stat-card">
                                <div className="stat-icon">👥</div>
                                <div className="stat-content">
                                    <div className="stat-value">{getStatValue(stats.users, timePeriod)}</div>
                                    <div className="stat-label">
                                        {timePeriod === 'total' ? '总用户数' : timePeriod === 'today' ? '今日新增' : timePeriod === 'week' ? '本周新增' : '本月新增'}
                                    </div>
                                    <div className="stat-sub">总计 {stats.users.total} 用户</div>
                                </div>
                            </div>

                            <div className="admin-stat-card highlight">
                                <div className="stat-icon">🔥</div>
                                <div className="stat-content">
                                    <div className="stat-value">{getStatValue(stats.activeUsers, timePeriod)}</div>
                                    <div className="stat-label">
                                        {timePeriod === 'today' ? '今日活跃' : timePeriod === 'week' ? '本周活跃' : timePeriod === 'month' ? '本月活跃' : '本月活跃'}
                                    </div>
                                    <div className="stat-sub">有操作记录的用户</div>
                                </div>
                            </div>

                            <div className="admin-stat-card">
                                <div className="stat-icon">🎨</div>
                                <div className="stat-content">
                                    <div className="stat-value">{getStatValue(stats.generate, timePeriod)}</div>
                                    <div className="stat-label">生成次数</div>
                                    <div className="stat-sub">总计 {stats.generate.total} 次</div>
                                </div>
                            </div>

                            <div className="admin-stat-card">
                                <div className="stat-icon">🔍</div>
                                <div className="stat-content">
                                    <div className="stat-value">{getStatValue(stats.upscale, timePeriod)}</div>
                                    <div className="stat-label">放大次数</div>
                                    <div className="stat-sub">总计 {stats.upscale.total} 次</div>
                                </div>
                            </div>

                            <div className="admin-stat-card">
                                <div className="stat-icon">💰</div>
                                <div className="stat-content">
                                    <div className="stat-value">
                                        {timePeriod === 'today' ? stats.points.earnedToday : stats.points.totalEarned}
                                    </div>
                                    <div className="stat-label">积分发放</div>
                                    <div className="stat-sub">
                                        消耗 {timePeriod === 'today' ? stats.points.consumedToday : stats.points.totalConsumed}
                                    </div>
                                </div>
                            </div>

                            <div className="admin-stat-card">
                                <div className="stat-icon">🎁</div>
                                <div className="stat-content">
                                    <div className="stat-value">
                                        {timePeriod === 'today' ? stats.invites.today : timePeriod === 'week' ? stats.invites.thisWeek : stats.invites.used}
                                    </div>
                                    <div className="stat-label">邀请成功</div>
                                    <div className="stat-sub">使用率 {stats.invites.successRate}% (总{stats.invites.used}/{stats.invites.total})</div>
                                </div>
                            </div>
                        </section>

                        {/* Growth Chart */}
                        {growth && (
                            <section className="admin-growth-section">
                                <h2>用户增长趋势 (过去30天)</h2>
                                <div className="growth-summary">
                                    <span>总增长: <strong>{growth.summary.total}</strong></span>
                                    <span>日均: <strong>{growth.summary.avgDaily}</strong></span>
                                    <span>峰值: <strong>{growth.summary.maxDay}</strong></span>
                                </div>
                                <div className="admin-chart">
                                    {growth.data.map((item, idx) => {
                                        const height = growth.summary.maxDay > 0
                                            ? (item.count / growth.summary.maxDay) * 100
                                            : 0;
                                        return (
                                            <div
                                                key={idx}
                                                className="chart-bar-container"
                                                title={`${item.date}: ${item.count} 用户`}
                                            >
                                                <div
                                                    className="chart-bar"
                                                    style={{ height: `${Math.max(height, item.count > 0 ? 5 : 2)}%` }}
                                                >
                                                    {item.count > 0 && <span className="chart-bar-value">{item.count}</span>}
                                                </div>
                                                {idx % 5 === 0 && (
                                                    <span className="chart-label">{item.date.slice(5)}</span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </section>
                        )}
                    </>
                )}

                {activeTab === 'users' && (
                    <section className="admin-users-section">
                        {/* Search */}
                        <form onSubmit={handleSearch} className="admin-search">
                            <input
                                type="text"
                                placeholder="搜索邮箱..."
                                value={searchInput}
                                onChange={(e) => setSearchInput(e.target.value)}
                            />
                            <button type="submit">搜索</button>
                            {search && (
                                <button type="button" onClick={() => { setSearch(''); setSearchInput(''); }} className="clear-btn">
                                    清除
                                </button>
                            )}
                        </form>

                        {/* Users Table */}
                        <div className="admin-table-container">
                            <table className="admin-table">
                                <thead>
                                    <tr>
                                        <th>ID</th>
                                        <th>邮箱</th>
                                        <th>层级</th>
                                        <th>永久积分</th>
                                        <th>总消耗</th>
                                        <th>每日积分</th>
                                        <th>邀请成功</th>
                                        <th>登录</th>
                                        <th>生成</th>
                                        <th>放大</th>
                                        <th>邀请人</th>
                                        <th>注册时间</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.length === 0 ? (
                                        <tr>
                                            <td colSpan={12} className="empty-cell">暂无用户数据</td>
                                        </tr>
                                    ) : (
                                        users.map(u => (
                                            <tr key={u.id}>
                                                <td>{u.id}</td>
                                                <td className="email-cell">{u.email}</td>
                                                <td>
                                                    <span className={`user-level ${u.level <= 3 ? `level-${u.level}` : 'level-default'}`}>
                                                        L{u.level}
                                                    </span>
                                                </td>
                                                <td>{u.points}</td>
                                                <td className="consumed-cell">{u.consumedPoints}</td>
                                                <td>{u.dailyPoints}</td>
                                                <td>{u.invitedCount}</td>
                                                <td>{u.loginCount}</td>
                                                <td>{u.generateCount}</td>
                                                <td>{u.upscaleCount}</td>
                                                <td className="inviter-cell">{u.inviter || '-'}</td>
                                                <td>{u.createdAt ? new Date(u.createdAt).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '-'}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        {pagination.total > 0 && (
                            <div className="admin-pagination">
                                <span>共 {pagination.total} 条</span>
                                <div className="pagination-buttons">
                                    <button
                                        disabled={pagination.page <= 1}
                                        onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                                    >
                                        上一页
                                    </button>
                                    <span>{pagination.page} / {pagination.totalPages || 1}</span>
                                    <button
                                        disabled={pagination.page >= pagination.totalPages}
                                        onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                                    >
                                        下一页
                                    </button>
                                </div>
                            </div>
                        )}
                    </section>
                )}
            </main>
        </div>
    );
}
