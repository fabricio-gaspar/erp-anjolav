export function canSeeCompanyReport(
  tenant: {id:string} | null,
  security: {tenantId:string|null;isAdmin:boolean;mfaSatisfied:boolean},
): boolean {
  return Boolean(tenant && security.tenantId === tenant.id && security.isAdmin && security.mfaSatisfied);
}
