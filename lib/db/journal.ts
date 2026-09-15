import { invoke } from "@tauri-apps/api/core";
import { validateJournalEntry } from "@/lib/validation";
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

  // Reuse the date filter instead of an unbounded IN list (SQLite has a bind limit).
  const allLines = await db.select<JournalLine[]>(
    `SELECT jl.*, a.name as account_name, a.code as account_code
     FROM journal_lines jl
     JOIN accounts a ON jl.account_id = a.id
     JOIN (${query}) je ON jl.entry_id = je.id
     ORDER BY jl.entry_id, jl.id`,
    params
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
  await bulkCreateJournalEntries([input]);
}

export async function deleteJournalEntry(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM journal_entries WHERE id = ?", [id]);
}

export interface ImportRuleInput {
  keyword: string;
  account_id: number;
  entry_type: "debit" | "credit";
}

export async function bulkCreateJournalEntries(
  entries: CreateJournalEntryInput[],
  rules: ImportRuleInput[] = []
): Promise<void> {
  if (!entries.length) throw new Error("保存する仕訳がありません");
  entries.forEach(validateJournalEntry);
  await getDb();
  await invoke("save_journal_entries", { entries, rules });
}
