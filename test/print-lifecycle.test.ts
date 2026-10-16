import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import * as safePrint from "../src/lib/safePrint.ts";

type PrintLifecycle = (printWindow: Window | null | undefined) => boolean;
type PreparedPrint = (
  prepareHtml: () => Promise<string | null>,
  options?: {
    features?: string;
    reserveWindow?: (features: string) => Window | null;
    writeDocument?: (printWindow: Window, html: string) => void;
    requestPrint?: (printWindow: Window | null | undefined) => boolean;
  },
) => Promise<boolean>;

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function lifecycle(): PrintLifecycle | undefined {
  return (safePrint as typeof safePrint & {
    printDocumentWhenReady?: PrintLifecycle;
  }).printDocumentWhenReady;
}

function preparedPrint(): PreparedPrint | undefined {
  return (safePrint as typeof safePrint & {
    reserveAndPrintPreparedDocument?: PreparedPrint;
  }).reserveAndPrintPreparedDocument;
}

function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });

  return { promise, resolve };
}

function sourceImplementation(source: string, startMarker: string, endMarker: string): string {
  const start = source.indexOf(startMarker);
  assert.notEqual(start, -1, `${startMarker} must remain present`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  return source.slice(start, end === -1 ? source.length : end);
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

test("reserves before asynchronous preparation, then prints without closing a successful window", async () => {
  const reserveAndPrintPreparedDocument = preparedPrint();
  assert.ok(reserveAndPrintPreparedDocument, "shared preparation helper must be exported");

  const events: string[] = [];
  const pendingHtml = deferred<string | null>();
  const printWindow = {
    closed: false,
    close: () => events.push("window-close"),
  } as unknown as Window;
  let writtenWindow: Window | undefined;
  let requestedWindow: Window | null | undefined;

  const result = reserveAndPrintPreparedDocument(
    async () => {
      events.push("prepare");
      return pendingHtml.promise;
    },
    {
      reserveWindow: () => {
        events.push("reserve");
        return printWindow;
      },
      writeDocument: (window, html) => {
        events.push(`write:${html}`);
        writtenWindow = window;
      },
      requestPrint: (window) => {
        events.push("request-print");
        requestedWindow = window;
        return true;
      },
    },
  );

  assert.deepEqual(events, ["reserve", "prepare"]);
  pendingHtml.resolve("<html>ready</html>");

  assert.equal(await result, true);
  assert.deepEqual(events, ["reserve", "prepare", "write:<html>ready</html>", "request-print"]);
  assert.equal(writtenWindow, printWindow);
  assert.equal(requestedWindow, printWindow);
  assert.equal(events.includes("window-close"), false);
});

test("closes only the reserved blank window when asynchronous preparation fails", async () => {
  const reserveAndPrintPreparedDocument = preparedPrint();
  assert.ok(reserveAndPrintPreparedDocument, "shared preparation helper must be exported");

  const events: string[] = [];
  const pendingHtml = deferred<string | null>();
  const printWindow = {
    closed: false,
    close: () => events.push("window-close"),
  } as unknown as Window;

  const result = reserveAndPrintPreparedDocument(
    async () => {
      events.push("prepare");
      return pendingHtml.promise;
    },
    {
      reserveWindow: () => {
        events.push("reserve");
        return printWindow;
      },
      writeDocument: () => events.push("write"),
      requestPrint: () => {
        events.push("request-print");
        return true;
      },
    },
  );

  assert.deepEqual(events, ["reserve", "prepare"]);
  pendingHtml.resolve(null);

  assert.equal(await result, false);
  assert.deepEqual(events, ["reserve", "prepare", "window-close"]);
});

test("does not close a possibly rendered window when writing throws", async () => {
  const reserveAndPrintPreparedDocument = preparedPrint();
  assert.ok(reserveAndPrintPreparedDocument, "shared preparation helper must be exported");

  const events: string[] = [];
  const printWindow = {
    closed: false,
    close: () => events.push("window-close"),
  } as unknown as Window;

  const result = reserveAndPrintPreparedDocument(
    async () => {
      events.push("prepare");
      return "<html>partially-written</html>";
    },
    {
      reserveWindow: () => {
        events.push("reserve");
        return printWindow;
      },
      writeDocument: () => {
        events.push("write");
        throw new Error("write failed");
      },
      requestPrint: () => {
        events.push("request-print");
        return true;
      },
    },
  );

  await assert.rejects(result, /write failed/);
  assert.deepEqual(events, ["reserve", "prepare", "write"]);
});

test("does not close a written window when requesting print throws", async () => {
  const reserveAndPrintPreparedDocument = preparedPrint();
  assert.ok(reserveAndPrintPreparedDocument, "shared preparation helper must be exported");

  const events: string[] = [];
  const printWindow = {
    closed: false,
    close: () => events.push("window-close"),
  } as unknown as Window;

  const result = reserveAndPrintPreparedDocument(
    async () => {
      events.push("prepare");
      return "<html>ready</html>";
    },
    {
      reserveWindow: () => {
        events.push("reserve");
        return printWindow;
      },
      writeDocument: () => events.push("write"),
      requestPrint: () => {
        events.push("request-print");
        throw new Error("print request failed");
      },
    },
  );

  await assert.rejects(result, /print request failed/);
  assert.deepEqual(events, ["reserve", "prepare", "write", "request-print"]);
});

test("closes the blank reservation when preparation rejects before writing", async () => {
  const reserveAndPrintPreparedDocument = preparedPrint();
  assert.ok(reserveAndPrintPreparedDocument, "shared preparation helper must be exported");

  const events: string[] = [];
  const printWindow = {
    closed: false,
    close: () => events.push("window-close"),
  } as unknown as Window;

  const result = reserveAndPrintPreparedDocument(
    async () => {
      events.push("prepare");
      throw new Error("preparation failed");
    },
    {
      reserveWindow: () => {
        events.push("reserve");
        return printWindow;
      },
      writeDocument: () => events.push("write"),
      requestPrint: () => {
        events.push("request-print");
        return true;
      },
    },
  );

  await assert.rejects(result, /preparation failed/);
  assert.deepEqual(events, ["reserve", "prepare", "window-close"]);
});

test("returns false for a blocked reservation without beginning preparation", async () => {
  const reserveAndPrintPreparedDocument = preparedPrint();
  assert.ok(reserveAndPrintPreparedDocument, "shared preparation helper must be exported");

  let prepared = false;
  assert.equal(
    await reserveAndPrintPreparedDocument(
      async () => {
        prepared = true;
        return "<html>unreachable</html>";
      },
      { reserveWindow: () => null },
    ),
    false,
  );
  assert.equal(prepared, false);
});

test("lancamento print callbacks wire the shared reservation helper before configuration awaits", async () => {
  const source = await readFile(resolve(repoRoot, "src/hooks/usePrintOS.ts"), "utf8");
  const paths = [
    ["printROLFromData", "await fetchROLConfig()", "  const printEtiquetaFromData"],
    ["printEtiquetaFromData", "await fetchEtiquetaConfig()", "\n\n  return {"],
  ] as const;

  for (const [callbackName, configAwait, endMarker] of paths) {
    const implementation = sourceImplementation(
      source,
      `  const ${callbackName} = useCallback`,
      endMarker,
    );
    const helperCall = implementation.indexOf("reserveAndPrintPreparedDocument(");
    const configCall = implementation.indexOf(configAwait);

    assert.ok(helperCall >= 0, `${callbackName} must invoke the shared helper`);
    assert.ok(configCall >= 0, `${callbackName} must load configuration`);
    assert.ok(helperCall < configCall, `${callbackName} must reserve before configuration awaits`);
    assert.equal(implementation.slice(0, helperCall).includes("await "), false);
  }
});

test("OS print services reserve and reuse one popup before asynchronous data acquisition", async () => {
  const source = await readFile(resolve(repoRoot, "src/services/printService.ts"), "utf8");
  const entryPoints = ["printROLFromOS", "printEtiquetaFromOS", "printMultipleEtiquetas"];

  for (const entryPoint of entryPoints) {
    const implementation = sourceImplementation(
      source,
      `export async function ${entryPoint}`,
      "\nexport async function",
    );
    const reserve = implementation.indexOf("const printWindow = reservedWindow ?? reservePrintWindow(");
    const dataAwait = implementation.indexOf("await Promise.all");

    assert.ok(reserve >= 0, `${entryPoint} must reserve when no window is supplied`);
    assert.ok(dataAwait >= 0, `${entryPoint} must load data asynchronously`);
    assert.ok(reserve < dataAwait, `${entryPoint} must reserve before loading data`);
    assert.equal((implementation.match(/reservePrintWindow\(/g) ?? []).length, 1);
    assert.match(implementation, /openPrintWindow\(html, printWindow\)/);
  }
});
