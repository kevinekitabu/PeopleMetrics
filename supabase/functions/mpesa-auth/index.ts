import { Buffer } from 'npm:buffer@6.0.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info',
  'Access-Control-Max-Age': '86400'
};

const MPESA_AUTH_URL = 'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials';
const MPESA_CONSUMER_KEY = 'IIOfklBxQmfrwVOynZJbQw5wCn3GJpCE';
const MPESA_CONSUMER_SECRET = '3YSlKPHxZxE0iXug';

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Basic Auth token from consumer key and secret
    const auth = Buffer.from(`${MPESA_CONSUMER_KEY}:${MPESA_CONSUMER_SECRET}`).toString('base64');

    // Get access token from M-Pesa
    const response = await fetch(MPESA_AUTH_URL, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });

    // Check if response is JSON
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      console.error('Non-JSON response:', text);
      throw new Error('Invalid response format from M-Pesa');
    }

    if (!response.ok) {
      const errorData = await response.json();
      console.error('M-Pesa auth error response:', errorData);
      throw new Error(errorData.errorMessage || `Failed to get access token: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.access_token) {
      console.error('Invalid M-Pesa auth response:', data);
      throw new Error('No access token received from M-Pesa');
    }

    console.log('M-Pesa auth successful');

    return new Response(
      JSON.stringify({
        access_token: data.access_token,
        expires_in: data.expires_in
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      }
    );
  } catch (error) {
    console.error('M-Pesa auth error:', error);
    
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'An unexpected error occurred'
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