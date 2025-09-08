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

    console.log('Checking payment status for:', CheckoutRequestID);

    // Check mpesa_callbacks table first
    const { data: callbackData, error: callbackError } = await supabase
      .from('mpesa_callbacks')
      .select('*')
      .eq('checkout_request_id', CheckoutRequestID)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (callbackError && callbackError.code !== 'PGRST116') {
      console.error('Error checking callback:', callbackError);
    }

    if (callbackData) {
      console.log('Found callback data:', callbackData);
      
      if (callbackData.result_code === 0) {
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
    }

    // Check subscription status as backup
    const { data: subscriptionData, error: subscriptionError } = await supabase
      .from('subscriptions')
      .select('status')
      .eq('checkout_request_id', CheckoutRequestID)
      .single();

    if (!subscriptionError && subscriptionData?.status === 'active') {
      return new Response(
        JSON.stringify({ 
          status: 'COMPLETED', 
          message: 'Payment completed successfully' 
        }),
        { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // No callback found yet, payment still pending
    console.log('No callback found yet, status: PENDING');
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
        message: 'Checking payment status...',
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
});