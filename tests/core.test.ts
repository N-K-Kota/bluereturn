import test from "node:test";
import assert from "node:assert/strict";
import { calcBasicDeduction, calcLifeInsuranceTotalDeduction, calcAllDeductions } from "@/lib/tax/deductions";
import { calcSalaryIncome } from "@/lib/tax/income";
import { calcMedicalDeduction, calcLifeInsuranceNewDeduction } from "@/lib/tax/constants";
import { calcTax } from "@/lib/tax/tax";
import { emptyTaxReturn, parseFiscalYear } from "@/lib/tax/validation";
import { calcGeneralConsumptionTax, calcSimplifiedConsumptionTax, calcTwoTenthSpecialTax } from "@/lib/tax/consumption";
import { buildPLReport, buildBSReport, type AccountBalance } from "@/lib/accounting/reports";
import { calculateReturn } from "@/lib/tax/compute";
import { parseCSVText, parseCsvBuffer, decodeCSV } from "@/lib/csv/parser";
import { matchRule } from "@/lib/csv/rules";
import { normalizeDate, validateJournalEntry } from "@/lib/validation";
import type { TaxProfile } from "@/types/tax";
import type { ImportRule } from "@/types";

const zeroBusiness = { revenue: 0, cost: 0, expenses: 0, blueDeduction: 0 };
const buffer = (value: string) => new TextEncoder().encode(value).buffer;

test("basic deduction switches by year, including every 2025 boundary", () => {
  for (const [income, deduction] of [[0,950000],[1320000,950000],[1320001,880000],[3360000,880000],[3360001,680000],[4890000,680000],[4890001,630000],[6550000,630000],[6550001,580000],[23500000,580000],[23500001,480000],[24000001,320000],[24500001,160000],[25000001,0]]) {
    assert.equal(calcBasicDeduction(income, "2025"), deduction, String(income));
  }
  assert.equal(calcBasicDeduction(1_320_000, "2024"), 480_000);
});

// Expected amounts from NTA's year-specific salary tables, not the deduction formula.
for (const [year, salary, income] of [
  ["2024",550999,0], ["2024",551000,1000], ["2024",1618999,1068999],
  ["2024",1619000,1069000], ["2024",1621999,1070000], ["2024",1623999,1072000],
  ["2024",1627999,1074000], ["2024",1628000,1076800], ["2024",1803999,1180000],
  ["2025",650999,0], ["2025",651000,1000], ["2025",1899999,1249999],
  ["2025",1903999,1250000], ["2025",1920500,1264000],
  ["2025",3603999,2440000], ["2025",6600001,4840000], ["2025",8500000,6550000],
] as const) {
  test(`salary table ${year}: ${salary} => ${income}`, () => assert.equal(calcSalaryIncome(salary, year).income, income));
}

test("mixed old/new life insurance never exceeds 120,000", () => {
  assert.equal(calcLifeInsuranceTotalDeduction(0, 150000, 100000, 0, 150000), 120000);
  assert.equal(calcLifeInsuranceNewDeduction(20001), 20001);
});
test("negative income does not create a medical deduction with no expenses", () => {
  assert.equal(calcMedicalDeduction(0, -1000000), 0);
  assert.equal(calcMedicalDeduction(150000, 1000000), 100000);
});
test("widow and student income limits are enforced", () => {
  const tr = { ...emptyTaxReturn("2025", 1), widow_type: 2, working_student: 1 };
  assert.equal(calcAllDeductions(tr, 5000001).widowDeduction, 0);
  assert.equal(calcAllDeductions(tr, 850001).workingStudentDeduction, 0);
  assert.equal(calcAllDeductions(tr, 850000).workingStudentDeduction, 270000);
  assert.equal(calcAllDeductions({ ...tr, fiscal_year: "2024" }, 750001).workingStudentDeduction, 0);
});
test("2024 fixed reduction applies before reconstruction tax and only in the eligible year", () => {
  const input = { ...zeroBusiness, revenue: 2000000 };
  const tr = { ...emptyTaxReturn("2024", 1), fixed_tax_reduction_people: 2 };
  const result = calcTax("2024", input, tr);
  assert.equal(result.income_tax_before_reduction, 76000);
  assert.equal(result.fixed_tax_reduction, 60000);
  assert.equal(result.reconstruction_tax, 336);
  assert.equal(result.tax_due, 16300);
  assert.equal(calcTax("2025", input, { ...tr, fiscal_year: "2025" }).fixed_tax_reduction, 0);
  assert.equal(calcTax("2024", { ...input, revenue: 18050001 }, tr).fixed_tax_reduction, 0);
});
test("taxable income, payments and refunds use their own rounding rules", () => {
  const tr = { ...emptyTaxReturn("2025", 1), business_withheld: 12345, prepaid_tax: 10000 };
  const r = calcTax("2025", { ...zeroBusiness, revenue: 2000999 }, tr);
  assert.equal(r.taxable_income, 1120000);
  assert.equal(r.total_tax, 57176);
  assert.equal(r.tax_due, 34800);
  assert.equal(calcTax("2025", zeroBusiness, tr).tax_due, -22345);
});
test("invalid years and negative/nonfinite/fractional inputs are rejected", () => {
  assert.throws(() => parseFiscalYear("2026"));
  for (const amount of [-1, 1.5, NaN, Infinity]) {
    assert.throws(() => calcTax("2025", zeroBusiness, { ...emptyTaxReturn("2025", 1), salary_income: amount }));
  }
  assert.throws(() => calcTax("2024", zeroBusiness, emptyTaxReturn("2025", 1)));
});
test("consumption tax splits national and local without double charging", () => {
  const general = calcGeneralConsumptionTax(1000000, 400000);
  assert.equal(general.output_tax, 78000);
  assert.equal(general.input_tax, 31200);
  assert.equal(general.consumption_tax_due, 46800);
  assert.equal(general.local_consumption_tax_due, 13200);
  assert.equal(general.total_due, 60000);
  assert.equal(calcSimplifiedConsumptionTax(1100000, "5").total_due, 50000);
  assert.equal(calcTwoTenthSpecialTax(1000000).total_due, 20000);
});
test("zero sales stays zero and general consumption refunds are preserved", () => {
  assert.equal(calcGeneralConsumptionTax(0, 1000000).total_due, -100000);
  assert.equal(calcTwoTenthSpecialTax(999).total_due, 0);
  assert.throws(() => calcSimplifiedConsumptionTax(1000000, "invalid"));
});

function balance(id: number, type: string, subtype: string, debit: number, credit: number): AccountBalance {
  return { account_id: id, account_name: type, account_code: String(id), account_type: type, account_subtype: subtype, total_debit: debit, total_credit: credit };
}
const balances = [balance(1,"asset","current_asset",1400000,0), balance(2,"revenue","revenue",0,1600000), balance(3,"revenue","other_income",0,100000), balance(4,"expense","selling_expense",200000,0), balance(5,"expense","other_expense",100000,0)];
test("P&L, business income and BS include other income and prior unclosed profit", () => {
  const pl = buildPLReport(balances);
  assert.equal(pl.net_profit, 1400000);
  const bs = buildBSReport(balances, 400000);
  assert.equal(bs.total_assets, bs.total_liabilities + bs.total_equity);
  assert.equal(bs.equity.find((item) => item.account_id === -2)?.amount, 1000000);
  const profile: TaxProfile = { id: 1, fiscal_year: "2025", name: "", name_kana: "", address: "", address_kana: "", birthday: "", phone: "", business_type: "", my_number: "", consumption_tax_type: "general", simplified_tax_industry: "5", blue_deduction: "650000" };
  const result = calculateReturn(profile, emptyTaxReturn("2025", 1), pl);
  assert.equal(result.business_income_before_blue, pl.net_profit);
  assert.equal(result.business_income, 750000);
  assert.equal(result.consumption_tax_result?.total_due, 0);
  assert.throws(() => calculateReturn(profile, emptyTaxReturn("2024", 1), pl));
});
test("closed previous income is not added to equity twice", () => {
  const bs = buildBSReport([balance(1,"asset","current_asset",100000,0), balance(2,"equity","equity",0,100000)], 0);
  assert.equal(bs.total_equity, 100000);
  assert.equal(bs.equity.length, 1);
});
test("CSV supports quoted newlines, escaped quotes and BOM", () => {
  assert.deepEqual(parseCSVText('\uFEFFdate,description\r\n2025/1/2,"one\r\n""two"""\r\n'), [["date","description"],["2025/1/2",'one\n"two"']]);
  assert.throws(() => parseCSVText('a,"unterminated'));
  assert.throws(() => parseCSVText('a,"closed"bad'));
  assert.equal(decodeCSV(new Uint8Array([0x93,0xfa,0x95,0x74]).buffer), "日付");
});
test("Mizuho preamble/date normalization and card refunds", async () => {
  const mizuho = await parseCsvBuffer(buffer('口座情報\n明細通番,日付,お引出金額,お預入金額,残高,お取引内容\n1,2025/1/2,"1,000",0,9000,通信費'), []);
  assert.equal(mizuho.format?.id, "mizuho");
  assert.equal(mizuho.transactions[0].date, "2025-01-02");
  assert.equal(mizuho.transactions[0].amount, 1000);
  const card = await parseCsvBuffer(buffer('利用日,利用店名・商品名,利用金額\n20250102,返品,-500'), []);
  assert.equal(card.transactions[0].type, "credit");
  assert.equal(card.transactions[0].amount, 500);
});
test("empty/unsupported/malformed CSV fails visibly", async () => {
  for (const csv of ['', 'a,b\n1,2', '利用日,利用店名・商品名,利用金額\n2025/2/30,店,100', '利用日,利用店名・商品名,利用金額\n2025/2/28,店,100abc']) {
    await assert.rejects(parseCsvBuffer(buffer(csv), []));
  }
});
test("rule matching respects direction and prefers specific keywords", () => {
  const rules: ImportRule[] = [
    { id: 1, keyword: "shop", account_id: 1, entry_type: "debit" },
    { id: 2, keyword: "shop rent", account_id: 2, entry_type: "debit" },
    { id: 3, keyword: "shop", account_id: 3, entry_type: "credit" },
  ];
  assert.equal(matchRule("SHOP RENT", rules, "debit")?.account_id, 2);
  assert.equal(matchRule("SHOP RENT", rules, "credit")?.account_id, 3);
  assert.equal(matchRule("unknown", rules, "debit"), null);
});
test("journal validation catches empty, unbalanced, invalid dates and dual-sided lines", () => {
  const entry = { date: "2024-02-29", description: "", lines: [
    { account_id: 1, debit_amount: 100, credit_amount: 0, description: "" },
    { account_id: 2, debit_amount: 0, credit_amount: 100, description: "" },
  ] };
  validateJournalEntry(entry);
  assert.throws(() => validateJournalEntry({ ...entry, lines: [] }));
  assert.throws(() => validateJournalEntry({ ...entry, date: "2025-02-29" }));
  assert.throws(() => validateJournalEntry({ ...entry, lines: [entry.lines[0], { ...entry.lines[1], debit_amount: 50 }] }));
  assert.throws(() => validateJournalEntry({ ...entry, lines: [entry.lines[0], { ...entry.lines[1], credit_amount: 99 }] }));
  assert.equal(normalizeDate("2025/1/2"), "2025-01-02");
});
