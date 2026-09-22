import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";
import { requireAdmin } from "../_shared/auth.ts";
import { isValidCnpj, isValidCpf } from "../_shared/br-document.ts";
import { handlePreflight, jsonResponse, readJsonBody, requireJsonPost } from "../_shared/http.ts";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const PROFILE_TEXT_FIELDS: Readonly<Record<string, number>> = {
  genero: 40,
  estado_civil: 60,
  nacionalidade: 80,
  naturalidade: 120,
  nome_mae: 160,
  nome_pai: 160,
  escolaridade: 120,
  rg: 30,
  rg_orgao_emissor: 30,
  pis: 30,
  ctps_numero: 30,
  ctps_serie: 20,
  ctps_uf: 2,
  titulo_eleitor: 30,
  cnh_numero: 30,
  cnh_categoria: 10,
  contato_emergencia_nome: 160,
  contato_emergencia_telefone: 30,
  contato_emergencia_parentesco: 80,
  tipo_contrato: 40,
  regime_jornada: 40,
  banco_nome: 120,
  banco_agencia: 30,
  banco_conta: 40,
  banco_tipo_conta: 30,
  pix_chave: 160,
  pix_tipo_chave: 30,
  empregador_cnpj: 20,
  empregador_nome: 160,
  codigo_externo: 80,
  cbo: 20,
  matricula_inss: 40,
  centro_custo: 120,
  filial: 120,
  observacoes: 5_000,
};

const PROFILE_DATE_FIELDS = ["data_nascimento", "cnh_validade", "data_demissao"] as const;
const PROFILE_MONEY_FIELDS = [
  "salario_base",
  "valor_hora",
  "vale_transporte",
  "vale_alimentacao",
  "vale_refeicao",
  "plano_saude",
  "plano_odontologico",
  "gratificacao",
  "outros_descontos",
  "outros_beneficios",
] as const;
const PROFILE_PERCENT_FIELDS = [
  "comissao_percentual",
  "insalubridade_percentual",
  "desconto_inss_percentual",
  "desconto_vt_percentual",
] as const;

type EmployeePatchResult =
  | { ok: true; value: Record<string, unknown> }
  | { ok: false; error: string };

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function strictOptionalText(value: unknown, maxLength: number): { ok: true; value: string | null } | { ok: false } {
  if (value === null || value === "") return { ok: true, value: null };
  if (typeof value !== "string") return { ok: false };
  const normalized = value.trim();
  if (!normalized) return { ok: true, value: null };
  if (normalized.length > maxLength) return { ok: false };
  return { ok: true, value: normalized };
}

function strictOptionalNumber(
  value: unknown,
  min: number,
  max: number,
): { ok: true; value: number | null } | { ok: false } {
  if (value === null || value === "") return { ok: true, value: null };
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    return { ok: false };
  }
  return { ok: true, value: Math.round(value * 100) / 100 };
}

function parseAddress(value: unknown): { ok: true; value: Record<string, string | null> | null } | { ok: false } {
  if (value === null) return { ok: true, value: null };
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ok: false };

  const source = value as Record<string, unknown>;
  const limits: Readonly<Record<string, number>> = {
    logradouro: 200,
    numero: 20,
    complemento: 120,
    bairro: 120,
    cidade: 120,
    uf: 2,
    cep: 10,
  };
  const address: Record<string, string | null> = {};
  for (const [field, maxLength] of Object.entries(limits)) {
    if (!hasOwn(source, field)) continue;
    const parsed = strictOptionalText(source[field], maxLength);
    if (!parsed.ok) return { ok: false };
    address[field] = parsed.value;
  }

  if (address.uf) {
    const uf = address.uf.toUpperCase();
    if (!/^[A-Z]{2}$/.test(uf)) return { ok: false };
    address.uf = uf;
  }
  if (address.cep) {
    const cep = address.cep.replace(/\D/g, "");
    if (!/^\d{8}$/.test(cep)) return { ok: false };
    address.cep = cep;
  }
  return { ok: true, value: address };
}

function buildProfilePatch(body: Record<string, unknown>): EmployeePatchResult {
  const patch: Record<string, unknown> = {};

  for (const [field, maxLength] of Object.entries(PROFILE_TEXT_FIELDS)) {
    if (!hasOwn(body, field)) continue;
    const parsed = strictOptionalText(body[field], maxLength);
    if (!parsed.ok) return { ok: false, error: `Campo ${field} inválido` };
    patch[field] = parsed.value;
  }

  for (const field of PROFILE_DATE_FIELDS) {
    if (!hasOwn(body, field)) continue;
    const value = body[field];
    if (value === null || value === "") {
      patch[field] = null;
    } else if (typeof value === "string" && isValidIsoDate(value)) {
      patch[field] = value;
    } else {
      return { ok: false, error: `Campo ${field} inválido` };
    }
  }

  for (const field of PROFILE_MONEY_FIELDS) {
    if (!hasOwn(body, field)) continue;
    const parsed = strictOptionalNumber(body[field], 0, 9_999_999_999.99);
    if (!parsed.ok) return { ok: false, error: `Campo ${field} inválido` };
    patch[field] = parsed.value;
  }

  for (const field of PROFILE_PERCENT_FIELDS) {
    if (!hasOwn(body, field)) continue;
    const parsed = strictOptionalNumber(body[field], 0, 100);
    if (!parsed.ok) return { ok: false, error: `Campo ${field} inválido` };
    patch[field] = parsed.value;
  }

  if (hasOwn(body, "periculosidade")) {
    if (typeof body.periculosidade !== "boolean") {
      return { ok: false, error: "Campo periculosidade inválido" };
    }
    patch.periculosidade = body.periculosidade;
  }

  if (hasOwn(body, "endereco")) {
    const parsed = parseAddress(body.endereco);
    if (!parsed.ok) return { ok: false, error: "Endereço inválido" };
    patch.endereco = parsed.value;
  }

  const employerCnpj = patch.empregador_cnpj;
  if (typeof employerCnpj === "string" && !isValidCnpj(employerCnpj.replace(/\D/g, ""))) {
    return { ok: false, error: "CNPJ do empregador inválido" };
  }

  const emergencyPhone = patch.contato_emergencia_telefone;
  if (typeof emergencyPhone === "string") {
    const digits = emergencyPhone.replace(/\D/g, "");
    if (![10, 11, 12, 13].includes(digits.length)) {
      return { ok: false, error: "Telefone de emergência inválido" };
    }
  }

  return { ok: true, value: patch };
}

function optionalText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized ? normalized.slice(0, maxLength) : null;
}

function optionalAvatarUrl(value: unknown, supabaseUrl: string): string | null {
  const rawUrl = optionalText(value, 2_048);
  if (!rawUrl) return null;
  try {
    const url = new URL(rawUrl);
    const storageHost = new URL(supabaseUrl).hostname;
    return url.protocol === "https:" &&
        !url.username &&
        !url.password &&
        url.hostname === storageHost &&
        url.pathname.startsWith("/storage/v1/object/public/avatars/funcionarios/")
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function avatarObjectPath(value: unknown, supabaseUrl: string): string | null {
  const avatarUrl = optionalAvatarUrl(value, supabaseUrl);
  if (!avatarUrl) return null;
  try {
    const marker = "/storage/v1/object/public/avatars/";
    const pathname = new URL(avatarUrl).pathname;
    if (!pathname.startsWith(marker)) return null;
    const objectPath = decodeURIComponent(pathname.slice(marker.length));
    return /^funcionarios\/[0-9a-f-]{36}\.(?:jpg|png|webp)$/i.test(objectPath)
      ? objectPath
      : null;
  } catch {
    return null;
  }
}

function isValidIsoDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.toISOString().slice(0, 10) === value;
}

function roleForCargo(cargo: string): "admin" | "producao" | "operador" {
  const normalized = cargo.toUpperCase();
  if (normalized === "ADMINISTRADOR") return "admin";
  if (normalized === "PRODUCAO" || normalized === "PRODUÇÃO") return "producao";
  return "operador";
}

async function countActiveAdmins(supabase: SupabaseClient): Promise<number> {
  const { data: activeEmployees, error: employeeError } = await supabase
    .from("funcionarios")
    .select("user_id")
    .eq("ativo", true)
    .not("user_id", "is", null);
  if (employeeError) throw employeeError;
  const userIds = (activeEmployees ?? [])
    .map(({ user_id }) => user_id as string | null)
    .filter((userId): userId is string => Boolean(userId));
  if (userIds.length === 0) return 0;

  const { count, error: roleError } = await supabase
    .from("user_roles")
    .select("id", { count: "exact", head: true })
    .eq("role", "admin")
    .in("user_id", userIds);
  if (roleError) throw roleError;
  return count ?? 0;
}

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  const invalidRequest = requireJsonPost(req);
  if (invalidRequest) return invalidRequest;

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Supabase service credentials are not configured");
    return jsonResponse(req, { error: "Serviço temporariamente indisponível" }, 503);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const authorization = await requireAdmin(req, supabase);
  if (!authorization.ok) return authorization.response;

  try {
    const parsedBody = await readJsonBody(req, 65_536);
    if (!parsedBody.ok) return parsedBody.response;
    if (!parsedBody.value || typeof parsedBody.value !== "object" || Array.isArray(parsedBody.value)) {
      return jsonResponse(req, { error: "JSON inválido" }, 400);
    }
    const body = parsedBody.value as Record<string, unknown>;
    const action = typeof body.action === "string" ? body.action : "";

    if (action === "health") {
      return jsonResponse(req, { success: true });
    }

    if (action === "create") {
      const nome = optionalText(body.nome, 160);
      const cargo = optionalText(body.cargo, 80);
      const login = optionalText(body.login, 100)?.toLowerCase() ?? null;
      const email = optionalText(body.email, 254)?.toLowerCase() ?? null;
      const password = typeof body.password === "string" ? body.password : "";
      const rawCpf = optionalText(body.cpf, 20);
      const cpf = rawCpf?.replace(/\D/g, "") ?? null;
      const telefone = optionalText(body.telefone, 30);
      const telefoneDigits = telefone?.replace(/\D/g, "") ?? "";
      const avatarUrl = optionalAvatarUrl(body.avatar_url, supabaseUrl);

      if (!nome || !cargo || !login) {
        return jsonResponse(req, { error: "Nome, cargo e login são obrigatórios" }, 400);
      }
      if (!/^[a-z0-9._-]{3,100}$/.test(login)) {
        return jsonResponse(req, { error: "Login inválido" }, 400);
      }
      if (email && !EMAIL_PATTERN.test(email)) {
        return jsonResponse(req, { error: "Email inválido" }, 400);
      }
      if (email && (password.length < 12 || password.length > 128)) {
        return jsonResponse(req, { error: "A senha deve ter entre 12 e 128 caracteres" }, 400);
      }
      if (rawCpf && (!cpf || !isValidCpf(cpf))) {
        return jsonResponse(req, { error: "CPF inválido" }, 400);
      }
      if (telefone && ![10, 11, 12, 13].includes(telefoneDigits.length)) {
        return jsonResponse(req, { error: "Telefone inválido" }, 400);
      }
      if (body.avatar_url && !avatarUrl) {
        return jsonResponse(req, { error: "A foto deve usar uma URL HTTPS válida" }, 400);
      }

      const { data: existingEmployee, error: lookupError } = await supabase
        .from("funcionarios")
        .select("id")
        .eq("login", login)
        .maybeSingle();
      if (lookupError) throw lookupError;
      if (existingEmployee) {
        return jsonResponse(req, { error: "Já existe um funcionário com este login" }, 409);
      }

      let createdUserId: string | null = null;
      if (email) {
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { nome, cargo },
        });
        if (authError) {
          console.warn("Falha ao criar usuário de autenticação", { code: authError.code });
          return jsonResponse(req, { error: "Não foi possível criar o acesso do funcionário" }, 409);
        }
        createdUserId = authData.user.id;
      }

      const employeePayload = {
        user_id: createdUserId,
        nome,
        cargo,
        departamento: optionalText(body.departamento, 120),
        telefone,
        cpf,
        email,
        login,
        avatar_url: avatarUrl,
        ativo: true,
      };

      const { data: employee, error: employeeError } = await supabase
        .from("funcionarios")
        .insert(employeePayload)
        .select()
        .single();

      if (employeeError || !employee) {
        if (createdUserId) await supabase.auth.admin.deleteUser(createdUserId);
        console.error("Falha ao criar funcionário; acesso compensado", { code: employeeError?.code });
        return jsonResponse(req, { error: "Não foi possível cadastrar o funcionário" }, 409);
      }

      if (cargo.toUpperCase() === "MOTORISTA") {
        const { error: driverError } = await supabase.from("motoristas").insert({
          nome,
          telefone: employeePayload.telefone,
          email,
          funcionario_id: employee.id,
          ativo: true,
        });

        if (driverError) {
          await supabase.from("funcionarios").delete().eq("id", employee.id);
          if (createdUserId) await supabase.auth.admin.deleteUser(createdUserId);
          console.error("Falha ao criar motorista; cadastro compensado", { code: driverError.code });
          return jsonResponse(req, { error: "Não foi possível cadastrar o motorista" }, 409);
        }
      }

      return jsonResponse(req, { employee, userId: createdUserId }, 201);
    }

    if (action === "update") {
      const employeeId = typeof body.employeeId === "string" ? body.employeeId : "";
      if (!UUID_PATTERN.test(employeeId)) {
        return jsonResponse(req, { error: "Funcionário inválido" }, 400);
      }

      const { data: existing, error: employeeLookupError } = await supabase
        .from("funcionarios")
        .select("*")
        .eq("id", employeeId)
        .maybeSingle();
      if (employeeLookupError) throw employeeLookupError;
      if (!existing) return jsonResponse(req, { error: "Funcionário não encontrado" }, 404);

      const profilePatch = buildProfilePatch(body);
      if (!profilePatch.ok) return jsonResponse(req, { error: profilePatch.error }, 400);

      const nome = hasOwn(body, "nome") ? optionalText(body.nome, 160) : existing.nome;
      const cargo = hasOwn(body, "cargo") ? optionalText(body.cargo, 80) : existing.cargo;
      const login = (hasOwn(body, "login") ? optionalText(body.login, 100) : existing.login)?.toLowerCase() ?? null;
      const email = (hasOwn(body, "email") ? optionalText(body.email, 254) : existing.email)?.toLowerCase() ?? null;
      const departamento = hasOwn(body, "departamento") ? optionalText(body.departamento, 120) : existing.departamento;
      const telefone = hasOwn(body, "telefone") ? optionalText(body.telefone, 30) : existing.telefone;
      const rawCpf = hasOwn(body, "cpf") ? optionalText(body.cpf, 20) : existing.cpf;
      const cpf = rawCpf?.replace(/\D/g, "") ?? null;
      const avatarUrl = hasOwn(body, "avatar_url")
        ? optionalAvatarUrl(body.avatar_url, supabaseUrl)
        : existing.avatar_url;
      const dataAdmissao = hasOwn(body, "data_admissao")
        ? optionalText(body.data_admissao, 10)
        : existing.data_admissao;
      const cargaHoraria = hasOwn(body, "carga_horaria")
        ? body.carga_horaria === null
          ? null
          : Number(body.carga_horaria)
        : existing.carga_horaria;
      const diasTrabalhados = hasOwn(body, "dias_trabalhados") ? body.dias_trabalhados : existing.dias_trabalhados;
      const telefoneDigits = telefone?.replace(/\D/g, "") ?? "";

      if (!nome || !cargo || !login || !/^[a-z0-9._-]{3,100}$/.test(login)) {
        return jsonResponse(req, { error: "Nome, cargo ou login inválido" }, 400);
      }
      if (email && !EMAIL_PATTERN.test(email)) return jsonResponse(req, { error: "Email inválido" }, 400);
      if (rawCpf && (!cpf || !isValidCpf(cpf))) return jsonResponse(req, { error: "CPF inválido" }, 400);
      if (telefone && ![10, 11, 12, 13].includes(telefoneDigits.length)) {
        return jsonResponse(req, { error: "Telefone inválido" }, 400);
      }
      if (hasOwn(body, "avatar_url") && body.avatar_url && !avatarUrl) {
        return jsonResponse(req, { error: "A foto deve pertencer ao Storage de avatares" }, 400);
      }
      if (dataAdmissao && !isValidIsoDate(dataAdmissao)) {
        return jsonResponse(req, { error: "Data de admissão inválida" }, 400);
      }
      if (cargaHoraria !== null && (!Number.isInteger(cargaHoraria) || cargaHoraria < 1 || cargaHoraria > 80)) {
        return jsonResponse(req, { error: "Carga horária inválida" }, 400);
      }
      const allowedDays = new Set(["seg", "ter", "qua", "qui", "sex", "sab", "dom"]);
      if (
        diasTrabalhados !== null &&
        (!Array.isArray(diasTrabalhados) ||
          diasTrabalhados.length > 7 ||
          new Set(diasTrabalhados).size !== diasTrabalhados.length ||
          diasTrabalhados.some((day) => typeof day !== "string" || !allowedDays.has(day)))
      ) {
        return jsonResponse(req, { error: "Dias trabalhados inválidos" }, 400);
      }

      const { data: duplicateLogin, error: duplicateLoginError } = await supabase
        .from("funcionarios")
        .select("id")
        .eq("login", login)
        .neq("id", employeeId)
        .limit(1)
        .maybeSingle();
      if (duplicateLoginError) throw duplicateLoginError;
      if (duplicateLogin) return jsonResponse(req, { error: "Este login já está em uso" }, 409);
      if (email) {
        const { data: duplicateEmail, error: duplicateEmailError } = await supabase
          .from("funcionarios")
          .select("id")
          .eq("email", email)
          .neq("id", employeeId)
          .limit(1)
          .maybeSingle();
        if (duplicateEmailError) throw duplicateEmailError;
        if (duplicateEmail) return jsonResponse(req, { error: "Este email já está em uso" }, 409);
      }

      const targetRole = roleForCargo(cargo);
      let previousRoles: Array<{ role: "admin" | "producao" | "operador" }> = [];
      let previousAuthEmail: string | null = null;
      let previousMetadata: Record<string, unknown> = {};
      if (existing.user_id) {
        const { data: roles, error: rolesError } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", existing.user_id);
        if (rolesError) throw rolesError;
        previousRoles = (roles ?? []) as Array<{ role: "admin" | "producao" | "operador" }>;

        if (previousRoles.some(({ role }) => role === "admin") && targetRole !== "admin") {
          if (existing.user_id === authorization.user.id) {
            return jsonResponse(req, { error: "Você não pode remover seu próprio acesso administrativo" }, 409);
          }
          if (await countActiveAdmins(supabase) <= 1) {
            return jsonResponse(req, { error: "O sistema deve manter ao menos um administrador" }, 409);
          }
        }

        if (!email) {
          return jsonResponse(req, { error: "Um funcionário com acesso não pode ficar sem email" }, 400);
        }
        const { data: authUser, error: authLookupError } = await supabase.auth.admin.getUserById(existing.user_id);
        if (authLookupError || !authUser.user) {
          return jsonResponse(req, { error: "Conta de autenticação não encontrada" }, 409);
        }
        previousAuthEmail = authUser.user.email ?? null;
        previousMetadata = authUser.user.user_metadata ?? {};
      }

      const employeePayload = {
        ...profilePatch.value,
        nome,
        cargo,
        departamento,
        telefone,
        cpf,
        email,
        login,
        avatar_url: avatarUrl,
        data_admissao: dataAdmissao,
        carga_horaria: cargaHoraria,
        dias_trabalhados: diasTrabalhados as string[] | null,
      };
      const existingRecord = existing as Record<string, unknown>;
      const previousPayload = Object.fromEntries(
        Object.keys(employeePayload).map((field) => [field, existingRecord[field]]),
      );
      const rollbackEmployeeAndAccess = async () => {
        const rollbackErrors: unknown[] = [];
        const { error: employeeRollbackError } = await supabase
          .from("funcionarios")
          .update(previousPayload)
          .eq("id", employeeId);
        if (employeeRollbackError) rollbackErrors.push(employeeRollbackError);

        if (existing.user_id) {
          const { error: clearRoleError } = await supabase
            .from("user_roles")
            .delete()
            .eq("user_id", existing.user_id);
          if (clearRoleError) rollbackErrors.push(clearRoleError);
          if (!clearRoleError && previousRoles.length > 0) {
            const { error: restoreRoleError } = await supabase.from("user_roles").insert(
              previousRoles.map(({ role }) => ({ user_id: existing.user_id, role })),
            );
            if (restoreRoleError) rollbackErrors.push(restoreRoleError);
          }

          const { error: restoreAuthError } = await supabase.auth.admin.updateUserById(existing.user_id, {
            ...(previousAuthEmail ? { email: previousAuthEmail, email_confirm: true } : {}),
            user_metadata: previousMetadata,
          });
          if (restoreAuthError) rollbackErrors.push(restoreAuthError);
        }

        if (rollbackErrors.length > 0) {
          console.error("A compensação do funcionário ficou incompleta", {
            employeeId,
            failures: rollbackErrors.length,
          });
        }
      };

      const { data: employee, error: updateError } = await supabase
        .from("funcionarios")
        .update(employeePayload)
        .eq("id", employeeId)
        .select()
        .single();
      if (updateError) throw updateError;

      if (existing.user_id) {
        const { error: clearRolesError } = await supabase.from("user_roles").delete().eq("user_id", existing.user_id);
        const { error: insertRoleError } = clearRolesError
          ? { error: clearRolesError }
          : await supabase.from("user_roles").insert({ user_id: existing.user_id, role: targetRole });
        const { error: authUpdateError } = clearRolesError || insertRoleError
          ? { error: clearRolesError ?? insertRoleError }
          : await supabase.auth.admin.updateUserById(existing.user_id, {
            email: email ?? undefined,
            email_confirm: true,
            user_metadata: { ...previousMetadata, nome, cargo },
          });

        if (clearRolesError || insertRoleError || authUpdateError) {
          await rollbackEmployeeAndAccess();
          console.error("Falha ao sincronizar funcionário, role e Auth", { employeeId });
          return jsonResponse(req, { error: "Não foi possível sincronizar o acesso do funcionário" }, 500);
        }
      }

      const { data: linkedDrivers, error: driverLookupError } = await supabase
        .from("motoristas")
        .select("id")
        .eq("funcionario_id", employeeId);
      if (driverLookupError) {
        await rollbackEmployeeAndAccess();
        return jsonResponse(req, { error: "Não foi possível validar o cadastro de motorista" }, 500);
      }

      const isDriver = cargo.toUpperCase() === "MOTORISTA";
      const driverPayload = {
        nome,
        telefone,
        email,
        cnh: typeof employee.cnh_numero === "string" ? employee.cnh_numero : null,
        cnh_validade: typeof employee.cnh_validade === "string" ? employee.cnh_validade : null,
        ativo: isDriver,
      };
      const { error: driverSyncError } = isDriver && (linkedDrivers?.length ?? 0) === 0
        ? await supabase.from("motoristas").insert({
          ...driverPayload,
          funcionario_id: employeeId,
        })
        : (linkedDrivers?.length ?? 0) > 0
        ? await supabase.from("motoristas").update(driverPayload).eq("funcionario_id", employeeId)
        : { error: null };
      if (driverSyncError) {
        await rollbackEmployeeAndAccess();
        console.error("Falha ao sincronizar funcionário e motorista", {
          employeeId,
          code: driverSyncError.code,
        });
        return jsonResponse(req, { error: "Não foi possível sincronizar o cadastro de motorista" }, 500);
      }

      return jsonResponse(req, { employee });
    }

    if (action === "set-active") {
      const employeeId = typeof body.employeeId === "string" ? body.employeeId : "";
      const active = body.active;
      if (!UUID_PATTERN.test(employeeId) || typeof active !== "boolean") {
        return jsonResponse(req, { error: "Funcionário ou status inválido" }, 400);
      }
      const { data: employee, error: lookupError } = await supabase
        .from("funcionarios")
        .select("id, user_id, ativo, cargo")
        .eq("id", employeeId)
        .maybeSingle();
      if (lookupError) throw lookupError;
      if (!employee) return jsonResponse(req, { error: "Funcionário não encontrado" }, 404);
      if (!active && employee.user_id === authorization.user.id) {
        return jsonResponse(req, { error: "Você não pode desativar seu próprio acesso" }, 409);
      }

      let previousRoles: Array<{ role: "admin" | "producao" | "operador" }> = [];
      if (employee.user_id) {
        const { data: roles, error: roleLookupError } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", employee.user_id);
        if (roleLookupError) throw roleLookupError;
        previousRoles = (roles ?? []) as Array<{ role: "admin" | "producao" | "operador" }>;
      }

      if (!active && employee.user_id) {
        if (previousRoles.some(({ role }) => role === "admin")) {
          if (await countActiveAdmins(supabase) <= 1) {
            return jsonResponse(req, { error: "O sistema deve manter ao menos um administrador ativo" }, 409);
          }
        }
      }

      const restoreAccessState = async () => {
        if (!employee.user_id) return;
        await supabase.from("user_roles").delete().eq("user_id", employee.user_id);
        if (previousRoles.length > 0) {
          await supabase.from("user_roles").insert(
            previousRoles.map(({ role }) => ({ user_id: employee.user_id, role })),
          );
        }
        await supabase.auth.admin.updateUserById(employee.user_id, {
          ban_duration: employee.ativo ? "none" : "876000h",
        });
      };

      if (employee.user_id) {
        const { error: authError } = await supabase.auth.admin.updateUserById(employee.user_id, {
          ban_duration: active ? "none" : "876000h",
        });
        if (authError) return jsonResponse(req, { error: "Não foi possível alterar o acesso" }, 409);

        const { error: clearRoleError } = await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", employee.user_id);
        const { error: insertRoleError } = active && !clearRoleError
          ? await supabase.from("user_roles").insert({
            user_id: employee.user_id,
            role: roleForCargo(employee.cargo),
          })
          : { error: clearRoleError };
        if (clearRoleError || insertRoleError) {
          await restoreAccessState();
          return jsonResponse(req, { error: "Não foi possível sincronizar as permissões" }, 500);
        }
      }
      const { data: updated, error: updateError } = await supabase
        .from("funcionarios")
        .update({ ativo: active })
        .eq("id", employeeId)
        .select()
        .single();
      if (updateError) {
        await restoreAccessState();
        throw updateError;
      }

      const { error: driverStatusError } = await supabase
        .from("motoristas")
        .update({ ativo: active && employee.cargo.toUpperCase() === "MOTORISTA" })
        .eq("funcionario_id", employeeId);
      if (driverStatusError) {
        await supabase.from("funcionarios").update({ ativo: employee.ativo }).eq("id", employeeId);
        await restoreAccessState();
        console.error("Falha ao sincronizar status do funcionário e motorista", {
          employeeId,
          code: driverStatusError.code,
        });
        return jsonResponse(req, { error: "Não foi possível sincronizar o status do motorista" }, 500);
      }
      return jsonResponse(req, { employee: updated });
    }

    if (action === "delete") {
      const employeeId = typeof body.employeeId === "string" ? body.employeeId : "";
      if (!UUID_PATTERN.test(employeeId)) return jsonResponse(req, { error: "Funcionário inválido" }, 400);
      const { data: employee, error: lookupError } = await supabase
        .from("funcionarios")
        .select("id, user_id, avatar_url")
        .eq("id", employeeId)
        .maybeSingle();
      if (lookupError) throw lookupError;
      if (!employee) return jsonResponse(req, { error: "Funcionário não encontrado" }, 404);
      if (employee.user_id === authorization.user.id) {
        return jsonResponse(req, { error: "Você não pode excluir seu próprio usuário" }, 409);
      }

      if (employee.user_id) {
        const { data: adminRole, error: roleError } = await supabase
          .from("user_roles")
          .select("id")
          .eq("user_id", employee.user_id)
          .eq("role", "admin")
          .maybeSingle();
        if (roleError) throw roleError;
        if (adminRole) {
          if (await countActiveAdmins(supabase) <= 1) {
            return jsonResponse(req, { error: "O sistema deve manter ao menos um administrador" }, 409);
          }
        }
      }

      const { data: linkedDrivers, error: driverLookupError } = await supabase
        .from("motoristas")
        .select("id, ativo")
        .eq("funcionario_id", employeeId);
      if (driverLookupError) throw driverLookupError;
      if ((linkedDrivers?.length ?? 0) > 0) {
        const { error: driverDisableError } = await supabase
          .from("motoristas")
          .update({ ativo: false })
          .eq("funcionario_id", employeeId);
        if (driverDisableError) {
          return jsonResponse(req, { error: "Não foi possível desativar o cadastro de motorista" }, 409);
        }
      }

      if (employee.user_id) {
        const { error: authDeleteError } = await supabase.auth.admin.deleteUser(employee.user_id);
        if (authDeleteError) {
          for (const driver of linkedDrivers ?? []) {
            await supabase.from("motoristas").update({ ativo: driver.ativo }).eq("id", driver.id);
          }
          return jsonResponse(req, { error: "Não foi possível remover a conta de autenticação" }, 409);
        }
      }

      const { error: deleteError } = await supabase.from("funcionarios").delete().eq("id", employeeId);
      if (deleteError) {
        console.error("Conta Auth removida, mas cadastro do funcionário permaneceu", { employeeId });
        return jsonResponse(req, { error: "O acesso foi removido, mas o cadastro requer limpeza administrativa" }, 500);
      }

      const avatarPath = avatarObjectPath(employee.avatar_url, supabaseUrl);
      if (avatarPath) {
        const { error: avatarDeleteError } = await supabase.storage.from("avatars").remove([avatarPath]);
        if (avatarDeleteError) {
          console.warn("Funcionário removido, mas o avatar exige limpeza posterior", { employeeId });
        }
      }
      return jsonResponse(req, { success: true });
    }

    if (action === "update-password") {
      const userId = typeof body.userId === "string" ? body.userId : "";
      const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";
      if (!UUID_PATTERN.test(userId) || newPassword.length < 12 || newPassword.length > 128) {
        return jsonResponse(req, { error: "Usuário inválido ou senha fora do limite permitido" }, 400);
      }

      const { data: employee, error: employeeLookupError } = await supabase
        .from("funcionarios")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();
      if (employeeLookupError) throw employeeLookupError;
      if (!employee) {
        return jsonResponse(req, { error: "Funcionário não encontrado" }, 404);
      }

      const { error } = await supabase.auth.admin.updateUserById(userId, { password: newPassword });
      if (error) {
        console.error("Falha ao atualizar senha", { code: error.code, targetUserId: userId });
        return jsonResponse(req, { error: "Não foi possível atualizar a senha" }, 422);
      }
      return jsonResponse(req, { success: true });
    }

    if (action === "update-email") {
      const userId = typeof body.userId === "string" ? body.userId : "";
      const newEmail = optionalText(body.newEmail, 254)?.toLowerCase() ?? "";
      if (!UUID_PATTERN.test(userId) || !EMAIL_PATTERN.test(newEmail)) {
        return jsonResponse(req, { error: "Usuário ou email inválido" }, 400);
      }

      const { data: employee, error: employeeLookupError } = await supabase
        .from("funcionarios")
        .select("id, email")
        .eq("user_id", userId)
        .maybeSingle();
      if (employeeLookupError) throw employeeLookupError;
      if (!employee) {
        return jsonResponse(req, { error: "Funcionário não encontrado" }, 404);
      }

      const { data: duplicateEmail, error: duplicateError } = await supabase
        .from("funcionarios")
        .select("id")
        .eq("email", newEmail)
        .neq("id", employee.id)
        .limit(1)
        .maybeSingle();
      if (duplicateError) throw duplicateError;
      if (duplicateEmail) {
        return jsonResponse(req, { error: "Este email já está em uso" }, 409);
      }

      const { data: currentAuthUser, error: currentUserError } = await supabase.auth.admin
        .getUserById(userId);
      if (currentUserError || !currentAuthUser.user) {
        return jsonResponse(req, { error: "Acesso do funcionário não encontrado" }, 404);
      }
      const previousEmail = currentAuthUser.user.email ?? employee.email;

      const { error } = await supabase.auth.admin.updateUserById(userId, {
        email: newEmail,
        email_confirm: true,
      });
      if (error) {
        console.error("Falha ao atualizar email", { code: error.code, targetUserId: userId });
        return jsonResponse(req, { error: "Não foi possível atualizar o email" }, 422);
      }

      const { error: employeeUpdateError } = await supabase
        .from("funcionarios")
        .update({ email: newEmail })
        .eq("id", employee.id);
      if (employeeUpdateError) {
        if (previousEmail) {
          const { error: rollbackError } = await supabase.auth.admin.updateUserById(userId, {
            email: previousEmail,
            email_confirm: true,
          });
          if (rollbackError) {
            console.error("Falha ao restaurar email de autenticação", { targetUserId: userId });
          }
        }
        return jsonResponse(req, { error: "Não foi possível sincronizar o email do funcionário" }, 500);
      }
      return jsonResponse(req, { success: true });
    }

    return jsonResponse(req, { error: "Ação inválida" }, 400);
  } catch (error: unknown) {
    console.error("Erro interno em manage-employee", error instanceof Error ? error.message : "unknown");
    return jsonResponse(req, { error: "Erro interno ao gerenciar funcionário" }, 500);
  }
});
