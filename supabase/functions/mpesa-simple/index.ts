const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// M-Pesa Sandbox Credentials (exactly as provided)
const MPESA_CONSUMER_KEY = 'IIOfklBxQmfrwVOynZJbQw5wCn3GJpCE';
const MPESA_CONSUMER_SECRET = '3YSlKPHxZxE0iXug';
const MPESA_SHORTCODE = 174379;
const MPESA_PASSKEY = 'bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919';

// Simple in-memory storage for payment status
const paymentStatus = new Map();

async function getAccessToken(): Promise<string> {
  try {
    // Create Base64 encoded auth string (Consumer Key : Consumer Secret)
    const auth = btoa(`${MPESA_CONSUMER_KEY}:${MPESA_CONSUMER_SECRET}`);
    console.log('Auth string created');
    
    const response = await fetch('https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials', {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Auth failed:', response.status, errorText);
      throw new Error(`Auth failed: ${response.status}`);
    }

    const data = await response.json();
    console.log('Access token received:', data.access_token ? 'Yes' : 'No');
    return data.access_token;
  } catch (error) {
    console.error('Auth error:', error);
    throw new Error('Failed to authenticate with M-Pesa');
  }
}

function generateTimestamp(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  
  return `${year}${month}${day}${hours}${minutes}${seconds}`;
}

function generatePassword(shortcode: number, passkey: string, timestamp: string): string {
  const passwordString = `${shortcode}${passkey}${timestamp}`;
  return btoa(passwordString);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log('Request received:', body);

    const { phoneNumber, amount } = body;

    // Simple validation
    if (!phoneNumber) {
      console.error('Missing phone number');
      return new Response(
        JSON.stringify({ error: 'Phone number is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    if (!amount || amount <= 0) {
      console.error('Invalid amount:', amount);
      return new Response(
        JSON.stringify({ error: 'Valid amount is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Format phone number exactly as in your example
    let formattedPhone = phoneNumber.toString().replace(/\s+/g, '');
    if (formattedPhone.startsWith('0')) {
      formattedPhone = '254' + formattedPhone.substring(1);
    }
    if (!formattedPhone.startsWith('254')) {
      formattedPhone = '254' + formattedPhone;
    }

    console.log('Formatted phone:', formattedPhone);

    // Validate phone format (must be 254 + 9 digits)
    if (!formattedPhone.match(/^254[0-9]{9}$/)) {
      console.error('Invalid phone format:', formattedPhone);
      return new Response(
        JSON.stringify({ error: 'Invalid phone number format. Use format: 254XXXXXXXXX' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Get access token
    console.log('Getting access token...');
    const accessToken = await getAccessToken();

    // Generate timestamp exactly as in your example
    const timestamp = generateTimestamp();
    console.log('Generated timestamp:', timestamp);

    // Generate password exactly as in your example
    const password = generatePassword(MPESA_SHORTCODE, MPESA_PASSKEY, timestamp);
    console.log('Generated password');

    // Create callback URL
    const callbackURL = `${Deno.env.get('SUPABASE_URL')}/functions/v1/mpesa-simple-callback`;
    console.log('Callback URL:', callbackURL);

    // STK Push payload exactly as in your example
    const stkPayload = {
      BusinessShortCode: MPESA_SHORTCODE,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: Math.round(Number(amount)),
      PartyA: parseInt(formattedPhone),
      PartyB: MPESA_SHORTCODE,
      PhoneNumber: parseInt(formattedPhone),
      CallBackURL: callbackURL,
      AccountReference: 'PeopleMetrics',
      TransactionDesc: 'Subscription Payment'
    };

    console.log('STK Push payload:', JSON.stringify(stkPayload, null, 2));

    // Make STK Push request exactly as in your example
    const stkResponse = await fetch('https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify(stkPayload)
    });

    const responseText = await stkResponse.text();
    console.log('STK Response status:', stkResponse.status);
    console.log('STK Response text:', responseText);

    if (!stkResponse.ok) {
      console.error('STK Push failed:', stkResponse.status, responseText);
      throw new Error(`STK Push failed: ${stkResponse.status} - ${responseText}`);
    }

    let stkData;
    try {
      stkData = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Failed to parse STK response:', parseError);
      throw new Error('Invalid response from M-Pesa API');
    }

    console.log('STK Data parsed:', stkData);

    if (!stkData.CheckoutRequestID) {
      console.error('No CheckoutRequestID in response:', stkData);
      throw new Error('Invalid response from M-Pesa - no CheckoutRequestID');
    }

    // Store initial status in memory
    paymentStatus.set(stkData.CheckoutRequestID, {
      status: 'PENDING',
      timestamp: new Date().toISOString(),
      merchantRequestID: stkData.MerchantRequestID
    });

    console.log('Payment initiated successfully:', stkData.CheckoutRequestID);

    return new Response(
      JSON.stringify({
        success: true,
        CheckoutRequestID: stkData.CheckoutRequestID,
        MerchantRequestID: stkData.MerchantRequestID,
        ResponseCode: stkData.ResponseCode,
        ResponseDescription: stkData.ResponseDescription,
        CustomerMessage: stkData.CustomerMessage,
        message: 'STK Push sent successfully'
      }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );

  } catch (error) {
    console.error('Payment error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Payment failed',
        details: error instanceof Error ? error.stack : undefined
      }),
      { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
});

// Make paymentStatus available globally for callback and status functions
globalThis.paymentStatus = paymentStatus;