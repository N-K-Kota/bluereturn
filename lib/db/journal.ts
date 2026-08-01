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
  } else if (to) {
    query += " WHERE date <= ?";
    params.push(to);
  }
  query += " ORDER BY date DESC, id DESC";

  const entries = await db.select<JournalEntry[]>(query, params);
  if (entries.length === 0) return [];

  // N+1を避けるため全明細を一括取得してグループ化
  const ids = entries.map((e) => e.id);
  const placeholders = ids.map(() => "?").join(",");
  const allLines = await db.select<JournalLine[]>(
    `SELECT jl.*, a.name as account_name, a.code as account_code
     FROM journal_lines jl
     JOIN accounts a ON jl.account_id = a.id
     WHERE jl.entry_id IN (${placeholders})
     ORDER BY jl.entry_id, jl.id`,
    ids
  );

  const linesByEntry = new Map<number, JournalLine[]>();
  for (const line of allLines) {
    const arr = linesByEntry.get(line.entry_id) ?? [];
    arr.push(line);
    linesByEntry.set(line.entry_id, arr);
  }

  return entries.map((e) => ({ ...e, lines: linesByEntry.get(e.id) ?? [] }));
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
  await db.execute("BEGIN");
  try {
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
    await db.execute("COMMIT");
  } catch (e) {
    await db.execute("ROLLBACK");
    throw e;
  }
}

export async function deleteJournalEntry(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM journal_entries WHERE id = ?", [id]);
}

export async function bulkCreateJournalEntries(
  entries: CreateJournalEntryInput[]
): Promise<void> {
  const db = await getDb();
  await db.execute("BEGIN");
  try {
    for (const entry of entries) {
      const totalDebit = entry.lines.reduce((s, l) => s + l.debit_amount, 0);
      const totalCredit = entry.lines.reduce((s, l) => s + l.credit_amount, 0);
      if (Math.abs(totalDebit - totalCredit) > 0.01) {
        throw new Error(`借貸不一致: ${entry.description}`);
      }
      const result = await db.execute(
        "INSERT INTO journal_entries (date, description) VALUES (?, ?)",
        [entry.date, entry.description]
      );
      const entryId = result.lastInsertId;
      for (const line of entry.lines) {
        await db.execute(
          "INSERT INTO journal_lines (entry_id, account_id, debit_amount, credit_amount, description) VALUES (?, ?, ?, ?, ?)",
          [entryId, line.account_id, line.debit_amount, line.credit_amount, line.description]
        );
      }
    }
    await db.execute("COMMIT");
  } catch (e) {
    await db.execute("ROLLBACK");
    throw e;
  }
}
