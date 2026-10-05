import "server-only";
import ExcelJS from "exceljs";

// Reading Purdue's approved driver spreadsheet (ApprovedDrivers.xlsx). Its
// first sheet has a title row, then a header row with columns including
// "Last Name", "First Name", "Email" and "MVR Expiration Date", then one row
// per driver. Columns are found by their headers, so reordering them or
// adding new ones doesn't matter.

export type PurdueDriver = {
  firstName: string;
  lastName: string;
  email: string | null; // lowercased; often missing
  // The last day they're approved, "2027-05-14"; null if unreadable.
  until: string | null;
};

export class PurdueListError extends Error {}

const HEADERS = {
  lastName: /last\s*name/i,
  firstName: /first\s*name/i,
  email: /e-?mail/i,
  until: /expir/i,
} as const;

export async function readPurdueList(data: ArrayBuffer): Promise<PurdueDriver[]> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(data);
  } catch {
    throw new PurdueListError("That file isn't an Excel spreadsheet (.xlsx). Upload ApprovedDrivers.xlsx as downloaded.");
  }

  for (const sheet of workbook.worksheets) {
    // The header row is near the top, under the title.
    for (let r = 1; r <= Math.min(sheet.rowCount, 15); r++) {
      const columns = headerColumns(sheet.getRow(r));
      if (!columns) continue;

      const drivers: PurdueDriver[] = [];
      for (let i = r + 1; i <= sheet.rowCount; i++) {
        const row = sheet.getRow(i);
        const lastName = row.getCell(columns.lastName).text.trim();
        const firstName = row.getCell(columns.firstName).text.trim();
        if (!lastName || !firstName) continue;
        const email = columns.email ? row.getCell(columns.email).text.trim().toLowerCase() : "";
        drivers.push({
          firstName,
          lastName,
          email: email.includes("@") ? email : null,
          until: toDay(row.getCell(columns.until).value),
        });
      }
      return drivers;
    }
  }
  throw new PurdueListError(
    "Couldn't find the driver list in that file. It should have \"Last Name\", \"First Name\" and \"MVR Expiration Date\" columns.",
  );
}

// The column number of each header we need, or null if this isn't the
// header row.
function headerColumns(row: ExcelJS.Row) {
  const found: Partial<Record<keyof typeof HEADERS, number>> = {};
  row.eachCell((cell, column) => {
    const text = cell.text.trim();
    for (const [key, pattern] of Object.entries(HEADERS) as [keyof typeof HEADERS, RegExp][]) {
      if (found[key] === undefined && pattern.test(text)) found[key] = column;
    }
  });
  if (!found.lastName || !found.firstName || !found.until) return null;
  return { lastName: found.lastName, firstName: found.firstName, until: found.until, email: found.email };
}

// An expiration date cell as "2027-05-14". Excel stores dates as dates
// (read as midnight UTC), but a cell typed as text such as "5/14/2027"
// works too.
function toDay(cell: ExcelJS.CellValue): string | null {
  // A formula cell's value is its result.
  const value = cell && typeof cell === "object" && "result" in cell ? cell.result : cell;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "number") {
    // Days since Excel's epoch.
    return new Date(Math.round((value - 25569) * 86400000)).toISOString().slice(0, 10);
  }
  if (typeof value !== "string") return null;
  const match = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (!match) return null;
  const [, month, day, year] = match;
  const fullYear = year.length === 2 ? `20${year}` : year;
  return `${fullYear}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

// A name reduced to plain lowercase letters, so "Abd Ghaffar", "abd-ghaffar"
// and "Abd Ghaffár" all match.
export function nameKey(name: string) {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

// The first word of a first name, as a key: "Ammar Hafiy Bin" → "ammar".
export function firstWordKey(name: string) {
  return nameKey(name.trim().split(/\s+/)[0] ?? "");
}
