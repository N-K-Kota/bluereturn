import { SIMPLIFIED_TAX_RATES } from "./constants";
import { assertAmount } from "../validation";
import type { ConsumptionTaxResult, ConsumptionTaxType } from "@/types/tax";

export const CONSUMPTION_TAX_LABELS: Record<ConsumptionTaxType, string> = {
  exempt: "免税", general: "一般課税", simplified: "簡易課税", two_tenth: "2割特例",
};

// 標準税率10%の割戻し計算。国税7.8%と地方税2.2%を分ける。
// https://www.nta.go.jp/taxes/shiraberu/taxanswer/shohi/6351.htm
// 課税標準は千円未満、納付税額は百円未満を切捨て。還付は円単位。
function result(type: ConsumptionTaxType, sales: number, outputTax: number, inputTax: number): ConsumptionTaxResult {
  const balance = outputTax - inputTax;
  const national = balance >= 0 ? Math.floor(balance / 100) * 100 : balance;
  const local = national >= 0
    ? Math.floor(national * 22 / 78 / 100) * 100
    : -Math.floor(-national * 22 / 78);
  return {
    type, taxable_sales: sales, output_tax: outputTax, input_tax: inputTax,
    consumption_tax_due: national, local_consumption_tax_due: local, total_due: national + local,
  };
}

function outputTax(exclusiveSales: number): number {
  return Math.floor(exclusiveSales / 1000) * 78;
}

// 一般課税・2割特例は税抜入力。軽減税率・控除割合調整・中間納付は対象外。
export function calcGeneralConsumptionTax(sales: number, purchases: number): ConsumptionTaxResult {
  assertAmount(sales); assertAmount(purchases);
  return result("general", sales, outputTax(sales), Math.floor(purchases * 78 / 1000));
}

// 簡易課税は既存画面・保存データと同じ税込入力（単一事業区分）。
export function calcSimplifiedConsumptionTax(sales: number, industry: string): ConsumptionTaxResult {
  assertAmount(sales);
  const rate = SIMPLIFIED_TAX_RATES[industry];
  if (rate === undefined) throw new Error("簡易課税の事業区分が正しくありません");
  const output = outputTax(sales * 100 / 110);
  return result("simplified", sales, output, Math.floor(output * Math.round(rate * 100) / 100));
}

export function calcTwoTenthSpecialTax(sales: number): ConsumptionTaxResult {
  assertAmount(sales);
  const output = outputTax(sales);
  return result("two_tenth", sales, output, Math.floor(output * 80 / 100));
}

export function calcConsumptionTax(type: ConsumptionTaxType, sales: number, purchases: number, industry: string): ConsumptionTaxResult | undefined {
  switch (type) {
    case "exempt": return undefined;
    case "general": return calcGeneralConsumptionTax(sales, purchases);
    case "two_tenth": return calcTwoTenthSpecialTax(sales);
    case "simplified": return calcSimplifiedConsumptionTax(sales, industry);
    default: throw new Error("消費税の課税方式が正しくありません");
  }
}
