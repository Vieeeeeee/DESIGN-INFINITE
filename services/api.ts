// API 基础配置
// 开发环境使用 VITE_API_BASE_URL (如 http://localhost:3001)
// 生产环境默认使用 https://api.abdc.online
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://api.abdc.online';

// 规范化 URL，避免双斜杠和重复 /api
function normalizeUrl(base: string, path: string): string {
    const cleanBase = base.replace(/\/+$/, ''); // 移除末尾斜杠
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${cleanBase}${cleanPath}`;
}

// 通用请求方法
async function request(endpoint: string, options: RequestInit = {}) {
    const token = localStorage.getItem('auth_token');

    const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...options.headers,
    };

    if (token) {
        (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(normalizeUrl(API_BASE, endpoint), {
        ...options,
        headers,
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || '请求失败');
    }

    return data;
}

// ============================================================================
// 认证相关 API
// ============================================================================
export const authApi = {
    // 检查是否需要初始化
    checkInit: () => request('/api/auth/check-init'),

    // 初始化管理员
    initAdmin: (email: string, password: string) =>
        request('/api/auth/init-admin', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
        }),

    // 发送验证码
    sendCode: (email: string, type: 'register' | 'reset_password' = 'register') =>
        request('/api/auth/send-code', {
            method: 'POST',
            body: JSON.stringify({ email, type }),
        }),

    // 注册
    register: (email: string, password: string, verificationCode: string, inviteCode: string) =>
        request('/api/auth/register', {
            method: 'POST',
            body: JSON.stringify({ email, password, verificationCode, inviteCode }),
        }),

    // 登录
    login: (email: string, password: string) =>
        request('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
        }),

    // 重置密码
    resetPassword: (email: string, password: string, verificationCode: string) =>
        request('/api/auth/reset-password', {
            method: 'POST',
            body: JSON.stringify({ email, password, verificationCode }),
        }),
};

// ============================================================================
// 用户相关 API
// ============================================================================
export const userApi = {
    // 获取用户信息
    getProfile: () => request('/api/user/profile'),

    // 获取积分记录
    getPointsLog: () => request('/api/user/points-log'),

    // 每日签到
    checkIn: () => request('/api/user/check-in', { method: 'POST' }),

    // 检查积分是否足够（不扣费）
    checkPoints: (amount: number = 100) =>
        request(`/api/user/check-points?amount=${amount}`),

    // 消耗积分 (生成/放大时调用)
    consumePoints: (amount: number = 100, action: 'generate' | 'upscale' = 'generate') =>
        request('/api/user/consume-points', {
            method: 'POST',
            body: JSON.stringify({ amount, action }),
        }),
};

// ============================================================================
// 邀请码相关 API
// ============================================================================
export const inviteApi = {
    // 获取我的邀请码
    getMyCodes: () => request('/api/invite/my-codes'),

    // 获取邀请统计
    getStats: () => request('/api/invite/stats'),

    // 验证邀请码
    validate: (code: string) => request(`/api/invite/validate/${code}`),
};

// ============================================================================
// 管理员 API
// ============================================================================
export const adminApi = {
    // 获取总体统计数据
    getStats: () => request('/api/admin/stats'),

    // 获取用户增长数据
    getGrowth: (days: number = 30) => request(`/api/admin/growth?days=${days}`),

    // 获取用户列表
    getUsers: (page: number = 1, limit: number = 20, search: string = '') =>
        request(`/api/admin/users?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`),

    // 获取单个用户详情
    getUser: (id: number) => request(`/api/admin/user/${id}`),

    // 生成邀请码
    generateCodes: (count: number = 5) => request('/api/admin/generate-codes', {
        method: 'POST',
        body: JSON.stringify({ count }),
    }),
};
