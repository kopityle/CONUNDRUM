import React, { useEffect, useMemo, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import MainPage from './components/MainPage';
import SignInUp from './components/SignInUp';
import PersonalAccount from './components/PersonalAccount';
import GameGenerator from './components/GameGenerator';
import PublicPlayPage from './components/PublicPlayPage';
import { getMe, getToken, setToken, AUTH_CHANGED_EVENT } from './services/authService';

const AppContent = () => {
    const [isBlackTheme, setIsBlackTheme] = useState(() => {
        const saved = localStorage.getItem("theme");
        return saved ? saved === "black" : true;
    });
    const [user, setUser] = useState(null);
    const [isAuthResolved, setIsAuthResolved] = useState(false);

    const searchParams = useMemo(() => new URLSearchParams(window.location.search), []);
    const isLTI = searchParams.get('lti') === 'true';
    const ltiUserId = searchParams.get('user_id') || searchParams.get('lti_user_id') || undefined;

    const toggleTheme = () => {
        setIsBlackTheme(prev => {
            const newValue = !prev;

            localStorage.setItem("theme", newValue ? "black" : "white");

            return newValue;
        });
    };

    useEffect(() => {
        let mounted = true;

        const restoreSession = async () => {
            const tokenFromQuery = searchParams.get('auth_token');
            if (tokenFromQuery) setToken(tokenFromQuery);

            // No token - stay a guest immediately, without a blocking loader.
            if (!tokenFromQuery && !getToken()) {
                if (mounted) setIsAuthResolved(true);
                return;
            }

            try {
                const currentUser = await getMe();
                if (mounted) setUser(currentUser || null);
            } catch (error) {
                console.error('App.js: Failed to restore session:', error);
                if (mounted) setUser(null);
            } finally {
                if (mounted) setIsAuthResolved(true);
            }
        };

        restoreSession();

        const handleAuthChanged = (event) => {
            setUser(event?.detail?.user || null);
        };

        window.addEventListener(AUTH_CHANGED_EVENT, handleAuthChanged);

        return () => {
            mounted = false;
            window.removeEventListener(AUTH_CHANGED_EVENT, handleAuthChanged);
        };
    }, [searchParams]);

    if (isLTI) {
        return (
            <div className={isBlackTheme ? 'black-theme' : 'white-theme'}>
                <GameGenerator
                    isBlackTheme={isBlackTheme}
                    toggleTheme={toggleTheme}
                    user={user}
                    isAuth={!!user}
                    isAuthResolved={isAuthResolved}
                    ltiUserId={ltiUserId || user?.id}
                />
            </div>
        );
    }

    return (
        <div className={isBlackTheme ? 'black-theme' : 'white-theme'}>
            <Routes>
                <Route path="/" element={<MainPage isBlackTheme={isBlackTheme} toggleTheme={toggleTheme} isAuth={!!user} />} />
                <Route path="/register" element={user ? <Navigate to="/account" /> : <SignInUp />} />
                <Route path="/gamegenerator" element={
                    <GameGenerator
                        isBlackTheme={isBlackTheme}
                        toggleTheme={toggleTheme}
                        user={user}
                        isAuth={!!user}
                        isAuthResolved={isAuthResolved}
                        ltiUserId={ltiUserId || (isLTI ? user?.id : undefined)}
                    />
                } />
                <Route path="/play/:shareId" element={<PublicPlayPage />} />
                <Route path="/account" element={user ? <PersonalAccount isBlackTheme={isBlackTheme} toggleTheme={toggleTheme} user={user} /> : <Navigate to="/register" />} />
                <Route path="*" element={<Navigate to="/" />} />
            </Routes>
        </div>
    );
};

const App = () => <AppContent />;

export default App;
