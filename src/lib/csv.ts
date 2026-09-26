// Builds CSV files that open cleanly in Excel, Numbers and Google Sheets.

type Cell = string | number | boolean | Date | null | undefined;

// A header row and data rows as CSV text. Starts with a byte order mark so
// Excel reads accented names as UTF-8.
export function toCsv(header: string[], rows: Cell[][]) {
  const lines = [header, ...rows].map((row) => row.map(csvCell).join(","));
  return `﻿${lines.join("\r\n")}\r\n`;
}

function csvCell(value: Cell) {
  if (value === null || value === undefined) return "";
  let text = value instanceof Date ? value.toISOString() : String(value);
  // A spreadsheet runs a cell starting with = + - or @ as a formula, which
  // someone could abuse by typing one into their profile. Prefixing ' makes
  // it plain text. Phone numbers (+17655550123) are safe and left alone.
  if (/^[=+\-@\t\r]/.test(text) && !/^\+\d+$/.test(text)) text = `'${text}`;
  if (/[",\r\n]/.test(text) || text.trim() !== text) {
    text = `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}
