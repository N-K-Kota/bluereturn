export type FiscalYear = "2024" | "2025";

export type ConsumptionTaxType = "exempt" | "general" | "simplified" | "two_tenth";

// 簡易課税の事業区分（みなし仕入率）
export type SimplifiedTaxIndustry = "1" | "2" | "3" | "4" | "5" | "6";

export type BlueDeduction = "650000" | "550000" | "100000";

export interface TaxProfile {
  id: number;
  fiscal_year: FiscalYear;
  name: string;
  name_kana: string;
  address: string;
  address_kana: string;
  birthday: string; // YYYY-MM-DD
  phone: string;
  business_type: string;
  my_number: string;
  consumption_tax_type: ConsumptionTaxType;
  simplified_tax_industry: SimplifiedTaxIndustry;
  blue_deduction: BlueDeduction;
}

export interface TaxReturn {
  id: number;
  fiscal_year: FiscalYear;
  profile_id: number;
  // 給与所得
  salary_income: number;          // 給与収入合計
  business_withheld?: number;     // 事業・雑所得の源泉徴収税額
  prepaid_tax?: number;           // 予定納税額
  fixed_tax_reduction_people?: number; // 令和6年定額減税の対象人数（本人を含む）
  salary_withheld: number;        // 源泉徴収税額（復興特別所得税を含む）
  // 雑所得
  misc_income: number;
  misc_expenses: number;
  // 所得控除
  social_insurance: number;
  life_insurance_old: number;     // 一般生命保険料（旧契約）
  life_insurance_new: number;     // 一般生命保険料（新契約）
  care_insurance_new: number;     // 介護医療保険料（新契約のみ・所得税法第76条第2項）
  pension_insurance_old: number;  // 個人年金保険料（旧契約）
  pension_insurance_new: number;  // 個人年金保険料（新契約）
  earthquake_insurance: number;
  long_term_earthquake: number;   // 旧長期損害保険料
  medical_expenses: number;       // 医療費支払合計（補填後）
  disabled_type: number;          // 0:なし 1:一般 2:特別
  widow_type: number;             // 0:なし 1:ひとり親 2:寡婦
  working_student: number;        // 0:なし 1:あり
  spouse_income: number;          // 配偶者の合計所得金額（-1=配偶者なし）
  dependent_general: number;      // 一般扶養（16〜18歳・23〜69歳）
  dependent_specific: number;     // 特定扶養（19〜22歳）
  dependent_elderly_parent: number; // 老人扶養（同居老親等）
  dependent_elderly_other: number;  // 老人扶養（その他）
  // 消費税
  taxable_sales: number;          // 一般・2割特例: 税抜、簡易課税: 税込（既存データと共通）
  taxable_purchases: number;      // 課税仕入高（税抜・一般課税用）
}

export interface TaxCalculationResult {
  fiscal_year: FiscalYear;
  // 事業所得
  business_revenue: number;
  business_cost: number;
  business_expenses: number;
  business_income_before_blue: number;
  blue_deduction_amount: number;
  business_income: number;
  // 給与所得
  salary_income_gross: number;
  salary_deduction: number;
  salary_income_net: number;
  // 雑所得
  misc_income_net: number;
  // 合計所得
  total_income: number;
  // 所得控除
  basic_deduction: number;
  social_insurance_deduction: number;
  life_insurance_deduction: number;
  earthquake_deduction: number;
  medical_deduction: number;
  disability_deduction: number;
  widow_deduction: number;
  working_student_deduction: number;
  spouse_deduction: number;
  dependent_deduction: number;
  total_deduction: number;
  // 課税所得
  taxable_income: number;
  // 税額
  income_tax_before_reduction: number;
  fixed_tax_reduction: number;
  prepaid_tax: number;
  income_tax: number;
  reconstruction_tax: number;
  total_tax: number;
  withheld_tax: number;
  tax_due: number;               // 納付税額（還付はマイナス）
  // 消費税
  consumption_tax_result?: ConsumptionTaxResult;
}

export interface ConsumptionTaxResult {
  type: ConsumptionTaxType;
  taxable_sales: number;
  output_tax: number;
  input_tax: number;
  consumption_tax_due: number;
  local_consumption_tax_due: number;
  total_due: number;
}
