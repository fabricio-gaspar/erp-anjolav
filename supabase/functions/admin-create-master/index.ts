import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { email, password, login, nome, cargo } = await req.json();

    if (!email || !password || !login || !nome) {
      return new Response(JSON.stringify({ error: "Parâmetros inválidos" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verifica se já existe funcionário com esse login
    const { data: existing } = await supabase
      .from("funcionarios")
      .select("id, user_id")
      .ilike("login", login)
      .maybeSingle();

    let userId: string | null = existing?.user_id ?? null;

    if (!userId) {
      // Tenta criar usuário no auth
      const { data: created, error: createErr } =
        await supabase.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        });

      if (createErr) {
        // Se já existe no auth, busca pelo email
        const { data: list } = await supabase.auth.admin.listUsers();
        const found = list?.users?.find(
          (u) => u.email?.toLowerCase() === email.toLowerCase()
        );
        if (!found) {
          return new Response(
            JSON.stringify({ error: createErr.message }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
        userId = found.id;
        // Reseta senha do existente
        await supabase.auth.admin.updateUserById(userId, { password });
      } else {
        userId = created.user!.id;
      }
    } else {
      // Atualiza senha
      await supabase.auth.admin.updateUserById(userId, { password });
    }

    if (existing) {
      await supabase
        .from("funcionarios")
        .update({
          user_id: userId,
          email,
          nome,
          cargo: cargo ?? "ADMINISTRADOR",
          ativo: true,
        })
        .eq("id", existing.id);
    } else {
      await supabase.from("funcionarios").insert({
        user_id: userId,
        login,
        email,
        nome,
        cargo: cargo ?? "ADMINISTRADOR",
        ativo: true,
      });
    }

    return new Response(JSON.stringify({ success: true, userId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
