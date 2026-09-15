import { getDb } from "./index";
import type { Account } from "@/types";

const ACCOUNT_SUBTYPES: Record<Account["type"], string[]> = {
  asset: ["current_asset", "fixed_asset"], liability: ["current_liability", "fixed_liability"],
  equity: ["equity"], revenue: ["revenue", "other_income"], expense: ["cost", "selling_expense", "other_expense"],
};
function validateAccount(data: Omit<Account, "id" | "is_system">) {
  if (!data.code.trim() || !data.name.trim()) throw new Error("コードと科目名を入力してください");
  if (!ACCOUNT_SUBTYPES[data.type]?.includes(data.subtype)) throw new Error("勘定科目の種別と区分が一致しません");
}

export async function listAccounts(): Promise<Account[]> {
  const db = await getDb();
  return db.select<Account[]>("SELECT * FROM accounts ORDER BY code");
}

export async function createAccount(
  data: Omit<Account, "id" | "is_system">
): Promise<void> {
  validateAccount(data);
  const db = await getDb();
  await db.execute(
    "INSERT INTO accounts (code, name, type, subtype, is_system) VALUES (?, ?, ?, ?, 0)",
    [data.code.trim(), data.name.trim(), data.type, data.subtype]
  );
}

const ALLOWED_ACCOUNT_FIELDS = ["code", "name", "type", "subtype"] as const;

export async function updateAccount(
  id: number,
  data: Partial<Omit<Account, "id" | "is_system">>
): Promise<void> {
  const db = await getDb();
  const rows = await db.select<Account[]>("SELECT * FROM accounts WHERE id = ?", [id]);
  if (!rows[0]) throw new Error("勘定科目が見つかりません");
  if (rows[0].is_system && (data.type || data.subtype || data.code)) throw new Error("標準科目のコード・分類は変更できません");
  validateAccount({ ...rows[0], ...data });
  const entries = Object.entries(data).filter(([k]) =>
    ALLOWED_ACCOUNT_FIELDS.includes(k as (typeof ALLOWED_ACCOUNT_FIELDS)[number])
  );
  if (entries.length === 0) return;
  const fields = entries.map(([k]) => `${k} = ?`).join(", ");
  await db.execute(`UPDATE accounts SET ${fields} WHERE id = ?`, [
    ...entries.map(([, v]) => v),
    id,
  ]);
}

export async function deleteAccount(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM accounts WHERE id = ? AND is_system = 0", [id]);
}
