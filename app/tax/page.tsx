"use client";

import { useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getTaxProfile, getTaxReturn, upsertTaxReturn } from "@/lib/db/tax";
import { getPLReport } from "@/lib/db/reports";
import { businessIncomeFromReport, calculateReturn } from "@/lib/tax/compute";
import { emptyTaxReturn } from "@/lib/tax/validation";
import { errorMessage } from "@/lib/validation";
import type { PLReport } from "@/types";
import { TaxScope } from "@/components/tax/TaxScope";
import type { TaxProfile, TaxCalculationResult, FiscalYear } from "@/types/tax";
import { ChevronRight, ChevronLeft, FileText, Printer, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const YEAR_RANGE: Record<FiscalYear, { from: string; to: string }> = {
  "2024": { from: "2024-01-01", to: "2024-12-31" },
  "2025": { from: "2025-01-01", to: "2025-12-31" },
};

function fmt(n: number) {
  return n.toLocaleString("ja-JP");
}

function NumField({
  label,
  value,
  onChange,
  suffix = "円",
  hint,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
  hint?: string;
}) {
  const id = useId();
  return (
    <div>
      <Label htmlFor={id} className="text-xs mb-1 block">{label}</Label>
      {hint && <p id={`${id}-hint`} className="text-xs text-muted-foreground mb-1">{hint}</p>}
      <div className="flex items-center gap-1.5">
        <Input
          id={id}
          aria-describedby={hint ? `${id}-hint` : undefined}
          type="number"
          step={1}
          min={0}
          value={value || ""}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
          className="w-44 text-right"
          placeholder="0"
        />
        <span className="text-sm text-muted-foreground">{suffix}</span>
      </div>
    </div>
  );
}

const STEPS = ["年度・事業所得", "給与・雑所得", "所得控除", "消費税", "計算結果"];

export default function TaxWizardPage() {
  const [year, setYear] = useState<FiscalYear>("2025");
  return <TaxWizard key={year} year={year} onYearChange={setYear} />;
}

function TaxWizard({ year, onYearChange }: { year: FiscalYear; onYearChange: (year: FiscalYear) => void }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState<TaxProfile | null>(null);

  const [pl, setPl] = useState<PLReport | null>(null);
  const [form, setForm] = useState(() => emptyTaxReturn(year, 0));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<TaxCalculationResult | null>(null);
  const plLoaded = pl !== null;
  const business = pl ? businessIncomeFromReport(pl) : { revenue: 0, cost: 0, expenses: 0 };
  const businessRevenue = business.revenue;
  const businessCost = business.cost;
  const businessExpenses = business.expenses;
  const hasSpouse = form.spouse_income >= 0;

  function updateField<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((previous) => ({ ...previous, [key]: value }));
    setResult(null);
  }

  useEffect(() => {
    let active = true;
    const range = YEAR_RANGE[year];
    Promise.all([getTaxProfile(year), getTaxReturn(year), getPLReport(range.from, range.to)])
      .then(([profile, taxReturn, report]) => {
        if (!active) return;
        setProfile(profile);
        setForm(taxReturn ?? emptyTaxReturn(year, profile?.id ?? 0));
        setPl(report);
      }).catch((error) => { if (active) setError(errorMessage(error)); });
    return () => { active = false; };
  }, [year]);

  async function handleCalculate() {
    if (!profile || !pl || saving) return;
    setSaving(true);
    setError("");
    try {
      const calculation = calculateReturn(profile, form, pl);
      await upsertTaxReturn(form);
      setResult(calculation);
      setStep(effectiveSteps.length - 1);
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  const isExempt = !profile || profile.consumption_tax_type === "exempt";
  const effectiveSteps = isExempt ? STEPS.filter((_, i) => i !== 3) : STEPS;

  function next() {
    if (step < effectiveSteps.length - 2) setStep((s) => s + 1);
    else handleCalculate();
  }
  function back() { setStep((s) => Math.max(0, s - 1)); }

  return (
    <div className="p-6 max-w-2xl">
      <h2 className="text-xl font-semibold mb-4">確定申告の計算</h2>
      <TaxScope />
      {error && <p role="alert" className="text-sm text-destructive mb-4">{error}</p>}

      {/* Step indicator */}
      <div className="flex items-center gap-1 mb-8 flex-wrap">
        {effectiveSteps.map((label, i) => (
          <div key={i} className="flex items-center gap-1">
            <div className={cn(
              "flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium shrink-0",
              i === step ? "bg-primary text-primary-foreground"
                : i < step ? "bg-primary/20 text-primary"
                : "bg-muted text-muted-foreground"
            )}>{i + 1}</div>
            <span className={cn("text-xs hidden sm:block",
              i === step ? "text-foreground font-medium" : "text-muted-foreground"
            )}>{label}</span>
            {i < effectiveSteps.length - 1 && (
              <ChevronRight size={12} className="text-muted-foreground mx-0.5" />
            )}
          </div>
        ))}
      </div>

      <div className="min-h-[320px]">

        {/* ── Step 0: Year & Business Income ── */}
        {step === 0 && (
          <div className="space-y-5">
            <div>
              <Label className="text-xs mb-1 block">対象年度</Label>
              <Select value={year} onValueChange={(v) => onYearChange((v ?? "2025") as FiscalYear)}>
                <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="2025">令和7年分（2025年）</SelectItem>
                  <SelectItem value="2024">令和6年分（2024年）</SelectItem>
                </SelectContent>
              </Select>
              {!profile && (
                <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                  <AlertCircle size={12} />
                  設定画面で納税者情報を先に登録してください
                </p>
              )}
            </div>

            <div className="border rounded-md p-4 bg-muted/30">
              <p className="text-sm font-medium mb-3">事業所得（帳簿から自動取得）</p>
              {!plLoaded ? (
                <p className="text-sm text-muted-foreground">読み込み中...</p>
              ) : (
                <div className="space-y-1.5 text-sm">
                  <Row2 label="事業収入（雑収入を含む）" value={businessRevenue} />
                  <Row2 label="売上原価" value={businessCost} neg />
                  <Row2 label="経費合計" value={businessExpenses} neg />
                  <Row2 label="差引所得（控除前）"
                    value={businessRevenue - businessCost - businessExpenses} bold />
                  <p className="text-xs text-primary">
                    ▲ 青色申告特別控除 {fmt(parseInt(profile?.blue_deduction ?? "650000"))} 円
                  </p>
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              ※ 帳簿の仕訳から自動計算されます。数値を変更する場合は仕訳帳を修正してください。
            </p>
          </div>
        )}

        {/* ── Step 1: Salary & Misc ── */}
        {step === 1 && (
          <div className="space-y-5">
            <div>
              <h3 className="font-medium text-sm mb-3">給与所得</h3>
              <div className="grid grid-cols-2 gap-4">
                <NumField label="給与収入合計" value={form.salary_income} onChange={(value) => updateField("salary_income", value)}
                  hint="源泉徴収票の「支払金額」" />
                <NumField label="源泉徴収税額" value={form.salary_withheld} onChange={(value) => updateField("salary_withheld", value)}
                  hint="源泉徴収票の「源泉徴収税額」（復興特別所得税を含む）" />
              </div>
              {form.salary_income === 0 && (
                <p className="text-xs text-muted-foreground mt-1">給与所得がない場合は 0 のままで構いません。</p>
              )}
            </div>
            <NumField label="事業・雑所得の源泉徴収税額" value={form.business_withheld ?? 0}
              onChange={(v) => updateField("business_withheld", v)} hint="支払調書などで確認した、給与以外の源泉徴収税額合計" />
            <NumField label="予定納税額（第1期・第2期）" value={form.prepaid_tax ?? 0}
              onChange={(v) => updateField("prepaid_tax", v)} />
            {year === "2024" && <NumField label="定額減税の対象人数（本人を含む）" value={form.fixed_tax_reduction_people ?? 0}
              onChange={(v) => updateField("fixed_tax_reduction_people", v)} suffix="人"
              hint="居住者である本人と、国内居住・所得48万円以下等の要件を満たす同一生計配偶者・扶養親族（16歳未満を含む）。対象外は0人。本人所得1,805万円超は自動除外。" />}
            <div className="border-t pt-4">
              <h3 className="font-medium text-sm mb-3">雑所得</h3>
              <div className="grid grid-cols-2 gap-4">
                <NumField label="雑収入" value={form.misc_income} onChange={(value) => updateField("misc_income", value)} />
                <NumField label="雑所得の必要経費" value={form.misc_expenses} onChange={(value) => updateField("misc_expenses", value)} />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                ※ 雑所得は他の所得と損益通算できません。赤字でもゼロとして計算されます。
              </p>
            </div>
          </div>
        )}

        {/* ── Step 2: Deductions ── */}
        {step === 2 && (
          <div className="space-y-4">
            <h3 className="font-medium text-sm">所得控除</h3>
            <NumField label="社会保険料控除" value={form.social_insurance} onChange={(value) => updateField("social_insurance", value)}
              hint="国民健康保険料・国民年金保険料・介護保険料の年間合計" />

            <div className="border-t pt-3">
              <p className="text-xs font-medium mb-2">生命保険料控除（所得税法第76条）</p>
              <p className="text-xs text-muted-foreground mb-2">
                新契約＝平成24年1月1日以降に締結した契約（各区分上限4万円、合計上限12万円）
              </p>
              <div className="grid grid-cols-2 gap-3">
                <NumField label="一般生命保険料（新契約）" value={form.life_insurance_new} onChange={(value) => updateField("life_insurance_new", value)} />
                <NumField label="一般生命保険料（旧契約）" value={form.life_insurance_old} onChange={(value) => updateField("life_insurance_old", value)} />
                <NumField label="介護医療保険料（新契約のみ）" value={form.care_insurance_new} onChange={(value) => updateField("care_insurance_new", value)}
                  hint="医療保険・がん保険等。新契約のみ対象" />
                <div /> {/* spacer */}
                <NumField label="個人年金保険料（新契約）" value={form.pension_insurance_new} onChange={(value) => updateField("pension_insurance_new", value)} />
                <NumField label="個人年金保険料（旧契約）" value={form.pension_insurance_old} onChange={(value) => updateField("pension_insurance_old", value)} />
              </div>
            </div>

            <div className="border-t pt-3">
              <p className="text-xs font-medium mb-2">地震保険料控除</p>
              <div className="grid grid-cols-2 gap-3">
                <NumField label="地震保険料" value={form.earthquake_insurance} onChange={(value) => updateField("earthquake_insurance", value)} />
                <NumField label="旧長期損害保険料" value={form.long_term_earthquake} onChange={(value) => updateField("long_term_earthquake", value)} />
              </div>
            </div>

            <NumField label="医療費（保険補填後の自己負担合計）" value={form.medical_expenses} onChange={(value) => updateField("medical_expenses", value)}
              hint="受け取った保険金・高額療養費を差し引いた後の実質負担額" />

            <div className="border-t pt-3 grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs mb-1 block">障害者控除</Label>
                <Select value={String(form.disabled_type)} onValueChange={(v) => updateField("disabled_type", Number(v ?? "0"))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">なし</SelectItem>
                    <SelectItem value="1">一般障害者（27万円）</SelectItem>
                    <SelectItem value="2">特別障害者（40万円）</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs mb-1 block">ひとり親・寡婦控除</Label>
                <Select value={String(form.widow_type)} onValueChange={(v) => updateField("widow_type", Number(v ?? "0"))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">なし</SelectItem>
                    <SelectItem value="1">ひとり親（35万円）※合計所得500万円以下</SelectItem>
                    <SelectItem value="2">寡婦（27万円）※合計所得500万円以下</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs mb-1 block">勤労学生控除</Label>
                <Select value={String(form.working_student)} onValueChange={(v) => updateField("working_student", Number(v ?? "0"))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">なし</SelectItem>
                    <SelectItem value="1">あり（27万円・学校要件と勤労以外の所得10万円以下を確認済み）</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="border-t pt-3">
              <div className="flex items-center gap-2 mb-2">
                <input type="checkbox" id="hasSpouse" checked={hasSpouse}
                  onChange={(e) => updateField("spouse_income", e.target.checked ? 0 : -1)} className="h-4 w-4" />
                <Label htmlFor="hasSpouse" className="text-xs cursor-pointer">配偶者あり</Label>
              </div>
              {hasSpouse && (
                <NumField label="配偶者の合計所得金額"
                  value={form.spouse_income} onChange={(value) => updateField("spouse_income", value)}
                  hint="給与収入のみなら源泉徴収票「給与所得控除後の金額」を入力" />
              )}
            </div>

            <div className="border-t pt-3">
              <p className="text-xs font-medium mb-2">扶養控除（年齢は申告年12月31日時点）</p>
              <p className="text-xs text-muted-foreground mb-2">生計・専従者等の要件を満たし、合計所得が{year === "2025" ? "58" : "48"}万円以下の親族を入力してください。</p>
              <div className="grid grid-cols-2 gap-3">
                <NumField label="一般扶養（16〜18歳・23〜69歳）38万円/人"
                  value={form.dependent_general} onChange={(value) => updateField("dependent_general", value)} suffix="人" />
                <NumField label="特定扶養（19〜22歳）63万円/人"
                  value={form.dependent_specific} onChange={(value) => updateField("dependent_specific", value)} suffix="人" />
                <NumField label="老人扶養・同居老親等（70歳以上）58万円/人"
                  value={form.dependent_elderly_parent} onChange={(value) => updateField("dependent_elderly_parent", value)} suffix="人" />
                <NumField label="老人扶養・その他（70歳以上）48万円/人"
                  value={form.dependent_elderly_other} onChange={(value) => updateField("dependent_elderly_other", value)} suffix="人" />
              </div>
            </div>
          </div>
        )}

        {/* ── Step 3: Consumption Tax (課税事業者のみ) ── */}
        {step === 3 && !isExempt && (
          <div className="space-y-5">
            <h3 className="font-medium text-sm">消費税</h3>
            <div className="border rounded-md p-3 bg-muted/30 text-sm space-y-1">
              <p className="font-medium">
                課税方式：{
                  profile?.consumption_tax_type === "general"   ? "一般課税" :
                  profile?.consumption_tax_type === "two_tenth" ? "2割特例（令和5〜8年）" :
                  "簡易課税"
                }
              </p>
              {profile?.consumption_tax_type === "two_tenth" && (
                <p className="text-xs text-muted-foreground">
                  売上消費税の20%のみ納付（インボイス制度移行事業者向け特例）。
                  適用要件を満たす個人事業者の令和6・7年分を計算します。
                </p>
              )}
            </div>

            {profile?.consumption_tax_type === "general" ? (
              <div className="space-y-4">
                <NumField label="課税売上高（税抜）" value={form.taxable_sales}
                  onChange={(value) => updateField("taxable_sales", value)}
                  hint="消費税抜きの金額を入力してください（税込合計÷1.1）" />
                <NumField label="課税仕入高（税抜）" value={form.taxable_purchases}
                  onChange={(value) => updateField("taxable_purchases", value)}
                  hint="インボイス保存済みの仕入・経費の税抜合計。令和5〜8年は経過措置あり" />
              </div>
            ) : profile?.consumption_tax_type === "two_tenth" ? (
              <NumField label="課税売上高（税抜）" value={form.taxable_sales}
                onChange={(value) => updateField("taxable_sales", value)}
                hint="消費税抜きの金額を入力してください（税込合計÷1.1）" />
            ) : (
              <NumField label="課税売上高（税込）" value={form.taxable_sales}
                onChange={(value) => updateField("taxable_sales", value)}
                hint="簡易課税は税込売上高を使います。帳簿の売上高がそのまま使えます" />
            )}
          </div>
        )}

        {/* ── Final Step: Result ── */}
        {step === effectiveSteps.length - 1 && result && (
          <div className="space-y-4">
            <div className="border rounded-md divide-y text-sm">
              <Section title="事業所得の計算">
                <Row label="事業収入（雑収入を含む）" value={result.business_revenue} />
                <Row label="売上原価" value={result.business_cost} neg />
                <Row label="経費合計" value={result.business_expenses} neg />
                <Row label="青色申告特別控除" value={result.blue_deduction_amount} neg />
                <Row label="事業所得" value={result.business_income} bold />
              </Section>

              {result.salary_income_gross > 0 && (
                <Section title="給与所得">
                  <Row label="給与収入" value={result.salary_income_gross} />
                  <Row label="給与所得控除" value={result.salary_deduction} neg />
                  <Row label="給与所得" value={result.salary_income_net} bold />
                </Section>
              )}

              {result.misc_income_net > 0 && (
                <Section title="雑所得">
                  <Row label="雑所得（純額）" value={result.misc_income_net} bold />
                </Section>
              )}

              <Section title="合計所得">
                <Row label="合計所得金額" value={result.total_income} bold />
              </Section>

              <Section title="所得控除">
                <Row label="基礎控除" value={result.basic_deduction} />
                <Row label="社会保険料控除" value={result.social_insurance_deduction} />
                {result.life_insurance_deduction > 0 &&
                  <Row label="生命保険料控除" value={result.life_insurance_deduction} />}
                {result.earthquake_deduction > 0 &&
                  <Row label="地震保険料控除" value={result.earthquake_deduction} />}
                {result.medical_deduction > 0 &&
                  <Row label="医療費控除" value={result.medical_deduction} />}
                {result.disability_deduction > 0 &&
                  <Row label="障害者控除" value={result.disability_deduction} />}
                {result.widow_deduction > 0 &&
                  <Row label="ひとり親・寡婦控除" value={result.widow_deduction} />}
                {result.working_student_deduction > 0 &&
                  <Row label="勤労学生控除" value={result.working_student_deduction} />}
                {result.spouse_deduction > 0 &&
                  <Row label="配偶者（特別）控除" value={result.spouse_deduction} />}
                {result.dependent_deduction > 0 &&
                  <Row label="扶養控除" value={result.dependent_deduction} />}
                <Row label="所得控除合計" value={result.total_deduction} bold />
              </Section>

              <Section title="税額">
                <Row label="課税所得" value={result.taxable_income} />
                <Row label="所得税額（減税前）" value={result.income_tax_before_reduction} />
                {result.fixed_tax_reduction > 0 && <Row label="定額減税" value={result.fixed_tax_reduction} neg />}
                <Row label="基準所得税額" value={result.income_tax} />
                <Row label="予定納税額" value={result.prepaid_tax} neg />
                <Row label="復興特別所得税（2.1%）" value={result.reconstruction_tax} />
                <Row label="源泉徴収税額" value={result.withheld_tax} neg />
                <Row
                  label={result.tax_due >= 0 ? "納付税額" : "還付税額"}
                  value={Math.abs(result.tax_due)}
                  bold
                  className={result.tax_due < 0 ? "text-blue-600" : "text-red-600"}
                />
              </Section>

              {result.consumption_tax_result && (
                <Section title={`消費税（${
                  result.consumption_tax_result.type === "general"   ? "一般課税" :
                  result.consumption_tax_result.type === "two_tenth" ? "2割特例" :
                  "簡易課税"
                }）`}>
                  <Row label="売上消費税" value={result.consumption_tax_result.output_tax} />
                  <Row label="仕入控除消費税" value={result.consumption_tax_result.input_tax} neg />
                  <Row label="消費税額" value={result.consumption_tax_result.consumption_tax_due} />
                  <Row label="地方消費税" value={result.consumption_tax_result.local_consumption_tax_due} />
                  <Row label="消費税・地方消費税合計（マイナスは還付）" value={result.consumption_tax_result.total_due} bold />
                </Section>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" size="sm"
                onClick={() => router.push(`/tax/print?year=${year}`)} className="gap-1.5">
                <Printer size={14} />帳票を印刷
              </Button>
              <Button size="sm"
                onClick={() => router.push(`/tax/guide?year=${year}`)} className="gap-1.5">
                <FileText size={14} />e-Tax入力ガイド
              </Button>
            </div>
          </div>
        )}

        {step === effectiveSteps.length - 1 && !result && (
          <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
            計算結果がありません
          </div>
        )}
      </div>

      {/* Navigation */}
        <div className="flex justify-between mt-8 pt-4 border-t">
          <Button variant="outline" size="sm" onClick={back} disabled={step === 0 || saving} className="gap-1">
            <ChevronLeft size={14} />戻る
          </Button>
          {step < effectiveSteps.length - 1 && <Button size="sm" onClick={next} disabled={!plLoaded || !profile || saving} className="gap-1">
            {saving ? "保存中..." : step === effectiveSteps.length - 2 ? "計算して保存" : "次へ"}
            <ChevronRight size={14} />
          </Button>}
        </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="p-3">
      <p className="text-xs font-medium text-muted-foreground mb-2">{title}</p>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function Row({ label, value, neg, bold, className }: {
  label: string; value: number; neg?: boolean; bold?: boolean; className?: string;
}) {
  return (
    <div className={cn("flex justify-between text-sm", bold && "font-semibold border-t pt-1 mt-1")}>
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("font-mono", className)}>
        {neg ? "▲ " : ""}{value.toLocaleString("ja-JP")} 円
      </span>
    </div>
  );
}

function Row2({ label, value, neg, bold }: {
  label: string; value: number; neg?: boolean; bold?: boolean;
}) {
  return (
    <div className={cn("flex justify-between", bold && "font-medium border-t pt-1.5 mt-1")}>
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono text-sm">{neg ? "▲ " : ""}{fmt(value)} 円</span>
    </div>
  );
}
