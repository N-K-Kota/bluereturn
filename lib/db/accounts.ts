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

export async function updateAccount(
  id: number,
  data: Partial<Omit<Account, "id" | "is_system">>
): Promise<void> {
  const db = await getDb();
  const fields = Object.keys(data)
    .map((k) => `${k} = ?`)
    .join(", ");
  await db.execute(`UPDATE accounts SET ${fields} WHERE id = ?`, [
    ...Object.values(data),
    id,
  ]);
}

export async function deleteAccount(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM accounts WHERE id = ? AND is_system = 0", [id]);
}
