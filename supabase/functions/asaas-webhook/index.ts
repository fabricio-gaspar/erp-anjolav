import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, asaas-access-token",
};

interface AsaasWebhookPayload {
  event: string;
  payment?: {
    id: string;
    status: string;
    value: number;
    netValue: number;
    description: string;
    billingType: string;
    confirmedDate?: string;
    paymentDate?: string;
    clientPaymentDate?: string;
    invoiceUrl?: string;
    bankSlipUrl?: string;
    transactionReceiptUrl?: string;
  };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Verify Asaas webhook authentication token (hard fail if not configured)
    const expectedToken = Deno.env.get("ASAAS_WEBHOOK_TOKEN");
    if (!expectedToken) {
      console.error("ASAAS_WEBHOOK_TOKEN is not configured; rejecting webhook");
      return new Response(
        JSON.stringify({ error: "Webhook not configured" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const providedToken = req.headers.get("asaas-access-token");
    if (!providedToken || providedToken !== expectedToken) {
      console.warn("Rejected webhook: invalid asaas-access-token");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const payload: AsaasWebhookPayload = await req.json();

    console.log("Received Asaas webhook:", JSON.stringify(payload));

    const { event, payment } = payload;

    if (!event) {
      return new Response(
        JSON.stringify({ error: "Missing event type" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find the charge in our database by asaas_id
    let chargeId = null;
    if (payment?.id) {
      const { data: existingCharge } = await supabase
        .from("asaas_charges")
        .select("id")
        .eq("asaas_id", payment.id)
        .maybeSingle();

      if (existingCharge) {
        chargeId = existingCharge.id;
      }
    }

    // Log the webhook event
    const { error: webhookLogError } = await supabase
      .from("asaas_webhook_events")
      .insert({
        event_type: event,
        payment_id: payment?.id,
        charge_id: chargeId,
        payload: payload,
      });

    if (webhookLogError) {
      console.error("Error logging webhook:", webhookLogError);
    }

    // Process specific events
    if (payment?.id && chargeId) {
      switch (event) {
        case "PAYMENT_CONFIRMED":
        case "PAYMENT_RECEIVED": {
          // Update charge status to paid
          const { error: updateError } = await supabase
            .from("asaas_charges")
            .update({
              status: "RECEIVED",
              paid_at: payment.confirmedDate || payment.paymentDate || new Date().toISOString(),
            })
            .eq("id", chargeId);

          if (updateError) {
            console.error("Error updating charge status:", updateError);
          }
          break;
        }

        case "PAYMENT_OVERDUE": {
          // Update charge status to overdue
          const { error: updateError } = await supabase
            .from("asaas_charges")
            .update({ status: "OVERDUE" })
            .eq("id", chargeId);

          if (updateError) {
            console.error("Error updating charge status:", updateError);
          }
          break;
        }

        case "PAYMENT_DELETED":
        case "PAYMENT_REFUNDED": {
          // Update charge status
          const newStatus = event === "PAYMENT_DELETED" ? "DELETED" : "REFUNDED";
          const { error: updateError } = await supabase
            .from("asaas_charges")
            .update({ status: newStatus })
            .eq("id", chargeId);

          if (updateError) {
            console.error("Error updating charge status:", updateError);
          }
          break;
        }

        case "PAYMENT_UPDATED": {
          // Update charge with new data
          const { error: updateError } = await supabase
            .from("asaas_charges")
            .update({
              status: payment.status,
              invoice_url: payment.invoiceUrl,
              bank_slip_url: payment.bankSlipUrl,
            })
            .eq("id", chargeId);

          if (updateError) {
            console.error("Error updating charge:", updateError);
          }
          break;
        }

        default:
          console.log(`Unhandled event type: ${event}`);
      }
    }

    return new Response(
      JSON.stringify({ success: true, event }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Webhook error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
