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

    // Store callback in mpesa_callbacks table
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
      console.log('Callback stored successfully');
    }

    // Update mpesa_payments table
    const { error: paymentUpdateError } = await supabase
      .from('mpesa_payments')
      .update({
        status: ResultCode === 0 ? 'completed' : 'failed',
        result_code: ResultCode,
        result_desc: ResultDesc
      })
      .eq('checkout_request_id', CheckoutRequestID);

    if (paymentUpdateError) {
      console.error('Error updating payment record:', paymentUpdateError);
    } else {
      console.log('Payment record updated successfully');
    }

    // If payment was successful, create/update subscription
    if (ResultCode === 0) {
      console.log('=== PAYMENT SUCCESSFUL ===');
      
      // Get the payment record to find user info
      const { data: paymentData, error: paymentFetchError } = await supabase
        .from('mpesa_payments')
        .select('*')
        .eq('checkout_request_id', CheckoutRequestID)
        .single();

      if (paymentFetchError) {
        console.error('Error fetching payment data:', paymentFetchError);
      } else if (paymentData) {
        console.log('Found payment data:', paymentData);
        
        // Try to find existing subscription by checkout_request_id
        const { data: existingSubscription, error: findError } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('checkout_request_id', CheckoutRequestID)
          .single();

        if (findError && findError.code !== 'PGRST116') {
          console.error('Error finding subscription:', findError);
        } else if (existingSubscription) {
          console.log('Found existing subscription, updating status');
          
          const { error: updateError } = await supabase
            .from('subscriptions')
            .update({
              status: 'active',
              updated_at: new Date().toISOString()
            })
            .eq('id', existingSubscription.id);

          if (updateError) {
            console.error('Error updating subscription:', updateError);
          } else {
            console.log('Subscription activated successfully');
          }
        } else {
          console.log('No existing subscription found - will need to be created manually or by frontend');
        }
      }
    } else {
      console.log('=== PAYMENT FAILED ===');
      console.log('Failure reason:', ResultDesc);
      
      // Update any pending subscriptions to failed
      const { error: subscriptionUpdateError } = await supabase
        .from('subscriptions')
        .update({
          status: 'failed',
          updated_at: new Date().toISOString()
        })
        .eq('checkout_request_id', CheckoutRequestID)
        .eq('status', 'pending');

      if (subscriptionUpdateError) {
        console.error('Error updating failed subscription:', subscriptionUpdateError);
      }
    }

    // Always return success to M-Pesa to acknowledge callback
    return new Response(
      JSON.stringify({ 
        success: true,
        message: `Callback processed - ${ResultCode === 0 ? 'success' : 'failed'}`,
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