import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
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
    const [mode, setMode] = useState('login');
    const [resetPassword, setResetPassword] = useState(false);
    const from = location.state?.from?.pathname || '/dashboard';
    const handleGoogleSignIn = async () => {
        try {
            const provider = new GoogleAuthProvider();
            const result = await signInWithPopup(firebaseAuth, provider);
            const user = result.user;
            // Sign in with Supabase using the Firebase token
            const { error } = await supabase.auth.signInWithPassword({
                email: user.email,
                password: user.uid // Use Firebase UID as password
            });
            if (error && error.message.includes('Invalid login credentials')) {
                // User doesn't exist in Supabase, create a new account
                const { error: signUpError } = await supabase.auth.signUp({
                    email: user.email,
                    password: user.uid,
                    options: {
                        data: {
                            full_name: user.displayName,
                            avatar_url: user.photoURL
                        }
                    }
                });
                if (signUpError)
                    throw signUpError;
            }
            else if (error) {
                throw error;
            }
            navigate(from, { replace: true });
        }
        catch (error) {
            console.error('Google sign in error:', error);
            toast.error('Failed to sign in with Google');
        }
    };
    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            if (resetPassword) {
                const { error } = await supabase.auth.resetPasswordForEmail(email, {
                    redirectTo: `${window.location.origin}/auth/callback`,
                });
                if (error)
                    throw error;
                toast.success('Password reset instructions have been sent to your email');
                setResetPassword(false);
                return;
            }
            if (mode === 'login') {
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                if (error) {
                    if (error.message === 'Invalid login credentials') {
                        toast.error('Invalid email or password. Please check your credentials or use the password reset option.');
                    }
                    else {
                        toast.error(error.message);
                    }
                    return;
                }
                navigate(from, { replace: true });
            }
            else {
                const { data, error } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        emailRedirectTo: `${window.location.origin}/auth/callback`
                    }
                });
                if (error) {
                    if (error.message.includes('already registered')) {
                        toast.error('An account with this email already exists. Please try logging in instead.');
                        setMode('login');
                    }
                    else {
                        toast.error(error.message);
                    }
                    return;
                }
                if (data.user) {
                    toast.success('Account created successfully! You can now log in.');
                    setMode('login');
                    setEmail('');
                    setPassword('');
                }
            }
        }
        catch (error) {
            toast.error('An unexpected error occurred. Please try again.');
            console.error('Error:', error);
        }
        finally {
            setIsLoading(false);
        }
    };
    return (_jsx("div", { className: "min-h-screen bg-gray-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8", children: _jsxs("div", { className: "max-w-md w-full space-y-8", children: [_jsx("div", { children: _jsx("h2", { className: "mt-6 text-center text-3xl font-extrabold text-gray-900", children: resetPassword ? 'Reset Password' : mode === 'login' ? 'Sign in to your account' : 'Create a new account' }) }), _jsx("div", { className: "mt-6", children: _jsxs("button", { onClick: handleGoogleSignIn, className: "w-full flex justify-center items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500", children: [_jsx("i", { className: "fab fa-google text-xl mr-2" }), "Continue with Google"] }) }), _jsxs("div", { className: "mt-6 relative", children: [_jsx("div", { className: "absolute inset-0 flex items-center", children: _jsx("div", { className: "w-full border-t border-gray-300" }) }), _jsx("div", { className: "relative flex justify-center text-sm", children: _jsx("span", { className: "px-2 bg-gray-100 text-gray-500", children: "Or continue with email" }) })] }), _jsxs("form", { className: "mt-8 space-y-6", onSubmit: handleSubmit, children: [_jsxs("div", { className: "rounded-md shadow-sm -space-y-px", children: [_jsxs("div", { children: [_jsx("label", { htmlFor: "email-address", className: "sr-only", children: "Email address" }), _jsx("input", { id: "email-address", name: "email", type: "email", autoComplete: "email", required: true, className: "appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm", placeholder: "Email address", value: email, onChange: (e) => setEmail(e.target.value) })] }), !resetPassword && (_jsxs("div", { children: [_jsx("label", { htmlFor: "password", className: "sr-only", children: "Password" }), _jsx("input", { id: "password", name: "password", type: "password", autoComplete: mode === 'login' ? 'current-password' : 'new-password', required: true, className: "appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm", placeholder: "Password", value: password, onChange: (e) => setPassword(e.target.value), minLength: 6 })] }))] }), _jsxs("div", { className: "flex flex-col gap-4", children: [_jsx("button", { type: "submit", disabled: isLoading, className: `group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white ${isLoading ? 'bg-indigo-400' : 'bg-indigo-600 hover:bg-indigo-700'} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500`, children: isLoading
                                        ? 'Processing...'
                                        : resetPassword
                                            ? 'Send Reset Instructions'
                                            : mode === 'login'
                                                ? 'Sign in'
                                                : 'Sign up' }), !resetPassword && (_jsx("button", { type: "button", onClick: () => setMode(mode === 'login' ? 'signup' : 'login'), className: "text-sm text-indigo-600 hover:text-indigo-500", children: mode === 'login'
                                        ? "Don't have an account? Sign up"
                                        : 'Already have an account? Sign in' })), !resetPassword && mode === 'login' && (_jsx("button", { type: "button", onClick: () => setResetPassword(true), className: "text-sm text-indigo-600 hover:text-indigo-500", children: "Forgot your password?" })), resetPassword && (_jsx("button", { type: "button", onClick: () => setResetPassword(false), className: "text-sm text-indigo-600 hover:text-indigo-500", children: "Back to sign in" }))] })] })] }) }));
}
