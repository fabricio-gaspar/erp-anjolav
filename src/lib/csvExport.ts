export type CsvValue = string | number | boolean | Date | null | undefined;

export interface CsvColumn<T> {
  header: string;
  value: (row: T) => CsvValue;
}

function normalizeCsvValue(value: CsvValue): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  return String(value);
}

export function escapeCsvCell(value: CsvValue): string {
  let normalized = normalizeCsvValue(value).replace(/\r?\n/g, " ").trim();
  // Prevent Excel and compatible spreadsheet applications from evaluating exported data as formulas.
  if (/^[=+\-@]/.test(normalized)) normalized = `'${normalized}`;
  return `"${normalized.replace(/"/g, '""')}"`;
}

export function createCsv<T>(rows: readonly T[], columns: readonly CsvColumn<T>[]): string {
  const header = columns.map((column) => escapeCsvCell(column.header)).join(";");
  const body = rows.map((row) => columns.map((column) => escapeCsvCell(column.value(row))).join(";"));
  return [header, ...body].join("\n");
}

export function downloadCsv<T>(filename: string, rows: readonly T[], columns: readonly CsvColumn<T>[]) {
  if (typeof document === "undefined" || typeof URL === "undefined") return;
  const safeFilename = filename.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-");
  const blob = new Blob(["\ufeff", createCsv(rows, columns)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = safeFilename.toLowerCase().endsWith(".csv") ? safeFilename : `${safeFilename}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
