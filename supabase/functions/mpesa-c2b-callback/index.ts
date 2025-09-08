import { createClient } from 'npm:@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

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
    console.log('Callback payload:', JSON.stringify(payload, null, 2));

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

    console.log('Processing callback:', {
      CheckoutRequestID,
      ResultCode,
      ResultDesc
    });

    // Store callback in database
    const { error: callbackError } = await supabase
      .from('mpesa_callbacks')
      .insert({
        checkout_request_id: CheckoutRequestID,
        merchant_request_id: MerchantRequestID,
        result_code: ResultCode,
        result_desc: ResultDesc,
        raw_response: payload
      });

    if (callbackError) {
      console.error('Error storing callback:', callbackError);
    } else {
      console.log('✅ Callback stored successfully');
    }

    // Update payment status
    const status = ResultCode === 0 ? 'completed' : 'failed';
    
    const { data: updatedPayment, error: paymentError } = await supabase
      .from('mpesa_payments')
      .update({
        status: status,
        result_code: ResultCode,
        result_desc: ResultDesc,
        updated_at: new Date().toISOString()
      })
      .eq('checkout_request_id', CheckoutRequestID);

    if (paymentError) {
      console.error('Error updating payment:', paymentError);
      // Try to find and update by merchant_request_id as fallback
      const { error: fallbackError } = await supabase
        .from('mpesa_payments')
        .update({
          status: status,
          result_code: ResultCode,
          result_desc: ResultDesc,
          updated_at: new Date().toISOString()
        })
        .eq('merchant_request_id', MerchantRequestID);
      
      if (fallbackError) {
        console.error('Fallback update also failed:', fallbackError);
      } else {
        console.log('✅ Payment status updated via fallback method');
      }
    } else {
      console.log('✅ Payment status updated to:', status);
    }

    // If successful, handle subscription
    if (ResultCode === 0) {
      console.log('Payment successful - processing subscription');
      
      // Get payment details
      const { data: paymentData } = await supabase
        .from('mpesa_payments')
        .select('*')
        .eq('checkout_request_id', CheckoutRequestID)
        .single();

      if (paymentData) {
        console.log('Found payment data for subscription processing');
        
        // Check if subscription already exists
        const { data: existingSub } = await supabase
          .from('subscriptions')
          .select('id')
          .eq('checkout_request_id', CheckoutRequestID)
          .single();

        if (!existingSub) {
          // Create subscription - we'll let the frontend handle this
          console.log('Subscription will be created by frontend');
        }
      }
    }

    console.log('=== CALLBACK PROCESSED SUCCESSFULLY ===');

    return new Response(
      JSON.stringify({ 
        success: true,
        message: `Payment ${ResultCode === 0 ? 'successful' : 'failed'}`,
        resultCode: ResultCode
      }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );

  } catch (error) {
    console.error('Callback error:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: 'Callback processing failed'
      }),
      { 
        status: 200, // Always return 200 to M-Pesa
        headers: { 'Content-Type': 'application/json', ...corsHeaders } 
      }
    );
  }
});