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

export function openPrintDocument(
  html: string,
  features = "width=900,height=700,noopener,noreferrer",
): Window | null {
  // Browsers may deliberately return null when `noopener` is passed to
  // window.open(), even though the new window was created. For an about:blank
  // print document, detach the opener synchronously before writing content.
  const printableFeatures = features
    .split(",")
    .map((feature) => feature.trim())
    .filter((feature) => feature && feature !== "noopener" && feature !== "noreferrer")
    .join(",");
  const printWindow = window.open("", "_blank", printableFeatures);
  if (!printWindow) return null;

  printWindow.opener = null;
  printWindow.document.open();
  printWindow.document.write(securePrintHtml(html));
  printWindow.document.close();
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
