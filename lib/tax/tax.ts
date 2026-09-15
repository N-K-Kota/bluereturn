import { validateTaxReturn } from "./validation";
import {
  INCOME_TAX_BRACKETS,
} from "./constants";
import {
  calcBusinessIncome,
  calcSalaryIncome,
  calcMiscIncomeNet,
  type BusinessIncomeInput,
} from "./income";
import { calcAllDeductions } from "./deductions";
import type { TaxReturn, TaxCalculationResult, FiscalYear } from "@/types/tax";

export function calcProgressiveTax(taxableIncome: number): number {
  if (taxableIncome <= 0) return 0;
  // 千円未満切り捨て
  const rounded = Math.floor(taxableIncome / 1000) * 1000;
  for (const bracket of INCOME_TAX_BRACKETS) {
    if (rounded <= bracket.limit) {
      return Math.floor(rounded * bracket.rate) - bracket.deduction;
    }
  }
  return 0;
}

export function calcTax(
  year: FiscalYear,
  businessInput: BusinessIncomeInput,
  taxReturn: Omit<TaxReturn, "id">
): TaxCalculationResult {
  validateTaxReturn(taxReturn);
  if (taxReturn.fiscal_year !== year) throw new Error("申告年度が一致しません");
  const businessResult = calcBusinessIncome(businessInput);
  const salaryResult = calcSalaryIncome(taxReturn.salary_income, year);
  const miscNet = calcMiscIncomeNet(taxReturn.misc_income, taxReturn.misc_expenses);

  const totalIncome = Math.max(0, businessResult.income + salaryResult.income + miscNet);

  const deductions = calcAllDeductions(taxReturn, totalIncome);
  const taxableIncome = Math.floor(Math.max(0, totalIncome - deductions.total) / 1000) * 1000;

  const incomeTaxBeforeReduction = calcProgressiveTax(taxableIncome);
  const fixedTaxReduction = year === "2024" && totalIncome <= 18_050_000
    ? Math.min(incomeTaxBeforeReduction, (taxReturn.fixed_tax_reduction_people ?? 0) * 30_000) : 0;
  const incomeTax = incomeTaxBeforeReduction - fixedTaxReduction;
  const reconstructionTax = Math.floor(incomeTax * 21 / 1000);
  const totalTax = incomeTax + reconstructionTax;
  const withheldTax = taxReturn.salary_withheld + (taxReturn.business_withheld ?? 0);
  const prepaidTax = taxReturn.prepaid_tax ?? 0;
  const balance = totalTax - withheldTax;
  const declaredTax = balance > 0 ? Math.floor(balance / 100) * 100 : balance;
  const taxDue = declaredTax - prepaidTax;

  return {
    fiscal_year: year,
    business_revenue: businessResult.revenue,
    business_cost: businessResult.cost,
    business_expenses: businessResult.expenses,
    business_income_before_blue: businessResult.incomeBeforeBlue,
    blue_deduction_amount: businessResult.blueDeduction,
    business_income: businessResult.income,
    salary_income_gross: salaryResult.gross,
    salary_deduction: salaryResult.deduction,
    salary_income_net: salaryResult.income,
    misc_income_net: miscNet,
    total_income: totalIncome,
    basic_deduction: deductions.basicDeduction,
    social_insurance_deduction: deductions.socialInsuranceDeduction,
    life_insurance_deduction: deductions.lifeInsuranceDeduction,
    earthquake_deduction: deductions.earthquakeDeduction,
    medical_deduction: deductions.medicalDeduction,
    disability_deduction: deductions.disabilityDeduction,
    widow_deduction: deductions.widowDeduction,
    working_student_deduction: deductions.workingStudentDeduction,
    spouse_deduction: deductions.spouseDeduction,
    dependent_deduction: deductions.dependentDeduction,
    total_deduction: deductions.total,
    taxable_income: taxableIncome,
    income_tax_before_reduction: incomeTaxBeforeReduction,
    fixed_tax_reduction: fixedTaxReduction,
    prepaid_tax: prepaidTax,
    income_tax: incomeTax,
    reconstruction_tax: reconstructionTax,
    total_tax: totalTax,
    withheld_tax: withheldTax,
    tax_due: taxDue,
  };
}
