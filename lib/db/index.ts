import Database from "@tauri-apps/plugin-sql";
import { isTauri } from "@tauri-apps/api/core";

let _dbPromise: Promise<Database> | null = null;

export function getDb(): Promise<Database> {
  if (!isTauri()) return Promise.reject(new Error("データの表示・保存はデスクトップ版で利用できます。青色申告アプリを起動してください。"));
  if (!_dbPromise) {
    _dbPromise = Database.load("sqlite:aoshoku.db").then(async (db) => {
      await initSchema(db);
      return db;
    }).catch((error) => {
      _dbPromise = null;
      throw error;
    });
  }
  return _dbPromise;
}

async function initSchema(db: Database) {
  await db.execute("PRAGMA foreign_keys = ON");
  await db.execute(`
    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('asset','liability','equity','revenue','expense')),
      subtype TEXT NOT NULL,
      is_system INTEGER NOT NULL DEFAULT 0
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS journal_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS journal_lines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entry_id INTEGER NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
      account_id INTEGER NOT NULL REFERENCES accounts(id),
      debit_amount REAL NOT NULL DEFAULT 0,
      credit_amount REAL NOT NULL DEFAULT 0,
      description TEXT NOT NULL DEFAULT ''
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS import_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      keyword TEXT NOT NULL UNIQUE,
      account_id INTEGER NOT NULL REFERENCES accounts(id),
      entry_type TEXT NOT NULL CHECK(entry_type IN ('debit','credit'))
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS tax_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fiscal_year TEXT NOT NULL,
      name TEXT NOT NULL DEFAULT '',
      name_kana TEXT NOT NULL DEFAULT '',
      address TEXT NOT NULL DEFAULT '',
      address_kana TEXT NOT NULL DEFAULT '',
      birthday TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      business_type TEXT NOT NULL DEFAULT '',
      my_number TEXT NOT NULL DEFAULT '',
      consumption_tax_type TEXT NOT NULL DEFAULT 'exempt'
        CHECK(consumption_tax_type IN ('exempt','general','simplified')),
      simplified_tax_industry TEXT NOT NULL DEFAULT '5',
      blue_deduction TEXT NOT NULL DEFAULT '650000',
      UNIQUE(fiscal_year)
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS tax_returns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fiscal_year TEXT NOT NULL,
      profile_id INTEGER NOT NULL REFERENCES tax_profiles(id),
      salary_income REAL NOT NULL DEFAULT 0,
      salary_withheld REAL NOT NULL DEFAULT 0,
      misc_income REAL NOT NULL DEFAULT 0,
      misc_expenses REAL NOT NULL DEFAULT 0,
      social_insurance REAL NOT NULL DEFAULT 0,
      life_insurance_old REAL NOT NULL DEFAULT 0,
      life_insurance_new REAL NOT NULL DEFAULT 0,
      pension_insurance_old REAL NOT NULL DEFAULT 0,
      pension_insurance_new REAL NOT NULL DEFAULT 0,
      earthquake_insurance REAL NOT NULL DEFAULT 0,
      long_term_earthquake REAL NOT NULL DEFAULT 0,
      medical_expenses REAL NOT NULL DEFAULT 0,
      disabled_type INTEGER NOT NULL DEFAULT 0,
      widow_type INTEGER NOT NULL DEFAULT 0,
      working_student INTEGER NOT NULL DEFAULT 0,
      spouse_income REAL NOT NULL DEFAULT -1,
      dependent_general INTEGER NOT NULL DEFAULT 0,
      dependent_specific INTEGER NOT NULL DEFAULT 0,
      dependent_elderly_parent INTEGER NOT NULL DEFAULT 0,
      dependent_elderly_other INTEGER NOT NULL DEFAULT 0,
      taxable_sales REAL NOT NULL DEFAULT 0,
      taxable_purchases REAL NOT NULL DEFAULT 0,
      care_insurance_new REAL NOT NULL DEFAULT 0,
      UNIQUE(fiscal_year)
    )
  `);
  // Inspect columns so genuine migration failures are surfaced and can be retried.
  for (const [table, column, definition] of [
    ["tax_returns", "taxable_purchases", "REAL NOT NULL DEFAULT 0"],
    ["tax_returns", "care_insurance_new", "REAL NOT NULL DEFAULT 0"],
    ["tax_returns", "fixed_tax_reduction_people", "INTEGER NOT NULL DEFAULT 0"],
    ["tax_returns", "business_withheld", "INTEGER NOT NULL DEFAULT 0"],
    ["tax_returns", "prepaid_tax", "INTEGER NOT NULL DEFAULT 0"],
    ["tax_profiles", "consumption_tax_two_tenth", "INTEGER NOT NULL DEFAULT 0"],
  ]) {
    const columns = await db.select<{ name: string }[]>(`PRAGMA table_info(${table})`);
    if (!columns.some((c) => c.name === column)) {
      await db.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
  }
  await db.execute("CREATE INDEX IF NOT EXISTS journal_entries_date_idx ON journal_entries(date)");
  await db.execute("CREATE INDEX IF NOT EXISTS journal_lines_entry_idx ON journal_lines(entry_id)");
  await db.execute("CREATE INDEX IF NOT EXISTS journal_lines_account_idx ON journal_lines(account_id)");

  await seedDefaultAccounts(db);
}

async function seedDefaultAccounts(db: Database) {
  const defaults = [
    // 資産
    ["101", "現金", "asset", "current_asset"],
    ["110", "普通預金", "asset", "current_asset"],
    ["111", "当座預金", "asset", "current_asset"],
    ["120", "売掛金", "asset", "current_asset"],
    ["130", "前払費用", "asset", "current_asset"],
    ["150", "商品", "asset", "current_asset"],
    ["200", "建物", "asset", "fixed_asset"],
    ["210", "工具器具備品", "asset", "fixed_asset"],
    ["220", "車両運搬具", "asset", "fixed_asset"],
    ["230", "ソフトウェア", "asset", "fixed_asset"],
    ["240", "開業費", "asset", "fixed_asset"],
    // 負債
    ["300", "買掛金", "liability", "current_liability"],
    ["310", "未払金", "liability", "current_liability"],
    ["320", "前受金", "liability", "current_liability"],
    ["330", "預り金", "liability", "current_liability"],
    ["340", "仮受消費税", "liability", "current_liability"],
    ["400", "借入金", "liability", "fixed_liability"],
    // 資本
    ["500", "元入金", "equity", "equity"],
    ["510", "事業主借", "equity", "equity"],
    ["520", "事業主貸", "equity", "equity"],
    // 収益
    ["600", "売上高", "revenue", "revenue"],
    ["610", "雑収入", "revenue", "other_income"],
    // 費用
    ["700", "仕入高", "expense", "cost"],
    ["710", "給料賃金", "expense", "selling_expense"],
    ["711", "外注費", "expense", "selling_expense"],
    ["720", "地代家賃", "expense", "selling_expense"],
    ["721", "水道光熱費", "expense", "selling_expense"],
    ["722", "通信費", "expense", "selling_expense"],
    ["723", "旅費交通費", "expense", "selling_expense"],
    ["724", "接待交際費", "expense", "selling_expense"],
    ["725", "広告宣伝費", "expense", "selling_expense"],
    ["726", "消耗品費", "expense", "selling_expense"],
    ["727", "修繕費", "expense", "selling_expense"],
    ["728", "保険料", "expense", "selling_expense"],
    ["729", "支払手数料", "expense", "selling_expense"],
    ["730", "新聞図書費", "expense", "selling_expense"],
    ["731", "研修費", "expense", "selling_expense"],
    ["740", "減価償却費", "expense", "selling_expense"],
    ["750", "租税公課", "expense", "selling_expense"],
    ["760", "雑費", "expense", "selling_expense"],
    ["800", "支払利息", "expense", "other_expense"],
  ] as const;

  for (const [code, name, type, subtype] of defaults) {
    await db.execute(
      "INSERT OR IGNORE INTO accounts (code, name, type, subtype, is_system) VALUES (?, ?, ?, ?, 1)",
      [code, name, type, subtype]
    );
  }
}
