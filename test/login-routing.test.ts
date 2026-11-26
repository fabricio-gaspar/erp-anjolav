import { strict as assert } from "node:assert";
import { test } from "node:test";
import { getAfterLoginPath, getLoginArea, getLoginPath } from "../src/lib/loginRouting.ts";

test("cada entrada identificada leva ao painel correspondente", () => {
  assert.equal(getAfterLoginPath(getLoginArea("/login/central")), "/admin/visao-geral");
  assert.equal(getAfterLoginPath(getLoginArea("/login/pdv")), "/pdv/painel");
  assert.equal(getAfterLoginPath(getLoginArea("/login")), "/");
});

test("login do PDV abre o painel principal do setor solicitado, não o atendimento em andamento", () => {
  assert.equal(
    getAfterLoginPath("pdv", { from: { pathname: "/pdv/domestico/rol", search: "?cliente=123", hash: "#pagamento" } }),
    "/pdv/painel/domestico",
  );
  assert.equal(
    getAfterLoginPath("pdv", { from: { pathname: "/pdv/industrial/delivery" } }),
    "/pdv/painel/industrial",
  );
  assert.equal(getAfterLoginPath("pdv", undefined, "?area=industrial"), "/pdv/painel/industrial");
});

test("login central preserva o destino administrativo solicitado", () => {
  assert.equal(
    getAfterLoginPath("central", { from: { pathname: "/admin/clientes", search: "?q=ana", hash: "#lista" } }),
    "/admin/clientes?q=ana#lista",
  );
});

test("rotas protegidas direcionam ao login do ambiente correspondente", () => {
  assert.equal(getLoginPath("/admin/configuracoes", "central"), "/login/central");
  assert.equal(getLoginPath("/central/financeiro", "central"), "/login/central");
  assert.equal(getLoginPath("/pdv/domestico/rol", "residencial"), "/login/pdv");
  assert.equal(getLoginPath("/industrial/producao", "industrial"), "/login/pdv");
  assert.equal(getLoginPath("/"), "/login");
});
