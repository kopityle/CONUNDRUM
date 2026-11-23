import React, { useState, useEffect, useMemo } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import MainPage from './components/MainPage';
import SignInUp from './components/SignInUp';
import PersonalAccount from './components/PersonalAccount';
import GameGenerator from './components/GameGenerator';
import { initializeSupabase } from './config/supabaseClient';

const AppContent = () => {
    const [isBlackTheme, setIsBlackTheme] = useState(() => {
        const saved = localStorage.getItem("theme");
        return saved ? saved === "black" : true;
    });
    const [isLoading, setIsLoading] = useState(true);
    const [user, setUser] = useState(null);
    const [supabaseInstance, setSupabaseInstance] = useState(null);

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

        const handleAuth = async () => {
            console.log("App.js: Starting auth process...");
            try {
                const supabase = await initializeSupabase();
                if (!mounted) return;
                setSupabaseInstance(supabase);

                const supabaseToken = searchParams.get('supabase_token');

                if (isLTI && supabaseToken) {
                    console.log("App.js: LTI mode detected. Setting session from token...");
                    await supabase.auth.setSession({
                        access_token: supabaseToken,
                        refresh_token: supabaseToken,
                    });
                }

                const { data: { session } } = await supabase.auth.getSession();
                if (mounted) {
                    const currentUser = session?.user || null;
                    console.log('App.js: Final user state determined:', currentUser);
                    setUser(currentUser);
                }

                supabase.auth.onAuthStateChange((_event, session) => {
                    if (mounted) {
                        setUser(session?.user || null);
                    }
                });

            } catch (error) {
                console.error('App.js: Auth setup failed:', error);
                if (mounted) setUser(null);
            } finally {
                if (mounted) setIsLoading(false);
            }
        };

        handleAuth();

        return () => { mounted = false; };
    }, [isLTI, searchParams]);

    if (isLoading) {
        return <div className="loading">Загрузка...</div>;
    }

    if (isLTI) {
        return (
            <div className={isBlackTheme ? 'black-theme' : 'white-theme'}>
                <GameGenerator
                    isBlackTheme={isBlackTheme}
                    toggleTheme={toggleTheme}
                    user={user}
                    isAuth={!!user}
                    supabase={supabaseInstance}
                    ltiUserId={ltiUserId}
                />
            </div>
        );
    }

    return (
        <div className={isBlackTheme ? 'black-theme' : 'white-theme'}>
            <Routes>
                <Route path="/" element={<MainPage isBlackTheme={isBlackTheme} toggleTheme={toggleTheme} isAuth={!!user} />} />
                <Route path="/register" element={user ? <Navigate to="/account" /> : <SignInUp supabase={supabaseInstance} />} />
                <Route path="/gamegenerator" element={user ? <GameGenerator isBlackTheme={isBlackTheme} toggleTheme={toggleTheme} user={user} isAuth={!!user} supabase={supabaseInstance} /> : <Navigate to="/register" />} />
                <Route path="/account" element={user ? <PersonalAccount isBlackTheme={isBlackTheme} toggleTheme={toggleTheme} user={user} supabase={supabaseInstance} /> : <Navigate to="/register" />} />
                <Route path="*" element={<Navigate to="/" />} />
            </Routes>
        </div>
    );
};

const App = () => <AppContent />;

export default App;