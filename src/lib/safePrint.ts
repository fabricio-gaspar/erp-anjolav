const HTML_ESCAPE_PATTERN = /[&<>"']/g;

const HTML_ENTITIES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

const PRINT_SECURITY_META = [
  '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'none\'; style-src \'unsafe-inline\'; img-src https: data: blob:; font-src data:; connect-src \'none\'; object-src \'none\'; frame-src \'none\'; base-uri \'none\'; form-action \'none\'">',
  '<meta name="referrer" content="no-referrer">',
].join("");

export function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(
    HTML_ESCAPE_PATTERN,
    (character) => HTML_ENTITIES[character],
  );
}

export function securePrintHtml(html: string): string {
  if (/<head(?:\s[^>]*)?>/i.test(html)) {
    return html.replace(/<head(?:\s[^>]*)?>/i, (head) => `${head}${PRINT_SECURITY_META}`);
  }

  return `${PRINT_SECURITY_META}${html}`;
}

export function reservePrintWindow(
  features = "width=900,height=700,noopener,noreferrer",
): Window | null {
  // A print window must be reserved while the click event is still active.
  // Opening it after an awaited data request is treated as a popup by browsers.
  const printableFeatures = features
    .split(",")
    .map((feature) => feature.trim())
    .filter((feature) => feature && feature !== "noopener" && feature !== "noreferrer")
    .join(",");
  const printWindow = window.open("", "_blank", printableFeatures);
  if (!printWindow) return null;

  printWindow.opener = null;
  return printWindow;
}

export function writePrintDocument(printWindow: Window, html: string): void {
  printWindow.document.open();
  printWindow.document.write(securePrintHtml(html));
  printWindow.document.close();
}

export function triggerPrint(printWindow: Window): void {
  // Do not close immediately after print(): embedded browsers can return before
  // the native dialog has sent the job to the Windows spooler.
  window.setTimeout(() => {
    if (printWindow.closed) return;
    printWindow.focus();
    printWindow.print();
  }, 120);
}

export function openPrintDocument(
  html: string,
  features = "width=900,height=700,noopener,noreferrer",
): Window | null {
  const printWindow = reservePrintWindow(features);
  if (!printWindow) return null;
  writePrintDocument(printWindow, html);
  return printWindow;
}

export function openPrintClone(
  source: HTMLElement,
  title: string,
  css: string,
  features = "width=900,height=700,noopener,noreferrer",
): Window | null {
  const printWindow = openPrintDocument(
    `<!doctype html><html><head><meta charset="UTF-8"><title>${escapeHtml(title)}</title><style>${css}</style></head><body></body></html>`,
    features,
  );
  if (!printWindow) return null;

  printWindow.document.body.replaceChildren(source.cloneNode(true));
  return printWindow;
}

export function safeHttpsUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;

  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url.toString() : null;
  } catch {
    return null;
  }
}

export function openExternalHttpsUrl(value: unknown): boolean {
  const url = safeHttpsUrl(value);
  if (!url) return false;

  const opened = window.open(url, "_blank", "noopener,noreferrer");
  if (opened) opened.opener = null;
  return true;
}
