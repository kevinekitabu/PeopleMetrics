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
      console.error('No CheckoutRequestID provided');
      return new Response(
        JSON.stringify({ error: 'CheckoutRequestID is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    console.log('Checking status for:', CheckoutRequestID);

    // Get the global payment status map
    const paymentStatus = globalThis.paymentStatus || new Map();
    const result = paymentStatus.get(CheckoutRequestID);

    if (!result) {
      console.log('No status found in memory for:', CheckoutRequestID);
      console.log('Available payment IDs:', Array.from(paymentStatus.keys()));
      
      return new Response(
        JSON.stringify({ 
          status: 'PENDING', 
          message: 'Payment is being processed...' 
        }),
        { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    console.log('Found status in memory:', result);

    // Return the status
    const response = {
      status: result.status,
      message: result.resultDesc || (result.status === 'COMPLETED' ? 'Payment successful' : 'Payment failed'),
      resultCode: result.resultCode,
      merchantRequestID: result.merchantRequestID,
      timestamp: result.timestamp
    };

    console.log('Returning status response:', response);

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

// Ensure global storage is available
if (!globalThis.paymentStatus) {
  globalThis.paymentStatus = new Map();
}