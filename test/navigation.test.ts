import assert from "node:assert/strict";
import test from "node:test";

import {
  APP_ROUTES,
  getAppRoute,
  getFirstAuthorizedWorkspace,
  getSearchResultRoute,
  getSidebarNavigationGroups,
} from "../src/lib/appRoutes.ts";
import {
  getRoutePermissionRequirement,
  isRouteAccessible,
} from "../src/lib/authorization.ts";

test("redireciona a raiz para Industrial ou Residencial quando Central não está acessível", () => {
  assert.equal(
    getFirstAuthorizedWorkspace({ central: false, industrial: true, residencial: true }),
    "industrial",
  );
  assert.equal(
    getFirstAuthorizedWorkspace({ central: false, industrial: false, residencial: true }),
    "residencial",
  );
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
