import { validateTaxReturn, parseFiscalYear } from "@/lib/tax/validation";
import { getDb } from "./index";
import type { TaxProfile, TaxReturn, FiscalYear } from "@/types/tax";

// DBの生の行（consumption_tax_typeのCHECK制約が'exempt'|'general'|'simplified'のみ）
interface TaxProfileRow extends Omit<TaxProfile, "consumption_tax_type"> {
  consumption_tax_type: string;
  consumption_tax_two_tenth: number; // 1=2割特例
}

function rowToProfile(row: TaxProfileRow): TaxProfile {
  return {
    ...row,
    consumption_tax_type:
      row.consumption_tax_two_tenth === 1
        ? "two_tenth"
        : (row.consumption_tax_type as TaxProfile["consumption_tax_type"]),
  };
}

export async function getTaxProfile(year: FiscalYear): Promise<TaxProfile | null> {
  parseFiscalYear(year);
  const db = await getDb();
  const rows = await db.select<TaxProfileRow[]>(
    "SELECT *, COALESCE(consumption_tax_two_tenth, 0) as consumption_tax_two_tenth FROM tax_profiles WHERE fiscal_year = ?",
    [year]
  );
  return rows[0] ? rowToProfile(rows[0]) : null;
}

export async function upsertTaxProfile(data: Omit<TaxProfile, "id">): Promise<void> {
  parseFiscalYear(data.fiscal_year);
  if (!["exempt", "general", "simplified", "two_tenth"].includes(data.consumption_tax_type)
    || !["1", "2", "3", "4", "5", "6"].includes(data.simplified_tax_industry)
    || !["650000", "550000", "100000"].includes(data.blue_deduction)) {
    throw new Error("税務設定の選択が正しくありません");
  }
  const db = await getDb();
  // 2割特例は別フラグに分離（CHECK制約回避）
  const isTwoTenth = data.consumption_tax_type === "two_tenth";
  const dbType = isTwoTenth ? "general" : data.consumption_tax_type;

  await db.execute(
    `INSERT INTO tax_profiles
       (fiscal_year, name, name_kana, address, address_kana, birthday, phone,
        business_type, my_number, consumption_tax_type, simplified_tax_industry,
        blue_deduction, consumption_tax_two_tenth)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(fiscal_year) DO UPDATE SET
       name=excluded.name, name_kana=excluded.name_kana,
       address=excluded.address, address_kana=excluded.address_kana,
       birthday=excluded.birthday, phone=excluded.phone,
       business_type=excluded.business_type, my_number=excluded.my_number,
       consumption_tax_type=excluded.consumption_tax_type,
       simplified_tax_industry=excluded.simplified_tax_industry,
       blue_deduction=excluded.blue_deduction,
       consumption_tax_two_tenth=excluded.consumption_tax_two_tenth`,
    [
      data.fiscal_year, data.name, data.name_kana,
      data.address, data.address_kana, data.birthday, data.phone,
      data.business_type, data.my_number, dbType,
      data.simplified_tax_industry, data.blue_deduction,
      isTwoTenth ? 1 : 0,
    ]
  );
}

export async function getTaxReturn(year: FiscalYear): Promise<TaxReturn | null> {
  const db = await getDb();
  const rows = await db.select<TaxReturn[]>(
    "SELECT * FROM tax_returns WHERE fiscal_year = ?",
    [year]
  );
  return rows[0] ?? null;
}

export async function upsertTaxReturn(data: Omit<TaxReturn, "id">): Promise<void> {
  validateTaxReturn(data);
  const profile = await getTaxProfile(data.fiscal_year);
  if (!profile || profile.id !== data.profile_id) throw new Error("納税者情報と申告年度が一致しません");
  const db = await getDb();
  await db.execute(
    `INSERT INTO tax_returns
       (fiscal_year, profile_id, salary_income, salary_withheld,
        misc_income, misc_expenses, social_insurance,
        life_insurance_old, life_insurance_new, care_insurance_new,
        pension_insurance_old, pension_insurance_new,
        earthquake_insurance, long_term_earthquake,
        medical_expenses, disabled_type, widow_type, working_student,
        spouse_income, dependent_general, dependent_specific,
        dependent_elderly_parent, dependent_elderly_other,
        taxable_sales, taxable_purchases, fixed_tax_reduction_people, business_withheld, prepaid_tax)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(fiscal_year) DO UPDATE SET
       profile_id=excluded.profile_id,
       salary_income=excluded.salary_income, salary_withheld=excluded.salary_withheld,
       misc_income=excluded.misc_income, misc_expenses=excluded.misc_expenses,
       social_insurance=excluded.social_insurance,
       life_insurance_old=excluded.life_insurance_old, life_insurance_new=excluded.life_insurance_new,
       care_insurance_new=excluded.care_insurance_new,
       pension_insurance_old=excluded.pension_insurance_old, pension_insurance_new=excluded.pension_insurance_new,
       earthquake_insurance=excluded.earthquake_insurance, long_term_earthquake=excluded.long_term_earthquake,
       medical_expenses=excluded.medical_expenses,
       disabled_type=excluded.disabled_type, widow_type=excluded.widow_type,
       working_student=excluded.working_student, spouse_income=excluded.spouse_income,
       dependent_general=excluded.dependent_general, dependent_specific=excluded.dependent_specific,
       dependent_elderly_parent=excluded.dependent_elderly_parent,
       dependent_elderly_other=excluded.dependent_elderly_other,
       taxable_sales=excluded.taxable_sales,
       taxable_purchases=excluded.taxable_purchases,
       fixed_tax_reduction_people=excluded.fixed_tax_reduction_people,
       business_withheld=excluded.business_withheld, prepaid_tax=excluded.prepaid_tax`,
    [
      data.fiscal_year, data.profile_id,
      data.salary_income, data.salary_withheld,
      data.misc_income, data.misc_expenses,
      data.social_insurance,
      data.life_insurance_old, data.life_insurance_new, data.care_insurance_new ?? 0,
      data.pension_insurance_old, data.pension_insurance_new,
      data.earthquake_insurance, data.long_term_earthquake,
      data.medical_expenses,
      data.disabled_type, data.widow_type, data.working_student,
      data.spouse_income,
      data.dependent_general, data.dependent_specific,
      data.dependent_elderly_parent, data.dependent_elderly_other,
      data.taxable_sales, data.taxable_purchases ?? 0,
      data.fixed_tax_reduction_people ?? 0, data.business_withheld ?? 0, data.prepaid_tax ?? 0,
    ]
  );
}
