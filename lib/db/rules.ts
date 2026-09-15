import { getDb } from "./index";
import type { ImportRule } from "@/types";

export async function listRules(): Promise<ImportRule[]> {
  const db = await getDb();
  return db.select<ImportRule[]>(
    `SELECT r.*, a.name as account_name
     FROM import_rules r
     JOIN accounts a ON r.account_id = a.id
     ORDER BY r.keyword`
  );
}

export async function upsertRule(
  keyword: string,
  account_id: number,
  entry_type: "debit" | "credit"
): Promise<void> {
  if (!keyword.trim()) throw new Error("キーワードを入力してください");
  const db = await getDb();
  await db.execute(
    `INSERT INTO import_rules (keyword, account_id, entry_type)
     VALUES (?, ?, ?)
     ON CONFLICT(keyword) DO UPDATE SET account_id = excluded.account_id, entry_type = excluded.entry_type`,
    [keyword.trim().toLowerCase(), account_id, entry_type]
  );
}

export async function deleteRule(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM import_rules WHERE id = ?", [id]);
}

export async function updateRule(id: number, keyword: string, accountId: number, entryType: "debit" | "credit"): Promise<void> {
  if (!keyword.trim()) throw new Error("キーワードを入力してください");
  const db = await getDb();
  await db.execute("UPDATE import_rules SET keyword = ?, account_id = ?, entry_type = ? WHERE id = ?",
    [keyword.trim().toLowerCase(), accountId, entryType, id]);
}
