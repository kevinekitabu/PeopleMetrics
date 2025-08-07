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

    // Get the global payment status map
    const paymentStatus = globalThis.paymentStatus || new Map();
    const result = paymentStatus.get(CheckoutRequestID);

    if (!result) {
      return new Response(
        JSON.stringify({ 
          status: 'PENDING', 
          message: 'Payment is being processed...' 
        }),
        { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    return new Response(
      JSON.stringify({ 
        status: result.status,
        message: result.resultDesc || (result.status === 'COMPLETED' ? 'Payment successful' : 'Payment failed')
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