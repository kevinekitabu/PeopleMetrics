import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth as firebaseAuth } from '../lib/firebase';
import toast from 'react-hot-toast';
import '@fortawesome/fontawesome-free/css/all.min.css';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [resetPassword, setResetPassword] = useState(false);

  const from = location.state?.from?.pathname || '/dashboard';

  const handleGoogleSignIn = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(firebaseAuth, provider);
      const user = result.user;

      // Sign in with Supabase using the Firebase token
      const { data, error } = await supabase.auth.signInWithPassword({
        email: user.email!,
        password: user.uid // Use Firebase UID as password
      });

      if (error && error.message.includes('Invalid login credentials')) {
        // User doesn't exist in Supabase, create a new account
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
      } else if (error) {
        throw error;
      }

      navigate(from, { replace: true });
    } catch (error) {
      console.error('Google sign in error:', error);
      toast.error('Failed to sign in with Google');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (resetPassword) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/callback`,
        });

        if (error) throw error;
        
        toast.success('Password reset instructions have been sent to your email');
        setResetPassword(false);
        setEmail('');
        return;
      }

      if (mode === 'login') {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          console.error('Login error:', error);
          
          if (error.message.includes('Invalid login credentials') || 
              error.message.includes('Email not confirmed') ||
              error.message.includes('Invalid email or password')) {
            toast.error('Invalid email or password. Please check your credentials and try again.');
          } else if (error.message.includes('Email not confirmed')) {
            toast.error('Please check your email and confirm your account before signing in.');
          } else if (error.message.includes('Too many requests')) {
            toast.error('Too many login attempts. Please wait a moment and try again.');
          } else {
            toast.error('Login failed. Please try again or contact support.');
          }
          return;
        }

        if (data?.user) {
          console.log('Login successful for user:', data.user.email);
          navigate(from, { replace: true });
        }
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
            data: {
              email_confirm: false // Disable email confirmation for faster signup
            }
          }
        });

        if (error) {
          console.error('Signup error:', error);
          
          if (error.message.includes('already registered')) {
            toast.error('An account with this email already exists. Please try logging in instead.');
            setMode('login');
          } else if (error.message.includes('Password should be at least')) {
            toast.error('Password must be at least 6 characters long.');
          } else if (error.message.includes('Unable to validate email address')) {
            toast.error('Please enter a valid email address.');
          } else {
            toast.error('Account creation failed. Please try again.');
          }
          return;
        }

        if (data.user) {
          console.log('Signup successful for user:', data.user.email);
          
          if (data.session) {
            // User is automatically signed in
            toast.success('Account created successfully! Welcome!');
            navigate(from, { replace: true });
          } else {
            // User needs to confirm email
            toast.success('Account created! Please check your email to confirm your account.');
            setMode('login');
            setPassword('');
          }
        }
      }
    } catch (error: any) {
      console.error('Authentication error:', error);
      toast.error('An unexpected error occurred. Please check your internet connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            {resetPassword ? 'Reset Password' : mode === 'login' ? 'Sign in to your account' : 'Create a new account'}
          </h2>
        </div>

        {/* Social Login */}
        <div className="mt-6">
          <button
            onClick={handleGoogleSignIn}
            className="w-full flex justify-center items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <i className="fab fa-google text-xl mr-2"></i>
            Continue with Google
          </button>
        </div>

        <div className="mt-6 relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-gray-100 text-gray-500">Or continue with email</span>
          </div>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="email-address" className="sr-only">
                Email address
              </label>
              <input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            {!resetPassword && (
              <div>
                <label htmlFor="password" className="sr-only">
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  required
                  className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={6}
                />
              </div>
            )}
          </div>

          <div className="flex flex-col gap-4">
            <button
              type="submit"
              disabled={isLoading}
              className={`group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white ${
                isLoading ? 'bg-indigo-400' : 'bg-indigo-600 hover:bg-indigo-700'
              } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500`}
            >
              {isLoading
                ? 'Processing...'
                : resetPassword
                ? 'Send Reset Instructions'
                : mode === 'login'
                ? 'Sign in'
                : 'Sign up'}
            </button>
            
            {!resetPassword && (
              <button
                type="button"
                onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
                className="text-sm text-indigo-600 hover:text-indigo-500"
              >
                {mode === 'login'
                  ? "Don't have an account? Sign up"
                  : 'Already have an account? Sign in'}
              </button>
            )}
            
            {!resetPassword && mode === 'login' && (
              <button
                type="button"
                onClick={() => setResetPassword(true)}
                className="text-sm text-indigo-600 hover:text-indigo-500"
              >
                Forgot your password?
              </button>
            )}
            
            {resetPassword && (
              <button
                type="button"
                onClick={() => setResetPassword(false)}
                className="text-sm text-indigo-600 hover:text-indigo-500"
              >
                Back to sign in
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}