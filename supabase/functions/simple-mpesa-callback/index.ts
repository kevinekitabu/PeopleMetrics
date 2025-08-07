const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Simple in-memory storage for demo (in production, use a database)
const paymentResults = new Map();

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

    // Store the result
    paymentResults.set(CheckoutRequestID, {
      resultCode: ResultCode,
      resultDesc: ResultDesc,
      timestamp: new Date().toISOString()
    });

    console.log(`Payment result stored: ${CheckoutRequestID} -> ${ResultCode === 0 ? 'SUCCESS' : 'FAILED'}`);

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );

  } catch (error) {
    console.error('Callback error:', error);
    return new Response(
      JSON.stringify({ error: 'Callback processing failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
});

// Export the results map for the status function to access
globalThis.paymentResults = paymentResults;