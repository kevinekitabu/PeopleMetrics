import React from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from './AuthProvider';
import { supabase } from '../lib/supabase';
import { useEffect, useState } from 'react';
import AuthModal from './AuthModal';
import { toast } from 'react-hot-toast';

interface SubscriptionCheckProps {
  children: React.ReactNode;
}

export default function SubscriptionCheck({ children }: SubscriptionCheckProps) {
  const { user } = useAuth();
  const location = useLocation();
  const [hasSubscription, setHasSubscription] = useState<boolean | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 3;

  // Define admin emails here for global access in function
  const adminEmails = ['admin@gmail.com']; // <-- update with your admin email(s)

  useEffect(() => {
    const checkSubscriptionAndAdmin = async () => {
      try {
        if (!user) {
          setShowAuthModal(true);
          setIsLoading(false);
          return;
        }

        // Check if user is admin
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('is_admin')
          .eq('id', user.id)
          .single();

        // Fallback: allow access for known admin emails
        let adminOverride = false;
        if (user.email && adminEmails.includes(user.email)) {
          adminOverride = true;
        }

        if (profileError) {
          if (retryCount < maxRetries) {
            setTimeout(() => {
              setRetryCount((prev) => prev + 1);
            }, 1000 * (retryCount + 1));
            return;
          }
          // If adminOverride, allow access
          if (adminOverride) {
            setIsAdmin(true);
            setHasSubscription(true);
            setIsLoading(false);
            return;
          }
          throw profileError;
        }

        setIsAdmin(profileData?.is_admin === true || adminOverride);

        // If user is admin, skip subscription check and always allow access
        if (profileData?.is_admin === true || adminOverride) {
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

        if (subscriptionError) {
          if (retryCount < maxRetries) {
            setTimeout(() => {
              setRetryCount((prev) => prev + 1);
            }, 1000 * (retryCount + 1));
            return;
          }
          throw subscriptionError;
        }

        setHasSubscription(!!subscriptionData);

        // If no subscription, notify and redirect to pricing
        if (!subscriptionData) {
          toast('You need an active subscription to access the dashboard. Redirecting to pricing...');
          window.location.href = '/pricing';
        }
      } catch (error) {
        console.error('Error checking subscription:', error);
        // If adminOverride, allow access
        if (user && user.email && adminEmails.includes(user.email)) {
          setIsAdmin(true);
          setHasSubscription(true);
          setIsLoading(false);
          return;
        }
        toast.error('Failed to verify subscription status. Please try refreshing the page.');
        setHasSubscription(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkSubscriptionAndAdmin();
  }, [user, retryCount]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  // Refine redirection logic to avoid loops
  if (!user || (!hasSubscription && !isAdmin)) {
    if (location.pathname !== '/') {
      window.location.href = '/'; // Redirect to the landing page only if not already there
    }
    return null; // Prevent rendering anything else
  }

  return <>{children}</>;
}