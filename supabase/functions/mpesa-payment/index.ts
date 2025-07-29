import { Buffer } from 'buffer';
import { createClient } from '@supabase/supabase-js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info',
  'Access-Control-Max-Age': '86400'
};

const MPESA_API_URL = 'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest';
const MPESA_AUTH_URL = 'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials';
const MPESA_CONSUMER_KEY = 'IIOfklBxQmfrwVOynZJbQw5wCn3GJpCE';
const MPESA_CONSUMER_SECRET = '3YSlKPHxZxE0iXug';
const MPESA_SHORTCODE = '174379';
const MPESA_PASSKEY = 'bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919';

const supabase = createClient(
  process.env.SUPABASE_URL ?? '',
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
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

import { serve } from "https://deno.land/std@0.203.0/http/server.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phoneNumber, amount, plan, interval, userId } = await req.json();

    // Validate required fields
    if (!phoneNumber || !amount || !plan || !interval || !userId) {
      throw new Error('Missing required fields');
    }

    // Validate phone number format (should start with 254)
    if (!phoneNumber.match(/^254[0-9]{9}$/)) {
      throw new Error('Invalid phone number format. Must start with 254 followed by 9 digits');
    }

    console.log('Processing payment request:', { phoneNumber, amount, plan, interval });

    // Get fresh access token
    const access_token = await getAccessToken();

    // Generate timestamp in the format YYYYMMDDHHmmss
    const timestamp = new Date().toISOString()
      .replace(/[^0-9]/g, '')
      .slice(0, 14);

    // Generate password (shortcode + passkey + timestamp)
    const password = Buffer.from(`${MPESA_SHORTCODE}${MPESA_PASSKEY}${timestamp}`).toString('base64');

    // Construct callback URL with the Supabase project URL
    const callbackUrl = `${process.env.SUPABASE_URL}/functions/v1/mpesa-callback`;
    console.log('Using callback URL:', callbackUrl);

    // Initiate STK Push
    const response = await fetch(MPESA_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        BusinessShortCode: MPESA_SHORTCODE,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: Math.round(amount), // Ensure amount is a whole number
        PartyA: phoneNumber,
        PartyB: MPESA_SHORTCODE,
        PhoneNumber: phoneNumber,
        CallBackURL: callbackUrl,
        AccountReference: 'PeopleMetrics',
        TransactionDesc: `Subscription - ${plan} (${interval}ly)`
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('M-Pesa API error response:', errorText);
      throw new Error(`Failed to initiate M-Pesa payment: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('M-Pesa API response:', data);

    if (!data.CheckoutRequestID) {
      console.error('Invalid M-Pesa API response:', data);
      throw new Error('Invalid response from M-Pesa');
    }

    // Create a pending subscription record
    const { error: subscriptionError } = await supabase
      .from('subscriptions')
      .insert({
        user_id: userId,
        plan,
        interval,
        status: 'pending',
        checkout_request_id: data.CheckoutRequestID,
        current_period_end: new Date(Date.now() + (interval === 'month' ? 30 : 365) * 24 * 60 * 60 * 1000)
      });

    if (subscriptionError) {
      console.error('Error creating subscription record:', subscriptionError);
      throw subscriptionError;
    }

    return new Response(
      JSON.stringify(data),
      {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  } catch (error) {
    console.error('M-Pesa payment error:', error);
    
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'An unexpected error occurred'
      }),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  }
});