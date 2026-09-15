import { normalizeDate } from "../validation";
import { detectFormat, BANK_FORMATS, parseAmount, type BankFormat } from "./formats";
import type { CsvTransaction, CsvMapping } from "@/types";
import type { ImportRule } from "@/types";
import { matchRule } from "./rules";

export function decodeCSV(buffer: ArrayBuffer): string {
  // fatal: true により、無効なUTF-8バイト列（Shift-JIS等）は例外を投げる
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder("shift-jis").decode(buffer);
  }
}

export function parseCSVText(text: string): string[][] {
  const source = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false, closed = false;
  const pushCell = () => { row.push(cell.trim()); cell = ""; closed = false; };
  const pushRow = () => { pushCell(); if (row.some(Boolean)) rows.push(row); row = []; };
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (quoted) {
      if (char === '"') {
        if (source[i + 1] === '"') { cell += '"'; i++; }
        else { quoted = false; closed = true; }
      } else cell += char;
    } else if (char === ",") pushCell();
    else if (char === "\n") pushRow();
    else if (char === '"' && !cell.trim() && !closed) { cell = ""; quoted = true; }
    else {
      if (char === '"' || (closed && char.trim())) throw new Error("CSVの引用符が正しくありません");
      cell += char;
    }
  }
  if (quoted) throw new Error("CSVの引用符が閉じられていません");
  pushRow();
  return rows;
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
  if (!rows.length) throw new Error("CSVファイルが空です");

  // 全フォーマットの既知ヘッダー一覧を使い、最もマッチ数が多い行をヘッダー行とする
  const knownHeaders = new Set(BANK_FORMATS.flatMap((f) => f.headers));
  let headerRowIndex = 0;
  let bestScore = -1;
  for (let i = 0; i < Math.min(20, rows.length); i++) {
    const score = rows[i].filter((c) => knownHeaders.has(c)).length;
    if (score > bestScore) {
      bestScore = score;
      headerRowIndex = i;
    }
  }

  const headers = rows[headerRowIndex];
  const dataRows = rows.slice(headerRowIndex + 1);
  const format = customMapping ? null : detectFormat(headers);

  if (!format && !customMapping) throw new Error("対応するCSV形式を検出できませんでした。銀行の入出金明細CSVを選択してください。");
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
        const amount = parseAmount(rowObj[customMapping.amount] ?? "");
        if (amount >= 0) credit = amount;
        else debit = -amount;
      } else {
        debit = parseAmount(rowObj[customMapping.debit_amount ?? ""] ?? "");
        credit = parseAmount(rowObj[customMapping.credit_amount ?? ""] ?? "");
      }
    } else {
      continue;
    }

    if (!date || (debit === 0 && credit === 0)) continue;

    date = normalizeDate(date);
    if (debit < 0 && credit === 0) { credit = -debit; debit = 0; }
    else if (credit < 0 && debit === 0) { debit = -credit; credit = 0; }
    if (debit < 0 || credit < 0 || (debit > 0 && credit > 0)) {
      throw new Error(`${date}: 入金・出金の両方に金額がある行は取り込めません`);
    }
    const type = debit > 0 ? "debit" : "credit";
    const rule = matchRule(description, rules, type);

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
