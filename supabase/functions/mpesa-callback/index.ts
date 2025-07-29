import { createClient } from 'npm:@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info',
  'Access-Control-Max-Age': '86400'
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
    console.log('Received M-Pesa callback');
    const payload = await req.json();
    console.log('Callback payload:', JSON.stringify(payload, null, 2));

    // Extract relevant data from the callback
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
      MerchantRequestID,
      CheckoutRequestID,
      ResultCode,
      ResultDesc,
      CallbackMetadata
    });

    // Store the callback data
    const { error: insertError } = await supabase
      .from('mpesa_callbacks')
      .insert({
        checkout_request_id: CheckoutRequestID,
        merchant_request_id: MerchantRequestID,
        result_code: ResultCode,
        result_desc: ResultDesc,
        raw_response: payload
      });

    if (insertError) {
      console.error('Error storing callback:', insertError);
      throw insertError;
    }

    // If payment was successful, update subscription
    if (ResultCode === 0) {
      console.log('Payment successful, updating subscription');

      // Get the pending subscription
      const { data: subscription, error: fetchError } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('checkout_request_id', CheckoutRequestID)
        .eq('status', 'pending')
        .single();

      if (fetchError) {
        console.error('Error fetching subscription:', fetchError);
        throw fetchError;
      }

      if (!subscription) {
        console.error('No pending subscription found for:', CheckoutRequestID);
        throw new Error('No pending subscription found');
      }

      // Calculate new period end date
      const daysToAdd = subscription.interval === 'month' ? 30 : 365;
      const currentPeriodEnd = new Date();
      currentPeriodEnd.setDate(currentPeriodEnd.getDate() + daysToAdd);

      // Update subscription status
      const { error: updateError } = await supabase
        .from('subscriptions')
        .update({
          status: 'active',
          current_period_end: currentPeriodEnd.toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', subscription.id)
        .eq('status', 'pending');

      if (updateError) {
        console.error('Error updating subscription:', updateError);
        throw updateError;
      }

      console.log('Successfully activated subscription');
    } else {
      console.log('Payment failed or cancelled');
      
      // Update failed subscription status
      const { error: updateError } = await supabase
        .from('subscriptions')
        .update({
          status: 'failed',
          updated_at: new Date().toISOString()
        })
        .eq('checkout_request_id', CheckoutRequestID)
        .eq('status', 'pending');

      if (updateError) {
        console.error('Error updating failed subscription:', updateError);
        throw updateError;
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: ResultCode === 0 ? 'Payment processed successfully' : 'Payment failed'
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      }
    );
  } catch (error) {
    console.error('Callback processing error:', error);
    
    // Always return 200 to acknowledge the callback
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'An unexpected error occurred'
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      }
    );
  }
});