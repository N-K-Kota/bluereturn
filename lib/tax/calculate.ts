import { calculateReturn } from "./compute";
import { parseFiscalYear } from "./validation";
import { getTaxProfile, getTaxReturn } from "@/lib/db/tax";
import { getPLReport } from "@/lib/db/reports";
import type { FiscalYear, TaxCalculationResult, TaxProfile } from "@/types/tax";

const YEAR_RANGE: Record<FiscalYear, { from: string; to: string }> = {
  "2024": { from: "2024-01-01", to: "2024-12-31" },
  "2025": { from: "2025-01-01", to: "2025-12-31" },
};

export interface FullTaxResult {
  profile: TaxProfile;
  result: TaxCalculationResult;
}

export async function loadAndCalculate(year: FiscalYear): Promise<FullTaxResult | null> {
  parseFiscalYear(year);
  const profile = await getTaxProfile(year);
  if (!profile) return null;

  const tr = await getTaxReturn(year);
  if (!tr) return null;

  const range = YEAR_RANGE[year];
  const pl = await getPLReport(range.from, range.to);

  return { profile, result: calculateReturn(profile, tr, pl) };
}
