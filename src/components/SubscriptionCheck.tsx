import React from 'react';
import { useLocation, Navigate } from 'react-router-dom';
import { useAuth } from './AuthProvider';
import { supabase } from '../lib/supabase';
import { useEffect, useState } from 'react';
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
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 3;

  // Define admin emails - these users can access dashboard without subscription
  const adminEmails = [
    'admin@gmail.com',
    'peoplemetricssolutions@gmail.com',
    'michelle.gacigi@gmail.com',
    'superadmin@mail.com'
  ];

  useEffect(() => {
    const checkSubscriptionAndAdmin = async () => {
      try {
        if (!user) {
          setIsLoading(false);
          return;
        }

        // Check if user is admin by email first (primary check)
        let isAdminUser = false;
        if (user.email && adminEmails.includes(user.email)) {
          isAdminUser = true;
          console.log('Admin user detected by email:', user.email);
        }

        // Also check database profile for admin flag
        try {
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('is_admin')
            .eq('id', user.id)
            .single();

          if (!profileError && profileData?.is_admin) {
            isAdminUser = true;
            console.log('Admin user detected by database flag');
          }

          // Update profile to mark as admin if they're in admin emails but not flagged
          if (isAdminUser && !profileData?.is_admin) {
            await supabase
              .from('profiles')
              .update({ is_admin: true })
              .eq('id', user.id);
            console.log('Updated profile to mark user as admin');
          }
        } catch (profileError) {
          console.warn('Could not check/update profile, but continuing with email-based admin check:', profileError);
        }

        setIsAdmin(isAdminUser);

        // If user is admin, skip subscription check and allow access
        if (isAdminUser) {
          setHasSubscription(true);
          setIsLoading(false);
          console.log('Admin user granted access without subscription check');
          return;
        }

        // For non-admin users, check for active subscription
        try {
          const { data: subscriptionData, error: subscriptionError } = await supabase
            .from('subscriptions')
            .select('*')
            .eq('user_id', user.id)
            .eq('status', 'active')
            .gt('current_period_end', new Date().toISOString())
            .maybeSingle();

          if (subscriptionError) {
            console.error('Error checking subscription:', subscriptionError);
            if (retryCount < maxRetries) {
              setTimeout(() => {
                setRetryCount((prev) => prev + 1);
              }, 1000 * (retryCount + 1));
              return;
            }
            throw subscriptionError;
          }

          const hasActiveSubscription = !!subscriptionData;
          setHasSubscription(hasActiveSubscription);

          if (!hasActiveSubscription) {
            console.log('No active subscription found for user');
          } else {
            console.log('Active subscription found:', subscriptionData);
          }
        } catch (subscriptionError) {
          console.error('Error checking subscription:', subscriptionError);
          setHasSubscription(false);
        }

      } catch (error) {
        console.error('Error checking subscription:', error);
        setHasSubscription(false);
        setIsAdmin(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkSubscriptionAndAdmin();
  }, [user, retryCount]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Verifying access...</p>
        </div>
      </div>
    );
  }

  // If no user, redirect to login
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // If user doesn't have subscription and is not admin, redirect to landing page
  if (!hasSubscription && !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-md max-w-md w-full text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            Subscription Required
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            You need an active subscription to access the dashboard. Please select a plan to continue.
          </p>
          <button
            onClick={() => window.location.href = '/'}
            className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 transition-colors"
          >
            View Plans
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}