import { useAuth0Context } from '../contexts/Auth0Context';

interface Auth0ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function Auth0Modal({ isOpen, onClose, onSuccess }: Auth0ModalProps) {
  const { loginWithRedirect, isLoading } = useAuth0Context();

  if (!isOpen) return null;

  const handleLogin = () => {
    loginWithRedirect({
      appState: {
        returnTo: '/dashboard'
      }
    });
  };

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-blue-900/90 via-blue-800/90 to-blue-900/90 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-blue-950 rounded-2xl max-w-md w-full p-8 shadow-2xl border border-blue-200 dark:border-blue-800">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-blue-900 dark:text-yellow-300">
            Sign In
          </h2>
          <button
            onClick={onClose}
            className="text-blue-400 hover:text-yellow-400 transition-colors"
            title="Close"
            aria-label="Close"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="text-center">
          <p className="text-blue-800 dark:text-yellow-200 mb-6">
            Sign in to access your dashboard and manage your HR reports.
          </p>

          <button
            onClick={handleLogin}
            disabled={isLoading}
            className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white ${
              isLoading ? 'bg-blue-400 dark:bg-blue-700' : 'bg-yellow-400 hover:bg-yellow-500 dark:bg-yellow-500 dark:hover:bg-yellow-400'
            } focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:ring-offset-2 transition-all`}
          >
            {isLoading ? (
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Signing in...
              </div>
            ) : (
              'Sign In with Auth0'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}