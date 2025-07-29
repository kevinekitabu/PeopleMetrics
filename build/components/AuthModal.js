import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth as firebaseAuth } from '../lib/firebase';
import toast from 'react-hot-toast';
export default function AuthModal({ isOpen, onClose, onSuccess }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [mode, setMode] = useState('login');
    const [isLoading, setIsLoading] = useState(false);
    if (!isOpen)
        return null;
    const handleGoogleSignIn = async () => {
        try {
            setIsLoading(true);
            const provider = new GoogleAuthProvider();
            const result = await signInWithPopup(firebaseAuth, provider);
            const user = result.user;
            // Try to sign in with Supabase
            const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
                email: user.email,
                password: user.uid
            });
            if (signInError && signInError.message.includes('Invalid login credentials')) {
                // User doesn't exist, create new account
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
                // Wait for profile creation
                await new Promise(resolve => setTimeout(resolve, 1000));
                // Sign in after signup
                const { data: finalSignInData, error: finalSignInError } = await supabase.auth.signInWithPassword({
                    email: user.email,
                    password: user.uid
                });
                if (finalSignInError)
                    throw finalSignInError;
                if (finalSignInData.session) {
                    onSuccess();
                }
            }
            else if (signInError) {
                throw signInError;
            }
            else if (signInData.session) {
                onSuccess();
            }
        }
        catch (error) {
            console.error('Google sign in error:', error);
            toast.error('Failed to sign in with Google');
        }
        finally {
            setIsLoading(false);
        }
    };
    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            if (mode === 'login') {
                const { data, error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                if (error)
                    throw error;
                if (data.session) {
                    onSuccess();
                }
            }
            else {
                const { error: signUpError } = await supabase.auth.signUp({
                    email,
                    password,
                });
                if (signUpError)
                    throw signUpError;
                // Wait for profile creation
                await new Promise(resolve => setTimeout(resolve, 1000));
                // Sign in after signup
                const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                if (signInError)
                    throw signInError;
                if (signInData.session) {
                    onSuccess();
                }
            }
        }
        catch (error) {
            toast.error(error.message || 'Authentication failed');
        }
        finally {
            setIsLoading(false);
        }
    };
    return (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50", children: _jsxs("div", { className: "bg-white rounded-lg max-w-md w-full p-6", children: [_jsxs("div", { className: "flex justify-between items-center mb-6", children: [_jsx("h2", { className: "text-xl font-semibold", children: mode === 'login' ? 'Sign In' : 'Create Account' }), _jsx("button", { onClick: onClose, className: "text-gray-500 hover:text-gray-700", children: _jsx("svg", { className: "w-6 h-6", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M6 18L18 6M6 6l12 12" }) }) })] }), _jsxs("button", { onClick: handleGoogleSignIn, disabled: isLoading, className: "w-full flex justify-center items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 mb-4", children: [_jsx("i", { className: "fab fa-google text-xl mr-2" }), "Continue with Google"] }), _jsxs("div", { className: "relative mb-4", children: [_jsx("div", { className: "absolute inset-0 flex items-center", children: _jsx("div", { className: "w-full border-t border-gray-300" }) }), _jsx("div", { className: "relative flex justify-center text-sm", children: _jsx("span", { className: "px-2 bg-white text-gray-500", children: "Or continue with email" }) })] }), _jsxs("form", { onSubmit: handleSubmit, className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { htmlFor: "email", className: "block text-sm font-medium text-gray-700", children: "Email address" }), _jsx("input", { type: "email", id: "email", value: email, onChange: (e) => setEmail(e.target.value), className: "mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm", required: true })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "password", className: "block text-sm font-medium text-gray-700", children: "Password" }), _jsx("input", { type: "password", id: "password", value: password, onChange: (e) => setPassword(e.target.value), className: "mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm", required: true, minLength: 6 })] }), _jsx("button", { type: "submit", disabled: isLoading, className: `w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${isLoading ? 'bg-indigo-400' : 'bg-indigo-600 hover:bg-indigo-700'} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500`, children: isLoading ? 'Processing...' : mode === 'login' ? 'Sign In' : 'Sign Up' }), _jsx("button", { type: "button", onClick: () => setMode(mode === 'login' ? 'signup' : 'login'), className: "w-full text-sm text-indigo-600 hover:text-indigo-500", children: mode === 'login'
                                ? "Don't have an account? Sign up"
                                : 'Already have an account? Sign in' })] })] }) }));
}
