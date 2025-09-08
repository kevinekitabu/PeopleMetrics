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

    // Query payment status from database
    const { data: payment, error: queryError } = await supabase
      .from('mpesa_payments')
      .select('*')
      .eq('checkout_request_id', CheckoutRequestID)
      .single();

    if (queryError) {
      if (queryError.code === 'PGRST116') {
        // No record found - payment still pending
        console.log('No payment record found, status: PENDING');
        return new Response(
          JSON.stringify({ 
            status: 'PENDING', 
            message: 'Payment is being processed...' 
          }),
          { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }
      
      console.error('Database query error:', queryError);
      return new Response(
        JSON.stringify({ 
          status: 'PENDING', 
          message: 'Checking payment status...',
          error: queryError.message
        }),
        { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    console.log('Payment record found:', payment);

    // Return status based on database record
    let status = 'PENDING';
    let message = 'Payment is being processed...';

    if (payment.status === 'completed') {
      status = 'COMPLETED';
      message = 'Payment successful!';
    } else if (payment.status === 'failed') {
      status = 'FAILED';
      message = payment.result_desc || 'Payment failed';
    } else {
      // Still pending
      status = 'PENDING';
      message = 'Payment is being processed...';
    }

    const response = {
      status: status,
      message: message,
      resultCode: payment.result_code,
      amount: payment.amount,
      phoneNumber: payment.phone_number,
      timestamp: payment.updated_at
    };

    console.log('Returning status:', response);

    return new Response(
      JSON.stringify(response),
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