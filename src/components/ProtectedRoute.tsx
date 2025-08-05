import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthProvider';
import SubscriptionCheck from './SubscriptionCheck';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, session } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || !session) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  return (
    <SubscriptionCheck>
      {children}
    </SubscriptionCheck>
  );
}