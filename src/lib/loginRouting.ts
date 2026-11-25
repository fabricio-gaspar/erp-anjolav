export type LoginArea = "central" | "pdv" | null;
export type PdvSector = "domestico" | "industrial";

interface IntendedLocation {
  pathname?: unknown;
  search?: unknown;
  hash?: unknown;
}

interface LoginNavigationState {
  from?: IntendedLocation;
}

export function getLoginArea(pathname: string): LoginArea {
  if (pathname === "/login/central") return "central";
  if (pathname === "/login/pdv") return "pdv";
  return null;
}

export function getAfterLoginPath(area: LoginArea, state?: unknown, loginSearch = ""): string {
  const intended = (state as LoginNavigationState | null)?.from;
  if (area === "pdv") {
    const sectorFromIntendedPath = typeof intended?.pathname === "string"
      ? getPdvSectorFromPath(intended.pathname)
      : null;
    const sectorFromLoginLink = normalizePdvSector(new URLSearchParams(loginSearch).get("area"));
    const sector = sectorFromIntendedPath ?? sectorFromLoginLink;
    if (sector) return `/pdv/painel/${sector}`;
    return "/pdv/painel";
  }

  if (typeof intended?.pathname === "string" && isDestinationForArea(area, intended.pathname)) {
    const search = typeof intended.search === "string" ? intended.search : "";
    const hash = typeof intended.hash === "string" ? intended.hash : "";
    return `${intended.pathname}${search}${hash}`;
  }

  if (area === "central") return "/admin/visao-geral";
  return "/";
}

export function getLoginPdvSector(pathname: string, search = "", state?: unknown): PdvSector | null {
  if (getLoginArea(pathname) !== "pdv") return null;

  const intendedPath = (state as LoginNavigationState | null)?.from?.pathname;
  const sectorFromPath = typeof intendedPath === "string" ? getPdvSectorFromPath(intendedPath) : null;
  if (sectorFromPath) return sectorFromPath;

  return normalizePdvSector(new URLSearchParams(search).get("area"));
}

function isDestinationForArea(area: LoginArea, pathname: string): boolean {
  if (!pathname.startsWith("/") || pathname.startsWith("//")) return false;
  if (area === "central") return pathname === "/admin" || pathname.startsWith("/admin/") || pathname === "/central" || pathname.startsWith("/central/");
  if (area === "pdv") {
    return pathname === "/pdv" || pathname.startsWith("/pdv/")
      || pathname === "/industrial" || pathname.startsWith("/industrial/")
      || pathname === "/residencial" || pathname.startsWith("/residencial/");
  }
  return false;
}

function getPdvSectorFromPath(pathname: string): PdvSector | null {
  if (pathname === "/pdv/painel/industrial" || pathname === "/pdv/industrial" || pathname.startsWith("/pdv/industrial/") || pathname === "/industrial" || pathname.startsWith("/industrial/")) return "industrial";
  if (pathname === "/pdv/painel/domestico" || pathname === "/pdv/domestico" || pathname.startsWith("/pdv/domestico/") || pathname === "/pdv/residencial" || pathname === "/residencial" || pathname.startsWith("/residencial/")) return "domestico";
  return null;
}

function normalizePdvSector(value: string | null): PdvSector | null {
  if (value === "industrial") return "industrial";
  if (value === "domestico" || value === "residencial") return "domestico";
  return null;
}

export function getLoginPath(pathname: string, requiredArea?: "central" | "industrial" | "residencial"): string {
  if (requiredArea === "central" || pathname.startsWith("/admin") || pathname.startsWith("/central")) return "/login/central";
  if (requiredArea === "industrial" || requiredArea === "residencial" || pathname.startsWith("/pdv")) return "/login/pdv";
  return "/login";
}
