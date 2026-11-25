import test from "node:test";
import assert from "node:assert/strict";
import { canSeeCompanyReport } from "../src/lib/companyReportAccess.ts";

test("resultado mensal e auditoria exigem administrador da empresa ativa com MFA satisfeito", () => {
  const admin={tenantId:"empresa-a",isAdmin:true,mfaSatisfied:true};
  assert.equal(canSeeCompanyReport({id:"empresa-a"},admin),true);
  assert.equal(canSeeCompanyReport({id:"empresa-b"},admin),false);
  assert.equal(canSeeCompanyReport({id:"empresa-a"},{...admin,isAdmin:false}),false);
  assert.equal(canSeeCompanyReport({id:"empresa-a"},{...admin,mfaSatisfied:false}),false);
  assert.equal(canSeeCompanyReport(null,admin),false);
});
