import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { userApi } from '../../services/api';

interface User {
    id: number;
    email: string;
    points: number;           // 永久积分
    dailyPoints: number;      // 每日积分
    totalPoints: number;      // 总可用积分
    hasCheckedInToday: boolean;
}

interface AuthContextType {
    user: User | null;
    isLoading: boolean;
    isLoggedIn: boolean;
    login: (token: string, user: Partial<User>) => void;
    logout: () => void;
    refreshUser: () => Promise<void>;
    updatePoints: (points: number, dailyPoints: number) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // 初始化时检查 token
    useEffect(() => {
        const token = localStorage.getItem('auth_token');
        if (token) {
            refreshUser().finally(() => setIsLoading(false));
        } else {
            setIsLoading(false);
        }
    }, []);

    const login = (token: string, userData: Partial<User>) => {
        localStorage.setItem('auth_token', token);
        setUser({
            id: userData.id || 0,
            email: userData.email || '',
            points: userData.points || 0,
            dailyPoints: userData.dailyPoints || 0,
            totalPoints: (userData.points || 0) + (userData.dailyPoints || 0),
            hasCheckedInToday: userData.hasCheckedInToday || false,
        });
    };

    const logout = () => {
        localStorage.removeItem('auth_token');
        setUser(null);
    };

    const refreshUser = async () => {
        try {
            const data = await userApi.getProfile();
            if (data.user) {
                setUser({
                    id: data.user.id,
                    email: data.user.email,
                    points: data.user.points || 0,
                    dailyPoints: data.user.dailyPoints || 0,
                    totalPoints: data.user.totalPoints || (data.user.points || 0) + (data.user.dailyPoints || 0),
                    hasCheckedInToday: data.user.hasCheckedInToday || false,
                });
            }
        } catch (error) {
            // Token 无效，清除登录状态
            logout();
        }
    };

    // 更新积分（用于扣费后立即更新显示）
    const updatePoints = (points: number, dailyPoints: number) => {
        setUser(prev => prev ? {
            ...prev,
            points,
            dailyPoints,
            totalPoints: points + dailyPoints
        } : null);
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                isLoading,
                isLoggedIn: !!user,
                login,
                logout,
                refreshUser,
                updatePoints,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
