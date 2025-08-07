import { useState, useEffect } from 'react';
import { useAuth } from './AuthProvider';
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
  const { user } = useAuth();
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('idle');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [checkoutRequestId, setCheckoutRequestId] = useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(120);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setPaymentStatus('idle');
      setStatusMessage('');
      setPhoneNumber('');
      setCheckoutRequestId(null);
      setTimeRemaining(120);
    }
  }, [isOpen]);

  // Countdown timer
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    
    if (paymentStatus === 'processing' && timeRemaining > 0) {
      interval = setInterval(() => {
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
    
    return () => interval && clearInterval(interval);
  }, [paymentStatus, timeRemaining]);

  if (!isOpen) return null;

  const handleMpesaPayment = async (e: React.FormEvent) => {
    e.preventDefault();

    // Simple validation
    if (!phoneNumber.trim()) {
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

      // Format phone number
      const formattedPhone = phoneNumber.startsWith('254') ? phoneNumber : `254${phoneNumber.replace(/^0+/, '')}`;

      // Validate phone format
      if (!formattedPhone.match(/^254[0-9]{9}$/)) {
        throw new Error('Invalid phone number format. Use 254XXXXXXXXX or 07XXXXXXXX');
      }

      console.log('Initiating payment:', { formattedPhone, amount: selectedPlan.price });

      // Call simplified M-Pesa function
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/simple-mpesa`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          phoneNumber: formattedPhone,
          amount: selectedPlan.price
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Payment initiation failed');
      }

      const data = await response.json();
      
      if (!data.CheckoutRequestID) {
        throw new Error('Invalid response from payment service');
      }

      setCheckoutRequestId(data.CheckoutRequestID);
      setStatusMessage('Check your phone for M-Pesa prompt...');
      toast.success('M-Pesa request sent! Check your phone.');

      // Start polling for status
      let attempts = 0;
      const maxAttempts = 24; // 2 minutes

      const pollStatus = async () => {
        try {
          attempts++;
          
          const statusResponse = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/simple-mpesa-status`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({ CheckoutRequestID: data.CheckoutRequestID })
          });

          if (statusResponse.ok) {
            const statusData = await statusResponse.json();
            
            if (statusData.status === 'COMPLETED') {
              setPaymentStatus('completed');
              setStatusMessage('Payment successful!');
              toast.success('Payment completed successfully!');
              setTimeout(() => onClose(), 2000);
              return;
            }
            
            if (statusData.status === 'FAILED') {
              setPaymentStatus('failed');
              setStatusMessage(statusData.message || 'Payment failed');
              toast.error(statusData.message || 'Payment failed');
              return;
            }
          }

          // Continue polling if still pending and within limits
          if (attempts < maxAttempts && timeRemaining > 0) {
            setTimeout(pollStatus, 5000);
          } else {
            setPaymentStatus('failed');
            setStatusMessage('Payment request timed out');
            toast.error('Payment request timed out');
          }

        } catch (error) {
          console.error('Status check error:', error);
          if (attempts < maxAttempts && timeRemaining > 0) {
            setTimeout(pollStatus, 5000);
          } else {
            setPaymentStatus('failed');
            setStatusMessage('Failed to verify payment');
            toast.error('Failed to verify payment');
          }
        }
      };

      // Start polling after 5 seconds
      setTimeout(pollStatus, 5000);

    } catch (error) {
      console.error('Payment error:', error);
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

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            M-Pesa Payment
          </h2>
          {paymentStatus !== 'processing' && (
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <div className="flex justify-between mb-2">
            <span className="text-gray-600 dark:text-gray-300">Plan:</span>
            <span className="font-semibold text-gray-900 dark:text-gray-100">{selectedPlan.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-300">Amount:</span>
            <span className="font-semibold text-gray-900 dark:text-gray-100">
              ${selectedPlan.price}
            </span>
          </div>
        </div>

        {paymentStatus === 'idle' ? (
          <form onSubmit={handleMpesaPayment} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Phone Number
              </label>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="254700000000 or 0700000000"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                required
              />
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Enter your Safaricom number
              </p>
            </div>
            <button
              type="submit"
              className="w-full py-3 px-4 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors"
            >
              Pay with M-Pesa
            </button>
          </form>
        ) : (
          <div className="text-center py-6">
            {paymentStatus === 'processing' && (
              <div className="space-y-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div 
                    className="bg-green-600 h-full rounded-full transition-all duration-1000"
                    style={{ width: `${((120 - timeRemaining) / 120) * 100}%` }}
                  ></div>
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-300">
                  Time remaining: {formatTime(timeRemaining)}
                </div>
              </div>
            )}
            
            {paymentStatus === 'completed' && (
              <div className="text-green-600 text-6xl mb-4">✓</div>
            )}
            
            {paymentStatus === 'failed' && (
              <div className="text-red-600 text-6xl mb-4">✗</div>
            )}
            
            <p className={`text-lg mb-4 ${
              paymentStatus === 'processing' ? 'text-blue-600 dark:text-blue-400' :
              paymentStatus === 'completed' ? 'text-green-600 dark:text-green-400' :
              'text-red-600 dark:text-red-400'
            }`}>
              {statusMessage}
            </p>
            
            {paymentStatus === 'failed' && (
              <button
                onClick={() => {
                  setPaymentStatus('idle');
                  setStatusMessage('');
                  setCheckoutRequestId(null);
                  setTimeRemaining(120);
                }}
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
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