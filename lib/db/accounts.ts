import { getDb } from "./index";
import type { Account } from "@/types";

export async function listAccounts(): Promise<Account[]> {
  const db = await getDb();
  return db.select<Account[]>("SELECT * FROM accounts ORDER BY code");
}

export async function createAccount(
  data: Omit<Account, "id" | "is_system">
): Promise<void> {
  const db = await getDb();
  await db.execute(
    "INSERT INTO accounts (code, name, type, subtype, is_system) VALUES (?, ?, ?, ?, 0)",
    [data.code, data.name, data.type, data.subtype]
  );
}

const ALLOWED_ACCOUNT_FIELDS = ["code", "name", "type", "subtype"] as const;

export async function updateAccount(
  id: number,
  data: Partial<Omit<Account, "id" | "is_system">>
): Promise<void> {
  const db = await getDb();
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
