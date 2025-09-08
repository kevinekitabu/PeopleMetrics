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
    console.log('=== M-PESA CALLBACK RECEIVED ===');
    
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
      ResultDesc
    });

    // Determine status
    const status = ResultCode === 0 ? 'completed' : 'failed';
    console.log('Payment status:', status);

    // Update payment record in database
    const { data: updatedPayment, error: updateError } = await supabase
      .from('mpesa_payments')
      .update({
        merchant_request_id: MerchantRequestID,
        status: status,
        result_code: ResultCode,
        result_desc: ResultDesc,
        updated_at: new Date().toISOString()
      })
      .eq('checkout_request_id', CheckoutRequestID)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating payment record:', updateError);
      // Don't throw error, just log it
    } else {
      console.log('Payment record updated:', updatedPayment);
    }

    // If payment was successful, create/activate subscription
    if (ResultCode === 0) {
      console.log('=== PAYMENT SUCCESSFUL - ACTIVATING SUBSCRIPTION ===');
      
      // Get user ID from payment record
      if (updatedPayment?.phone_number) {
        // For now, we'll need to handle subscription creation differently
        // since we don't have user_id in mpesa_payments table
        console.log('Payment successful for phone:', updatedPayment.phone_number);
      }
      
      if (CallbackMetadata) {
        console.log('Callback metadata:', CallbackMetadata);
      }
    } else {
      console.log('=== PAYMENT FAILED ===');
      console.log('Failure reason:', ResultDesc);
    }

    // Always return success to M-Pesa to acknowledge callback
    return new Response(
      JSON.stringify({ 
        success: true,
        message: `Callback processed - ${status}`,
        checkoutRequestId: CheckoutRequestID
      }),
      { 
        headers: { 
          'Content-Type': 'application/json', 
          ...corsHeaders 
        } 
      }
    );

  } catch (error) {
    console.error('=== CALLBACK ERROR ===', error);
    
    // Always return 200 to acknowledge callback to M-Pesa
    return new Response(
      JSON.stringify({ 
        success: false,
        error: 'Callback processing failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 200, // Always 200 for M-Pesa
        headers: { 
          'Content-Type': 'application/json', 
          ...corsHeaders 
        } 
      }
    );
  }
});