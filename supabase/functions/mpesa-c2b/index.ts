import { createClient } from 'npm:@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

// M-Pesa Sandbox Credentials
const MPESA_CONSUMER_KEY = 'IIOfklBxQmfrwVOynZJbQw5wCn3GJpCE';
const MPESA_CONSUMER_SECRET = '3YSlKPHxZxE0iXug';
const MPESA_SHORTCODE = 174379;
const MPESA_PASSKEY = 'bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919';

// Initialize Supabase client
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

async function getAccessToken(): Promise<string> {
  try {
    console.log('Getting M-Pesa access token...');
    
    const auth = btoa(`${MPESA_CONSUMER_KEY}:${MPESA_CONSUMER_SECRET}`);
    
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
    console.log('Access token received successfully');
    
    if (!data.access_token) {
      throw new Error('No access token in response');
    }

    return data.access_token;
  } catch (error) {
    console.error('Auth error:', error);
    throw new Error(`Failed to authenticate with M-Pesa: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
    console.log('=== M-PESA C2B REQUEST START ===');
    
    const body = await req.json();
    console.log('Request body:', JSON.stringify(body, null, 2));

    const { phoneNumber, amount } = body;

    // Validation
    if (!phoneNumber) {
      console.error('Missing phone number');
      throw new Error('Phone number is required');
    }

    if (!amount || amount <= 0) {
      console.error('Invalid amount:', amount);
      throw new Error('Valid amount is required');
    }

    // Format phone number
    let formattedPhone = phoneNumber.toString().replace(/\s+/g, '');
    if (formattedPhone.startsWith('0')) {
      formattedPhone = '254' + formattedPhone.substring(1);
    }
    if (!formattedPhone.startsWith('254')) {
      formattedPhone = '254' + formattedPhone;
    }

    console.log('Formatted phone:', formattedPhone);

    // Validate phone format
    if (!formattedPhone.match(/^254[0-9]{9}$/)) {
      console.error('Invalid phone format:', formattedPhone);
      throw new Error('Invalid phone number format. Use: 254XXXXXXXXX');
    }

    // Get access token
    console.log('Getting access token...');
    const accessToken = await getAccessToken();

    // Generate timestamp
    const timestamp = generateTimestamp();
    console.log('Generated timestamp:', timestamp);

    // Generate password
    const password = generatePassword(MPESA_SHORTCODE, MPESA_PASSKEY, timestamp);
    console.log('Generated password');

    // Create callback URL
    const callbackURL = `${Deno.env.get('SUPABASE_URL')}/functions/v1/mpesa-c2b-callback`;
    console.log('Callback URL:', callbackURL);

    // STK Push payload
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

    // Store initial payment record
    const { data: paymentRecord, error: insertError } = await supabase
      .from('mpesa_payments')
      .insert({
        checkout_request_id: 'temp_' + Date.now(), // Temporary ID until we get the real one
        phone_number: formattedPhone,
        amount: amount,
        status: 'pending'
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating payment record:', insertError);
      console.warn('Could not create initial payment record, continuing...');
    }

    if (paymentRecord) {
      console.log('Payment record created:', paymentRecord.id);
    }

    // Make STK Push request
    const stkResponse = await fetch('https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify(stkPayload)
    });

    console.log('STK Response status:', stkResponse.status);
    
    const responseText = await stkResponse.text();
    console.log('STK Response text:', responseText);

    if (!stkResponse.ok) {
      console.error('STK Push failed:', stkResponse.status, responseText);
      
      // Update payment record with failure
      await supabase
        .from('mpesa_payments')
        .update({ 
          status: 'failed',
          result_desc: `STK Push failed: ${stkResponse.status} - ${responseText}`
        })
        .eq('id', paymentRecord.id);

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

    // Create or update payment record with CheckoutRequestID
    const { error: upsertError } = await supabase
      .from('mpesa_payments')
      .upsert({
        checkout_request_id: stkData.CheckoutRequestID,
        merchant_request_id: stkData.MerchantRequestID,
        phone_number: formattedPhone,
        amount: amount,
        status: 'pending'
      }, {
        onConflict: 'checkout_request_id'
      });

    if (upsertError) {
      console.error('Error upserting payment record:', upsertError);
      console.log('Continuing anyway, callback will handle payment tracking');
    }

    console.log('=== M-PESA C2B REQUEST SUCCESS ===');
    console.log('CheckoutRequestID:', stkData.CheckoutRequestID);
    console.log('ResponseCode:', stkData.ResponseCode);
    console.log('CustomerMessage:', stkData.CustomerMessage);

    // Check if M-Pesa returned an error in the response
    if (stkData.ResponseCode && stkData.ResponseCode !== '0') {
      console.error('M-Pesa returned error code:', stkData.ResponseCode);
      console.error('Error description:', stkData.ResponseDescription);

      throw new Error(`M-Pesa error (${stkData.ResponseCode}): ${stkData.ResponseDescription || stkData.CustomerMessage}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        CheckoutRequestID: stkData.CheckoutRequestID,
        MerchantRequestID: stkData.MerchantRequestID,
        ResponseCode: stkData.ResponseCode,
        ResponseDescription: stkData.ResponseDescription,
        CustomerMessage: stkData.CustomerMessage
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      }
    );

  } catch (error) {
    console.error('=== M-PESA C2B ERROR ===', error);
    
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Payment failed',
        details: error instanceof Error ? error.stack : undefined
      }),
      { 
        status: 400, 
        headers: { 
          'Content-Type': 'application/json', 
          ...corsHeaders 
        } 
      }
    );
  }
});