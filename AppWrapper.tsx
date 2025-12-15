import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth, AuthPage, UserCenter } from './components/auth';
import { LandingPage } from './components/landing';
import { AdminDashboard } from './components/admin/AdminDashboard';
import App from './App';

// Protected Route Component
function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const { isLoggedIn, isLoading } = useAuth();
    const location = useLocation();

    if (isLoading) {
        return (
            <div style={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 50%, #16213e 100%)',
            }}>
                <div style={{
                    width: 40,
                    height: 40,
                    border: '3px solid rgba(0, 217, 255, 0.2)',
                    borderTopColor: '#00d9ff',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                }} />
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

    if (!isLoggedIn) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    return <>{children}</>;
}

// Main App with UserCenter
function MainApp() {
    const { user, refreshUser, updatePoints } = useAuth();
    const [showUserCenter, setShowUserCenter] = useState(false);
    const [isLightMode, setIsLightMode] = useState(false);

    const handleCloseUserCenter = () => {
        setShowUserCenter(false);
        // 关闭用户中心后刷新积分，确保 App 显示最新值
        refreshUser();
    };

    return (
        <>
            <App
                userEmail={user?.email}
                userPoints={user?.totalPoints}
                onOpenUserCenter={() => setShowUserCenter(true)}
                onUpdatePoints={updatePoints}
                onThemeChange={setIsLightMode}
            />
            {showUserCenter && <UserCenter onClose={handleCloseUserCenter} isLightMode={isLightMode} />}
        </>
    );
}

// Auth Page Wrapper - redirects if already logged in
function AuthPageWrapper() {
    const { isLoggedIn, isLoading } = useAuth();
    const location = useLocation();

    if (isLoading) {
        return (
            <div style={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 50%, #16213e 100%)',
            }}>
                <div style={{
                    width: 40,
                    height: 40,
                    border: '3px solid rgba(0, 217, 255, 0.2)',
                    borderTopColor: '#00d9ff',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                }} />
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

    if (isLoggedIn) {
        // If user is logged in, redirect to app
        const from = (location.state as any)?.from?.pathname || '/app';
        return <Navigate to={from} replace />;
    }

    return <AuthPage />;
}

// App Routes
function AppRoutes() {
    return (
        <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<AuthPageWrapper />} />
            <Route path="/register" element={<AuthPageWrapper />} />
            <Route path="/app" element={
                <ProtectedRoute>
                    <MainApp />
                </ProtectedRoute>
            } />
            <Route path="/admin" element={
                <ProtectedRoute>
                    <AdminDashboard />
                </ProtectedRoute>
            } />
            {/* Redirect unknown routes to home */}
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}

export default function AppWrapper() {
    return (
        <BrowserRouter>
            <AuthProvider>
                <AppRoutes />
            </AuthProvider>
        </BrowserRouter>
    );
}
