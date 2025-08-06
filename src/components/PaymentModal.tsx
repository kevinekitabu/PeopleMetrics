import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { useAuth } from './AuthProvider';

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
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('idle');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [pollInterval, setPollInterval] = useState<NodeJS.Timeout | null>(null);
  const [checkoutRequestId, setCheckoutRequestId] = useState<string | null>(null);
  const [pollCount, setPollCount] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(120); // 2 minutes countdown
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
      setTimeRemaining(120);
      if (pollInterval) {
        clearInterval(pollInterval);
        setPollInterval(null);
      }
    }
  }, [isOpen, pollInterval]);

  // Countdown timer effect
  useEffect(() => {
    let countdownInterval: NodeJS.Timeout | null = null;
    
    if (paymentStatus === 'processing' && timeRemaining > 0) {
      countdownInterval = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            setPaymentStatus('failed');
            setStatusMessage('Payment request timed out. Please try again.');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    
    return () => countdownInterval && clearInterval(countdownInterval);
  }, [paymentStatus, timeRemaining]);

  if (!isOpen) return null;

  const handleMpesaPayment = async (e: React.FormEvent) => {
    e.preventDefault();

    // CRITICAL: Validate ALL required fields before proceeding
    console.log('=== PAYMENT VALIDATION START ===');
    console.log('User object:', user);
    console.log('User ID:', user?.id);
    console.log('User Email:', user?.email);
    console.log('Phone Number:', phoneNumber);
    console.log('Selected Plan:', selectedPlan);
    console.log('=== PAYMENT VALIDATION END ===');

    // Validate user authentication
    if (!user) {
      console.error('VALIDATION ERROR: No user object');
      setPaymentStatus('failed');
      setStatusMessage('User authentication is required. Please sign in again.');
      toast.error('Please sign in again to continue.');
      return;
    }

    if (!user.id) {
      console.error('VALIDATION ERROR: No user ID');
      setPaymentStatus('failed');
      setStatusMessage('User ID is missing. Please sign in again.');
      toast.error('Authentication error. Please sign in again.');
      return;
    }

    // Validate phone number
    if (!phoneNumber || phoneNumber.trim() === '') {
      console.error('VALIDATION ERROR: Phone number is empty');
      setPaymentStatus('failed');
      setStatusMessage('Phone number is required.');
      toast.error('Please enter your phone number.');
      return;
    }

    // Validate selected plan
    if (!selectedPlan) {
      console.error('VALIDATION ERROR: No selected plan');
      setPaymentStatus('failed');
      setStatusMessage('Selected plan is missing.');
      toast.error('Plan selection error. Please try again.');
      return;
    }

    if (!selectedPlan.name || selectedPlan.name.trim() === '') {
      console.error('VALIDATION ERROR: Plan name is empty');
      setPaymentStatus('failed');
      setStatusMessage('Plan name is missing.');
      toast.error('Plan selection error. Please try again.');
      return;
    }

    if (!selectedPlan.price || selectedPlan.price <= 0) {
      console.error('VALIDATION ERROR: Invalid plan price');
      setPaymentStatus('failed');
      setStatusMessage('Plan price is invalid.');
      toast.error('Plan pricing error. Please try again.');
      return;
    }

    if (!selectedPlan.interval || (selectedPlan.interval !== 'month' && selectedPlan.interval !== 'year')) {
      console.error('VALIDATION ERROR: Invalid plan interval');
      setPaymentStatus('failed');
      setStatusMessage('Plan interval is invalid.');
      toast.error('Plan interval error. Please try again.');
      return;
    }

    try {
      setPaymentStatus('processing');
      setStatusMessage('Initiating M-Pesa payment...');
      setTimeRemaining(120); // Reset countdown

      // Format phone number
      const formattedPhone = phoneNumber.startsWith('254') ? phoneNumber : `254${phoneNumber.replace(/^0+/, '')}`;

      // Validate formatted phone number
      if (!formattedPhone.match(/^254[0-9]{9}$/)) {
        throw new Error('Invalid phone number format. Please enter a valid Kenyan phone number.');
      }

      // Prepare the complete request payload
      const requestPayload = {
        phoneNumber: formattedPhone,
        amount: selectedPlan.price,
        plan: selectedPlan.name,
        interval: selectedPlan.interval,
        userId: user.id
      };

      console.log('=== SENDING PAYMENT REQUEST ===');
      console.log('Request URL:', `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mpesa-payment`);
      console.log('Request Payload:', requestPayload);
      console.log('Authorization Header:', `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY ? '[PRESENT]' : '[MISSING]'}`);
      console.log('=== END PAYMENT REQUEST ===');

      // Call M-Pesa Edge Function
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mpesa-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'X-Client-Info': 'payment-modal'
        },
        body: JSON.stringify(requestPayload)
      });

      console.log('=== PAYMENT RESPONSE ===');
      console.log('Response Status:', response.status);
      console.log('Response OK:', response.ok);
      console.log('=== END PAYMENT RESPONSE ===');

      if (!response.ok) {
        const errorData = await response.json();
        console.error('=== PAYMENT ERROR DETAILS ===');
        console.error('Status:', response.status);
        console.error('Status Text:', response.statusText);
        console.error('Error Data:', errorData);
        console.error('=== END PAYMENT ERROR ===');
        throw new Error(errorData.error || `Payment failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('=== PAYMENT SUCCESS ===');
      console.log('M-Pesa Response:', data);
      console.log('=== END PAYMENT SUCCESS ===');

      if (!data.CheckoutRequestID) {
        console.error('CRITICAL ERROR: No CheckoutRequestID in response:', data);
        throw new Error('Invalid response from M-Pesa - missing CheckoutRequestID');
      }

      setCheckoutRequestId(data.CheckoutRequestID);
      setStatusMessage('Please check your phone for the M-Pesa prompt...');
      toast.success('M-Pesa payment request sent. Check your phone for the STK push.', {
        duration: 10000
      });

      // Start polling for payment status
      let attempts = 0;
      const interval = setInterval(async () => {
        try {
          attempts++;
          console.log(`=== STATUS CHECK #${attempts} ===`);
          console.log('CheckoutRequestID:', data.CheckoutRequestID);
          console.log('Time Remaining:', timeRemaining);
          console.log('=== END STATUS CHECK ===');

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
            const errorData = await statusResponse.json();
            console.error('Status check failed:', errorData);
            throw new Error(errorData.error || 'Failed to check payment status');
          }

          const { status, message } = await statusResponse.json();
          console.log('Status Response:', { status, message, attempt: attempts });

          if (status === 'COMPLETED') {
            clearInterval(interval);
            setPollInterval(null);
            setPaymentStatus('completed');
            setStatusMessage('Payment successful! Setting up your subscription...');

            // Update user's subscription
            const { error: supabaseError } = await supabase
              .from('subscriptions')
              .upsert({
                checkout_request_id: data.CheckoutRequestID,
                user_id: user.id,
                plan: selectedPlan.name,
                interval: selectedPlan.interval,
                status: 'active',
                current_period_end: new Date(Date.now() + (selectedPlan.interval === 'month' ? 30 : 365) * 24 * 60 * 60 * 1000)
              }, {
                onConflict: 'checkout_request_id'
              });

            if (supabaseError) {
              console.error('Subscription update error:', supabaseError);
              throw supabaseError;
            }

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

          // Update status message for pending
          const minutes = Math.floor(timeRemaining / 60);
          const seconds = timeRemaining % 60;
          setStatusMessage(`${message || 'Waiting for payment confirmation...'} (${minutes}:${seconds.toString().padStart(2, '0')} remaining)`);

          // Check timeout conditions
          if (attempts >= MAX_POLL_ATTEMPTS || timeRemaining <= 0) {
            clearInterval(interval);
            setPollInterval(null);
            setPaymentStatus('failed');
            setStatusMessage('Payment request timed out. Please try again.');
            toast.error('Payment request timed out');
            return;
          }

        } catch (error) {
          console.error('Error during status check:', error);
          
          // Only stop polling if we've exceeded max attempts or time
          if (attempts >= MAX_POLL_ATTEMPTS || timeRemaining <= 0) {
            clearInterval(interval);
            setPollInterval(null);
            setPaymentStatus('failed');
            setStatusMessage('Payment status check failed. Please try again.');
            toast.error('Failed to verify payment status');
            return;
          }
          
          // Continue polling for transient errors
          const minutes = Math.floor(timeRemaining / 60);
          const seconds = timeRemaining % 60;
          setStatusMessage(`Checking payment status... (${minutes}:${seconds.toString().padStart(2, '0')} remaining)`);
        }
      }, 5000);

      setPollInterval(interval);

    } catch (error) {
      console.error('=== PAYMENT INITIATION ERROR ===');
      console.error('Error:', error);
      console.error('Error Message:', error instanceof Error ? error.message : 'Unknown error');
      console.error('=== END PAYMENT ERROR ===');
      
      setPaymentStatus('failed');
      setStatusMessage(error instanceof Error ? error.message : 'Payment failed');
      toast.error(error instanceof Error ? error.message : 'Payment failed');
    }
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
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

        {/* Debug Info - Remove in production */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mb-4 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg text-xs">
            <p><strong>Debug Info:</strong></p>
            <p>User ID: {user?.id || 'MISSING'}</p>
            <p>User Email: {user?.email || 'MISSING'}</p>
            <p>Plan: {selectedPlan?.name || 'MISSING'}</p>
            <p>Price: {selectedPlan?.price || 'MISSING'}</p>
            <p>Interval: {selectedPlan?.interval || 'MISSING'}</p>
          </div>
        )}

        <div className="mb-6">
          <div className="flex justify-between mb-2">
            <span className="text-blue-700 dark:text-yellow-200">Selected Plan:</span>
            <span className="font-semibold text-blue-900 dark:text-yellow-100">{selectedPlan?.name || 'Unknown'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-blue-700 dark:text-yellow-200">Amount:</span>
            <span className="font-semibold text-blue-900 dark:text-yellow-100">
              ${selectedPlan?.price || 0}/{selectedPlan?.interval || 'month'}
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
              disabled={!user?.id || !selectedPlan?.name || !selectedPlan?.price || !selectedPlan?.interval}
              className="w-full py-2 px-4 rounded-lg text-white font-semibold bg-yellow-400 hover:bg-yellow-500 dark:bg-yellow-500 dark:hover:bg-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Pay with M-Pesa
            </button>
            {(!user?.id || !selectedPlan?.name || !selectedPlan?.price || !selectedPlan?.interval) && (
              <p className="text-sm text-red-600 dark:text-red-400 text-center">
                Missing required information. Please refresh and try again.
              </p>
            )}
          </form>
        ) : (
          <div className="text-center py-4">
            {paymentStatus === 'processing' && (
              <div className="space-y-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-400 dark:border-yellow-400 mx-auto"></div>
                <div className="bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                  <div 
                    className="bg-yellow-400 h-full transition-all duration-1000 ease-linear"
                    style={{ width: `${((120 - timeRemaining) / 120) * 100}%` }}
                  ></div>
                </div>
                <div className="text-sm text-blue-600 dark:text-yellow-300">
                  Time remaining: {formatTime(timeRemaining)}
                </div>
              </div>
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
                  setTimeRemaining(120);
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