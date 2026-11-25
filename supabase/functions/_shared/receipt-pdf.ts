import { encodeCode128B, type RolReceiptData } from "./rol-receipt.ts";

export type PdfReceiptData = RolReceiptData & {
  deliveryDetails?: string;
  payments?: Array<{ method: string; value: string }>;
  logoJpeg?: Uint8Array;
};

// A4-height pages at 80 mm width: each page can be printed or read on a phone.
const WIDTH = 227;
const HEIGHT = 595;
const LEFT = 12;
const RIGHT = WIDTH - 12;
const byte = (text: string) => new TextEncoder().encode(text);

function jpegSize(bytes: Uint8Array | undefined): { width: number; height: number } | null {
  if (!bytes || bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes.length > 1_000_000) return null;
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset++] !== 0xff) continue;
    const marker = bytes[offset++];
    if (marker === 0xd9 || marker === 0xda) break;
    const size = (bytes[offset] << 8) | bytes[offset + 1];
    if (size < 2 || offset + size > bytes.length) return null;
    if ([0xc0, 0xc1, 0xc2].includes(marker)) {
      const height = (bytes[offset + 3] << 8) | bytes[offset + 4];
      const width = (bytes[offset + 5] << 8) | bytes[offset + 6];
      return width > 0 && height > 0 && bytes[offset + 7] === 3 ? { width, height } : null;
    }
    offset += size;
  }
  return null;
}

function pdfString(value: string): string {
  // WinAnsi provides the common Portuguese characters used by the base fonts.
  return Array.from(value).map((ch) => {
    const code = ch.charCodeAt(0);
    if (ch === "(" || ch === ")" || ch === "\\") return "\\" + ch;
    if (code >= 32 && code <= 126) return ch;
    if (code >= 160 && code <= 255) return "\\" + code.toString(8).padStart(3, "0");
    if (ch === "–" || ch === "—") return "-";
    if (ch === "·" || ch === "•") return " - ";
    return "?";
  }).join("");
}

function wrap(text: string, max: number): string[] {
  const lines: string[] = [];
  for (const paragraph of String(text || "").split(/\r?\n/)) {
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      let remaining = word;
      while (remaining.length > max) {
        if (line) { lines.push(line); line = ""; }
        lines.push(remaining.slice(0, max));
        remaining = remaining.slice(max);
      }
      if (!remaining) continue;
      const combined = line ? line + " " + remaining : remaining;
      if (combined.length > max) { lines.push(line); line = remaining; }
      else line = combined;
    }
    lines.push(line);
  }
  return lines;
}

export function buildReceiptPdf(data: PdfReceiptData): Uint8Array {
  const pages: string[][] = [[]];
  let y = HEIGHT - 16;
  const page = () => pages[pages.length - 1];
  const line = (at = y) => page().push(`0.35 w 0 ${at.toFixed(2)} m ${WIDTH} ${at.toFixed(2)} l S`);
  const text = (value: string, x: number, at: number, size = 8, bold = false) =>
    page().push(`BT /F${bold ? 2 : 1} ${size} Tf 1 0 0 1 ${x.toFixed(2)} ${at.toFixed(2)} Tm (${pdfString(value)}) Tj ET`);
  const center = (value: string, at: number, size = 8, bold = false) =>
    text(value, Math.max(LEFT, (WIDTH - value.length * size * 0.5) / 2), at, size, bold);
  const ensure = (height: number) => {
    if (y - height >= 30) return;
    text("Continua na próxima página", LEFT, 15, 7);
    pages.push([]);
    y = HEIGHT - 17;
    center(`ROL: ${data.number} - continuação`, y, 9, true);
    y -= 14;
    line();
    y -= 12;
  };
  const rows = (value: string, bold = false, max = 48) => {
    for (const part of wrap(value, max)) {
      ensure(11);
      text(part, LEFT, y, 8, bold);
      y -= 11;
    }
  };
  const section = (title: string) => {
    ensure(25);
    line();
    y -= 10;
    center(title, y, 8, true);
    y -= 5;
    line();
    y -= 12;
  };

  const logo = jpegSize(data.logoJpeg);
  if (logo) {
    const scale = Math.min(60 / logo.width, 42 / logo.height);
    const width = logo.width * scale, height = logo.height * scale;
    page().push(`q ${width.toFixed(2)} 0 0 ${height.toFixed(2)} ${LEFT} ${(y - height).toFixed(2)} cm /Logo Do Q`);
    text(data.companyName || "LAVANDERIA", 80, y - 10, 9, true);
    y -= 50;
  } else {
    center(data.companyName || "LAVANDERIA", y, 11, true); y -= 12;
  }
  for (const l of wrap(data.companyAddress || "", 45)) { center(l, y, 7); y -= 9; }
  if (data.companyPhone) { center(`Tel: ${data.companyPhone}`, y, 7); y -= 9; }
  if (data.companyEmail) { center(data.companyEmail, y, 7); y -= 9; }
  if (data.companyCnpj) { center(`CNPJ: ${data.companyCnpj}`, y, 7); y -= 9; }
  line(); y -= 16;
  text(`ROL: ${data.number}`, LEFT, y, 12, true);
  const bits = encodeCode128B(data.number);
  const bx = 129, bw = 83, module = bw / bits.length;
  for (let i = 0; i < bits.length; i++) if (bits[i] === "1")
    page().push(`${(bx + i * module).toFixed(3)} ${(y - 1).toFixed(2)} ${Math.max(module, 0.3).toFixed(3)} 19 re f`);
  y -= 15;
  rows(`Entrada: ${data.entryDate} ${data.entryTime || ""}`.trim());
  rows(data.kind === "entrada"
    ? `Previsão de entrega: ${data.forecastDate || "-"} ${data.forecastTime || ""}`.trim()
    : `Disponível: ${data.availabilityDate || "-"} ${data.availabilityTime || ""}`.trim());
  rows(`Atendente: ${data.attendant || "Não informado"}`);
  section("DADOS DO CLIENTE");
  rows(data.clientName || "-", true);
  rows([data.clientStreet, data.clientNumber, data.clientComplement].filter(Boolean).join(", "));
  rows([data.clientDistrict, data.clientCity].filter(Boolean).join(" - "));
  if (data.clientPhone) rows(`Telefone: ${data.clientPhone}`);
  if (data.productionNotes) { section("INFORMAÇÕES PARA PRODUÇÃO"); rows(data.productionNotes); }
  section("PEÇAS E SERVIÇOS");
  for (const item of data.items) {
    ensure(35);
    rows(item.description, true);
    rows(`Serviço: ${item.operation || "-"}   Qtd.: ${item.quantity}`);
    rows(`Unitário: ${item.unitPrice}   Total: ${item.total}`);
    if (item.details) rows(item.details);
    line(); y -= 8;
  }
  if (data.deliveryDetails) { section("ENTREGA"); rows(data.deliveryDetails); }
  if (data.payments?.length) {
    section("PAGAMENTOS REGISTRADOS");
    for (const payment of data.payments) rows(`${payment.method}: ${payment.value}`);
  }
  section("TOTAIS DO ROL");
  rows(`Total de peças: ${data.totalPieces}`, true);
  rows(`Valor bruto: ${data.grossValue}`);
  rows(`Desconto: ${data.discountValue || "R$ 0,00"}`);
  if (data.expressValue) rows(`Lavagem Expressa: + ${data.expressValue}`);
  rows(`TOTAL DO ROL: ${data.totalValue}`, true);
  rows(`Total recebido: ${data.receivedValue}`);
  rows(`A PAGAR: ${data.amountDue}`, true);
  ensure(60); y -= 18; line(y); y -= 12;
  center("Assinatura do cliente", y, 7); y -= 16;
  if (data.footer) rows(data.footer);

  const objects: string[] = [];
  objects[0] = "<< /Type /Catalog /Pages 2 0 R >>";
  const pageIds = pages.map((_, i) => 5 + i * 2);
  objects[1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`;
  objects[2] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";
  pages.forEach((commands, i) => {
    const content = commands.join("\n") + "\n";
    const pid = pageIds[i];
    const logoResource = logo ? `/XObject << /Logo ${5 + pages.length * 2} 0 R >>` : "";
    objects[pid - 1] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${WIDTH} ${HEIGHT}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> ${logoResource} >> /Contents ${pid + 1} 0 R >>`;
    objects[pid] = `<< /Length ${byte(content).length} >>\nstream\n${content}endstream`;
  });
  if (logo && data.logoJpeg) {
    const hex = Array.from(data.logoJpeg, (value) => value.toString(16).padStart(2, "0")).join("") + ">";
    objects.push(`<< /Type /XObject /Subtype /Image /Width ${logo.width} /Height ${logo.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter [/ASCIIHexDecode /DCTDecode] /Length ${hex.length} >>\nstream\n${hex}\nendstream`);
  }
  let pdf = "%PDF-1.4\n% receipt\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(byte(pdf).length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = byte(pdf).length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.slice(1).map((n) => `${String(n).padStart(10, "0")} 00000 n \n`).join("");
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return byte(pdf);
}
