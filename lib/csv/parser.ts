import { detectFormat, BANK_FORMATS, type BankFormat } from "./formats";
import type { CsvTransaction, CsvMapping } from "@/types";
import type { ImportRule } from "@/types";
import { matchRule } from "@/lib/db/rules";

export function decodeCSV(buffer: ArrayBuffer): string {
  // Try UTF-8 first
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
    if (!text.includes("")) return text;
  } catch {}
  // Fall back to Shift-JIS
  return new TextDecoder("shift-jis").decode(buffer);
}

export function parseCSVText(text: string): string[][] {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  return lines
    .filter((l) => l.trim() !== "")
    .map((line) => {
      const cells: string[] = [];
      let cur = "";
      let inQuote = false;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') {
          if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
          else inQuote = !inQuote;
        } else if (c === "," && !inQuote) {
          cells.push(cur.trim()); cur = "";
        } else {
          cur += c;
        }
      }
      cells.push(cur.trim());
      return cells;
    });
}

export interface ParseResult {
  format: BankFormat | null;
  headers: string[];
  transactions: CsvTransaction[];
}

export async function parseCsvBuffer(
  buffer: ArrayBuffer,
  rules: ImportRule[],
  customMapping?: CsvMapping
): Promise<ParseResult> {
  const text = decodeCSV(buffer);
  const rows = parseCSVText(text);

  // Find header row (first row that looks like headers)
  let headerRowIndex = 0;
  for (let i = 0; i < Math.min(5, rows.length); i++) {
    if (rows[i].some((c) => /日|摘要|金額|利用/.test(c))) {
      headerRowIndex = i;
      break;
    }
  }

  const headers = rows[headerRowIndex];
  const dataRows = rows.slice(headerRowIndex + 1);
  const format = customMapping ? null : detectFormat(headers);

  const transactions: CsvTransaction[] = [];

  for (const row of dataRows) {
    if (row.every((c) => c === "")) continue;

    const rowObj: Record<string, string> = {};
    headers.forEach((h, i) => { rowObj[h] = row[i] ?? ""; });

    let date = "";
    let description = "";
    let debit = 0;
    let credit = 0;

    if (format) {
      const parsed = format.parse(rowObj);
      if (!parsed || !parsed.date) continue;
      ({ date, description, debit, credit } = parsed);
    } else if (customMapping) {
      date = rowObj[customMapping.date] ?? "";
      description = rowObj[customMapping.description] ?? "";
      if (customMapping.amount) {
        const amount = parseFloat((rowObj[customMapping.amount] ?? "").replace(/,/g, "")) || 0;
        if (amount >= 0) credit = amount;
        else debit = -amount;
      } else {
        debit = parseFloat((rowObj[customMapping.debit_amount ?? ""] ?? "").replace(/,/g, "")) || 0;
        credit = parseFloat((rowObj[customMapping.credit_amount ?? ""] ?? "").replace(/,/g, "")) || 0;
      }
    } else {
      continue;
    }

    if (!date || (debit === 0 && credit === 0)) continue;

    const type = debit > 0 ? "debit" : "credit";
    const rule = await matchRule(description, rules);

    transactions.push({
      date,
      description,
      amount: debit > 0 ? debit : credit,
      type,
      suggested_account_id: rule?.account_id,
      suggested_account_name: rule?.account_name,
      rule_matched: !!rule,
    });
  }

  return { format, headers, transactions };
}
