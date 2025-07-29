import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { useNavigate, useLocation } from 'react-router-dom';
const AuthContext = createContext({
    user: null,
    session: null,
    loading: true,
    signOut: async () => { }
});
export const useAuth = () => useContext(AuthContext);
export default function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();
    const location = useLocation();
    const signOut = async () => {
        try {
            // Clear local storage first
            localStorage.removeItem('supabase.auth.token');
            // Clear state
            setSession(null);
            setUser(null);
            // Attempt to sign out from Supabase
            await supabase.auth.signOut();
            // Navigate to home page
            navigate('/', { replace: true });
            toast.success('Signed out successfully');
        }
        catch (error) {
            console.error('Error during sign out:', error);
            // Ensure we still clear state and navigate away
            setSession(null);
            setUser(null);
            navigate('/', { replace: true });
        }
    };
    useEffect(() => {
        let mounted = true;
        // Get initial session
        const initializeAuth = async () => {
            try {
                const { data: { session: initialSession } } = await supabase.auth.getSession();
                if (mounted) {
                    if (initialSession) {
                        setSession(initialSession);
                        setUser(initialSession.user);
                        // If user is on login page and already authenticated, redirect to dashboard
                        if (location.pathname === '/login') {
                            navigate('/dashboard', { replace: true });
                        }
                    }
                    else {
                        // Clean state if no session
                        setSession(null);
                        setUser(null);
                    }
                }
            }
            catch (error) {
                console.error('Error getting initial session:', error);
                if (mounted) {
                    setSession(null);
                    setUser(null);
                }
            }
            finally {
                if (mounted) {
                    setLoading(false);
                }
            }
        };
        initializeAuth();
        // Listen for auth changes
        const { data: { subscription }, } = supabase.auth.onAuthStateChange(async (event, newSession) => {
            if (!mounted)
                return;
            switch (event) {
                case 'SIGNED_IN':
                    if (newSession) {
                        setSession(newSession);
                        setUser(newSession.user);
                        navigate('/dashboard');
                        toast.success(`Welcome${newSession.user?.email ? ` ${newSession.user.email}` : ''}!`);
                    }
                    break;
                case 'SIGNED_OUT':
                    localStorage.removeItem('supabase.auth.token');
                    setSession(null);
                    setUser(null);
                    navigate('/', { replace: true });
                    break;
                case 'TOKEN_REFRESHED':
                    if (newSession) {
                        setSession(newSession);
                        setUser(newSession.user);
                    }
                    break;
                case 'USER_UPDATED':
                    if (newSession) {
                        setSession(newSession);
                        setUser(newSession.user);
                        toast.success('Profile updated');
                    }
                    break;
            }
            setLoading(false);
        });
        return () => {
            mounted = false;
            subscription.unsubscribe();
        };
    }, [navigate, location.pathname]);
    return (_jsx(AuthContext.Provider, { value: { user, session, loading, signOut }, children: children }));
}
