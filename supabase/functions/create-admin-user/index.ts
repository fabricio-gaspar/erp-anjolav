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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Check if admin already exists
    const { data: existing } = await supabase
      .from("funcionarios")
      .select("id")
      .eq("login", "ADMIN")
      .maybeSingle();

    if (existing) {
      return new Response(
        JSON.stringify({ message: "Admin user already exists", id: existing.id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Create auth user with admin credentials
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: "master@anjolav.com",
      password: "fg886633@#$",
      email_confirm: true,
      user_metadata: { nome: "ADMIN", cargo: "ADMINISTRADOR" },
    });

    if (authError) {
      throw new Error("Auth error: " + authError.message);
    }

    const userId = authData.user.id;

    // Create funcionario record
    const { data: func, error: funcError } = await supabase
      .from("funcionarios")
      .insert({
        user_id: userId,
        nome: "ADMIN",
        cargo: "ADMINISTRADOR",
        email: "master@anjolav.com",
        login: "ADMIN",
        ativo: true,
      })
      .select()
      .single();

    if (funcError) {
      throw new Error("Funcionario error: " + funcError.message);
    }

    // Assign admin role
    const { error: roleError } = await supabase
      .from("user_roles")
      .insert({ user_id: userId, role: "admin" });

    if (roleError) {
      throw new Error("Role error: " + roleError.message);
    }

    return new Response(
      JSON.stringify({ success: true, funcionario_id: func.id, user_id: userId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
