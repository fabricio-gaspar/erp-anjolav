const LOGICAL_WIDTH = 302;
const MIN_LOGICAL_HEIGHT = 699;
const PIXEL_RATIO = 2;

const CODE128_PATTERNS = [
  "11011001100", "11001101100", "11001100110", "10010011000",
  "10010001100", "10001001100", "10011001000", "10011000100",
  "10001100100", "11001001000", "11001000100", "11000100100",
  "10110011100", "10011011100", "10011001110", "10111001100",
  "10011101100", "10011100110", "11001110010", "11001011100",
  "11001001110", "11011100100", "11001110100", "11101101110",
  "11101001100", "11100101100", "11100100110", "11101100100",
  "11100110100", "11100110010", "11011011000", "11011000110",
  "11000110110", "10100011000", "10001011000", "10001000110",
  "10110001000", "10001101000", "10001100010", "11010001000",
  "11000101000", "11000100010", "10110111000", "10110001110",
  "10001101110", "10111011000", "10111000110", "10001110110",
  "11101110110", "11010001110", "11000101110", "11011101000",
  "11011100010", "11011101110", "11101011000", "11101000110",
  "11100010110", "11101101000", "11101100010", "11100011010",
  "11101111010", "11001000010", "11110001010", "10100110000",
  "10100001100", "10010110000", "10010000110", "10000101100",
  "10000100110", "10110010000", "10110000100", "10011010000",
  "10011000010", "10000110100", "10000110010", "11000010010",
  "11001010000", "11110111010", "11000010100", "10001111010",
  "10100111100", "10010111100", "10010011110", "10111100100",
  "10011110100", "10011110010", "11110100100", "11110010100",
  "11110010010", "11011011110", "11011110110", "11110110110",
  "10101111000", "10100011110", "10001011110", "10111101000",
  "10111100010", "11110101000", "11110100010", "10111011110",
  "10111101110", "11101011110", "11110101110", "11010000100",
  "11010010000", "11010011100", "1100011101011",
] as const;

const GLYPHS: Record<string, readonly string[]> = {
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01111", "10000", "10000", "10000", "10000", "10000", "01111"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01111", "10000", "10000", "10111", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
  J: ["00111", "00010", "00010", "00010", "10010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "10101", "01010"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
  "3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "10000", "11110", "00001", "00001", "11110"],
  "6": ["01110", "10000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00001", "01110"],
  ".": ["00000", "00000", "00000", "00000", "00000", "00110", "00110"],
  ",": ["00000", "00000", "00000", "00000", "00110", "00100", "01000"],
  ":": ["00000", "00110", "00110", "00000", "00110", "00110", "00000"],
  ";": ["00000", "00110", "00110", "00000", "00110", "00100", "01000"],
  "-": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
  "_": ["00000", "00000", "00000", "00000", "00000", "00000", "11111"],
  "/": ["00001", "00010", "00010", "00100", "01000", "01000", "10000"],
  "\\": ["10000", "01000", "01000", "00100", "00010", "00010", "00001"],
  "(": ["00010", "00100", "01000", "01000", "01000", "00100", "00010"],
  ")": ["01000", "00100", "00010", "00010", "00010", "00100", "01000"],
  "[": ["01110", "01000", "01000", "01000", "01000", "01000", "01110"],
  "]": ["01110", "00010", "00010", "00010", "00010", "00010", "01110"],
  "+": ["00000", "00100", "00100", "11111", "00100", "00100", "00000"],
  "=": ["00000", "00000", "11111", "00000", "11111", "00000", "00000"],
  "$": ["00100", "01111", "10100", "01110", "00101", "11110", "00100"],
  "%": ["11001", "11010", "00100", "01000", "10110", "00110", "00000"],
  "&": ["01100", "10010", "10100", "01000", "10101", "10010", "01101"],
  "*": ["00000", "10101", "01110", "11111", "01110", "10101", "00000"],
  "#": ["01010", "11111", "01010", "01010", "11111", "01010", "00000"],
  "!": ["00100", "00100", "00100", "00100", "00100", "00000", "00100"],
  "?": ["01110", "10001", "00001", "00010", "00100", "00000", "00100"],
  "'": ["00100", "00100", "00000", "00000", "00000", "00000", "00000"],
  '"': ["01010", "01010", "00000", "00000", "00000", "00000", "00000"],
  "<": ["00010", "00100", "01000", "10000", "01000", "00100", "00010"],
  ">": ["01000", "00100", "00010", "00001", "00010", "00100", "01000"],
  "|": ["00100", "00100", "00100", "00100", "00100", "00100", "00100"],
  "@": ["01110", "10001", "10111", "10101", "10111", "10000", "01110"],
};

export type RolReceiptItem = {
  description: string;
  details?: string;
  operation?: string;
  quantity: string;
  unitPrice: string;
  total: string;
};

export type RolReceiptData = {
  kind: "entrada" | "pronto_retirada" | "pronto_delivery";
  companyName: string;
  companyAddress?: string;
  companyPhone?: string;
  companyEmail?: string;
  companyCnpj?: string;
  number: string;
  entryDate: string;
  entryTime?: string;
  forecastDate?: string;
  forecastTime?: string;
  availabilityDate?: string;
  availabilityTime?: string;
  attendant?: string;
  block?: string;
  clientName: string;
  clientCode?: string;
  clientStreet?: string;
  clientNumber?: string;
  clientComplement?: string;
  clientDistrict?: string;
  clientCity?: string;
  clientPhone?: string;
  productionNotes?: string;
  items: RolReceiptItem[];
  totalPieces: string;
  grossValue: string;
  discountValue?: string;
  expressValue?: string;
  totalValue: string;
  receivedValue: string;
  amountDue: string;
  dueDate?: string;
  footer?: string;
};

type Color = readonly [number, number, number];

const BLACK: Color = [0, 0, 0];
const WHITE: Color = [255, 255, 255];
const BRAND_BLUE: Color = [22, 86, 166];
const BRAND_CYAN: Color = [67, 203, 229];

function normalizeText(value: string): string {
  return value
    .replace(/[\u00A0\u202F]/g, " ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[º°]/g, "O")
    .replace(/[–—]/g, "-")
    .replace(/[×]/g, "X")
    .replace(/[·•]/g, "-")
    .replace(/[^\x20-\x7E]/g, "?")
    .toUpperCase();
}

class BitmapCanvas {
  readonly width: number;
  readonly height: number;
  readonly pixels: Uint8Array;

  constructor(logicalHeight: number) {
    this.width = LOGICAL_WIDTH * PIXEL_RATIO;
    this.height = logicalHeight * PIXEL_RATIO;
    this.pixels = new Uint8Array(this.width * this.height * 3);
    this.pixels.fill(255);
  }

  private setPhysicalPixel(x: number, y: number, color: Color) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const index = (y * this.width + x) * 3;
    this.pixels[index] = color[0];
    this.pixels[index + 1] = color[1];
    this.pixels[index + 2] = color[2];
  }

  fillRect(x: number, y: number, width: number, height: number, color: Color) {
    const left = Math.round(x * PIXEL_RATIO);
    const top = Math.round(y * PIXEL_RATIO);
    const right = Math.round((x + width) * PIXEL_RATIO);
    const bottom = Math.round((y + height) * PIXEL_RATIO);
    for (let py = top; py < bottom; py += 1) {
      for (let px = left; px < right; px += 1) this.setPhysicalPixel(px, py, color);
    }
  }

  hLine(y: number, x1 = 0, x2 = LOGICAL_WIDTH, thickness = 0.5, color: Color = BLACK) {
    this.fillRect(x1, y, x2 - x1, thickness, color);
  }

  rect(x: number, y: number, width: number, height: number, thickness = 0.5, color: Color = BLACK) {
    this.fillRect(x, y, width, thickness, color);
    this.fillRect(x, y + height - thickness, width, thickness, color);
    this.fillRect(x, y, thickness, height, color);
    this.fillRect(x + width - thickness, y, thickness, height, color);
  }

  measureText(value: string, scale = 1): number {
    const text = normalizeText(value);
    return text.length === 0 ? 0 : text.length * 6 * scale - scale;
  }

  text(value: string, x: number, y: number, options: {
    scale?: number;
    bold?: boolean;
    align?: "left" | "center" | "right";
    color?: Color;
    maxWidth?: number;
  } = {}) {
    const scale = options.scale ?? 1;
    const align = options.align ?? "left";
    const color = options.color ?? BLACK;
    let text = normalizeText(value);
    if (options.maxWidth && this.measureText(text, scale) > options.maxWidth) {
      while (text.length > 3 && this.measureText(`${text}...`, scale) > options.maxWidth) {
        text = text.slice(0, -1);
      }
      text = `${text.trimEnd()}...`;
    }
    const width = this.measureText(text, scale);
    let cursor = align === "center" ? x - width / 2 : align === "right" ? x - width : x;
    for (const character of text) {
      const glyph = GLYPHS[character] ?? GLYPHS["?"];
      for (let row = 0; row < glyph.length; row += 1) {
        for (let column = 0; column < glyph[row].length; column += 1) {
          if (glyph[row][column] !== "1") continue;
          this.fillRect(cursor + column * scale, y + row * scale, scale, scale, color);
          if (options.bold) {
            const offset = 1 / PIXEL_RATIO;
            this.fillRect(cursor + column * scale + offset, y + row * scale, scale, scale, color);
          }
        }
      }
      cursor += 6 * scale;
    }
  }

  wrappedText(value: string, x: number, y: number, maxWidth: number, options: {
    scale?: number;
    bold?: boolean;
    lineHeight?: number;
    maxLines?: number;
    align?: "left" | "center" | "right";
  } = {}): number {
    const scale = options.scale ?? 1;
    const words = normalizeText(value).split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (line && this.measureText(candidate, scale) > maxWidth) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    if (line) lines.push(line);
    const maxLines = options.maxLines ?? lines.length;
    const visible = lines.slice(0, maxLines);
    if (lines.length > maxLines && visible.length) visible[visible.length - 1] = `${visible[visible.length - 1]}...`;
    const lineHeight = options.lineHeight ?? 9 * scale;
    visible.forEach((item, index) => this.text(item, x, y + index * lineHeight, {
      scale,
      bold: options.bold,
      align: options.align,
      maxWidth,
    }));
    return visible.length * lineHeight;
  }
}

export function encodeCode128B(value: string): string {
  const text = normalizeText(value).replace(/[^\x20-\x7E]/g, "?").slice(0, 64) || "ROL";
  const codes = Array.from(text, (character) => character.charCodeAt(0) - 32);
  const checksum = codes.reduce((total, code, index) => total + code * (index + 1), 104) % 103;
  return [104, ...codes, checksum, 106].map((code) => CODE128_PATTERNS[code]).join("");
}

function drawBarcode(canvas: BitmapCanvas, value: string, x: number, y: number, width: number, height: number) {
  const pattern = encodeCode128B(value);
  const quiet = 5;
  const moduleWidth = (width - quiet * 2) / pattern.length;
  let cursor = x + quiet;
  for (const bit of pattern) {
    if (bit === "1") canvas.fillRect(cursor, y, Math.max(moduleWidth, 0.35), height, BLACK);
    cursor += moduleWidth;
  }
}

function writeUint32(target: Uint8Array, offset: number, value: number) {
  target[offset] = (value >>> 24) & 0xff;
  target[offset + 1] = (value >>> 16) & 0xff;
  target[offset + 2] = (value >>> 8) & 0xff;
  target[offset + 3] = value & 0xff;
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const result = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function pngChunk(name: string, data: Uint8Array): Uint8Array {
  const type = new TextEncoder().encode(name);
  const chunk = new Uint8Array(12 + data.length);
  writeUint32(chunk, 0, data.length);
  chunk.set(type, 4);
  chunk.set(data, 8);
  writeUint32(chunk, 8 + data.length, crc32(concatBytes([type, data])));
  return chunk;
}

async function encodePng(canvas: BitmapCanvas): Promise<Uint8Array> {
  const rowLength = canvas.width * 3;
  const raw = new Uint8Array((rowLength + 1) * canvas.height);
  for (let row = 0; row < canvas.height; row += 1) {
    const targetOffset = row * (rowLength + 1);
    raw[targetOffset] = 0;
    raw.set(canvas.pixels.subarray(row * rowLength, (row + 1) * rowLength), targetOffset + 1);
  }
  const compressedStream = new Blob([raw]).stream().pipeThrough(new CompressionStream("deflate"));
  const compressed = new Uint8Array(await new Response(compressedStream).arrayBuffer());
  const ihdr = new Uint8Array(13);
  writeUint32(ihdr, 0, canvas.width);
  writeUint32(ihdr, 4, canvas.height);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return concatBytes([
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", compressed),
    pngChunk("IEND", new Uint8Array()),
  ]);
}

function receiptStatus(data: RolReceiptData): string {
  if (data.kind === "pronto_retirada") return "DISPONIVEL PARA RETIRADA";
  if (data.kind === "pronto_delivery") return "PRONTO PARA DELIVERY";
  return "ROL DE ENTRADA";
}

function itemRows(data: RolReceiptData) {
  return data.items.map((item) => ({
    description: item.description || "PECA",
    details: item.details || "",
    operation: item.operation || "-",
    quantity: item.quantity || "0",
    unitPrice: item.unitPrice || "-",
    total: item.total || "-",
  }));
}

/**
 * Generates the WhatsApp receipt as a deterministic 604px-wide PNG. The
 * layout follows the configured 80mm ROL and the approved thermal reference;
 * no browser, external image service or mutable HTML is involved.
 */
export async function buildRolReceiptPng(data: RolReceiptData): Promise<Uint8Array> {
  const rows = itemRows(data);
  const extraRows = Math.max(0, rows.length - 1);
  const logicalHeight = MIN_LOGICAL_HEIGHT + extraRows * 22;
  const canvas = new BitmapCanvas(logicalHeight);
  const rowOffset = extraRows * 22;

  canvas.hLine(42);
  canvas.fillRect(12, 47, 91, 55, BRAND_BLUE);
  canvas.text("ANJO", 16, 65, { scale: 1, bold: true, color: WHITE });
  canvas.text("LAV", 50, 65, { scale: 1, bold: true, color: BRAND_CYAN });
  canvas.text("LAVANDERIA", 57.5, 84, { scale: 1, align: "center", color: WHITE, maxWidth: 79 });

  canvas.text(data.companyName || "ANJOLAV", 201, 48, { bold: true, align: "center", maxWidth: 180 });
  canvas.wrappedText(data.companyAddress || "", 201, 63, 178, { align: "center", lineHeight: 9, maxLines: 2 });
  canvas.text(data.companyPhone ? `TEL: ${data.companyPhone}` : "", 201, 84, { align: "center", maxWidth: 178 });
  canvas.text(data.companyEmail || "", 201, 94, { align: "center", maxWidth: 178 });
  canvas.text(data.companyCnpj ? `CNPJ: ${data.companyCnpj}` : "", 201, 104, { align: "center", maxWidth: 178 });
  canvas.hLine(132);

  const rolTitle = `ROL: ${data.number}`;
  const rolTitleScale = canvas.measureText(rolTitle, 2) <= 148 ? 2 : 1.5;
  canvas.text(rolTitle, 18, 143, { scale: rolTitleScale, bold: true, maxWidth: 148 });
  drawBarcode(canvas, data.number, 168, 136, 106, 30);
  canvas.text(data.number, 221, 169, { align: "center", maxWidth: 104 });

  canvas.text("DT.ENTRADA:", 20, 181, { bold: true });
  canvas.text(data.entryDate, 84, 181, { bold: true, maxWidth: 62 });
  canvas.text(data.entryTime || "", 148, 181, { bold: true, maxWidth: 36 });
  canvas.text(data.kind === "entrada" ? "PREV.ENTR.:" : "DISPONIV.:", 20, 195, { bold: true });
  canvas.text(data.kind === "entrada" ? data.forecastDate || "-" : data.availabilityDate || "-", 84, 195, { bold: true, maxWidth: 62 });
  canvas.text(data.kind === "entrada" ? data.forecastTime || "" : data.availabilityTime || "", 148, 195, { bold: true, maxWidth: 36 });
  canvas.text("ATENDENTE:", 20, 209, { bold: true });
  canvas.text(data.attendant || "NAO INFORMADO", 78, 209, { maxWidth: 112 });
  canvas.text("BLOCO:", 204, 209, { bold: true });
  canvas.text(data.block || "-", 245, 209, { maxWidth: 42 });
  canvas.hLine(222);

  canvas.text(data.clientName, LOGICAL_WIDTH / 2, 232, { scale: 2, bold: true, align: "center", maxWidth: 276 });
  canvas.text("ENDER.:", 20, 265, { bold: true });
  canvas.text(data.clientStreet || "-", 61, 265, { maxWidth: 143 });
  canvas.text("COD.:", 229, 265, { bold: true });
  canvas.text(data.clientCode || "-", 261, 265, { maxWidth: 32 });
  canvas.text("N.:", 229, 279, { bold: true });
  canvas.text(data.clientNumber || "-", 247, 279, { maxWidth: 46 });
  canvas.text("COMPL.:", 20, 279, { bold: true });
  canvas.text(data.clientComplement || "-", 61, 279, { maxWidth: 143 });
  canvas.text("BAIRRO:", 20, 293, { bold: true });
  canvas.text(data.clientDistrict || "-", 61, 293, { maxWidth: 143 });
  canvas.text("CIDADE:", 20, 307, { bold: true });
  canvas.text(data.clientCity || "-", 61, 307, { maxWidth: 143 });
  canvas.text("TEL.:", 166, 307, { bold: true });
  canvas.text(data.clientPhone || "-", 196, 307, { maxWidth: 99 });
  canvas.hLine(328);

  canvas.text("INFORMACOES PARA PRODUCAO", LOGICAL_WIDTH / 2, 336, { bold: true, align: "center" });
  canvas.wrappedText(`${receiptStatus(data)}${data.productionNotes ? ` - ${data.productionNotes}` : ""}`, LOGICAL_WIDTH / 2, 352, 270, {
    align: "center",
    lineHeight: 9,
    maxLines: 3,
  });
  canvas.hLine(388);

  canvas.text("PECAS", LOGICAL_WIDTH / 2, 394, { bold: true, align: "center" });
  canvas.hLine(405);
  canvas.text("DESCRICAO DA PECA", 20, 409, { bold: true, maxWidth: 102 });
  canvas.text("OPER.", 129, 409, { bold: true });
  canvas.text("QTDE", 169, 409, { bold: true });
  canvas.text("V.UNI", 205, 409, { bold: true });
  canvas.text("V.TOTAL", 254, 409, { bold: true });
  canvas.hLine(419);
  rows.forEach((item, index) => {
    const y = 424 + index * 22;
    canvas.text(item.description, 20, y, { bold: true, maxWidth: 103 });
    canvas.text(item.operation, 129, y, { maxWidth: 35 });
    canvas.text(item.quantity, 188, y, { align: "right", maxWidth: 21 });
    canvas.text(item.unitPrice, 240, y, { align: "right", maxWidth: 39 });
    canvas.text(item.total, 291, y, { align: "right", maxWidth: 47 });
    if (item.details) canvas.text(item.details, 22, y + 10, { maxWidth: 266 });
  });

  const itemBottom = 451 + rowOffset;
  canvas.hLine(itemBottom);
  canvas.rect(19, itemBottom + 5, 95, 39);
  canvas.text("TOTAL DE PECAS", 66.5, itemBottom + 10, { bold: true, align: "center" });
  canvas.text(data.totalPieces, 66.5, itemBottom + 22, { scale: 2, bold: true, align: "center" });
  canvas.text("VLR. BRUTO:", 151, itemBottom + 7, { bold: true });
  canvas.text(data.grossValue, 291, itemBottom + 7, { align: "right" });
  canvas.text("DESCONTO:", 151, itemBottom + 21, { bold: true });
  canvas.text(data.discountValue || "R$ 0,00", 291, itemBottom + 21, { align: "right" });
  const expressRow = Boolean(data.expressValue && Number(data.expressValue.replace(/[^0-9,.-]/g, "").replace(",", ".")) > 0);
  if (expressRow) {
    canvas.text("LAVAGEM EXPRESSA:", 151, itemBottom + 35, { bold: true });
    canvas.text(`+ ${data.expressValue}`, 291, itemBottom + 35, { align: "right" });
  }
  const totalsShift = expressRow ? 14 : 0;
  canvas.text("TOTAL DO ROL:", 151, itemBottom + 35 + totalsShift, { bold: true });
  canvas.text(data.totalValue, 291, itemBottom + 35 + totalsShift, { align: "right" });
  canvas.text("TOTAL RECEBIDO:", 151, itemBottom + 49 + totalsShift, { bold: true });
  canvas.text(data.receivedValue, 291, itemBottom + 49 + totalsShift, { align: "right" });
  canvas.text("A PAGAR:", 151, itemBottom + 63 + totalsShift, { bold: true });
  canvas.text(data.amountDue, 291, itemBottom + 63 + totalsShift, { bold: true, align: "right" });
  const totalsBottom = itemBottom + 73 + totalsShift;
  canvas.hLine(totalsBottom);

  const debtTop = totalsBottom + 46;
  canvas.hLine(debtTop);
  canvas.text("EXTRATO DE DEBITO DO CLIENTE", LOGICAL_WIDTH / 2, debtTop + 7, { bold: true, align: "center" });
  canvas.hLine(debtTop + 18);
  canvas.text("TIPO", 19, debtTop + 23, { bold: true });
  canvas.text("CODIGO", 70, debtTop + 23, { bold: true });
  canvas.text("DATA", 126, debtTop + 23, { bold: true });
  canvas.text("VALOR", 259, debtTop + 23, { bold: true });
  canvas.text("ROL", 20, debtTop + 38);
  canvas.text(data.number, 62, debtTop + 38, { scale: data.number.length > 9 ? 0.75 : 1, maxWidth: 57 });
  canvas.text(data.entryDate, 124, debtTop + 38, { maxWidth: 74 });
  canvas.text(data.amountDue, 291, debtTop + 38, { align: "right", maxWidth: 83 });
  canvas.text(`TOTAL DEVIDO EM ${data.dueDate || data.forecastDate || data.entryDate}`, LOGICAL_WIDTH / 2, debtTop + 50, {
    bold: true,
    align: "center",
    maxWidth: 270,
  });
  canvas.text("(INCLUI ROLS ANTERIORES, QUITADOS ETC.)", 18, debtTop + 61, { maxWidth: 214 });
  canvas.text(data.amountDue.replace(/^R\$\s?/, ""), 291, debtTop + 56, { scale: 2, bold: true, align: "right", maxWidth: 76 });

  const signatureY = debtTop + 74;
  canvas.hLine(signatureY);
  canvas.hLine(signatureY + 24, 62, 240);
  canvas.text("ASSINATURA DO CLIENTE", LOGICAL_WIDTH / 2, signatureY + 29, { bold: true, align: "center" });
  canvas.hLine(signatureY + 40);
  canvas.text(data.footer || "ANJOLAV ERP", LOGICAL_WIDTH / 2, signatureY + 45, { align: "center", maxWidth: 276 });
  canvas.hLine(logicalHeight - 1);

  return encodePng(canvas);
}

