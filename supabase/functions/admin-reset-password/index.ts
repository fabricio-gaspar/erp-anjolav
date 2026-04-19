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

    const body = await req.json();
    const { userId, newPassword, action, email, password, login, nome, cargo } = body;

    // ===== Modo: criar usuário master (action: create-master) =====
    if (action === "create-master") {
      if (!email || !password || !login || !nome) {
        return new Response(JSON.stringify({ error: "Parâmetros inválidos" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: existing } = await supabase
        .from("funcionarios")
        .select("id, user_id")
        .ilike("login", login)
        .maybeSingle();

      let uid: string | null = existing?.user_id ?? null;

      if (!uid) {
        const { data: created, error: createErr } =
          await supabase.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
          });

        if (createErr) {
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
          uid = found.id;
          await supabase.auth.admin.updateUserById(uid, { password });
        } else {
          uid = created.user!.id;
        }
      } else {
        await supabase.auth.admin.updateUserById(uid, { password });
      }

      if (existing) {
        await supabase
          .from("funcionarios")
          .update({
            user_id: uid,
            email,
            nome,
            cargo: cargo ?? "ADMINISTRADOR",
            ativo: true,
          })
          .eq("id", existing.id);
      } else {
        await supabase.from("funcionarios").insert({
          user_id: uid,
          login,
          email,
          nome,
          cargo: cargo ?? "ADMINISTRADOR",
          ativo: true,
        });
      }

      return new Response(JSON.stringify({ success: true, userId: uid }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ===== Modo padrão: reset de senha =====
    if (!userId || !newPassword || newPassword.length < 6) {
      return new Response(JSON.stringify({ error: "Parâmetros inválidos" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error } = await supabase.auth.admin.updateUserById(userId, {
      password: newPassword,
    });

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
