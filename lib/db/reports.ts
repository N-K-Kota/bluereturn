import { buildPLReport, buildBSReport, type AccountBalance } from "@/lib/accounting/reports";
import { normalizeDate } from "@/lib/validation";
import { getDb } from "./index";
import type { PLReport, BSReport } from "@/types";

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
  if (normalizeDate(from) !== from || normalizeDate(to) !== to || from > to) throw new Error("集計期間が正しくありません");
  const balances = await getBalances(from, to);
  return buildPLReport(balances);
}

export async function getBSReport(asOf: string, fiscalStart: string): Promise<BSReport> {
  if (normalizeDate(asOf) !== asOf || normalizeDate(fiscalStart) !== fiscalStart || fiscalStart > asOf) throw new Error("期首は基準日以前の日付を指定してください");
  const [balances, periodBalances] = await Promise.all([getBalancesAsOf(asOf), getBalances(fiscalStart, asOf)]);
  return buildBSReport(balances, buildPLReport(periodBalances).net_profit);
}
