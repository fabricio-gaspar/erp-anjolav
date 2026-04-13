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

    const { evento, ordem_servico_id, cliente_nome, cliente_telefone, itens, status_os, prateleira, posicao } = await req.json();

    if (!evento) {
      return new Response(
        JSON.stringify({ error: "evento é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get n8n webhook URL from config
    const { data: instancia } = await supabase
      .from("whatsapp_instancias")
      .select("webhook_n8n_url")
      .limit(1)
      .maybeSingle();

    if (!instancia?.webhook_n8n_url) {
      return new Response(
        JSON.stringify({ error: "URL do webhook n8n não configurada" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const payload = {
      evento,
      ordem_servico_id,
      cliente: cliente_nome,
      telefone: cliente_telefone,
      itens: itens || [],
      status: status_os,
      prateleira: prateleira || null,
      posicao: posicao || null,
      timestamp: new Date().toISOString(),
    };

    // Send to n8n
    const n8nRes = await fetch(instancia.webhook_n8n_url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const success = n8nRes.ok;
    let n8nData;
    try {
      n8nData = await n8nRes.text();
    } catch {
      n8nData = null;
    }

    // Log the dispatch
    await supabase.from("mensagens_log").insert({
      ordem_servico_id: ordem_servico_id || null,
      telefone: cliente_telefone || "n8n-webhook",
      mensagem: JSON.stringify(payload),
      evento,
      status: success ? "enviado" : "erro",
      erro: success ? null : `n8n retornou status ${n8nRes.status}`,
      canal: "n8n",
    });

    return new Response(
      JSON.stringify({ success, n8n_response: n8nData }),
      { status: success ? 200 : 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
