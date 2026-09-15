import type { FiscalYear } from "@/types/tax";

// 所得税の超過累進税率テーブル（令和6・7年共通）
export const INCOME_TAX_BRACKETS = [
  { limit: 1_950_000,  rate: 0.05,  deduction: 0 },
  { limit: 3_300_000,  rate: 0.10,  deduction: 97_500 },
  { limit: 6_950_000,  rate: 0.20,  deduction: 427_500 },
  { limit: 9_000_000,  rate: 0.23,  deduction: 636_000 },
  { limit: 18_000_000, rate: 0.33,  deduction: 1_536_000 },
  { limit: 40_000_000, rate: 0.40,  deduction: 2_796_000 },
  { limit: Infinity,   rate: 0.45,  deduction: 4_796_000 },
] as const;

// 復興特別所得税率（令和元年〜令和19年）
export const RECONSTRUCTION_TAX_RATE = 0.021;

// 基礎控除テーブル（令和6年）
export const BASIC_DEDUCTION_TABLE = [
  { limit: 24_000_000, amount: 480_000 },
  { limit: 24_500_000, amount: 320_000 },
  { limit: 25_000_000, amount: 160_000 },
  { limit: Infinity,   amount: 0 },
] as const;

// 国税庁: 令和7年度税制改正による所得税の基礎控除の見直し等
// https://www.nta.go.jp/users/gensen/2025kiso/
export const BASIC_DEDUCTION_2025_TABLE = [
  { limit: 1_320_000, amount: 950_000 },
  { limit: 3_360_000, amount: 880_000 },
  { limit: 4_890_000, amount: 680_000 },
  { limit: 6_550_000, amount: 630_000 },
  { limit: 23_500_000, amount: 580_000 },
  ...BASIC_DEDUCTION_TABLE,
] as const;

// 所得税法別表第五: 660万円未満は4,000円刻みの表を適用。
export function calcSalaryDeduction(grossSalary: number, year: FiscalYear): number {
  let income: number;
  const a = Math.floor(grossSalary / 4_000) * 1_000;
  if (grossSalary <= (year === "2025" ? 650_999 : 550_999)) income = 0;
  else if (year === "2025" && grossSalary < 1_900_000) income = Math.max(0, grossSalary - 650_000);
  else if (grossSalary < 1_619_000) income = Math.max(0, grossSalary - 550_000);
  else if (grossSalary < 1_620_000) income = 1_069_000;
  else if (grossSalary < 1_622_000) income = 1_070_000;
  else if (grossSalary < 1_624_000) income = 1_072_000;
  else if (grossSalary < 1_628_000) income = 1_074_000;
  else if (grossSalary < 1_800_000) income = a * 24 / 10 + 100_000;
  else if (grossSalary < 3_600_000) income = a * 28 / 10 - 80_000;
  else if (grossSalary < 6_600_000) income = a * 32 / 10 - 440_000;
  else if (grossSalary <= 8_500_000) income = Math.floor(grossSalary * 9 / 10) - 1_100_000;
  else income = grossSalary - 1_950_000;
  return grossSalary - income;
}

// 生命保険料控除（新契約：平成24年1月1日以降）
// 根拠: 所得税法第76条第1項
export function calcLifeInsuranceNewDeduction(premium: number): number {
  if (premium <= 0)       return 0;
  if (premium <= 20_000)  return premium;
  if (premium <= 40_000)  return Math.ceil(premium * 0.5) + 10_000;
  if (premium <= 80_000)  return Math.ceil(premium * 0.25) + 20_000;
  return 40_000;
}

// 生命保険料控除（旧契約：平成23年12月31日以前）
// 根拠: 所得税法第76条第4項
export function calcLifeInsuranceOldDeduction(premium: number): number {
  if (premium <= 0)        return 0;
  if (premium <= 25_000)   return premium;
  if (premium <= 50_000)   return Math.ceil(premium * 0.5) + 12_500;
  if (premium <= 100_000)  return Math.ceil(premium * 0.25) + 25_000;
  return 50_000;
}

// 新旧混在時: ①新のみ ②旧のみ（上限5万）③新旧合算（上限4万）の最大値
// 根拠: 所得税法第76条第5項
export function calcLifeOrPensionDeduction(newAmt: number, oldAmt: number): number {
  if (newAmt <= 0 && oldAmt <= 0) return 0;
  const onlyNew  = calcLifeInsuranceNewDeduction(newAmt);
  const onlyOld  = Math.min(calcLifeInsuranceOldDeduction(oldAmt), 50_000);
  if (newAmt > 0 && oldAmt > 0) {
    const combined = Math.min(
      calcLifeInsuranceNewDeduction(newAmt) + calcLifeInsuranceOldDeduction(oldAmt),
      40_000
    );
    return Math.max(onlyNew, onlyOld, combined);
  }
  return newAmt > 0 ? onlyNew : onlyOld;
}

// 地震保険料控除
// 根拠: 所得税法第77条
export function calcEarthquakeDeduction(
  earthquakePremium: number,
  longTermPremium: number
): number {
  const eq = Math.min(earthquakePremium, 50_000);
  let lt = 0;
  if (longTermPremium > 0) {
    if (longTermPremium <= 5_000)       lt = longTermPremium;
    else if (longTermPremium <= 15_000) lt = Math.ceil(longTermPremium * 0.5) + 2_500;
    else                                lt = 10_000;
  }
  return Math.min(eq + lt, 50_000);
}

// 医療費控除（基本）
// 根拠: 所得税法第73条
export function calcMedicalDeduction(totalExpenses: number, totalIncome: number): number {
  const threshold = Math.min(Math.max(0, totalIncome) * 0.05, 100_000);
  return Math.ceil(Math.max(0, Math.min(totalExpenses - threshold, 2_000_000)));
}

// 障害者控除
export const DISABILITY_DEDUCTION: Record<number, number> = {
  0: 0,
  1: 270_000,  // 一般障害者
  2: 400_000,  // 特別障害者
};

// ひとり親・寡婦控除（適用金額。所得要件は deductions.ts で確認）
export const WIDOW_DEDUCTION: Record<number, number> = {
  0: 0,
  1: 350_000,  // ひとり親（合計所得500万円以下が必要）
  2: 270_000,  // 寡婦
};

// ひとり親控除の合計所得要件
export const SINGLE_PARENT_INCOME_LIMIT = 5_000_000;

// 勤労学生控除
export const WORKING_STUDENT_DEDUCTION = 270_000;

// 扶養控除（年齢は申告年12月31日時点）
export const DEPENDENT_DEDUCTION         = 380_000; // 一般（16〜18歳・23〜69歳）
export const DEPENDENT_SPECIFIC_DEDUCTION = 630_000; // 特定（19〜22歳）
export const DEPENDENT_ELDERLY_PARENT_DEDUCTION = 580_000; // 老人扶養（同居老親等・70歳以上）
export const DEPENDENT_ELDERLY_OTHER_DEDUCTION  = 480_000; // 老人扶養（その他・70歳以上）

// 配偶者控除・配偶者特別控除
// 根拠: 所得税法第83条・第83条の2
export function calcSpouseDeduction(ownIncome: number, spouseIncome: number): number {
  if (spouseIncome < 0) return 0;           // 配偶者なし
  if (ownIncome > 10_000_000) return 0;     // 所得1000万超は不可

  if (spouseIncome <= 480_000) {
    // 配偶者控除
    if (ownIncome <= 9_000_000) return 380_000;
    if (ownIncome <= 9_500_000) return 260_000;
    return 130_000;
  }

  if (spouseIncome <= 1_330_000) {
    // 配偶者特別控除（所得税法第83条の2）
    const table = [
      [480_001,   950_000, [380_000, 260_000, 130_000]],
      [950_001,   1_000_000, [360_000, 240_000, 120_000]],
      [1_000_001, 1_050_000, [310_000, 210_000, 110_000]],
      [1_050_001, 1_100_000, [260_000, 180_000,  90_000]],
      [1_100_001, 1_150_000, [210_000, 140_000,  70_000]],
      [1_150_001, 1_200_000, [160_000, 110_000,  60_000]],
      [1_200_001, 1_250_000, [110_000,  80_000,  40_000]],
      [1_250_001, 1_300_000, [ 60_000,  40_000,  20_000]],
      [1_300_001, 1_330_000, [ 30_000,  20_000,  10_000]],
    ] as const;
    const col = ownIncome <= 9_000_000 ? 0 : ownIncome <= 9_500_000 ? 1 : 2;
    for (const [lo, hi, amounts] of table) {
      if (spouseIncome >= lo && spouseIncome <= hi) return amounts[col];
    }
  }
  return 0;
}

// 消費税率（令和元年10月〜）
export const CONSUMPTION_TAX_RATE = 0.10;
export const LOCAL_CONSUMPTION_TAX_RATE = 22 / 78; // 地方消費税（消費税額×22/78）

// 簡易課税のみなし仕入率（消費税法施行令第57条）
export const SIMPLIFIED_TAX_RATES: Record<string, number> = {
  "1": 0.90, // 第1種（卸売業）
  "2": 0.80, // 第2種（小売業・農業林業漁業のうち飲食料品）
  "3": 0.70, // 第3種（製造業・農林漁業その他・建設業等）
  "4": 0.60, // 第4種（飲食店業等・その他）
  "5": 0.50, // 第5種（サービス業・金融保険業・運輸通信業）
  "6": 0.40, // 第6種（不動産業）
};

export const SIMPLIFIED_TAX_INDUSTRY_LABELS: Record<string, string> = {
  "1": "第1種（卸売業）90%",
  "2": "第2種（小売業・農業林業漁業〈飲食料品〉）80%",
  "3": "第3種（製造業・建設業・農林漁業その他）70%",
  "4": "第4種（飲食店業等・その他）60%",
  "5": "第5種（サービス業・IT・金融・運輸通信）50%",
  "6": "第6種（不動産業）40%",
};
