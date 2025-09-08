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
          onSuccess();
        }
      } else if (signInError) {
        throw signInError;
      } else if (signInData.session) {
        onSuccess();
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
          onSuccess();
        }
      }
    } catch (error: any) {
      toast.error(error.message || 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-blue-950 rounded-2xl max-w-md w-full p-8 shadow-2xl border border-blue-200 dark:border-blue-800">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            {mode === 'login' ? 'Sign In' : 'Create Account'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors"
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
          className="w-full flex justify-center items-center px-4 py-3 border border-gray-300 dark:border-gray-600 shadow-sm text-sm font-medium rounded-lg text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 mb-6 transition-all"
        >
          <i className="fab fa-google text-xl mr-3 text-red-500"></i>
          Continue with Google
        </button>

        <div className="relative mb-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300 dark:border-gray-600"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white dark:bg-blue-950 text-gray-500 dark:text-gray-400">Or continue with email</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Email address
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm transition-all"
              required
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Password
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm transition-all"
              required
              minLength={6}
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white ${
              isLoading ? 'bg-indigo-400' : 'bg-indigo-600 hover:bg-indigo-700'
            } focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all`}
          >
            {isLoading ? 'Processing...' : mode === 'login' ? 'Sign In' : 'Sign Up'}
          </button>

          <button
            type="button"
            onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
            className="w-full text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 transition-colors"
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