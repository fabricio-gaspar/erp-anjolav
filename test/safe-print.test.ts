import assert from "node:assert/strict";
import test from "node:test";

import { escapeHtml, safeHttpsUrl, securePrintHtml } from "../src/lib/safePrint.ts";

test("escapa conteúdo dinâmico antes de inseri-lo em documentos HTML", () => {
  assert.equal(
    escapeHtml('<img src=x onerror="alert(1)"> & teste'),
    "&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; teste",
  );
});

test("injeta uma política que desativa scripts nos documentos de impressão", () => {
  const secured = securePrintHtml("<!doctype html><html><head><title>Teste</title></head></html>");
  assert.match(secured, /Content-Security-Policy/);
  assert.match(secured, /script-src 'none'/);
  assert.ok(secured.indexOf("Content-Security-Policy") < secured.indexOf("<title>"));
});

test("aceita somente destinos HTTPS para links externos", () => {
  assert.equal(safeHttpsUrl("https://example.com/pagamento"), "https://example.com/pagamento");
  assert.equal(safeHttpsUrl("javascript:alert(1)"), null);
  assert.equal(safeHttpsUrl("http://example.com"), null);
  assert.equal(safeHttpsUrl("https://usuario:senha@example.com"), null);
  assert.equal(safeHttpsUrl("não é uma URL"), null);
});
