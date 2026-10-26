import assert from "node:assert/strict";
import test from "node:test";

import {
  APP_ROUTES,
  LEGACY_ROUTE_REDIRECTS,
  getAppRoute,
  getSearchResultRoute,
  getSidebarNavigationGroups,
} from "../src/lib/appRoutes.ts";
import {
  getRoutePermissionRequirement,
  isRouteAccessible,
  resolveDefaultAccessibleRoute,
  resolveFirstAccessibleRouteInArea,
  resolveLegacyRouteRedirect,
  type RouteAccessContext,
} from "../src/lib/authorization.ts";

test("redireciona a raiz para uma rota industrial autorizada quando o painel é negado", () => {
  const access: RouteAccessContext = {
    accessibleAreas: { central: false, industrial: true, residencial: false },
    modulePermissions: { clientes: true },
    isAdmin: false,
  };
  const destination = resolveDefaultAccessibleRoute(access);
  assert.equal(destination?.path, "/industrial/clientes");
  assert.equal(isRouteAccessible(destination, access), true);
});

test("redirecionamentos legados priorizam alternativa autorizada na mesma área", () => {
  const access: RouteAccessContext = {
    accessibleAreas: { central: false, industrial: true, residencial: false },
    modulePermissions: { clientes: true },
    isAdmin: false,
  };
  const ordensRedirect = LEGACY_ROUTE_REDIRECTS.find((redirect) => redirect.from === "/ordens");

  assert.ok(ordensRedirect);
  if (!ordensRedirect) return;

  const destination = resolveLegacyRouteRedirect(ordensRedirect, access);
  assert.equal(destination, "/industrial/clientes");
  assert.equal(isRouteAccessible(getAppRoute(destination ?? ""), access), true);
});

test("todo redirecionamento legado termina em uma rota autorizada", () => {
  const access: RouteAccessContext = {
    accessibleAreas: { central: false, industrial: false, residencial: true },
    modulePermissions: { clientes: true },
    isAdmin: false,
  };
  for (const redirect of LEGACY_ROUTE_REDIRECTS) {
    const destination = resolveLegacyRouteRedirect(redirect, access);
    if (redirect.from === "/caixa" || redirect.from === "/pdv") {
      assert.equal(destination, null, `${redirect.from} exige um PDV autorizado`);
      continue;
    }
    assert.ok(destination, `${redirect.from} deve ter fallback residencial autorizado`);
    assert.equal(
      isRouteAccessible(getAppRoute(destination ?? ""), access),
      true,
      `${redirect.from} não pode apontar para uma rota negada`,
    );
  }
});

test("aliases de PDV escolhem apenas um PDV autorizado, sem fallback de dashboard", () => {
  for (const alias of ["/pdv", "/caixa"]) {
    const redirect = LEGACY_ROUTE_REDIRECTS.find(item => item.from === alias);
    assert.ok(redirect);
    for (const area of ["industrial", "residencial"] as const) {
      for (const moduleKey of ["caixa", "faturamento"]) {
        assert.equal(resolveLegacyRouteRedirect(redirect, {
          accessibleAreas: { central: true, [area]: true },
          modulePermissions: { dashboard: true, [moduleKey]: true },
          isAdmin: false,
        }), `/${area}/caixa`);
      }
    }
    assert.equal(resolveLegacyRouteRedirect(redirect, {
      accessibleAreas: { central: true, industrial: true, residencial: true },
      modulePermissions: { dashboard: true },
      isAdmin: false,
    }), null);
    assert.equal(resolveLegacyRouteRedirect(redirect, {
      accessibleAreas: { industrial: true, residencial: true },
      modulePermissions: { faturamento: true },
      isAdmin: false,
    }), "/residencial/caixa");
  }
});

test("cada rota do menu lateral pertence ao catálogo centralizado", () => {
  const catalogPaths = new Set(APP_ROUTES.map((route) => route.path));

  for (const area of ["central", "industrial", "residencial"] as const) {
    for (const group of getSidebarNavigationGroups(area)) {
      for (const route of group.routes) {
        assert.equal(catalogPaths.has(route.path), true, `${area}:${route.path}`);
      }
    }
  }
});

test("protege a auditoria por Central, configurações e administração", () => {
  const auditRoute = getAppRoute("/central/auditoria");

  assert.ok(auditRoute);
  assert.equal(auditRoute.area, "central");
  assert.deepEqual(auditRoute.requiredModules, ["configuracoes"]);
  assert.equal(auditRoute.adminOnly, true);
  assert.deepEqual(getRoutePermissionRequirement("/central/auditoria"), ["configuracoes"]);

  assert.equal(
    isRouteAccessible(auditRoute, {
      accessibleAreas: { central: true, industrial: false, residencial: false },
      modulePermissions: { configuracoes: true },
      isAdmin: true,
    }),
    true,
  );
  assert.equal(
    isRouteAccessible(auditRoute, {
      accessibleAreas: { central: false, industrial: true, residencial: true },
      modulePermissions: { configuracoes: true },
      isAdmin: true,
    }),
    false,
  );
  assert.equal(
    isRouteAccessible(auditRoute, {
      accessibleAreas: { central: true, industrial: false, residencial: false },
      modulePermissions: { configuracoes: true },
      isAdmin: false,
    }),
    false,
  );
});

test("a busca central preserva a área residencial dos registros", () => {
  assert.equal(getSearchResultRoute("cliente", "residencial"), "/residencial/clientes");
  assert.equal(getSearchResultRoute("ordem", "loja"), "/residencial/ordens");
});

test("a busca não inventa um destino industrial sem uma área operacional autorizada", () => {
  assert.equal(getSearchResultRoute("cliente", undefined, "central"), null);
});

test("a busca não direciona clientes ou ordens classificados no Central para áreas operacionais", () => {
  assert.equal(getSearchResultRoute("cliente", "central"), null);
  assert.equal(getSearchResultRoute("ordem", "CENTRAL"), null);
});

test("Configurações é exibida na navegação apenas do Central", () => {
  const centralPaths = getSidebarNavigationGroups("central")
    .flatMap((group) => group.routes)
    .map((route) => route.path);
  const industrialPaths = getSidebarNavigationGroups("industrial")
    .flatMap((group) => group.routes)
    .map((route) => route.path);
  const residentialPaths = getSidebarNavigationGroups("residencial")
    .flatMap((group) => group.routes)
    .map((route) => route.path);

  assert.equal(centralPaths.filter((path) => path === "/central/configuracoes").length, 1);
  assert.equal(industrialPaths.includes("/central/configuracoes"), false);
  assert.equal(residentialPaths.includes("/central/configuracoes"), false);
});

test("seletor de painel encontra a primeira rota autorizada mesmo sem Dashboard", () => {
  const access: RouteAccessContext = {
    accessibleAreas: { central: false, industrial: true, residencial: false },
    modulePermissions: { clientes: true },
    isAdmin: false,
  };

  assert.equal(resolveFirstAccessibleRouteInArea("industrial", access)?.path, "/industrial/clientes");
});

test("grupos de navegação usam rótulos semânticos por área", () => {
  const industrialGroups = getSidebarNavigationGroups("industrial");
  const residentialGroups = getSidebarNavigationGroups("residencial");

  assert.equal(industrialGroups.find((group) => group.id === "industrial-customers")?.label, "Cadastros");
  assert.equal(industrialGroups.find((group) => group.id === "industrial-billing")?.label, "Financeiro e relatórios");
  assert.equal(industrialGroups.some((group) => group.id === "industrial-analysis"), false);
  assert.equal(residentialGroups.find((group) => group.id === "residential-billing")?.label, "Financeiro e relatórios");
});
