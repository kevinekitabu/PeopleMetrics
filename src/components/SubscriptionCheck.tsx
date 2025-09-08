import React from 'react';
import { useAuth } from './AuthProvider';
import { supabase } from '../lib/supabase';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface SubscriptionCheckProps {
  children: React.ReactNode;
}

export default function SubscriptionCheck({ children }: SubscriptionCheckProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [hasSubscription, setHasSubscription] = useState<boolean | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkSubscriptionAndAdmin = async () => {
      try {
        if (!user) {
          // Redirect to home page instead of showing modal
          navigate('/', { replace: true });
          setIsLoading(false);
          return;
        }

        // Check if user is admin
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('is_admin')
          .eq('id', user.id)
          .single();

        if (profileError && profileError.code !== 'PGRST116') {
          console.error('Error checking profile:', profileError);
          // If profile doesn't exist, user is not admin
          setIsAdmin(false);
        } else {
          setIsAdmin(profileData?.is_admin || false);
        }

        // If user is admin, no need to check subscription
        if (profileData?.is_admin || false) {
          setHasSubscription(true);
          setIsLoading(false);
          return;
        }

        // Check for active subscription
        const { data: subscriptionData, error: subscriptionError } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .gt('current_period_end', new Date().toISOString())
          .maybeSingle();

        if (subscriptionError) throw subscriptionError;

        setHasSubscription(!!subscriptionData);
      } catch (error) {
        console.error('Error checking subscription:', error);
        setHasSubscription(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkSubscriptionAndAdmin();
  }, [user, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || (!hasSubscription && !isAdmin)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-md max-w-md w-full text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            {!user ? 'Sign In Required' : 'Subscription Required'}
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {!user
              ? 'Please sign in to access the dashboard'
              : 'You need an active subscription to access the dashboard'}
          </p>
          <button
            onClick={() => navigate('/', { replace: true })}
            className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 transition-colors"
          >
            {!user ? 'Go to Home Page' : 'View Plans'}
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
          </div>
        </div>
        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          onSuccess={() => {
            setShowAuthModal(false);
            window.location.reload();
          }}
        />
      </>
    );
  }

  return <>{children}</>;
}