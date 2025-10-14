import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { CheckoutRequestID } = await req.json();

    if (!CheckoutRequestID) {
      return new Response(
        JSON.stringify({ error: 'CheckoutRequestID is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Query the database for payment status
    const { data: payment, error } = await supabase
      .from('mpesa_payments')
      .select('*')
      .eq('checkout_request_id', CheckoutRequestID)
      .maybeSingle();

    if (error) {
      console.error('Database error:', error);
      return new Response(
        JSON.stringify({
          status: 'PENDING',
          message: 'Checking payment status...',
          source: 'database_error'
        }),
        { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    if (!payment) {
      return new Response(
        JSON.stringify({
          status: 'PENDING',
          message: 'Payment record not found',
          source: 'no_record'
        }),
        { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Map database status to response
    let status = 'PENDING';
    let message = 'Payment is being processed...';

    if (payment.status === 'completed') {
      status = 'COMPLETED';
      message = payment.result_desc || 'Payment successful';
    } else if (payment.status === 'failed') {
      status = 'FAILED';
      message = payment.result_desc || 'Payment failed';
    } else if (payment.status === 'cancelled') {
      status = 'FAILED';
      message = 'Payment was cancelled';
    }

    return new Response(
      JSON.stringify({
        status,
        message,
        source: 'database',
        mpesaReceiptNumber: payment.mpesa_receipt_number,
        transactionDate: payment.transaction_date
      }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );

  } catch (error) {
    console.error('Status check error:', error);
    return new Response(
      JSON.stringify({
        status: 'PENDING',
        message: 'Checking payment status...',
        source: 'exception'
      }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
});