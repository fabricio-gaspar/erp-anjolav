import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Use Sandbox for testing, change to "https://api.asaas.com/v3" for production
const ASAAS_BASE_URL = "https://sandbox.asaas.com/api/v3";

interface ChargeRequest {
  customer_name: string;
  customer_email?: string;
  customer_cpf_cnpj: string;
  description: string;
  value: number;
  due_date: string; // YYYY-MM-DD
  billing_type: "BOLETO" | "PIX" | "BOLETO_PIX";
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!ASAAS_API_KEY) {
      return new Response(
        JSON.stringify({ error: "ASAAS_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Require authenticated admin caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: { user: caller } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!caller) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: caller.id, _role: "admin" });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Acesso negado" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: ChargeRequest = await req.json();

    // Validate required fields
    if (!body.customer_name || !body.customer_cpf_cnpj || !body.description || !body.value || !body.due_date || !body.billing_type) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // First, create or find customer in Asaas
    const customerResponse = await fetch(`${ASAAS_BASE_URL}/customers`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "access_token": ASAAS_API_KEY,
      },
      body: JSON.stringify({
        name: body.customer_name,
        email: body.customer_email,
        cpfCnpj: body.customer_cpf_cnpj.replace(/\D/g, ""),
      }),
    });

    let customerId: string;

    if (customerResponse.status === 409) {
      // Customer already exists, fetch by CPF/CNPJ
      const searchResponse = await fetch(
        `${ASAAS_BASE_URL}/customers?cpfCnpj=${body.customer_cpf_cnpj.replace(/\D/g, "")}`,
        {
          headers: {
            "access_token": ASAAS_API_KEY,
          },
        }
      );
      const searchData = await searchResponse.json();
      if (searchData.data && searchData.data.length > 0) {
        customerId = searchData.data[0].id;
      } else {
        throw new Error("Customer not found after conflict");
      }
    } else if (!customerResponse.ok) {
      const errorData = await customerResponse.json();
      throw new Error(`Failed to create customer: ${JSON.stringify(errorData)}`);
    } else {
      const customerData = await customerResponse.json();
      customerId = customerData.id;
    }

    // Create payment/charge
    const paymentResponse = await fetch(`${ASAAS_BASE_URL}/payments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "access_token": ASAAS_API_KEY,
      },
      body: JSON.stringify({
        customer: customerId,
        billingType: body.billing_type,
        value: body.value,
        dueDate: body.due_date,
        description: body.description,
      }),
    });

    if (!paymentResponse.ok) {
      const errorData = await paymentResponse.json();
      throw new Error(`Failed to create payment: ${JSON.stringify(errorData)}`);
    }

    const paymentData = await paymentResponse.json();

    // Get PIX QR Code if billing type includes PIX
    let pixQrCode = null;
    let pixCopyPaste = null;

    if (body.billing_type === "PIX" || body.billing_type === "BOLETO_PIX") {
      const pixResponse = await fetch(
        `${ASAAS_BASE_URL}/payments/${paymentData.id}/pixQrCode`,
        {
          headers: {
            "access_token": ASAAS_API_KEY,
          },
        }
      );

      if (pixResponse.ok) {
        const pixData = await pixResponse.json();
        pixQrCode = pixData.encodedImage;
        pixCopyPaste = pixData.payload;
      }
    }

    // Save to database
    const { data: chargeData, error: dbError } = await supabase
      .from("asaas_charges")
      .insert({
        asaas_id: paymentData.id,
        customer_name: body.customer_name,
        customer_email: body.customer_email,
        customer_cpf_cnpj: body.customer_cpf_cnpj,
        description: body.description,
        value: body.value,
        due_date: body.due_date,
        billing_type: body.billing_type,
        status: paymentData.status,
        invoice_url: paymentData.invoiceUrl,
        bank_slip_url: paymentData.bankSlipUrl,
        pix_qr_code: pixQrCode,
        pix_copy_paste: pixCopyPaste,
      })
      .select()
      .single();

    if (dbError) {
      console.error("Database error:", dbError);
      throw new Error(`Failed to save charge: ${dbError.message}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        charge: chargeData,
        asaas_payment: paymentData,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
