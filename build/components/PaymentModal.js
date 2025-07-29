import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
export default function PaymentModal({ isOpen, onClose, selectedPlan }) {
    // Removed unused paymentMethod state
    const [paymentStatus, setPaymentStatus] = useState('idle');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [statusMessage, setStatusMessage] = useState('');
    const [pollInterval, setPollInterval] = useState(null);
    // Cleanup polling on unmount or when payment completes/fails
    useEffect(() => {
        return () => {
            if (pollInterval) {
                clearInterval(pollInterval);
            }
        };
    }, [pollInterval]);
    // Reset state when modal closes
    useEffect(() => {
        if (!isOpen) {
            setPaymentStatus('idle');
            setStatusMessage('');
            setPhoneNumber('');
            if (pollInterval) {
                clearInterval(pollInterval);
                setPollInterval(null);
            }
        }
    }, [isOpen]);
    if (!isOpen)
        return null;
    const handleMpesaPayment = async (e) => {
        e.preventDefault();
        try {
            setPaymentStatus('processing');
            setStatusMessage('Initiating M-Pesa payment...');
            // Format phone number if needed
            const formattedPhone = phoneNumber.startsWith('254') ? phoneNumber : `254${phoneNumber.replace(/^0+/, '')}`;
            // Call M-Pesa Edge Function
            const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mpesa-payment`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_KEY}`,
                    'X-Client-Info': 'payment-modal'
                },
                body: JSON.stringify({
                    phoneNumber: formattedPhone,
                    amount: selectedPlan.price,
                    plan: selectedPlan.name,
                    interval: selectedPlan.interval
                })
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Payment failed');
            }
            const data = await response.json();
            if (!data.CheckoutRequestID) {
                throw new Error('Invalid response from M-Pesa');
            }
            setStatusMessage('Please check your phone for the M-Pesa prompt...');
            toast.success('M-Pesa payment request sent. Check your phone for the STK push.');
            let attempts = 0;
            const maxAttempts = 24; // 2 minutes (5 seconds * 24)
            // Poll for payment status
            const interval = window.setInterval(async () => {
                try {
                    attempts++;
                    const statusResponse = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mpesa-status`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_KEY}`,
                            'X-Client-Info': 'payment-modal'
                        },
                        body: JSON.stringify({ CheckoutRequestID: data.CheckoutRequestID })
                    });
                    if (!statusResponse.ok) {
                        const errorData = await statusResponse.json();
                        throw new Error(errorData.error || 'Failed to check payment status');
                    }
                    const { status, message } = await statusResponse.json();
                    if (status === 'COMPLETED') {
                        clearInterval(interval);
                        setPollInterval(null);
                        setPaymentStatus('completed');
                        setStatusMessage('Payment successful! Setting up your subscription...');
                        // Update user's subscription
                        const { error: supabaseError } = await supabase
                            .from('subscriptions')
                            .insert({
                            plan: selectedPlan.name,
                            interval: selectedPlan.interval,
                            status: 'active',
                            current_period_end: new Date(Date.now() + (selectedPlan.interval === 'month' ? 30 : 365) * 24 * 60 * 60 * 1000)
                        });
                        if (supabaseError)
                            throw supabaseError;
                        toast.success('Payment successful! Your subscription is now active.');
                        setTimeout(() => onClose(), 2000);
                    }
                    else if (status === 'FAILED') {
                        clearInterval(interval);
                        setPollInterval(null);
                        setPaymentStatus('failed');
                        setStatusMessage(message || 'Payment failed. Please try again.');
                        toast.error(message || 'Payment failed');
                    }
                    else if (attempts >= maxAttempts) {
                        clearInterval(interval);
                        setPollInterval(null);
                        setPaymentStatus('failed');
                        setStatusMessage('Payment request timed out. Please try again.');
                        toast.error('Payment request timed out');
                    }
                    else {
                        setStatusMessage(message || 'Waiting for payment confirmation...');
                    }
                }
                catch (error) {
                    clearInterval(interval);
                    setPollInterval(null);
                    setPaymentStatus('failed');
                    setStatusMessage(error instanceof Error ? error.message : 'Failed to check payment status');
                    toast.error('Failed to check payment status');
                }
            }, 5000);
            setPollInterval(interval);
        }
        catch (error) {
            setPaymentStatus('failed');
            setStatusMessage(error instanceof Error ? error.message : 'Payment failed');
            toast.error(error instanceof Error ? error.message : 'Payment failed');
        }
    };
    const getStatusColor = () => {
        switch (paymentStatus) {
            case 'processing':
                return 'text-blue-600';
            case 'completed':
                return 'text-green-600';
            case 'failed':
                return 'text-red-600';
            default:
                return 'text-gray-600';
        }
    };
    return (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50", children: _jsxs("div", { className: "bg-white rounded-lg max-w-md w-full p-6", children: [_jsxs("div", { className: "flex justify-between items-center mb-6", children: [_jsx("h2", { className: "text-xl font-semibold", children: "Payment Details" }), paymentStatus !== 'processing' && (_jsx("button", { onClick: onClose, className: "text-gray-500 hover:text-gray-700", children: _jsx("svg", { className: "w-6 h-6", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M6 18L18 6M6 6l12 12" }) }) }))] }), _jsxs("div", { className: "mb-6", children: [_jsxs("div", { className: "flex justify-between mb-2", children: [_jsx("span", { children: "Selected Plan:" }), _jsx("span", { className: "font-semibold", children: selectedPlan.name })] }), _jsxs("div", { className: "flex justify-between", children: [_jsx("span", { children: "Amount:" }), _jsxs("span", { className: "font-semibold", children: ["$", selectedPlan.price, "/", selectedPlan.interval] })] })] }), paymentStatus === 'idle' ? (_jsxs("form", { onSubmit: handleMpesaPayment, className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "M-Pesa Phone Number" }), _jsxs("div", { className: "relative", children: [_jsx("input", { type: "tel", value: phoneNumber, onChange: (e) => setPhoneNumber(e.target.value), placeholder: "254700000000", className: "w-full px-3 py-2 border rounded-lg", pattern: "^(254|0)[0-9]{9}$", title: "Please enter a valid phone number starting with 254 or 0", required: true }), _jsx("p", { className: "mt-1 text-sm text-gray-500", children: "Format: 254XXXXXXXXX or 07XXXXXXXX" })] })] }), _jsx("button", { type: "submit", className: "w-full py-2 px-4 rounded-lg text-white bg-indigo-600 hover:bg-indigo-700", children: "Pay with M-Pesa" })] })) : (_jsxs("div", { className: "text-center py-4", children: [paymentStatus === 'processing' && (_jsx("div", { className: "animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4" })), paymentStatus === 'completed' && (_jsx("div", { className: "text-green-500 text-5xl mb-4", children: "\u2713" })), paymentStatus === 'failed' && (_jsx("div", { className: "text-red-500 text-5xl mb-4", children: "\u00D7" })), _jsx("p", { className: `text-lg ${getStatusColor()}`, children: statusMessage }), paymentStatus === 'failed' && (_jsx("button", { onClick: () => {
                                setPaymentStatus('idle');
                                setStatusMessage('');
                            }, className: "mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700", children: "Try Again" }))] }))] }) }));
}
