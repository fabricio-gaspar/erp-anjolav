import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import * as safePrint from "../src/lib/safePrint.ts";

type PrintLifecycle = (printWindow: Window | null | undefined) => boolean;

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const browserPrintPaths = [
  "src/hooks/usePrintOS.ts",
  "src/components/configuracoes/ROLPreview.tsx",
  "src/components/configuracoes/EtiquetaPreview.tsx",
  "src/services/printService.ts",
];

function lifecycle(): PrintLifecycle | undefined {
  return (safePrint as typeof safePrint & {
    printDocumentWhenReady?: PrintLifecycle;
  }).printDocumentWhenReady;
}

test("reports a blocked popup instead of scheduling a print", () => {
  const printDocumentWhenReady = lifecycle();

  assert.equal(typeof printDocumentWhenReady, "function");
  assert.equal(printDocumentWhenReady?.(null), false);
});

test("waits for the document, then focuses and prints without closing the window", () => {
  const printDocumentWhenReady = lifecycle();
  assert.equal(typeof printDocumentWhenReady, "function");

  const events: string[] = [];
  let fireLoad: (() => void) | undefined;
  const printWindow = {
    closed: false,
    document: { readyState: "loading" },
    addEventListener: (_event: string, listener: () => void) => {
      fireLoad = listener;
    },
    focus: () => events.push("focus"),
    print: () => events.push("print"),
    close: () => events.push("close"),
  } as unknown as Window;
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      setTimeout: (callback: () => void) => {
        callback();
        return 0;
      },
    },
  });

  try {
    assert.equal(printDocumentWhenReady?.(printWindow), true);
    assert.deepEqual(events, []);
    fireLoad?.();
    assert.deepEqual(events, ["focus", "print"]);
  } finally {
    if (originalWindow) {
      Object.defineProperty(globalThis, "window", originalWindow);
    } else {
      delete (globalThis as { window?: Window }).window;
    }
  }
});

test("all ROL and label browser paths delegate to the shared lifecycle without print-close pairs", async () => {
  for (const path of browserPrintPaths) {
    const source = await readFile(resolve(repoRoot, path), "utf8");

    assert.match(source, /printDocumentWhenReady/);
    assert.doesNotMatch(source, /printWindow\.print\(\);?\s*printWindow\.close\(\)/);
  }
});

test("OS print services reserve one popup before loading data and reuse it for printing", async () => {
  const source = await readFile(resolve(repoRoot, "src/services/printService.ts"), "utf8");
  const entryPoints = ["printROLFromOS", "printEtiquetaFromOS", "printMultipleEtiquetas"];

  for (const entryPoint of entryPoints) {
    const start = source.indexOf(`export async function ${entryPoint}`);
    const next = source.indexOf("\nexport async function", start + 1);
    const implementation = source.slice(start, next === -1 ? source.length : next);

    assert.notEqual(start, -1, `${entryPoint} must remain exported`);
    assert.match(
      implementation,
      /const printWindow = reservedWindow \?\? reservePrintWindow\([\s\S]*?\);\s*if \(!printWindow\) return false;\s*const \[config, osData\] = await Promise\.all/,
    );
    assert.doesNotMatch(implementation, /reservePrintWindow\([\s\S]*reservePrintWindow\(/);
    assert.match(implementation, /if \(!config \|\| !osData\) \{\s*printWindow\.close\(\);\s*return false;/);
    assert.doesNotMatch(implementation, /reservedWindow\?\.close\(\)/);
    assert.match(implementation, /openPrintWindow\(html, printWindow\)/);
  }
});
