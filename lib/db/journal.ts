import { getDb } from "./index";
import type { JournalEntry, JournalEntryWithLines, JournalLine } from "@/types";

export async function listJournalEntries(
  from?: string,
  to?: string
): Promise<JournalEntryWithLines[]> {
  const db = await getDb();
  let query = "SELECT * FROM journal_entries";
  const params: string[] = [];
  if (from && to) {
    query += " WHERE date BETWEEN ? AND ?";
    params.push(from, to);
  } else if (from) {
    query += " WHERE date >= ?";
    params.push(from);
  }
  query += " ORDER BY date DESC, id DESC";

  const entries = await db.select<JournalEntry[]>(query, params);
  const result: JournalEntryWithLines[] = [];
  for (const entry of entries) {
    const lines = await listJournalLines(entry.id);
    result.push({ ...entry, lines });
  }
  return result;
}

export async function listJournalLines(entryId: number): Promise<JournalLine[]> {
  const db = await getDb();
  return db.select<JournalLine[]>(
    `SELECT jl.*, a.name as account_name, a.code as account_code
     FROM journal_lines jl
     JOIN accounts a ON jl.account_id = a.id
     WHERE jl.entry_id = ?
     ORDER BY jl.id`,
    [entryId]
  );
}

export interface CreateJournalEntryInput {
  date: string;
  description: string;
  lines: Array<{
    account_id: number;
    debit_amount: number;
    credit_amount: number;
    description: string;
  }>;
}

export async function createJournalEntry(
  input: CreateJournalEntryInput
): Promise<void> {
  const totalDebit = input.lines.reduce((s, l) => s + l.debit_amount, 0);
  const totalCredit = input.lines.reduce((s, l) => s + l.credit_amount, 0);
  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    throw new Error("借方合計と貸方合計が一致しません");
  }

  const db = await getDb();
  const result = await db.execute(
    "INSERT INTO journal_entries (date, description) VALUES (?, ?)",
    [input.date, input.description]
  );
  const entryId = result.lastInsertId;
  for (const line of input.lines) {
    await db.execute(
      "INSERT INTO journal_lines (entry_id, account_id, debit_amount, credit_amount, description) VALUES (?, ?, ?, ?, ?)",
      [entryId, line.account_id, line.debit_amount, line.credit_amount, line.description]
    );
  }
}

export async function deleteJournalEntry(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM journal_entries WHERE id = ?", [id]);
}

export async function bulkCreateJournalEntries(
  entries: CreateJournalEntryInput[]
): Promise<void> {
  for (const entry of entries) {
    await createJournalEntry(entry);
  }
}
