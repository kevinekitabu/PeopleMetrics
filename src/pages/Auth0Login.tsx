import { useEffect } from 'react';
import { useAuth0Context } from '../contexts/Auth0Context';

export default function Auth0Login() {
  const { loginWithRedirect, isAuthenticated } = useAuth0Context();

  useEffect(() => {
    if (!isAuthenticated) {
      loginWithRedirect({
        appState: {
          returnTo: '/dashboard'
        }
      });
    }
  }, [isAuthenticated, loginWithRedirect]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
        <p className="text-gray-600 dark:text-gray-400">Redirecting to login...</p>
      </div>
    </div>
  );
}