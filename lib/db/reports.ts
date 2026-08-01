import { getDb } from "./index";
import type { PLReport, BSReport, PLItem, BSItem } from "@/types";

interface AccountBalance {
  account_id: number;
  account_name: string;
  account_code: string;
  account_type: string;
  account_subtype: string;
  total_debit: number;
  total_credit: number;
}

// サブクエリで先に期間集計してからJOINすることで、日付フィルターが確実に機能する
async function getBalances(from: string, to: string): Promise<AccountBalance[]> {
  const db = await getDb();
  return db.select<AccountBalance[]>(
    `SELECT
       a.id as account_id,
       a.name as account_name,
       a.code as account_code,
       a.type as account_type,
       a.subtype as account_subtype,
       COALESCE(sums.total_debit, 0) as total_debit,
       COALESCE(sums.total_credit, 0) as total_credit
     FROM accounts a
     LEFT JOIN (
       SELECT jl.account_id,
              SUM(jl.debit_amount)  AS total_debit,
              SUM(jl.credit_amount) AS total_credit
       FROM journal_lines jl
       JOIN journal_entries je ON jl.entry_id = je.id
       WHERE je.date BETWEEN ? AND ?
       GROUP BY jl.account_id
     ) sums ON a.id = sums.account_id
     ORDER BY a.code`,
    [from, to]
  );
}

async function getBalancesAsOf(asOf: string): Promise<AccountBalance[]> {
  const db = await getDb();
  return db.select<AccountBalance[]>(
    `SELECT
       a.id as account_id,
       a.name as account_name,
       a.code as account_code,
       a.type as account_type,
       a.subtype as account_subtype,
       COALESCE(sums.total_debit, 0) as total_debit,
       COALESCE(sums.total_credit, 0) as total_credit
     FROM accounts a
     LEFT JOIN (
       SELECT jl.account_id,
              SUM(jl.debit_amount)  AS total_debit,
              SUM(jl.credit_amount) AS total_credit
       FROM journal_lines jl
       JOIN journal_entries je ON jl.entry_id = je.id
       WHERE je.date <= ?
       GROUP BY jl.account_id
     ) sums ON a.id = sums.account_id
     ORDER BY a.code`,
    [asOf]
  );
}

export async function getPLReport(from: string, to: string): Promise<PLReport> {
  const balances = await getBalances(from, to);

  const toItem = (b: AccountBalance): PLItem => ({
    account_id: b.account_id,
    account_name: b.account_name,
    account_code: b.account_code,
    amount: b.total_credit - b.total_debit,
  });

  const revenues = balances
    .filter((b) => b.account_subtype === "revenue")
    .map(toItem)
    .filter((i) => i.amount !== 0);

  const otherIncomes = balances
    .filter((b) => b.account_subtype === "other_income")
    .map(toItem)
    .filter((i) => i.amount !== 0);

  const costs = balances
    .filter((b) => b.account_subtype === "cost")
    .map((b) => ({ ...toItem(b), amount: b.total_debit - b.total_credit }))
    .filter((i) => i.amount !== 0);

  const sellingExpenses = balances
    .filter((b) => b.account_subtype === "selling_expense")
    .map((b) => ({ ...toItem(b), amount: b.total_debit - b.total_credit }))
    .filter((i) => i.amount !== 0);

  const otherExpenses = balances
    .filter((b) => b.account_subtype === "other_expense")
    .map((b) => ({ ...toItem(b), amount: b.total_debit - b.total_credit }))
    .filter((i) => i.amount !== 0);

  const total_revenue = revenues.reduce((s, i) => s + i.amount, 0);
  const total_cost = costs.reduce((s, i) => s + i.amount, 0);
  const gross_profit = total_revenue - total_cost;
  const total_selling_expense = sellingExpenses.reduce((s, i) => s + i.amount, 0);
  const operating_profit = gross_profit - total_selling_expense;
  const net_profit =
    operating_profit +
    otherIncomes.reduce((s, i) => s + i.amount, 0) -
    otherExpenses.reduce((s, i) => s + i.amount, 0);

  return {
    revenues,
    costs,
    selling_expenses: sellingExpenses,
    other_expenses: otherExpenses,
    other_incomes: otherIncomes,
    total_revenue,
    total_cost,
    gross_profit,
    total_selling_expense,
    operating_profit,
    net_profit,
  };
}

export async function getBSReport(asOf: string, fiscalStart: string): Promise<BSReport> {
  const balances = await getBalancesAsOf(asOf);

  const toAssetItem = (b: AccountBalance): BSItem => ({
    account_id: b.account_id,
    account_name: b.account_name,
    account_code: b.account_code,
    amount: b.total_debit - b.total_credit,
  });

  const toLiabItem = (b: AccountBalance): BSItem => ({
    account_id: b.account_id,
    account_name: b.account_name,
    account_code: b.account_code,
    amount: b.total_credit - b.total_debit,
  });

  const current_assets = balances
    .filter((b) => b.account_subtype === "current_asset")
    .map(toAssetItem)
    .filter((i) => i.amount !== 0);

  const fixed_assets = balances
    .filter((b) => b.account_subtype === "fixed_asset")
    .map(toAssetItem)
    .filter((i) => i.amount !== 0);

  const current_liabilities = balances
    .filter((b) => b.account_subtype === "current_liability")
    .map(toLiabItem)
    .filter((i) => i.amount !== 0);

  const fixed_liabilities = balances
    .filter((b) => b.account_subtype === "fixed_liability")
    .map(toLiabItem)
    .filter((i) => i.amount !== 0);

  // 事業主貸（code:520）は借方残高科目なのでtoAssetItemで計算し資本の控除として扱う
  const equityBalances = balances.filter((b) => b.account_subtype === "equity");
  const equity: BSItem[] = equityBalances.map((b) => ({
    account_id: b.account_id,
    account_name: b.account_name,
    account_code: b.account_code,
    amount: b.account_code === "520"
      ? -(b.total_debit - b.total_credit) // 事業主貸はマイナス控除
      : b.total_credit - b.total_debit,
  })).filter((i) => i.amount !== 0);

  // 当期純利益を資本の部に加算してBS均衡を保つ
  const plReport = await getPLReport(fiscalStart, asOf);
  if (plReport.net_profit !== 0) {
    equity.push({
      account_id: -1,
      account_name: "当期純利益",
      account_code: "---",
      amount: plReport.net_profit,
    });
  }

  const total_assets =
    current_assets.reduce((s, i) => s + i.amount, 0) +
    fixed_assets.reduce((s, i) => s + i.amount, 0);
  const total_liabilities =
    current_liabilities.reduce((s, i) => s + i.amount, 0) +
    fixed_liabilities.reduce((s, i) => s + i.amount, 0);
  const total_equity = equity.reduce((s, i) => s + i.amount, 0);

  return {
    current_assets,
    fixed_assets,
    current_liabilities,
    fixed_liabilities,
    equity,
    total_assets,
    total_liabilities,
    total_equity,
  };
}
