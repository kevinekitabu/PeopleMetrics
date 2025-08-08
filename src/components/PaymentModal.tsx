import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

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
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('idle');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [checkoutRequestId, setCheckoutRequestId] = useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(120);
  const [pollInterval, setPollInterval] = useState<NodeJS.Timeout | null>(null);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setPaymentStatus('idle');
      setStatusMessage('');
      setPhoneNumber('');
      setCheckoutRequestId(null);
      setTimeRemaining(120);
      if (pollInterval) {
        clearInterval(pollInterval);
        setPollInterval(null);
      }
    }
  }, [isOpen, pollInterval]);

  // Countdown timer
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    
    if (paymentStatus === 'processing' && timeRemaining > 0) {
      interval = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            setPaymentStatus('failed');
            setStatusMessage('Payment request timed out. Please try again.');
            if (pollInterval) {
              clearInterval(pollInterval);
              setPollInterval(null);
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    
    return () => interval && clearInterval(interval);
  }, [paymentStatus, timeRemaining, pollInterval]);

  if (!isOpen) return null;

  const handleMpesaPayment = async (e: React.FormEvent) => {
    e.preventDefault();

    console.log('=== PAYMENT FORM SUBMISSION ===');
    console.log('Phone Number:', phoneNumber);
    console.log('Amount:', selectedPlan.price);

    // Simple validation
    if (!phoneNumber?.trim()) {
      toast.error('Please enter your phone number');
      return;
    }

    if (!selectedPlan?.price || selectedPlan.price <= 0) {
      toast.error('Invalid plan selected');
      return;
    }

    try {
      setPaymentStatus('processing');
      setStatusMessage('Initiating M-Pesa payment...');
      setTimeRemaining(120);

      console.log('=== CALLING M-PESA API ===');
      
      const requestPayload = {
        phoneNumber: phoneNumber.trim(),
        amount: selectedPlan.price
      };

      console.log('Request payload:', JSON.stringify(requestPayload, null, 2));
      console.log('API URL:', `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mpesa-c2b`);

      // Call the M-Pesa C2B function
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mpesa-c2b`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify(requestPayload)
      });

      console.log('Response status:', response.status);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));
      
      const responseText = await response.text();
      console.log('Response text:', responseText);

      if (!response.ok) {
        console.error('Payment API error:', response.status, responseText);
        throw new Error(`Payment failed: ${response.status} - ${responseText}`);
      }

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Failed to parse response:', parseError);
        throw new Error('Invalid response from payment service');
      }

      console.log('Parsed response data:', data);
      
      if (!data.success || !data.CheckoutRequestID) {
        console.error('Invalid payment response:', data);
        throw new Error(data.error || 'Invalid response from payment service');
      }

      setCheckoutRequestId(data.CheckoutRequestID);
      setStatusMessage('Check your phone for M-Pesa prompt...');
      toast.success('M-Pesa request sent! Check your phone.');

      console.log('=== STARTING STATUS POLLING ===');
      console.log('CheckoutRequestID:', data.CheckoutRequestID);

      // Start polling for status
      let attempts = 0;
      const maxAttempts = 24; // 2 minutes

      const pollStatus = async () => {
        try {
          attempts++;
          console.log(`Status check attempt ${attempts}/${maxAttempts}`);
          
          const statusResponse = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mpesa-c2b-status`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({ CheckoutRequestID: data.CheckoutRequestID })
          });

          console.log('Status response status:', statusResponse.status);

          if (statusResponse.ok) {
            const statusData = await statusResponse.json();
            console.log('Status response data:', statusData);
            
            if (statusData.status === 'COMPLETED') {
              setPaymentStatus('completed');
              setStatusMessage('Payment successful!');
              toast.success('Payment completed successfully!');
              if (pollInterval) {
                clearInterval(pollInterval);
                setPollInterval(null);
              }
              setTimeout(() => onClose(), 3000);
              return;
            }
            
            if (statusData.status === 'FAILED') {
              setPaymentStatus('failed');
              setStatusMessage(statusData.message || 'Payment failed');
              toast.error(statusData.message || 'Payment failed');
              if (pollInterval) {
                clearInterval(pollInterval);
                setPollInterval(null);
              }
              return;
            }

            // Update status message for pending
            setStatusMessage(statusData.message || 'Waiting for payment confirmation...');
          } else {
            console.warn('Status check failed:', statusResponse.status);
          }

          // Stop polling if max attempts reached
          if (attempts >= maxAttempts) {
            setPaymentStatus('failed');
            setStatusMessage('Payment request timed out');
            toast.error('Payment request timed out');
            if (pollInterval) {
              clearInterval(pollInterval);
              setPollInterval(null);
            }
          }

        } catch (error) {
          console.error('Status check error:', error);
          if (attempts >= maxAttempts) {
            setPaymentStatus('failed');
            setStatusMessage('Failed to verify payment');
            toast.error('Failed to verify payment');
            if (pollInterval) {
              clearInterval(pollInterval);
              setPollInterval(null);
            }
          }
        }
      };

      // Start polling every 5 seconds
      const interval = setInterval(pollStatus, 5000);
      setPollInterval(interval);

      // Initial status check after 3 seconds
      setTimeout(pollStatus, 3000);

    } catch (error) {
      console.error('=== PAYMENT ERROR ===', error);
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

  const getStatusIcon = () => {
    switch (paymentStatus) {
      case 'processing':
        return (
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
          </div>
        );
      case 'completed':
        return (
          <div className="flex items-center justify-center">
            <div className="text-green-600 text-6xl">✓</div>
          </div>
        );
      case 'failed':
        return (
          <div className="flex items-center justify-center">
            <div className="text-red-600 text-6xl">✗</div>
          </div>
        );
      default:
        return null;
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
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6 shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            M-Pesa Payment
          </h2>
          {paymentStatus !== 'processing' && (
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Plan Details */}
        <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <div className="flex justify-between mb-2">
            <span className="text-gray-600 dark:text-gray-300">Plan:</span>
            <span className="font-semibold text-gray-900 dark:text-gray-100">{selectedPlan.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-300">Amount:</span>
            <span className="font-semibold text-gray-900 dark:text-gray-100">
              ${selectedPlan.price} USD
            </span>
          </div>
        </div>

        {paymentStatus === 'idle' ? (
          <form onSubmit={handleMpesaPayment} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Safaricom Phone Number
              </label>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="0700000000 or 254700000000"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors"
                required
              />
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Enter your Safaricom M-Pesa number
              </p>
            </div>
            <button
              type="submit"
              disabled={!phoneNumber.trim() || !selectedPlan.price}
              className="w-full py-3 px-4 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              Pay ${selectedPlan.price} with M-Pesa
            </button>
          </form>
        ) : (
          <div className="text-center py-6">
            {getStatusIcon()}
            
            {paymentStatus === 'processing' && (
              <div className="space-y-4 mt-4">
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div 
                    className="bg-green-600 h-full rounded-full transition-all duration-1000"
                    style={{ width: `${((120 - timeRemaining) / 120) * 100}%` }}
                  ></div>
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-300">
                  Time remaining: {formatTime(timeRemaining)}
                </div>
                {checkoutRequestId && (
                  <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                    Request ID: {checkoutRequestId.slice(-8)}
                  </div>
                )}
              </div>
            )}
            
            <p className={`text-lg mt-4 ${getStatusColor()}`}>
              {statusMessage}
            </p>
            
            {paymentStatus === 'failed' && (
              <button
                onClick={() => {
                  setPaymentStatus('idle');
                  setStatusMessage('');
                  setCheckoutRequestId(null);
                  setTimeRemaining(120);
                  if (pollInterval) {
                    clearInterval(pollInterval);
                    setPollInterval(null);
                  }
                }}
                className="mt-4 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
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