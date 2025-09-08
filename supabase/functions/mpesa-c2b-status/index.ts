import { createClient } from 'npm:@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

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

    // Check mpesa_callbacks table for the result
    const { data: callbackData, error: callbackError } = await supabase
      .from('mpesa_callbacks')
      .select('result_code, result_desc, created_at')
      .eq('checkout_request_id', CheckoutRequestID)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (callbackError) {
      if (callbackError.code === 'PGRST116') {
        // No callback found yet - payment still pending
        console.log('No callback found yet - payment pending');
        return new Response(
          JSON.stringify({ 
            status: 'PENDING', 
            message: 'Payment is being processed...' 
          }),
          { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      } else {
        console.error('Error checking callback:', callbackError);
        return new Response(
          JSON.stringify({ 
            status: 'PENDING', 
            message: 'Checking payment status...' 
          }),
          { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }
    }

    // Found callback - check result code
    console.log('Found callback data:', callbackData);
    console.log('Result code:', callbackData.result_code);
    console.log('Result description:', callbackData.result_desc);

    if (callbackData.result_code === 0) {
      // Payment successful
      console.log('=== PAYMENT SUCCESSFUL ===');
      return new Response(
        JSON.stringify({ 
          status: 'COMPLETED', 
          message: 'Payment completed successfully',
          resultCode: callbackData.result_code,
          resultDesc: callbackData.result_desc
        }),
        { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    } else {
      // Payment failed
      console.log('=== PAYMENT FAILED ===');
      console.log('Failure reason:', callbackData.result_desc);
      return new Response(
        JSON.stringify({ 
          status: 'FAILED', 
          message: callbackData.result_desc || 'Payment failed',
          resultCode: callbackData.result_code,
          resultDesc: callbackData.result_desc
        }),
        { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

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