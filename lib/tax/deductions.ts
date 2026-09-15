import {
  BASIC_DEDUCTION_TABLE,
  BASIC_DEDUCTION_2025_TABLE,
  calcLifeOrPensionDeduction,
  calcLifeInsuranceNewDeduction,
  calcEarthquakeDeduction,
  calcMedicalDeduction,
  DISABILITY_DEDUCTION,
  WIDOW_DEDUCTION,
  SINGLE_PARENT_INCOME_LIMIT,
  WORKING_STUDENT_DEDUCTION,
  calcSpouseDeduction,
  DEPENDENT_DEDUCTION,
  DEPENDENT_SPECIFIC_DEDUCTION,
  DEPENDENT_ELDERLY_PARENT_DEDUCTION,
  DEPENDENT_ELDERLY_OTHER_DEDUCTION,
} from "./constants";
import type { TaxReturn, FiscalYear } from "@/types/tax";

export interface DeductionResult {
  basicDeduction: number;
  socialInsuranceDeduction: number;
  lifeInsuranceDeduction: number;
  earthquakeDeduction: number;
  medicalDeduction: number;
  disabilityDeduction: number;
  widowDeduction: number;
  workingStudentDeduction: number;
  spouseDeduction: number;
  dependentDeduction: number;
  total: number;
}

export function calcBasicDeduction(totalIncome: number, year: FiscalYear): number {
  for (const row of (year === "2025" ? BASIC_DEDUCTION_2025_TABLE : BASIC_DEDUCTION_TABLE)) {
    if (totalIncome <= row.limit) return row.amount;
  }
  return 0;
}

// 生命保険料控除合計（所得税法第76条）
// 新制度: 一般・介護医療・個人年金の3区分、各上限4万円、合計上限12万円
// 各区分で新旧混在の場合は①新のみ ②旧のみ ③合算 の最大値を採用
export function calcLifeInsuranceTotalDeduction(
  lifeNew: number,
  lifeOld: number,
  careNew: number,          // 介護医療保険料（新契約のみ）
  pensionNew: number,
  pensionOld: number
): number {
  const life    = calcLifeOrPensionDeduction(lifeNew, lifeOld);
  const care    = calcLifeInsuranceNewDeduction(careNew); // 介護医療は新契約のみ
  const pension = calcLifeOrPensionDeduction(pensionNew, pensionOld);
  // 旧契約を含む場合も全区分の合計は12万円まで。
  return Math.min(life + care + pension, 120_000);
}

export function calcAllDeductions(
  taxReturn: Omit<TaxReturn, "id">,
  totalIncome: number
): DeductionResult {
  const basicDeduction = calcBasicDeduction(totalIncome, taxReturn.fiscal_year);
  const socialInsuranceDeduction = taxReturn.social_insurance;

  const lifeInsuranceDeduction = calcLifeInsuranceTotalDeduction(
    taxReturn.life_insurance_new,
    taxReturn.life_insurance_old,
    taxReturn.care_insurance_new ?? 0,
    taxReturn.pension_insurance_new,
    taxReturn.pension_insurance_old
  );

  const earthquakeDeduction = calcEarthquakeDeduction(
    taxReturn.earthquake_insurance,
    taxReturn.long_term_earthquake
  );

  const medicalDeduction = calcMedicalDeduction(taxReturn.medical_expenses, totalIncome);

  const disabilityDeduction = DISABILITY_DEDUCTION[taxReturn.disabled_type] ?? 0;

  const widowDeduction = totalIncome <= SINGLE_PARENT_INCOME_LIMIT
    ? WIDOW_DEDUCTION[taxReturn.widow_type] ?? 0 : 0;
  // 勤労によらない所得10万円以下・学校要件は入力時に本人が確認。
  const studentLimit = taxReturn.fiscal_year === "2025" ? 850_000 : 750_000;
  const workingStudentDeduction = taxReturn.working_student && totalIncome <= studentLimit
    ? WORKING_STUDENT_DEDUCTION : 0;

  const spouseDeduction = calcSpouseDeduction(totalIncome, taxReturn.spouse_income);

  const dependentDeduction =
    taxReturn.dependent_general       * DEPENDENT_DEDUCTION +
    taxReturn.dependent_specific      * DEPENDENT_SPECIFIC_DEDUCTION +
    taxReturn.dependent_elderly_parent * DEPENDENT_ELDERLY_PARENT_DEDUCTION +
    taxReturn.dependent_elderly_other  * DEPENDENT_ELDERLY_OTHER_DEDUCTION;

  const total =
    basicDeduction +
    socialInsuranceDeduction +
    lifeInsuranceDeduction +
    earthquakeDeduction +
    medicalDeduction +
    disabilityDeduction +
    widowDeduction +
    workingStudentDeduction +
    spouseDeduction +
    dependentDeduction;

  return {
    basicDeduction,
    socialInsuranceDeduction,
    lifeInsuranceDeduction,
    earthquakeDeduction,
    medicalDeduction,
    disabilityDeduction,
    widowDeduction,
    workingStudentDeduction,
    spouseDeduction,
    dependentDeduction,
    total,
  };
}
