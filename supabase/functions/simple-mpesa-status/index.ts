const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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

    // Get the payment result from global storage
    const paymentResults = globalThis.paymentResults || new Map();
    const result = paymentResults.get(CheckoutRequestID);

    if (!result) {
      return new Response(
        JSON.stringify({ 
          status: 'PENDING', 
          message: 'Payment is being processed...' 
        }),
        { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const status = result.resultCode === 0 ? 'COMPLETED' : 'FAILED';
    const message = result.resultDesc || (status === 'COMPLETED' ? 'Payment successful' : 'Payment failed');

    return new Response(
      JSON.stringify({ status, message }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ 
        status: 'PENDING', 
        message: 'Checking payment status...' 
      }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
});