import assert from "node:assert/strict";
import test from "node:test";
import { isWaAkgMediaUploadFailure, sendWaAkgMedia } from "../supabase/functions/_shared/wa-akg.ts";
import { buildRolImageFallbackMessage } from "../supabase/functions/_shared/wa-delivery.ts";

const originalFetch = globalThis.fetch;

test.afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("envia PDF como multipart e aceita o retorno oficial sem inventar ID", async () => {
  let received;
  globalThis.fetch = async (url, init) => {
    received = { url: String(url), init };
    return new globalThis.Response(JSON.stringify({
      status: true,
      message: "Operation successful",
      data: { text: "Hello from WA-AKG!" },
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  const result = await sendWaAkgMedia(
    new globalThis.URL("https://wa.wfdigital.com.br"),
    "test-key",
    "anjolav-test-session",
    "5511999999999",
    new globalThis.TextEncoder().encode("%PDF-1.4 test"),
    "ROL-teste.pdf",
    "application/pdf",
    "AnjoLav · comprovante do ROL",
  );

  assert.deepEqual(result, { state: "accepted" });
  assert.equal(received.url, "https://wa.wfdigital.com.br/api/messages/anjolav-test-session/5511999999999%40s.whatsapp.net/media");
  assert.equal(received.init.headers.get("X-API-Key"), "test-key");
  assert.equal(received.init.headers.has("Content-Type"), false);
  const form = received.init.body;
  assert.ok(form instanceof globalThis.FormData);
  const file = form.get("file");
  assert.equal(file.name, "ROL-teste.pdf");
  assert.equal(file.type, "application/pdf");
  assert.equal(await file.text(), "%PDF-1.4 test");
  assert.equal(form.get("type"), "document");
  assert.equal(form.get("caption"), "AnjoLav · comprovante do ROL");
});

test("não considera sucesso HTTP sem confirmação explícita do WA-AKG", async () => {
  globalThis.fetch = async () => new globalThis.Response(JSON.stringify({ message: "missing acknowledgement" }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

  const result = await sendWaAkgMedia(
    new globalThis.URL("https://wa.wfdigital.com.br"),
    "test-key",
    "anjolav-test-session",
    "5511999999999",
    new Uint8Array([1, 2, 3]),
    "ROL-teste.pdf",
    "application/pdf",
    "",
  );

  assert.deepEqual(result, { state: "uncertain", code: "PROVIDER_ACK_INVALID", hint: "missing acknowledgement" });
});

test("envia o ROL visual como imagem e não como documento", async () => {
  let form;
  globalThis.fetch = async (_url, init) => {
    form = init.body;
    return new globalThis.Response(JSON.stringify({
      status: true,
      data: { key: { id: "provider-image-id" } },
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  const result = await sendWaAkgMedia(
    new globalThis.URL("https://wa.wfdigital.com.br"),
    "test-key",
    "anjolav-test-session",
    "5511999999999",
    new Uint8Array([137, 80, 78, 71]),
    "ROL-2026-000001.png",
    "image/png",
    "AnjoLav · comprovante do ROL",
    "image",
  );

  assert.deepEqual(result, { state: "accepted", messageId: "provider-image-id" });
  assert.equal(form.get("type"), "image");
  assert.equal(form.get("file").type, "image/png");
  assert.equal(form.get("file").name, "ROL-2026-000001.png");
});

test("redige telefone de erros do provedor antes de registrar o diagnóstico", async () => {
  globalThis.fetch = async () => new globalThis.Response(JSON.stringify({
    status: false,
    message: "Falha ao enviar para +55 11 99999-9999",
  }), { status: 500, headers: { "Content-Type": "application/json" } });

  const result = await sendWaAkgMedia(
    new globalThis.URL("https://wa.wfdigital.com.br"),
    "test-key",
    "anjolav-test-session",
    "5511999999999",
    new Uint8Array([1, 2, 3]),
    "ROL-teste.pdf",
    "application/pdf",
    "",
  );

  assert.deepEqual(result, {
    state: "uncertain",
    code: "HTTP_500",
    hint: "Falha ao enviar para [telefone]",
  });
});

test("reconhece somente a falha específica de upload de mídia para permitir fallback", () => {
  assert.equal(isWaAkgMediaUploadFailure({
    state: "uncertain",
    code: "HTTP_500",
    hint: "Media upload failed on all hosts",
  }), true);
  assert.equal(isWaAkgMediaUploadFailure({
    state: "uncertain",
    code: "HTTP_500",
    hint: "Failed to send media",
  }), true);
  assert.equal(isWaAkgMediaUploadFailure({
    state: "uncertain",
    code: "NETWORK_OR_TIMEOUT",
  }), false);
});

test("fallback mantém a mensagem organizada sem anexar link privado", () => {
  const message = "*ROL 2026-000001*\nCliente: Fabrício\nTotal: R$ 43,00";
  const fallback = buildRolImageFallbackMessage(message);
  assert.equal(fallback, message);
  assert.doesNotMatch(fallback, /https?:\/\//i);
  assert.doesNotMatch(fallback, /comprovante visual/i);
});

test("fallback limita mensagens longas sem acrescentar URL", () => {
  const fallback = buildRolImageFallbackMessage("A".repeat(4_100));
  assert.equal(fallback.length, 4_000);
  assert.doesNotMatch(fallback, /https?:\/\//i);
});
