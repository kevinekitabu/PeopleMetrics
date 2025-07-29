import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { useAuth } from '../components/AuthProvider';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedPlan: {
    name: string;
    price: number;
    interval: 'month' | 'year';
  };
}

type PaymentStatus = 'idle' | 'processing' | 'completed' | 'failed';

export default function PaymentModal({ isOpen, onClose, selectedPlan }: PaymentModalProps) {
  const { user } = useAuth();
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'mpesa'>('mpesa');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('idle');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [pollInterval, setPollInterval] = useState<NodeJS.Timeout | null>(null);
  const [checkoutRequestId, setCheckoutRequestId] = useState<string | null>(null);
  const [pollCount, setPollCount] = useState(0);
  const MAX_POLL_ATTEMPTS = 24; // 2 minutes (5 seconds * 24)

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
      setCheckoutRequestId(null);
      setPollCount(0);
      if (pollInterval) {
        clearInterval(pollInterval);
        setPollInterval(null);
      }
    }
  }, [isOpen, pollInterval]);

  if (!isOpen || !user) return null;

  const handleMpesaPayment = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate required fields
    if (!phoneNumber) {
      setPaymentStatus('failed');
      setStatusMessage('Phone number is required.');
      toast.error('Phone number is required.');
      return;
    }

    if (!selectedPlan || !selectedPlan.name || !selectedPlan.price || !selectedPlan.interval) {
      setPaymentStatus('failed');
      setStatusMessage('Selected plan details are missing.');
      toast.error('Selected plan details are missing.');
      return;
    }

    if (!user || !user.id) {
      setPaymentStatus('failed');
      setStatusMessage('User authentication is required.');
      toast.error('User authentication is required.');
      return;
    }

    console.log('Initiating payment with the following details:', {
      phoneNumber,
      amount: selectedPlan.price,
      plan: selectedPlan.name,
      interval: selectedPlan.interval,
      userId: user.id
    });

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
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'X-Client-Info': 'payment-modal'
        },
        body: JSON.stringify({
          phoneNumber: formattedPhone,
          amount: selectedPlan.price,
          plan: selectedPlan.name,
          interval: selectedPlan.interval,
          userId: user.id
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Payment failed');
      }

      const data = await response.json();
      console.log('M-Pesa payment initiated:', data);

      if (!data.CheckoutRequestID) {
        throw new Error('Invalid response from M-Pesa');
      }

      setCheckoutRequestId(data.CheckoutRequestID);
      setStatusMessage('Please check your phone for the M-Pesa prompt...');
      toast.success('M-Pesa payment request sent. Check your phone for the STK push.', {
        duration: 10000 // Show for 10 seconds
      });

      // Poll for payment status
      const interval = setInterval(async () => {
        if (!data.CheckoutRequestID) {
          clearInterval(interval);
          return;
        }

        try {
          setPollCount(prev => prev + 1);

          const statusResponse = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mpesa-status`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
              'X-Client-Info': 'payment-modal'
            },
            body: JSON.stringify({ CheckoutRequestID: data.CheckoutRequestID })
          });

          if (!statusResponse.ok) {
            throw new Error('Failed to check payment status');
          }

          const { status, message } = await statusResponse.json();
          console.log('Payment status check:', { status, message, pollCount: pollCount + 1 });

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

            if (supabaseError) throw supabaseError;

            toast.success('Payment successful! Your subscription is now active.');
            setTimeout(() => onClose(), 2000);
            return;
          } 
          
          if (status === 'FAILED') {
            clearInterval(interval);
            setPollInterval(null);
            setPaymentStatus('failed');
            setStatusMessage(message || 'Payment failed. Please try again.');
            toast.error(message || 'Payment failed');
            return;
          }

          // Update message for pending status
          setStatusMessage(message || 'Waiting for payment confirmation...');

          // Check if we've exceeded maximum poll attempts
          if (pollCount + 1 >= MAX_POLL_ATTEMPTS) {
            clearInterval(interval);
            setPollInterval(null);
            setPaymentStatus('failed');
            setStatusMessage('Payment request timed out. Please try again.');
            toast.error('Payment request timed out');
            return;
          }

        } catch (error) {
          console.error('Error checking payment status:', error);
          setStatusMessage('Checking payment status...');
          
          // Only stop polling if we've exceeded max attempts
          if (pollCount + 1 >= MAX_POLL_ATTEMPTS) {
            clearInterval(interval);
            setPollInterval(null);
            setPaymentStatus('failed');
            setStatusMessage('Payment status check failed. Please try again.');
            toast.error('Failed to verify payment status');
            return;
          }
        }
      }, 5000);

      setPollInterval(interval);
    } catch (error) {
      console.error('Payment initiation error:', error);
      setPaymentStatus('failed');
      setStatusMessage(error instanceof Error ? error.message : 'Payment failed');
      toast.error(error instanceof Error ? error.message : 'Payment failed');
    }
  };

  const getStatusColor = () => {
    switch (paymentStatus) {
      case 'processing':
        return 'text-blue-600 dark:text-blue-400';
      case 'completed':
        return 'text-green-600 dark:text-green-400';
      case 'failed':
        return 'text-red-600 dark:text-red-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-blue-900/90 via-blue-800/90 to-blue-900/90 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-blue-950 rounded-2xl max-w-md w-full p-8 shadow-2xl border border-blue-200 dark:border-blue-800">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-blue-900 dark:text-yellow-300">Payment Details</h2>
          {paymentStatus !== 'processing' && (
            <button
              onClick={onClose}
              className="text-blue-400 hover:text-yellow-400 transition-colors"
              title="Close"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        <div className="mb-6">
          <div className="flex justify-between mb-2">
            <span className="text-blue-700 dark:text-yellow-200">Selected Plan:</span>
            <span className="font-semibold text-blue-900 dark:text-yellow-100">{selectedPlan.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-blue-700 dark:text-yellow-200">Amount:</span>
            <span className="font-semibold text-blue-900 dark:text-yellow-100">
              ${selectedPlan.price}/{selectedPlan.interval}
            </span>
          </div>
        </div>

        {paymentStatus === 'idle' ? (
          <form onSubmit={handleMpesaPayment} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-blue-900 dark:text-yellow-200 mb-1">
                M-Pesa Phone Number
              </label>
              <div className="relative">
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="254700000000"
                  className="w-full px-3 py-2 border rounded-lg border-blue-200 dark:border-blue-700 bg-white dark:bg-blue-900 text-blue-900 dark:text-yellow-200 focus:border-yellow-400 focus:ring-yellow-400 transition-all"
                  pattern="^(254|0)[0-9]{9}$"
                  title="Please enter a valid phone number starting with 254 or 0"
                  required
                />
                <p className="mt-1 text-sm text-blue-400 dark:text-yellow-200">
                  Format: 254XXXXXXXXX or 07XXXXXXXX
                </p>
              </div>
            </div>
            <button
              type="submit"
              className="w-full py-2 px-4 rounded-lg text-white font-semibold bg-yellow-400 hover:bg-yellow-500 dark:bg-yellow-500 dark:hover:bg-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:ring-offset-2 transition-all"
            >
              Pay with M-Pesa
            </button>
          </form>
        ) : (
          <div className="text-center py-4">
            {paymentStatus === 'processing' && (
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-400 dark:border-yellow-400 mx-auto mb-4"></div>
            )}
            {paymentStatus === 'completed' && (
              <div className="text-green-500 dark:text-yellow-400 text-5xl mb-4">✓</div>
            )}
            {paymentStatus === 'failed' && (
              <div className="text-red-500 dark:text-yellow-400 text-5xl mb-4">×</div>
            )}
            <p className={`text-lg ${getStatusColor()}`}>{statusMessage}</p>
            {paymentStatus === 'failed' && (
              <button
                onClick={() => {
                  setPaymentStatus('idle');
                  setStatusMessage('');
                  setCheckoutRequestId(null);
                  setPollCount(0);
                }}
                className="mt-4 px-4 py-2 bg-yellow-400 text-blue-900 font-semibold rounded-lg hover:bg-yellow-500 dark:bg-yellow-500 dark:hover:bg-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:ring-offset-2 transition-all"
              >
                Try Again
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}