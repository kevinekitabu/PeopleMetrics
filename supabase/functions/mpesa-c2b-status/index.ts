import { createClient } from 'npm:@supabase/supabase-js@2.39.3';
import { Buffer } from 'npm:buffer@6.0.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// M-Pesa API credentials
const MPESA_CONSUMER_KEY = 'IIOfklBxQmfrwVOynZJbQw5wCn3GJpCE';
const MPESA_CONSUMER_SECRET = '3YSlKPHxZxE0iXug';
const MPESA_SHORTCODE = '174379';
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
  } catch (error) {
    console.error('Error getting access token:', error);
    throw new Error('Failed to authenticate with M-Pesa');
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { CheckoutRequestID } = await req.json();

    if (!CheckoutRequestID) {
      console.error('No CheckoutRequestID provided');
      return new Response(
        JSON.stringify({ error: 'CheckoutRequestID is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    console.log('=== CHECKING PAYMENT STATUS ===');
    console.log('CheckoutRequestID:', CheckoutRequestID);

    // STEP 1: Check database for callback results first (most reliable)
    console.log('Step 1: Checking database for callback results...');
    
    const { data: callbackData, error: callbackError } = await supabase
      .from('mpesa_callbacks')
      .select('result_code, result_desc, created_at')
      .eq('checkout_request_id', CheckoutRequestID)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!callbackError && callbackData) {
      console.log('Found callback in database:', callbackData);
      
      if (callbackData.result_code === 0) {
        console.log('=== PAYMENT SUCCESSFUL (from database) ===');
        return new Response(
          JSON.stringify({ 
            status: 'COMPLETED', 
            message: 'Payment completed successfully',
            source: 'database_callback'
          }),
          { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      } else {
        console.log('=== PAYMENT FAILED (from database) ===');
        return new Response(
          JSON.stringify({ 
            status: 'FAILED', 
            message: callbackData.result_desc || 'Payment failed',
            source: 'database_callback'
          }),
          { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }
    }

    // STEP 2: Check mpesa_payments table for status
    console.log('Step 2: Checking mpesa_payments table...');
    
    const { data: paymentData, error: paymentError } = await supabase
      .from('mpesa_payments')
      .select('status, result_code, result_desc')
      .eq('checkout_request_id', CheckoutRequestID)
      .single();

    if (!paymentError && paymentData) {
      console.log('Found payment record:', paymentData);
      
      if (paymentData.status === 'completed' || paymentData.result_code === 0) {
        console.log('=== PAYMENT SUCCESSFUL (from payments table) ===');
        return new Response(
          JSON.stringify({ 
            status: 'COMPLETED', 
            message: 'Payment completed successfully',
            source: 'payments_table'
          }),
          { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      } else if (paymentData.status === 'failed') {
        console.log('=== PAYMENT FAILED (from payments table) ===');
        return new Response(
          JSON.stringify({ 
            status: 'FAILED', 
            message: paymentData.result_desc || 'Payment failed',
            source: 'payments_table'
          }),
          { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }
    }

    // STEP 3: Check subscriptions table for active subscription
    console.log('Step 3: Checking subscriptions table...');
    
    const { data: subscriptionData, error: subscriptionError } = await supabase
      .from('subscriptions')
      .select('status, plan, interval')
      .eq('checkout_request_id', CheckoutRequestID)
      .eq('status', 'active')
      .single();

    if (!subscriptionError && subscriptionData) {
      console.log('Found active subscription:', subscriptionData);
      console.log('=== PAYMENT SUCCESSFUL (subscription active) ===');
      return new Response(
        JSON.stringify({ 
          status: 'COMPLETED', 
          message: 'Payment completed successfully - subscription active',
          source: 'active_subscription'
        }),
        { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // STEP 4: Query M-Pesa API directly as fallback
    console.log('Step 4: Querying M-Pesa API directly...');
    
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
          console.log('=== PAYMENT SUCCESSFUL (M-Pesa API) ===');
          return new Response(
            JSON.stringify({ 
              status: 'COMPLETED', 
              message: mpesaData.ResultDesc || 'Payment completed successfully',
              source: 'mpesa_api'
            }),
            { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
          );
        } else if (mpesaData.ResultCode && mpesaData.ResultCode !== 0) {
          console.log('=== PAYMENT FAILED (M-Pesa API) ===');
          return new Response(
            JSON.stringify({ 
              status: 'FAILED', 
              message: mpesaData.ResultDesc || 'Payment failed',
              source: 'mpesa_api'
            }),
            { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
          );
        }
      }
    } catch (apiError) {
      console.log('M-Pesa API query failed:', apiError);
      // Continue to return pending status
    }

    // STEP 5: Return pending status if no definitive result found
    console.log('No definitive status found - returning PENDING');
    return new Response(
      JSON.stringify({ 
        status: 'PENDING', 
        message: 'Payment is being processed...',
        source: 'no_result_found'
      }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );

  } catch (error) {
    console.error('Status check error:', error);
    
    return new Response(
      JSON.stringify({ 
        status: 'PENDING', 
        message: 'Checking payment status...',
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
});