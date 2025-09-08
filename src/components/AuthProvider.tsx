import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { useNavigate, useLocation } from 'react-router-dom';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({ 
  user: null, 
  session: null, 
  loading: true,
  signOut: async () => {} 
});

export const useAuth = () => useContext(AuthContext);

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
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
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.warn('Supabase sign out error (non-critical):', error);
      }
      
      // Navigate to home page
      navigate('/', { replace: true });
      toast.success('Signed out successfully');
    } catch (error) {
      console.error('Error during sign out:', error);
      // Ensure we still clear state and navigate away
      setSession(null);
      setUser(null);
      navigate('/', { replace: true });
      toast.success('Signed out successfully');
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
          } else {
            // Clean state if no session
            setSession(null);
            setUser(null);
          }
        }
      } catch (error) {
        console.error('Error getting initial session:', error);
        if (mounted) {
          setSession(null);
          setUser(null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    initializeAuth();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!mounted) return;

      switch (event) {
        case 'SIGNED_IN':
          if (newSession) {
            setSession(newSession);
            setUser(newSession.user);
            
            // Only navigate to dashboard if user was on login page
            if (location.pathname === '/login') {
              navigate('/dashboard', { replace: true });
            }
            
            const welcomeMessage = newSession.user?.email 
              ? `Welcome back, ${newSession.user.email.split('@')[0]}!`
              : 'Welcome back!';
            toast.success(welcomeMessage);
          }
          break;
        case 'SIGNED_OUT':
          localStorage.removeItem('supabase.auth.token');
          setSession(null);
          setUser(null);
          if (location.pathname === '/dashboard') {
            navigate('/', { replace: true });
          }
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
          }
          break;
        case 'PASSWORD_RECOVERY':
          toast.success('Password recovery email sent');
          break;
      }
      
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [navigate, location.pathname]);

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}