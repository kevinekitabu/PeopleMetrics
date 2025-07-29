import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth as firebaseAuth } from '../lib/firebase';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AuthModal({ isOpen, onClose, onSuccess }: AuthModalProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleAuthSuccess = () => {
    onSuccess();
    toast('Please select a plan to access the dashboard.');
    navigate('/'); // Redirect to landing page
  };

  if (!isOpen) return null;

  const handleGoogleSignIn = async () => {
    try {
      setIsLoading(true);
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(firebaseAuth, provider);
      const user = result.user;

      // Try to sign in with Supabase
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email!,
        password: user.uid
      });

      if (signInError && signInError.message.includes('Invalid login credentials')) {
        // User doesn't exist, create new account
        const { error: signUpError } = await supabase.auth.signUp({
          email: user.email!,
          password: user.uid,
          options: {
            data: {
              full_name: user.displayName,
              avatar_url: user.photoURL
            }
          }
        });

        if (signUpError) throw signUpError;

        // Wait for profile creation
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Sign in after signup
        const { data: finalSignInData, error: finalSignInError } = await supabase.auth.signInWithPassword({
          email: user.email!,
          password: user.uid
        });

        if (finalSignInError) throw finalSignInError;
        
        if (finalSignInData.session) {
          handleAuthSuccess();
        }
      } else if (signInError) {
        throw signInError;
      } else if (signInData.session) {
        handleAuthSuccess();
      }
    } catch (error) {
      console.error('Google sign in error:', error);
      toast.error('Failed to sign in with Google');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (mode === 'login') {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;
        if (data.session) {
          onSuccess();
        }
      } else {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        });

        if (signUpError) throw signUpError;

        // Wait for profile creation
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Sign in after signup
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) throw signInError;
        if (signInData.session) {
          handleAuthSuccess();
        }
      }
    } catch (error: any) {
      toast.error(error.message || 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-blue-900/90 via-blue-800/90 to-blue-900/90 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-blue-950 rounded-2xl max-w-md w-full p-8 shadow-2xl border border-blue-200 dark:border-blue-800">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-blue-900 dark:text-yellow-300">
            {mode === 'login' ? 'Sign In' : 'Create Account'}
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

        <button
          onClick={handleGoogleSignIn}
          disabled={isLoading}
          className="w-full flex justify-center items-center px-4 py-2 border border-blue-200 dark:border-blue-700 shadow-sm text-sm font-medium rounded-lg text-blue-900 dark:text-yellow-200 bg-white dark:bg-blue-900 hover:bg-yellow-50 dark:hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:ring-offset-2 mb-4 transition-all"
        >
          <i className="fab fa-google text-xl mr-2 text-yellow-400"></i>
          Continue with Google
        </button>

        <div className="relative mb-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-blue-200 dark:border-blue-700"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white dark:bg-blue-950 text-blue-400 dark:text-yellow-200">Or continue with email</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-blue-900 dark:text-yellow-200">
              Email address
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full rounded-lg border-blue-200 dark:border-blue-700 bg-white dark:bg-blue-900 text-blue-900 dark:text-yellow-200 shadow-sm focus:border-yellow-400 focus:ring-yellow-400 sm:text-sm transition-all"
              required
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-blue-900 dark:text-yellow-200">
              Password
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full rounded-lg border-blue-200 dark:border-blue-700 bg-white dark:bg-blue-900 text-blue-900 dark:text-yellow-200 shadow-sm focus:border-yellow-400 focus:ring-yellow-400 sm:text-sm transition-all"
              required
              minLength={6}
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white ${
              isLoading ? 'bg-blue-400 dark:bg-blue-700' : 'bg-yellow-400 hover:bg-yellow-500 dark:bg-yellow-500 dark:hover:bg-yellow-400'
            } focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:ring-offset-2 transition-all`}
          >
            {isLoading ? 'Processing...' : mode === 'login' ? 'Sign In' : 'Sign Up'}
          </button>

          <button
            type="button"
            onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
            className="w-full text-sm text-blue-700 dark:text-yellow-300 hover:text-yellow-500 dark:hover:text-yellow-400 transition-colors"
          >
            {mode === 'login'
              ? "Don't have an account? Sign up"
              : 'Already have an account? Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}