import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const TOKEN = "b7f3c1a9-4e2d-4a77-9c30-temp-fix-admin";

Deno.serve(async (req) => {
  if (req.headers.get("x-temp-token") !== TOKEN) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const EMAIL = "fabricio@wfdigital.com.br";
  const PASSWORD = "Brics996633@#$";
  const log: string[] = [];

  // 1. find or create auth user
  let userId: string | null = null;
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const found = list?.users?.find((u) => u.email?.toLowerCase() === EMAIL);
  if (found) {
    userId = found.id;
    const { error } = await admin.auth.admin.updateUserById(userId, {
      password: PASSWORD,
      email_confirm: true,
    });
    if (error) return new Response(JSON.stringify({ step: "update", error: error.message }), { status: 200 });
    log.push("auth user found and updated: " + userId);
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email: EMAIL,
      password: PASSWORD,
      email_confirm: true,
    });
    if (error) return new Response(JSON.stringify({ step: "create", error: error.message }), { status: 200 });
    userId = data.user.id;
    log.push("auth user created: " + userId);
  }

  // 2. funcionarios: keep a single record with login ANJ137
  const { data: funcs } = await admin
    .from("funcionarios")
    .select("id, login, email, user_id, created_at")
    .or(`user_id.eq.${userId},email.ilike.${EMAIL}`);

  let keep = funcs?.find((f) => f.login === "ANJ137") ?? funcs?.[0] ?? null;

  // clear conflicting ANJ137 login on other rows
  for (const f of funcs ?? []) {
    if (keep && f.id !== keep.id) {
      await admin.from("funcionarios").update({ ativo: false, login: `INATIVO_${f.id.slice(0, 8)}` }).eq("id", f.id);
      log.push("deactivated duplicate funcionario " + f.id);
    }
  }
  const { data: conflict } = await admin.from("funcionarios").select("id").eq("login", "ANJ137").maybeSingle();
  if (conflict && keep && conflict.id !== keep.id) {
    await admin.from("funcionarios").update({ login: `LOGIN_${conflict.id.slice(0, 8)}` }).eq("id", conflict.id);
  }

  if (keep) {
    const { error } = await admin
      .from("funcionarios")
      .update({
        login: "ANJ137",
        nome: "Fabricio Gaspar",
        email: EMAIL,
        ativo: true,
        user_id: userId,
        cargo: "ADMINISTRADOR",
      })
      .eq("id", keep.id);
    if (error) log.push("funcionario update error: " + error.message);
    else log.push("funcionario updated: " + keep.id);
  } else {
    const { data, error } = await admin
      .from("funcionarios")
      .insert({ login: "ANJ137", nome: "Fabricio Gaspar", email: EMAIL, ativo: true, user_id: userId, cargo: "ADMINISTRADOR" })
      .select("id")
      .single();
    if (error) log.push("funcionario insert error: " + error.message);
    else {
      keep = { id: data.id } as any;
      log.push("funcionario created: " + data.id);
    }
  }

  // 3. admin role
  await admin.from("user_roles").upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role" });
  log.push("role admin ensured");

  // 4. area permissions
  for (const area of ["central", "industrial", "residencial"]) {
    await admin.from("area_permissoes").upsert({ user_id: userId, area }, { onConflict: "user_id,area" });
  }
  log.push("area permissions ensured");

  // 5. module permissions
  if (keep) {
    const modules = [
      "dashboard", "clientes", "produtos", "ordens", "producao", "agenda",
      "faturamento", "caixa", "contas_pagar", "contas_receber", "relatorios", "configuracoes",
    ];
    await admin.from("modulo_permissoes").upsert(
      modules.map((m) => ({ funcionario_id: keep!.id, modulo_key: m, tem_acesso: true })),
      { onConflict: "funcionario_id,modulo_key" },
    );
    log.push("module permissions ensured");
  }

  // 6. validate real login
  const anon = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
  const { data: signIn, error: signInError } = await anon.auth.signInWithPassword({
    email: EMAIL,
    password: PASSWORD,
  });
  log.push(signInError ? "LOGIN FAILED: " + signInError.message : "LOGIN OK: " + signIn.user?.id);

  return new Response(JSON.stringify({ userId, log }, null, 2), {
    headers: { "Content-Type": "application/json" },
  });
});
