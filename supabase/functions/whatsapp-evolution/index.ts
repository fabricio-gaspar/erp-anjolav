import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { action, ...params } = await req.json();

    // Get Evolution API config from DB
    const { data: instancia } = await supabase
      .from("whatsapp_instancias")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (!instancia?.api_url) {
      return new Response(
        JSON.stringify({ error: "Evolution API não configurada. Configure a URL nas configurações." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiUrl = instancia.api_url.replace(/\/$/, "");
    const apiKey = instancia.api_key_encrypted || "";
    const instanceName = instancia.nome_instancia || "loja1";

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (apiKey) headers["apikey"] = apiKey;

    // ACTION: create instance + get QR code
    if (action === "connect") {
      // Create instance
      const createRes = await fetch(`${apiUrl}/instance/create`, {
        method: "POST",
        headers,
        body: JSON.stringify({ instanceName }),
      });
      const createData = await createRes.json();

      // Get QR code
      const connectRes = await fetch(`${apiUrl}/instance/connect/${instanceName}`, {
        method: "GET",
        headers,
      });
      const connectData = await connectRes.json();

      const qrCode = connectData?.base64 || connectData?.qrcode?.base64 || null;

      // Save QR code and status
      await supabase
        .from("whatsapp_instancias")
        .update({ qr_code: qrCode, status: "aguardando_scan" })
        .eq("id", instancia.id);

      return new Response(
        JSON.stringify({ success: true, qr_code: qrCode, instance: createData }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ACTION: check status
    if (action === "status") {
      const statusRes = await fetch(`${apiUrl}/instance/connectionState/${instanceName}`, {
        method: "GET",
        headers,
      });
      const statusData = await statusRes.json();

      const connected = statusData?.instance?.state === "open" || statusData?.state === "open";
      const newStatus = connected ? "conectado" : "desconectado";

      await supabase
        .from("whatsapp_instancias")
        .update({ status: newStatus, qr_code: connected ? null : instancia.qr_code })
        .eq("id", instancia.id);

      return new Response(
        JSON.stringify({ success: true, connected, status: newStatus, raw: statusData }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ACTION: send message
    if (action === "send") {
      const { telefone, mensagem, ordem_servico_id, cliente_id, evento } = params;

      if (!telefone || !mensagem) {
        return new Response(
          JSON.stringify({ error: "telefone e mensagem são obrigatórios" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const telLimpo = telefone.replace(/\D/g, "");
      const telCompleto = telLimpo.startsWith("55") ? telLimpo : `55${telLimpo}`;

      const sendRes = await fetch(`${apiUrl}/message/sendText/${instanceName}`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          number: telCompleto,
          text: mensagem,
        }),
      });

      const sendData = await sendRes.json();
      const success = sendRes.ok;

      // Log the message
      await supabase.from("mensagens_log").insert({
        ordem_servico_id: ordem_servico_id || null,
        cliente_id: cliente_id || null,
        telefone: telCompleto,
        mensagem,
        evento: evento || "manual",
        status: success ? "enviado" : "erro",
        erro: success ? null : JSON.stringify(sendData),
        canal: "evolution",
      });

      return new Response(
        JSON.stringify({ success, data: sendData }),
        { status: success ? 200 : 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ACTION: disconnect
    if (action === "disconnect") {
      const logoutRes = await fetch(`${apiUrl}/instance/logout/${instanceName}`, {
        method: "DELETE",
        headers,
      });
      const logoutData = await logoutRes.json();

      await supabase
        .from("whatsapp_instancias")
        .update({ status: "desconectado", qr_code: null })
        .eq("id", instancia.id);

      return new Response(
        JSON.stringify({ success: true, data: logoutData }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Ação inválida. Use: connect, status, send, disconnect" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
