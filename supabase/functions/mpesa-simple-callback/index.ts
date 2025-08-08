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
    console.log('M-Pesa Callback received');
    const payload = await req.json();
    console.log('Full callback payload:', JSON.stringify(payload, null, 2));

    // Extract callback data exactly as M-Pesa sends it
    const {
      Body: {
        stkCallback: {
          MerchantRequestID,
          CheckoutRequestID,
          ResultCode,
          ResultDesc,
          CallbackMetadata
        }
      }
    } = payload;

    console.log('Extracted callback data:', {
      MerchantRequestID,
      CheckoutRequestID,
      ResultCode,
      ResultDesc,
      CallbackMetadata
    });

    // Get the global payment status map
    const paymentStatus = globalThis.paymentStatus || new Map();

    // Update payment status based on result
    const status = ResultCode === 0 ? 'COMPLETED' : 'FAILED';
    
    paymentStatus.set(CheckoutRequestID, {
      status: status,
      resultCode: ResultCode,
      resultDesc: ResultDesc,
      merchantRequestID: MerchantRequestID,
      callbackMetadata: CallbackMetadata,
      timestamp: new Date().toISOString()
    });

    console.log(`Payment status updated: ${CheckoutRequestID} -> ${status} (Code: ${ResultCode})`);
    console.log('Result description:', ResultDesc);

    // Log callback metadata if payment was successful
    if (ResultCode === 0 && CallbackMetadata) {
      console.log('Payment successful! Callback metadata:', CallbackMetadata);
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: `Callback processed successfully - ${status}`
      }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );

  } catch (error) {
    console.error('Callback processing error:', error);
    
    // Always return 200 to acknowledge the callback to M-Pesa
    return new Response(
      JSON.stringify({ 
        success: false,
        error: 'Callback processing failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 200, // Always return 200 to M-Pesa
        headers: { 'Content-Type': 'application/json', ...corsHeaders } 
      }
    );
  }
});

// Ensure global storage is available
if (!globalThis.paymentStatus) {
  globalThis.paymentStatus = new Map();
}