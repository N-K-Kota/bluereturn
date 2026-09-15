import type { FiscalYear } from "@/types/tax";
import { calcSalaryDeduction } from "./constants";

export interface BusinessIncomeInput {
  revenue: number;      // 売上高
  cost: number;         // 仕入高・売上原価
  expenses: number;     // 経費合計
  blueDeduction: number; // 青色申告特別控除額
}

export interface BusinessIncomeResult {
  revenue: number;
  cost: number;
  expenses: number;
  grossProfit: number;
  incomeBeforeBlue: number;
  blueDeduction: number;
  income: number; // 事業所得
}

export function calcBusinessIncome(input: BusinessIncomeInput): BusinessIncomeResult {
  const grossProfit = input.revenue - input.cost;
  const incomeBeforeBlue = grossProfit - input.expenses;
  const blueDeduction = Math.min(input.blueDeduction, Math.max(0, incomeBeforeBlue));
  const income = incomeBeforeBlue - blueDeduction;
  return {
    revenue: input.revenue,
    cost: input.cost,
    expenses: input.expenses,
    grossProfit,
    incomeBeforeBlue,
    blueDeduction,
    income,
  };
}

export interface SalaryIncomeResult {
  gross: number;
  deduction: number;
  income: number;
}

export function calcSalaryIncome(grossSalary: number, year: FiscalYear): SalaryIncomeResult {
  const deduction = calcSalaryDeduction(grossSalary, year);
  return {
    gross: grossSalary,
    deduction,
    income: Math.max(0, grossSalary - deduction),
  };
}

export function calcMiscIncomeNet(miscIncome: number, miscExpenses: number): number {
  return Math.max(0, miscIncome - miscExpenses);
}
