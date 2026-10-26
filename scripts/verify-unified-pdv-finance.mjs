// Isolated, in-memory PostgreSQL verification. No Supabase connection is used.
// Usage: node scripts/verify-unified-pdv-finance.mjs <absolute-path-to-pglite/dist/index.js>
// Runtime used: @electric-sql/pglite@0.5.12, installed outside the application.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

if (!process.argv[2]) throw new Error("Supply the local PGlite module path; this script never installs dependencies.");
const { PGlite } = await import(pathToFileURL(process.argv[2]).href);
const db = new PGlite();
const tenant = "10000000-0000-4000-8000-000000000001";
const other = "10000000-0000-4000-8000-000000000002";
const uid = (n) => `20000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const migration = readFileSync(new URL("../supabase/migrations/20261026203637_unified_pdv_financial_revenue.sql", import.meta.url), "utf8");
let checks = 0;
const check = async (name, run) => { await run(); checks++; console.log(`PASS ${name}`); };

try {
  await db.exec(`
    CREATE ROLE authenticated; CREATE ROLE anon; CREATE ROLE service_role;
    CREATE SCHEMA auth; CREATE SCHEMA private;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.actor',true),'')::uuid $$;
    CREATE FUNCTION private.current_tenant_id() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.tenant',true),'')::uuid $$;
    CREATE FUNCTION private.has_any_module_access(text[]) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT current_setting('app.module',true)='yes' $$;
    CREATE FUNCTION private.can_access_area(text) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT current_setting('app.admin',true)='yes' OR current_setting('app.area',true) IN ('central',$1) $$;
    CREATE TABLE clientes(id uuid PRIMARY KEY,tenant_id uuid,razao_social text,nome_fantasia text,classificacao text);
    CREATE FUNCTION private.can_access_client(uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
      SELECT EXISTS(SELECT 1 FROM public.clientes c WHERE c.id=$1 AND c.tenant_id=private.current_tenant_id() AND private.can_access_area(c.classificacao)) $$;
    CREATE TABLE faturas(id uuid PRIMARY KEY, tenant_id uuid,cliente_id uuid,status text,valor_total numeric,data_vencimento date,periodo_fim date,numero_nf text,data_emissao_nf timestamptz,updated_at timestamptz DEFAULT now(),created_at timestamptz DEFAULT now(),categoria_id uuid,centro_custo_id uuid,asaas_charge_id uuid);
    CREATE TABLE contas_pagar(id uuid PRIMARY KEY, tenant_id uuid,status text,descricao text,fornecedor text,fornecedor_id uuid,valor numeric,valor_pago numeric,vencimento date,data_pagamento date,categoria_id uuid,centro_custo_id uuid);
    CREATE TABLE centros_custo(id uuid PRIMARY KEY,tenant_id uuid,nome text);
    CREATE TABLE categorias_financeiras(id uuid PRIMARY KEY,tenant_id uuid,nome text,tipo text);
    CREATE TABLE ordens_servico(id uuid PRIMARY KEY,tenant_id uuid,cliente_id uuid,origem text);
    CREATE TABLE caixa_movimentacoes(id uuid PRIMARY KEY,tenant_id uuid,tipo text,valor numeric,created_at timestamptz DEFAULT now(),cliente_id uuid,ordem_servico_id uuid,descricao text,categoria_id uuid,centro_custo_id uuid,pdv_pagamento_id uuid);
    CREATE TABLE pdv_pagamentos(id uuid PRIMARY KEY,tenant_id uuid,asaas_charge_id uuid);
    CREATE TABLE asaas_charges(id uuid PRIMARY KEY,tenant_id uuid,cliente_id uuid,customer_name text,description text,value numeric,status text,due_date date,paid_at timestamptz,categoria_id uuid,centro_custo_id uuid,created_at timestamptz DEFAULT now());
    CREATE TABLE contratos_aluguel(id uuid PRIMARY KEY,tenant_id uuid,cliente_id uuid,descricao text,valor_servico numeric,created_at timestamptz DEFAULT now(),ativo boolean);
    GRANT USAGE ON SCHEMA public,private,auth TO authenticated,anon;
    GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
    SET app.actor='${uid(999)}'; SET app.tenant='${tenant}'; SET app.area='central'; SET app.admin='yes'; SET app.module='yes';
  `);
  for (const table of ["clientes", "faturas", "contas_pagar", "centros_custo", "categorias_financeiras", "ordens_servico", "caixa_movimentacoes", "pdv_pagamentos", "asaas_charges", "contratos_aluguel"]) {
    let restriction = "true";
    if (table === "clientes") restriction = "private.can_access_area(classificacao)";
    if (table === "faturas" || table === "contratos_aluguel") restriction = "private.can_access_client(cliente_id)";
    if (table === "ordens_servico") restriction = "private.can_access_area(CASE WHEN origem IN ('residencial','loja') THEN 'residencial' ELSE 'industrial' END)";
    if (table === "pdv_pagamentos" || table === "asaas_charges") restriction = "current_setting('app.admin',true)='yes'";
    await db.exec(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY; CREATE POLICY scope ON ${table} FOR SELECT TO authenticated USING (tenant_id=private.current_tenant_id() AND ${restriction});`);
  }
  // Execute only inside this disposable memory database, never on production.
  await db.exec(migration);
  await db.exec(`
    INSERT INTO clientes VALUES ('${uid(1)}','${tenant}','Industrial','I','industrial'),('${uid(2)}','${tenant}','Residencial','R','residencial'),('${uid(3)}','${other}','Other','O','industrial');
    INSERT INTO ordens_servico VALUES ('${uid(11)}','${tenant}','${uid(1)}','industrial'),('${uid(12)}','${tenant}','${uid(2)}','loja'),('${uid(13)}','${other}','${uid(3)}','industrial');
    INSERT INTO faturas(id,tenant_id,cliente_id,status,valor_total,data_vencimento) VALUES
      ('${uid(21)}','${tenant}','${uid(1)}','pago',100,current_date),('${uid(22)}','${tenant}','${uid(2)}','pago',200,current_date),
      ('${uid(23)}','${tenant}','${uid(2)}','pendente',30,current_date-1),('${uid(24)}','${other}','${uid(3)}','pago',9000,current_date);
    INSERT INTO caixa_movimentacoes(id,tenant_id,ordem_servico_id,cliente_id,tipo,valor) VALUES
      ('${uid(31)}','${tenant}','${uid(11)}','${uid(1)}','VENDA',40),('${uid(32)}','${tenant}','${uid(12)}','${uid(2)}','VENDA',60),
      ('${uid(33)}','${tenant}','${uid(11)}','${uid(1)}','ESTORNO',10),('${uid(34)}','${other}','${uid(13)}','${uid(3)}','VENDA',9000);
    SET ROLE authenticated;
  `);
  const dashboard = async (sector) => (await db.query("SELECT public.consultar_dashboard_financeiro(current_date-1,current_date+1,$1) data", [sector])).rows[0].data;
  const scalar = async (sql) => Object.values((await db.query(sql)).rows[0])[0];
  await check("industrial direct receipts and invoices include signed refunds", async () => {
    const result = await dashboard("industrial");
    assert.equal(result.receitas_totais, 130);
    assert.equal(result.receitas_loja, 30);
    assert.equal(result.receitas_count, 2);
  });
  await check("residential invoices and overdue alerts remain visible", async () => {
    const result = await dashboard("loja");
    assert.equal(result.receitas_totais, 260);
    assert.equal(result.a_receber_vencido, 30);
  });
  await check("all-sector totals exclude other tenants", async () => {
    assert.equal((await dashboard("todos")).receitas_totais, 390);
    assert.equal(Number(await scalar("SELECT sum(valor_recebido) FROM v_contas_receber")), 390);
    assert.equal(Number(await scalar("SELECT sum(valor) FROM v_fluxo_caixa WHERE tipo='receita'")), 390);
  });
  await check("view columns and origins remain compatible", async () => {
    const row = (await db.query("SELECT * FROM v_contas_receber WHERE id=$1", [uid(31)])).rows[0];
    assert.deepEqual(Object.keys(row), ["id","origem","cliente_id","cliente_nome","descricao","valor","valor_recebido","data_vencimento","data_recebimento","status","categoria_id","centro_custo_id","created_at"]);
    assert.equal(row.origem, "pdv_industrial");
    assert.equal(await scalar(`SELECT origem FROM v_contas_receber WHERE id='${uid(32)}'`), "pdv_loja");
  });
  await db.exec(`RESET ROLE;
    INSERT INTO asaas_charges(id,tenant_id,cliente_id,status,value,due_date,paid_at) VALUES
      ('${uid(41)}','${tenant}','${uid(2)}','RECEIVED',200,current_date,now()),
      ('${uid(42)}','${tenant}','${uid(1)}','RECEIVED',40,current_date,now()),
      ('${uid(43)}','${tenant}','${uid(2)}','PENDING',15,current_date,null),
      ('${uid(44)}','${tenant}','${uid(2)}','CONFIRMED',25,current_date,null),
      ('${uid(45)}','${tenant}','${uid(2)}','RECEIVED',35,current_date,now());
    UPDATE faturas SET asaas_charge_id='${uid(41)}' WHERE id='${uid(22)}';
    INSERT INTO pdv_pagamentos VALUES ('${uid(51)}','${tenant}','${uid(42)}'),('${uid(52)}','${tenant}','${uid(43)}');
    UPDATE caixa_movimentacoes SET pdv_pagamento_id='${uid(51)}' WHERE id='${uid(31)}';
    SET ROLE authenticated;
  `);
  await check("Asaas invoices and PDV receipts do not duplicate canonical entries", async () => {
    assert.equal(Number(await scalar(`SELECT count(*) FROM v_contas_receber WHERE id IN ('${uid(41)}','${uid(42)}')`)), 0);
    assert.equal(Number(await scalar("SELECT sum(valor_recebido) FROM v_contas_receber")), 425);
  });
  await check("pending PIX remains visible; CONFIRMED is not settled cash", async () => {
    assert.equal(Number(await scalar(`SELECT count(*) FROM v_contas_receber WHERE id IN ('${uid(43)}','${uid(44)}') AND valor_recebido=0`)), 2);
    assert.equal(Number(await scalar("SELECT sum(valor) FROM v_fluxo_caixa WHERE tipo='receita'")), 425);
  });
  await check("refunds reduce cash flow without erasing the original receipt", async () => {
    assert.equal(Number(await scalar(`SELECT valor FROM v_fluxo_caixa WHERE id='R-${uid(33)}'`)), -10);
    assert.equal(await scalar(`SELECT status FROM v_contas_receber WHERE id='${uid(33)}'`), "estornado");
  });
  await db.exec("SET app.admin='no'; SET app.area='residencial';");
  await check("restricted role cannot read industrial movements through RLS fallback", async () => {
    assert.equal(Number(await scalar(`SELECT count(*) FROM v_contas_receber WHERE id IN ('${uid(31)}','${uid(33)}')`)), 0);
    assert.equal(Number(await scalar("SELECT sum(valor_recebido) FROM v_contas_receber")), 260);
    await assert.rejects(dashboard("industrial"), /Acesso negado/);
    await assert.rejects(dashboard("todos"), /Acesso negado/);
    assert.equal((await dashboard("loja")).receitas_totais, 260);
  });
  await check("module, identity and interval checks remain enforced", async () => {
    await db.exec("SET app.module='no'");
    await assert.rejects(dashboard("loja"), /módulo financeiro negado/);
    await db.exec("SET app.module='yes'; SET app.actor='';");
    await assert.rejects(dashboard("loja"), /Autenticação/);
    await db.exec(`SET app.actor='${uid(999)}';`);
    await assert.rejects(db.query("SELECT public.consultar_dashboard_financeiro(current_date,current_date+367,'loja')"), /366 dias/);
  });
  await check("security_invoker remains active and anonymous reads remain revoked", async () => {
    const options = (await db.query("SELECT reloptions FROM pg_class WHERE relname IN ('v_contas_receber','v_fluxo_caixa')")).rows;
    assert.ok(options.every((row) => row.reloptions.includes("security_invoker=true")));
    await db.exec("RESET ROLE; SET ROLE anon;");
    await assert.rejects(db.query("SELECT * FROM v_contas_receber"), /permission denied/);
    await assert.rejects(db.query("SELECT public.consultar_dashboard_financeiro(current_date,current_date,'todos')"), /permission denied/);
  });
  console.log(`${checks} SQL integration checks passed in disposable memory PostgreSQL.`);
} catch (error) {
  console.error("SQL verification failed:", error.message, error.code ?? "", error.position ?? "");
  process.exitCode = 1;
} finally {
  await db.close();
}
