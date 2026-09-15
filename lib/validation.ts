import type { CreateJournalEntryInput } from "./db/journal";

export function normalizeDate(value: string): string {
  const match = value.trim().match(/^(\d{4})[-/.]?(\d{1,2})[-/.]?(\d{1,2})$/);
  if (!match) throw new Error(`日付が正しくありません: ${value}`);
  const [, y, m, d] = match;
  const year = Number(y), month = Number(m), day = Number(d);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > days[month - 1]) {
    throw new Error(`日付が正しくありません: ${value}`);
  }
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

export function localDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function assertAmount(value: number, label = "金額"): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label}は0以上の整数で入力してください`);
  }
}

export function validateJournalEntry(entry: CreateJournalEntryInput): void {
  if (normalizeDate(entry.date) !== entry.date) throw new Error("日付はYYYY-MM-DD形式で入力してください");
  if (entry.lines.length < 2) throw new Error("仕訳には2行以上の明細が必要です");
  let debit = 0, credit = 0;
  for (const line of entry.lines) {
    if (!Number.isSafeInteger(line.account_id) || line.account_id <= 0) throw new Error("勘定科目を選択してください");
    assertAmount(line.debit_amount, "借方");
    assertAmount(line.credit_amount, "貸方");
    if ((line.debit_amount > 0) === (line.credit_amount > 0)) {
      throw new Error("各行の借方・貸方の片方に金額を入力してください");
    }
    debit += line.debit_amount;
    credit += line.credit_amount;
  }
  assertAmount(debit); assertAmount(credit);
  if (debit !== credit) throw new Error("借方合計と貸方合計が一致しません");
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : typeof error === "string" ? error : "処理に失敗しました。もう一度お試しください。";
}
