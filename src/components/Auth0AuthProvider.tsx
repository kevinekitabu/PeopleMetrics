import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth0Context } from '../contexts/Auth0Context';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

interface AuthContextType {
  user: any;
  session: any;
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

export default function Auth0AuthProvider({ children }: { children: React.ReactNode }) {
  const { user: auth0User, isAuthenticated, isLoading, logout } = useAuth0Context();
  const [user, setUser] = useState<any>(null);
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const syncUserWithSupabase = async () => {
      if (isLoading) return;

      if (isAuthenticated && auth0User) {
        try {
          // Create or update user in Supabase
          const { data: existingUser, error: fetchError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', auth0User.sub)
            .single();

          if (fetchError && fetchError.code !== 'PGRST116') {
            console.error('Error fetching user profile:', fetchError);
          }

          if (!existingUser) {
            // Create new profile
            const { error: insertError } = await supabase
              .from('profiles')
              .insert({
                id: auth0User.sub,
                is_admin: false,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              });

            if (insertError) {
              console.error('Error creating user profile:', insertError);
            }
          }

          // Set user data
          setUser({
            id: auth0User.sub,
            email: auth0User.email,
            name: auth0User.name,
            picture: auth0User.picture,
            ...auth0User
          });

          setSession({
            user: {
              id: auth0User.sub,
              email: auth0User.email,
              ...auth0User
            }
          });

        } catch (error) {
          console.error('Error syncing user with Supabase:', error);
        }
      } else {
        setUser(null);
        setSession(null);
      }

      setLoading(false);
    };

    syncUserWithSupabase();
  }, [isAuthenticated, auth0User, isLoading]);

  const signOut = async () => {
    try {
      setUser(null);
      setSession(null);
      logout();
      toast.success('Signed out successfully');
    } catch (error) {
      console.error('Error during sign out:', error);
      toast.error('Error signing out');
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}