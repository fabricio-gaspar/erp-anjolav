// Contrato local entre catálogo, tipos gerados e Edge Function. Não consulta o banco.
import console from "node:console";
import { readdirSync } from "node:fs";

import { assert, projectPath, propertyStringsInArray, readProjectFile, stringArrayConstant } from "./local-checks.mjs";

const edge = readProjectFile("supabase", "functions", "data-administration", "index.ts");
const hook = readProjectFile("src", "hooks", "useDataManagement.ts");
const types = readProjectFile("src", "integrations", "supabase", "types.ts");
const client = readProjectFile("src", "integrations", "supabase", "client.ts");
const tables = stringArrayConstant(edge, "TABLES");
const entities = propertyStringsInArray(hook, "entityDefinitions", "table");

assert(tables.length > 0 && new Set(tables).size === tables.length, "Catálogo da Edge vazio ou duplicado");
assert(new Set(entities).size === entities.length, "Catálogo da interface tem tabelas duplicadas");
assert(tables.length === entities.length && [...tables].sort().every((table, index) => table === [...entities].sort()[index]),
  "Catálogos de exportação da Edge e da interface divergem");

const missingTenantType = [];
for (const table of tables) {
  const match = types.match(new RegExp(`^      ${table}: \\{\\r?\\n([\\s\\S]*?)^        Insert:`, "m"));
  assert(match, `${table} ausente dos tipos gerados`);
  assert(/^ {10}id: /m.test(match[1]), `${table} precisa de id para paginação`);
  if (!/^ {10}tenant_id: /m.test(match[1])) missingTenantType.push(table);
}

assert(edge.includes("requireAdmin(req, supabase)"), "Administração de dados perdeu a autorização administrativa");
assert(edge.includes('.eq("tenant_id", authorization.tenantId)'), "Administração de dados perdeu o filtro por empresa");
assert(edge.includes('operation === "export-manifest"') && hook.includes('operation: "export-manifest"'),
  "Contrato do manifesto de exportação não está conectado");
assert(edge.includes('select("*", { count: "exact" })') && hook.includes("page.count !== expectedCount"),
  "Exportação deve detectar páginas truncadas ou contagens divergentes");
assert(client.includes("VITE_SUPABASE_URL") && client.includes("VITE_SUPABASE_PUBLISHABLE_KEY"),
  "Cliente deve usar URL e chave publicável do Vite");
assert(!client.includes("SERVICE_ROLE_KEY"), "Chave de serviço não pode entrar no cliente");

const migrations = readdirSync(projectPath("supabase", "migrations")).filter((name) => name.endsWith(".sql"));
assert(migrations.length > 0, "Nenhuma migração local encontrada");
console.log(`Banco local: ${tables.length} tabelas de exportação alinhadas com tipos e Edge; ${migrations.length} migrações presentes (sem credenciais).`);
if (missingTenantType.length) {
  console.warn(`Tipos gerados sem tenant_id em ${missingTenantType.length} tabelas inventariadas; confira o schema real antes de exportar.`);
}
