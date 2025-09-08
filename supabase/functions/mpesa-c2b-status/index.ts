import { createClient } from 'npm:@supabase/supabase-js@2.39.3';
import { Buffer } from 'npm:buffer@6.0.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const MPESA_CONSUMER_KEY = 'IIOfklBxQmfrwVOynZJbQw5wCn3GJpCE';
const MPESA_CONSUMER_SECRET = '3YSlKPHxZxE0iXug';
const MPESA_SHORTCODE = '174379';
const MPESA_PASSKEY = 'bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919';

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
  const auth = Buffer.from(`${MPESA_CONSUMER_KEY}:${MPESA_CONSUMER_SECRET}`).toString('base64');
  
  const response = await fetch('https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials', {
    method: 'GET',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error('Failed to get access token');
  }

  const data = await response.json();
  return data.access_token;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { CheckoutRequestID } = await req.json();

    if (!CheckoutRequestID) {
      throw new Error('CheckoutRequestID is required');
    }

    console.log('Checking status for:', CheckoutRequestID);

    // STEP 1: Check database first (fastest)
    const { data: callbackData } = await supabase
      .from('mpesa_callbacks')
      .select('result_code, result_desc')
      .eq('checkout_request_id', CheckoutRequestID)
      .single();

    if (callbackData) {
      console.log('Found callback in database:', callbackData);
      
      const status = callbackData.result_code === 0 ? 'COMPLETED' : 'FAILED';
      const message = callbackData.result_desc || (status === 'COMPLETED' ? 'Payment successful' : 'Payment failed');
      
      return new Response(
        JSON.stringify({ status, message }),
        { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // STEP 2: Check payment table
    const { data: paymentData } = await supabase
      .from('mpesa_payments')
      .select('status, result_code, result_desc')
      .eq('checkout_request_id', CheckoutRequestID)
      .single();

    if (paymentData && paymentData.status !== 'pending') {
      console.log('Found payment status:', paymentData.status);
      
      const status = paymentData.status === 'completed' ? 'COMPLETED' : 'FAILED';
      const message = paymentData.result_desc || (status === 'COMPLETED' ? 'Payment successful' : 'Payment failed');
      
      return new Response(
        JSON.stringify({ status, message }),
        { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // STEP 3: Query M-Pesa API directly
    console.log('Querying M-Pesa API...');
    
    try {
      const accessToken = await getAccessToken();
      
      const timestamp = new Date().toISOString()
        .replace(/[^0-9]/g, '')
        .slice(0, 14);

      const password = Buffer.from(`${MPESA_SHORTCODE}${MPESA_PASSKEY}${timestamp}`).toString('base64');
      
      const queryResponse = await fetch('https://sandbox.safaricom.co.ke/mpesa/stkpushquery/v1/query', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          BusinessShortCode: MPESA_SHORTCODE,
          Password: password,
          Timestamp: timestamp,
          CheckoutRequestID
        })
      });

      if (queryResponse.ok) {
        const mpesaData = await queryResponse.json();
        console.log('M-Pesa API response:', mpesaData);
        
        if (mpesaData.ResultCode === 0 || mpesaData.ResultCode === '0') {
          return new Response(
            JSON.stringify({ 
              status: 'COMPLETED', 
              message: mpesaData.ResultDesc || 'Payment completed successfully'
            }),
            { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
          );
        } else if (mpesaData.ResultCode && mpesaData.ResultCode !== 0) {
          return new Response(
            JSON.stringify({ 
              status: 'FAILED', 
              message: mpesaData.ResultDesc || 'Payment failed'
            }),
            { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
          );
        }
      }
    } catch (apiError) {
      console.log('M-Pesa API query failed:', apiError);
    }

    // STEP 4: Return pending
    return new Response(
      JSON.stringify({ 
        status: 'PENDING', 
        message: 'Payment is being processed...'
      }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );

  } catch (error) {
    console.error('Status check error:', error);
    
    return new Response(
      JSON.stringify({ 
        status: 'PENDING', 
        message: 'Checking payment status...'
      }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
});