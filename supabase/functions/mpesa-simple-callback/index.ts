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
    const payload = await req.json();
    console.log('M-Pesa Callback received:', JSON.stringify(payload, null, 2));

    const {
      Body: {
        stkCallback: {
          CheckoutRequestID,
          ResultCode,
          ResultDesc
        }
      }
    } = payload;

    // Get the global payment status map
    const paymentStatus = globalThis.paymentStatus || new Map();

    // Update payment status
    paymentStatus.set(CheckoutRequestID, {
      status: ResultCode === 0 ? 'COMPLETED' : 'FAILED',
      resultCode: ResultCode,
      resultDesc: ResultDesc,
      timestamp: new Date().toISOString()
    });

    console.log(`Payment result updated: ${CheckoutRequestID} -> ${ResultCode === 0 ? 'SUCCESS' : 'FAILED'}`);

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );

  } catch (error) {
    console.error('Callback error:', error);
    return new Response(
      JSON.stringify({ error: 'Callback processing failed' }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
});