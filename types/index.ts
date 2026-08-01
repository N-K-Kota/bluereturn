export type AccountType = "asset" | "liability" | "equity" | "revenue" | "expense";

export type AccountSubtype =
  | "current_asset"
  | "fixed_asset"
  | "current_liability"
  | "fixed_liability"
  | "equity"
  | "revenue"
  | "cost"
  | "selling_expense"
  | "other_expense"
  | "other_income";

export interface Account {
  id: number;
  code: string;
  name: string;
  type: AccountType;
  subtype: AccountSubtype;
  is_system: number; // 0 or 1
}

export interface JournalEntry {
  id: number;
  date: string; // YYYY-MM-DD
  description: string;
  created_at: string;
}

export interface JournalLine {
  id: number;
  entry_id: number;
  account_id: number;
  debit_amount: number;
  credit_amount: number;
  description: string;
  // joined
  account_name?: string;
  account_code?: string;
}

export interface JournalEntryWithLines extends JournalEntry {
  lines: JournalLine[];
}

export interface ImportRule {
  id: number;
  keyword: string;
  account_id: number;
  entry_type: "debit" | "credit";
  // joined
  account_name?: string;
}

export interface CsvMapping {
  date: string;
  description: string;
  amount?: string;
  debit_amount?: string;
  credit_amount?: string;
}

export interface CsvTransaction {
  date: string;
  description: string;
  amount: number;
  type: "debit" | "credit";
  suggested_account_id?: number;
  suggested_account_name?: string;
  rule_matched?: boolean;
}

export type FiscalYear = {
  start: string; // YYYY-MM-DD
  end: string;
};

// 損益計算書
export interface PLItem {
  account_id: number;
  account_name: string;
  account_code: string;
  amount: number;
}

export interface PLReport {
  revenues: PLItem[];
  costs: PLItem[];
  selling_expenses: PLItem[];
  other_expenses: PLItem[];
  other_incomes: PLItem[];
  total_revenue: number;
  total_cost: number;
  gross_profit: number;
  total_selling_expense: number;
  operating_profit: number;
  net_profit: number;
}

// 貸借対照表
export interface BSItem {
  account_id: number;
  account_name: string;
  account_code: string;
  amount: number;
}

export interface BSReport {
  current_assets: BSItem[];
  fixed_assets: BSItem[];
  current_liabilities: BSItem[];
  fixed_liabilities: BSItem[];
  equity: BSItem[];
  total_assets: number;
  total_liabilities: number;
  total_equity: number;
}
