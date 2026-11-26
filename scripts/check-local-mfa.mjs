// Verifica o encadeamento local de MFA; não autentica nenhum usuário.
import console from "node:console";
import { assert, readProjectFile } from "./local-checks.mjs";

const mfa = readProjectFile("src", "lib", "mfaSecurity.ts");
const auth = readProjectFile("src", "contexts", "AuthContext.tsx");
const route = readProjectFile("src", "components", "auth", "ProtectedRoute.tsx");
const challenge = readProjectFile("src", "pages", "MfaChallenge.tsx");
const settings = readProjectFile("src", "components", "configuracoes", "ConfiguracoesSeguranca.tsx");

for (const operation of ["listFactors", "getAuthenticatorAssuranceLevel", "enroll", "challengeAndVerify"]) {
  assert(mfa.includes(`supabase.auth.mfa.${operation}(`), `MFA sem ${operation}`);
}
assert(auth.includes("security.isAdmin && security.requireMfaForAdmins && !security.mfaSatisfied"),
  "Contexto não exige MFA de administradores quando configurado");
assert(route.includes('mfaChallengeRequired && location.pathname !== "/mfa"') && route.includes('<Navigate to="/mfa"'),
  "Rota protegida não encaminha para MFA");
assert(challenge.includes("verifyTotpFactor") && challenge.includes("refreshSecurityContext"),
  "Desafio MFA não verifica e atualiza a sessão");
assert(settings.includes('supabase.rpc("set_admin_mfa_requirement"'), "Configuração da política MFA não está ligada ao RPC");

console.log("MFA local: fluxo TOTP, política e redirecionamento conectados (checagem estática).");
