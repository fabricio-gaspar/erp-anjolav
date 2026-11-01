import type { Factor } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export interface MfaState {
  factors: Factor<"totp">[];
  verifiedFactors: Factor<"totp", "verified">[];
  currentLevel: "aal1" | "aal2" | null;
  nextLevel: "aal1" | "aal2" | null;
}

export interface TotpEnrollment {
  factorId: string;
  uri: string;
  secret: string;
}

export function normalizeTotpCode(value: string): string {
  return value.replace(/\D/g, "").slice(0, 6);
}

export async function loadMfaState(): Promise<MfaState> {
  const [{ data: factorData, error: factorError }, { data: aalData, error: aalError }] =
    await Promise.all([
      supabase.auth.mfa.listFactors(),
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    ]);
  if (factorError) throw factorError;
  if (aalError) throw aalError;

  const factors = factorData.all.filter(
    (factor): factor is Factor<"totp"> => factor.factor_type === "totp",
  );
  return {
    factors,
    verifiedFactors: factorData.totp,
    currentLevel: aalData.currentLevel,
    nextLevel: aalData.nextLevel,
  };
}

export async function beginTotpEnrollment(): Promise<TotpEnrollment> {
  const { data: existingFactors, error: listError } = await supabase.auth.mfa.listFactors();
  if (listError) throw listError;

  for (const factor of existingFactors.all) {
    if (factor.factor_type === "totp" && factor.status === "unverified") {
      const { error } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
      if (error) throw error;
    }
  }

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: "AnjoLav ERP",
    issuer: "AnjoLav",
  });
  if (error) throw error;
  return {
    factorId: data.id,
    uri: data.totp.uri,
    secret: data.totp.secret,
  };
}

export async function verifyTotpFactor(factorId: string, code: string): Promise<void> {
  const normalizedCode = normalizeTotpCode(code);
  if (normalizedCode.length !== 6) {
    throw new Error("Digite os 6 números exibidos no aplicativo autenticador.");
  }
  const { error } = await supabase.auth.mfa.challengeAndVerify({
    factorId,
    code: normalizedCode,
  });
  if (error) throw error;
}

export async function removeTotpFactor(factorId: string): Promise<void> {
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) throw error;
}
