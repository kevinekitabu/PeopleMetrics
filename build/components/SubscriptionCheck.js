import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useAuth } from './AuthProvider';
import { supabase } from '../lib/supabase';
import { useEffect, useState } from 'react';
import AuthModal from './AuthModal';
export default function SubscriptionCheck({ children }) {
    const { user } = useAuth();
    const [hasSubscription, setHasSubscription] = useState(null);
    const [isAdmin, setIsAdmin] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [showAuthModal, setShowAuthModal] = useState(false);
    useEffect(() => {
        const checkSubscriptionAndAdmin = async () => {
            try {
                if (!user) {
                    setShowAuthModal(true);
                    setIsLoading(false);
                    return;
                }
                // Check if user is admin
                const { data: profileData, error: profileError } = await supabase
                    .from('profiles')
                    .select('is_admin')
                    .eq('id', user.id)
                    .single();
                if (profileError)
                    throw profileError;
                setIsAdmin(profileData?.is_admin || false);
                // If user is admin, no need to check subscription
                if (profileData?.is_admin) {
                    setHasSubscription(true);
                    setIsLoading(false);
                    return;
                }
                // Check for active subscription
                const { data: subscriptionData, error: subscriptionError } = await supabase
                    .from('subscriptions')
                    .select('*')
                    .eq('user_id', user.id)
                    .eq('status', 'active')
                    .gt('current_period_end', new Date().toISOString())
                    .maybeSingle();
                if (subscriptionError)
                    throw subscriptionError;
                setHasSubscription(!!subscriptionData);
            }
            catch (error) {
                console.error('Error checking subscription:', error);
                setHasSubscription(false);
            }
            finally {
                setIsLoading(false);
            }
        };
        checkSubscriptionAndAdmin();
    }, [user]);
    if (isLoading) {
        return (_jsx("div", { className: "min-h-screen flex items-center justify-center", children: _jsx("div", { className: "animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" }) }));
    }
    if (!user || (!hasSubscription && !isAdmin)) {
        return (_jsxs(_Fragment, { children: [_jsx("div", { className: "min-h-screen flex items-center justify-center bg-gray-100", children: _jsxs("div", { className: "bg-white p-8 rounded-lg shadow-md max-w-md w-full text-center", children: [_jsx("h2", { className: "text-2xl font-bold text-gray-900 mb-4", children: !user ? 'Sign In Required' : 'Subscription Required' }), _jsx("p", { className: "text-gray-600 mb-6", children: !user
                                    ? 'Please sign in to access the dashboard'
                                    : 'You need an active subscription to access the dashboard' }), !user ? (_jsx("button", { onClick: () => setShowAuthModal(true), className: "w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 transition-colors", children: "Sign In" })) : (_jsx("button", { onClick: () => window.location.href = '/', className: "w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 transition-colors", children: "View Plans" }))] }) }), _jsx(AuthModal, { isOpen: showAuthModal, onClose: () => setShowAuthModal(false), onSuccess: () => {
                        setShowAuthModal(false);
                        window.location.reload();
                    } })] }));
    }
    return _jsx(_Fragment, { children: children });
}
