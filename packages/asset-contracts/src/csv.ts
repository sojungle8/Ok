/** Minimal RFC 4180 CSV parser (quoted fields, escaped quotes, CRLF/LF). No dependencies. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  const src = text.startsWith("﻿") ? text.slice(1) : text;
  while (i < src.length) {
    const ch = src[i] as string;
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }
    if (ch === '"') {
      if (field.length > 0) throw new Error(`CSV: unexpected quote inside unquoted field at offset ${i}`);
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
      if (ch === "\r" && src[i + 1] === "\n") i += 1;
    } else {
      field += ch;
    }
    i += 1;
  }
  if (inQuotes) throw new Error("CSV: unterminated quoted field");
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => !(r.length === 1 && r[0] === ""));
}

/** Parse CSV with a header row into records; every row must have exactly the header's column count. */
export function parseCsvRecords(text: string): { header: string[]; records: Record<string, string>[] } {
  const rows = parseCsv(text);
  const header = rows[0];
  if (!header) throw new Error("CSV: missing header row");
  const records = rows.slice(1).map((r, idx) => {
    if (r.length !== header.length) {
      throw new Error(`CSV: row ${idx + 2} has ${r.length} fields, expected ${header.length}`);
    }
    const rec: Record<string, string> = {};
    header.forEach((h, j) => {
      rec[h] = r[j] as string;
    });
    return rec;
  });
  return { header, records };
}
