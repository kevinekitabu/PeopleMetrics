import { createClient } from 'npm:@supabase/supabase-js@2.39.3';
import { Buffer } from 'npm:buffer@6.0.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info',
  'Access-Control-Max-Age': '86400',
  'Access-Control-Expose-Headers': 'Content-Length, X-JSON'
};

const MPESA_QUERY_URL = 'https://sandbox.safaricom.co.ke/mpesa/stkpushquery/v1/query';
const MPESA_AUTH_URL = 'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials';
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
  try {
    const auth = Buffer.from(`${MPESA_CONSUMER_KEY}:${MPESA_CONSUMER_SECRET}`).toString('base64');
    
    const response = await fetch(MPESA_AUTH_URL, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.error('M-Pesa auth error:', await response.text());
      throw new Error('Failed to get M-Pesa access token');
    }

    const data = await response.json();
    
    if (!data.access_token) {
      throw new Error('No access token in response');
    }

    return data.access_token;
  } catch (error) {
    console.error('Error getting access token:', error);
    throw new Error('Failed to get M-Pesa access token');
  }
}

async function checkDatabaseStatus(CheckoutRequestID: string): Promise<{ status: string; message: string; } | null> {
  try {
    console.log('Checking database status for:', CheckoutRequestID);

    // First check subscription status
    const { data: subscriptionData, error: subscriptionError } = await supabase
      .from('subscriptions')
      .select('status, plan, interval')
      .eq('checkout_request_id', CheckoutRequestID)
      .single();

    if (subscriptionError) {
      console.log('No subscription found or error:', subscriptionError.message);
    } else if (subscriptionData?.status === 'active') {
      console.log('Found active subscription in database');
      return { status: 'COMPLETED', message: 'Payment completed successfully' };
    }

    // Then check M-Pesa callbacks
    const { data: callbackData, error: callbackError } = await supabase
      .from('mpesa_callbacks')
      .select('result_code, result_desc, created_at')
      .eq('checkout_request_id', CheckoutRequestID)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (callbackError) {
      if (callbackError.code === 'PGRST116') {
        console.log('No callback found yet');
        return null;
      }
      console.error('Error checking callback status:', callbackError);
      return null;
    }

    if (callbackData) {
      console.log('Found callback data:', callbackData);
      if (callbackData.result_code === 0) {
        return { status: 'COMPLETED', message: 'Payment completed successfully' };
      } else {
        return { 
          status: 'FAILED', 
          message: callbackData.result_desc || 'Payment failed' 
        };
      }
    }

    return null;
  } catch (error) {
    console.error('Error checking database status:', error);
    return null;
  }
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

    console.log('Checking payment status for:', CheckoutRequestID);

    // First check database status (callbacks and subscriptions)
    const dbStatus = await checkDatabaseStatus(CheckoutRequestID);
    if (dbStatus) {
      console.log('Found status in database:', dbStatus);
      return new Response(
        JSON.stringify(dbStatus),
        {
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        }
      );
    }

    // If no database status, query M-Pesa API directly
    console.log('No database status found, querying M-Pesa API');

    const timestamp = new Date().toISOString()
      .replace(/[^0-9]/g, '')
      .slice(0, 14);

    const password = Buffer.from(`${MPESA_SHORTCODE}${MPESA_PASSKEY}${timestamp}`).toString('base64');
    
    let accessToken;
    try {
      accessToken = await getAccessToken();
    } catch (authError) {
      console.error('Failed to get access token:', authError);
      return new Response(
        JSON.stringify({ 
          status: 'PENDING', 
          message: 'Checking payment status...' 
        }),
        {
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        }
      );
    }

    const queryResponse = await fetch(MPESA_QUERY_URL, {
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

    const responseText = await queryResponse.text();
    console.log('M-Pesa query response:', responseText);

    if (!queryResponse.ok) {
      console.error('M-Pesa query error:', responseText);
      return new Response(
        JSON.stringify({ 
          status: 'PENDING', 
          message: 'Payment is being processed...' 
        }),
        {
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        }
      );
    }

    let mpesaData;
    try {
      mpesaData = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Error parsing M-Pesa response:', parseError);
      return new Response(
        JSON.stringify({ 
          status: 'PENDING', 
          message: 'Payment is being processed...' 
        }),
        {
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        }
      );
    }

    console.log('Parsed M-Pesa response:', mpesaData);

    let status = 'PENDING';
    let message = 'Payment is being processed...';

    // Check for specific response codes
    if (mpesaData.ResultCode === 0 || mpesaData.ResultCode === '0') {
      status = 'COMPLETED';
      message = mpesaData.ResultDesc || 'Payment completed successfully';
    } else if (mpesaData.ResultCode === 1032 || mpesaData.ResultCode === '1032') {
      status = 'FAILED';
      message = 'Request cancelled by user';
    } else if (mpesaData.errorCode === '500.001.1001') {
      status = 'FAILED';
      message = 'Payment request has expired';
    } else if (mpesaData.ResultCode && mpesaData.ResultCode !== 0) {
      status = 'FAILED';
      message = mpesaData.ResultDesc || 'Payment failed';
    } else if (mpesaData.errorMessage) {
      if (mpesaData.errorMessage.includes('Invalid Access Token')) {
        status = 'PENDING';
        message = 'Verifying payment status...';
      } else {
        status = 'FAILED';
        message = mpesaData.errorMessage;
      }
    }

    console.log('Final status determination:', { status, message });

    return new Response(
      JSON.stringify({ status, message }),
      {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      }
    );
  } catch (error) {
    console.error('Status check error:', error);
    
    return new Response(
      JSON.stringify({
        status: 'PENDING',
        message: 'Payment status check is in progress...'
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      }
    );
  }
});