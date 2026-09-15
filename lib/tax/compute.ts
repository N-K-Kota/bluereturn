import type { PLReport } from "@/types";
import type { TaxProfile, TaxReturn, TaxCalculationResult } from "@/types/tax";
import { calcTax } from "./tax";
import { calcConsumptionTax } from "./consumption";

export function businessIncomeFromReport(pl: PLReport) {
  return {
    revenue: pl.total_revenue + pl.other_incomes.reduce((sum, item) => sum + item.amount, 0),
    cost: pl.total_cost,
    expenses: pl.total_selling_expense + pl.other_expenses.reduce((sum, item) => sum + item.amount, 0),
  };
}

// All views use exactly the same inputs and calculation, including an explicit zero sales value.
export function calculateReturn(profile: TaxProfile, tr: Omit<TaxReturn, "id">, pl: PLReport): TaxCalculationResult {
  if (profile.id !== tr.profile_id || profile.fiscal_year !== tr.fiscal_year) {
    throw new Error("納税者情報と申告年度が一致しません");
  }
  const res = calcTax(tr.fiscal_year, {
    ...businessIncomeFromReport(pl), blueDeduction: Number(profile.blue_deduction),
  }, tr);
  return {
    ...res,
    consumption_tax_result: calcConsumptionTax(profile.consumption_tax_type,
      tr.taxable_sales, tr.taxable_purchases, profile.simplified_tax_industry),
  };
}
