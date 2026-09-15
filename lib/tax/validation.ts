import type { FiscalYear, TaxReturn } from "@/types/tax";
import { assertAmount } from "../validation";

export function parseFiscalYear(value: string): FiscalYear {
  if (value !== "2024" && value !== "2025") throw new Error("対応年度は2024年・2025年です");
  return value;
}

export function validateTaxReturn(data: Omit<TaxReturn, "id">): void {
  parseFiscalYear(data.fiscal_year);
  for (const [key, value] of Object.entries(data)) {
    if (key === "fiscal_year" || key === "id") continue;
    if (key === "spouse_income" && value === -1) continue;
    assertAmount(value as number, key);
  }
  if (data.profile_id <= 0) throw new Error("納税者情報を先に登録してください");
  if (![0, 1, 2].includes(data.disabled_type) || ![0, 1, 2].includes(data.widow_type)
    || ![0, 1].includes(data.working_student)) throw new Error("控除の選択が正しくありません");
}

export function emptyTaxReturn(year: FiscalYear, profileId: number): Omit<TaxReturn, "id"> {
  return {
    fiscal_year: year, profile_id: profileId, salary_income: 0, salary_withheld: 0,
    business_withheld: 0, prepaid_tax: 0, fixed_tax_reduction_people: 0,
    misc_income: 0, misc_expenses: 0, social_insurance: 0, life_insurance_old: 0,
    life_insurance_new: 0, care_insurance_new: 0, pension_insurance_old: 0,
    pension_insurance_new: 0, earthquake_insurance: 0, long_term_earthquake: 0,
    medical_expenses: 0, disabled_type: 0, widow_type: 0, working_student: 0,
    spouse_income: -1, dependent_general: 0, dependent_specific: 0,
    dependent_elderly_parent: 0, dependent_elderly_other: 0,
    taxable_sales: 0, taxable_purchases: 0,
  };
}
