export type AuthErrorPresentation = {
  kind: "invalid_credentials" | "service_unavailable" | "generic";
  message: string;
};

const UNAVAILABLE_AUTH_ERROR =
  /authretryablefetcherror|failed to fetch|network request failed|load failed|failed to send a request to the edge function|networkerror/i;

/**
 * Translates authentication transport failures without exposing provider details.
 * A network failure must never be presented as an invalid password.
 */
export function presentAuthError(error: unknown): AuthErrorPresentation {
  const candidate = error instanceof Error ? error : new Error(String(error ?? ""));
  const detail = `${candidate.name} ${candidate.message}`;

  if (UNAVAILABLE_AUTH_ERROR.test(detail)) {
    return {
      kind: "service_unavailable",
      message: "O serviço de acesso está indisponível no momento. Aguarde alguns instantes e tente novamente.",
    };
  }

  if (/invalid login credentials|invalid_credentials|login or password/i.test(detail)) {
    return {
      kind: "invalid_credentials",
      message: "Login ou senha incorretos.",
    };
  }

  return {
    kind: "generic",
    message: "Não foi possível concluir o acesso. Tente novamente.",
  };
}
