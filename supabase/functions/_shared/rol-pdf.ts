function pdfBytes(value: string): Uint8Array {
  return new Uint8Array(Array.from(value, (character) => character.charCodeAt(0) & 0xff));
}

function concatBytes(...parts: Uint8Array[]) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function pdfText(value: string) {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/º/g, "o")
    .replace(/[·•]/g, "-")
    .replace(/[^\x20-\x7E]/g, "");
  return normalized.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function wrapLine(line: string, width: number) {
  if (line.length <= width) return [line];
  const chunks: string[] = [];
  let remaining = line.trim();
  while (remaining.length > width) {
    const splitAt = remaining.lastIndexOf(" ", width);
    const index = splitAt > Math.floor(width * 0.55) ? splitAt : width;
    chunks.push(remaining.slice(0, index).trim());
    remaining = remaining.slice(index).trim();
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}

function isHeading(line: string) {
  return line.startsWith("*") && line.endsWith("*") && line.length > 2;
}

/**
 * Creates a compact 80mm PDF from the exact notification body reserved in the
 * outbox. This keeps the data and ordering identical to the WhatsApp template
 * while giving the customer the visual receipt requested by the PDV flow.
 */
export function buildRolPdf(message: string): Uint8Array {
  const sourceLines = message.replace(/\r/g, "").split("\n");
  const lines = sourceLines.flatMap((line) => wrapLine(line, 39));
  const lineHeight = 11;
  const top = 34;
  const bottom = 28;
  const pageWidth = 227;
  const pageHeight = Math.max(360, top + bottom + lines.length * lineHeight);
  const commands: string[] = ["q", "0 0 0 RG", "0 0 0 rg", "0.6 w"];
  let y = pageHeight - top;

  commands.push(`0 ${y + 9} m ${pageWidth} ${y + 9} l S`);
  for (const sourceLine of lines) {
    const heading = isHeading(sourceLine.trim());
    const text = heading ? sourceLine.trim().slice(1, -1) : sourceLine;
    if (text.trim()) {
      commands.push("BT");
      commands.push(`/F${heading ? 2 : 1} ${heading ? 9 : 8.5} Tf`);
      commands.push(`1 0 0 1 14 ${y.toFixed(2)} Tm`);
      commands.push(`(${pdfText(text)}) Tj`);
      commands.push("ET");
    } else {
      commands.push(`14 ${y.toFixed(2)} m ${pageWidth - 14} ${y.toFixed(2)} l S`);
    }
    y -= lineHeight;
  }
  commands.push(`0 ${bottom - 10} m ${pageWidth} ${bottom - 10} l S`, "Q");
  const stream = `${commands.join("\n")}\n`;

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>`,
    `<< /Length ${pdfBytes(stream).length} >>\nstream\n${stream}endstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold /Encoding /WinAnsiEncoding >>",
  ];

  const header = pdfBytes("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
  const bodyParts: Uint8Array[] = [header];
  const offsets = [0];
  let offset = header.length;
  objects.forEach((object, index) => {
    const bytes = pdfBytes(`${index + 1} 0 obj\n${object}\nendobj\n`);
    offsets.push(offset);
    bodyParts.push(bytes);
    offset += bytes.length;
  });
  const xrefOffset = offset;
  const xref = [
    "xref",
    `0 ${objects.length + 1}`,
    "0000000000 65535 f ",
    ...offsets.slice(1).map((item) => `${String(item).padStart(10, "0")} 00000 n `),
    "trailer",
    `<< /Size ${objects.length + 1} /Root 1 0 R >>`,
    "startxref",
    String(xrefOffset),
    "%%EOF",
  ].join("\n") + "\n";
  bodyParts.push(pdfBytes(xref));
  return concatBytes(...bodyParts);
}
