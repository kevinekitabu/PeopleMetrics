import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { useAuth } from './AuthProvider';
import { supabase } from '../lib/supabase';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  const [hasSubscription, setHasSubscription] = useState<boolean | null>(null);

  useEffect(() => {
    const checkSubscription = async () => {
      if (!user) {
        setHasSubscription(false);
        return;
      }

      try {
        const { data: subscriptionData, error } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .gt('current_period_end', new Date().toISOString())
          .maybeSingle();

        if (error) {
          console.error('Error checking subscription:', error);
          toast.error('Failed to verify subscription status.');
          setHasSubscription(false);
        } else {
          setHasSubscription(!!subscriptionData);
        }
      } catch (err) {
        console.error('Unexpected error:', err);
        toast.error('An unexpected error occurred.');
        setHasSubscription(false);
      }
    };

    checkSubscription();
  }, [user]);

  if (loading || hasSubscription === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!user || !hasSubscription) {
    toast('You need an active subscription to access this page.');
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}