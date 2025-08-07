const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// M-Pesa Sandbox Credentials
const MPESA_CONSUMER_KEY = 'IIOfklBxQmfrwVOynZJbQw5wCn3GJpCE';
const MPESA_CONSUMER_SECRET = '3YSlKPHxZxE0iXug';
const MPESA_SHORTCODE = '174379';
const MPESA_PASSKEY = 'bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919';

// Simple in-memory storage for payment status
const paymentStatus = new Map();

async function getAccessToken(): Promise<string> {
  try {
    const auth = btoa(`${MPESA_CONSUMER_KEY}:${MPESA_CONSUMER_SECRET}`);
    
    const response = await fetch('https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials', {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Auth failed: ${response.status}`);
    }

    const data = await response.json();
    return data.access_token;
  } catch (error) {
    console.error('Auth error:', error);
    throw new Error('Failed to authenticate with M-Pesa');
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log('Request body:', body);

    const { phoneNumber, amount } = body;

    // Simple validation
    if (!phoneNumber) {
      return new Response(
        JSON.stringify({ error: 'Phone number is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    if (!amount || amount <= 0) {
      return new Response(
        JSON.stringify({ error: 'Valid amount is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Format phone number
    let formattedPhone = phoneNumber.toString().replace(/\s+/g, '');
    if (formattedPhone.startsWith('0')) {
      formattedPhone = '254' + formattedPhone.substring(1);
    }
    if (!formattedPhone.startsWith('254')) {
      formattedPhone = '254' + formattedPhone;
    }

    // Validate phone format
    if (!formattedPhone.match(/^254[0-9]{9}$/)) {
      return new Response(
        JSON.stringify({ error: 'Invalid phone number format' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    console.log('Formatted phone:', formattedPhone);

    // Get access token
    const accessToken = await getAccessToken();
    console.log('Got access token');

    // Generate timestamp
    const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);

    // Generate password
    const password = btoa(`${MPESA_SHORTCODE}${MPESA_PASSKEY}${timestamp}`);

    // STK Push request
    const stkPayload = {
      BusinessShortCode: MPESA_SHORTCODE,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: Math.round(Number(amount)),
      PartyA: formattedPhone,
      PartyB: MPESA_SHORTCODE,
      PhoneNumber: formattedPhone,
      CallBackURL: `${Deno.env.get('SUPABASE_URL')}/functions/v1/mpesa-simple-callback`,
      AccountReference: 'PeopleMetrics',
      TransactionDesc: 'Subscription Payment'
    };

    console.log('STK Push payload:', stkPayload);

    const stkResponse = await fetch('https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(stkPayload),
    });

    const stkData = await stkResponse.json();
    console.log('STK Response:', stkData);

    if (!stkResponse.ok) {
      throw new Error(stkData.errorMessage || 'STK Push failed');
    }

    if (!stkData.CheckoutRequestID) {
      throw new Error('No CheckoutRequestID received');
    }

    // Store initial status
    paymentStatus.set(stkData.CheckoutRequestID, {
      status: 'PENDING',
      timestamp: new Date().toISOString()
    });

    return new Response(
      JSON.stringify({
        success: true,
        CheckoutRequestID: stkData.CheckoutRequestID,
        message: 'STK Push sent successfully'
      }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );

  } catch (error) {
    console.error('Payment error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Payment failed' 
      }),
      { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
});

// Make paymentStatus available globally for callback and status functions
globalThis.paymentStatus = paymentStatus;