"use client";
import { useAsyncData } from "@/hooks/use-async-data";
import { LoadStatus } from "@/components/LoadStatus";
import { parseFiscalYear } from "@/lib/tax/validation";
import { TaxScope } from "@/components/tax/TaxScope";
import { CONSUMPTION_TAX_LABELS } from "@/lib/tax/consumption";

import { Suspense, useCallback, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { loadAndCalculate } from "@/lib/tax/calculate";
import type { FiscalYear } from "@/types/tax";
import { ArrowLeft, Copy, CheckCheck } from "lucide-react";
import Link from "next/link";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

function fmt(n: number) {
  return n.toLocaleString("ja-JP");
}

const YEAR_LABEL: Record<FiscalYear, string> = {
  "2024": "令和6年分",
  "2025": "令和7年分",
};

function CopyValue({ value }: { value: number }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
    await navigator.clipboard.writeText(String(Math.round(value)));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
    } catch { toast.add({ type: "error", title: "コピーできませんでした。金額を手動で入力してください。" }); }
  }

  return (
    <button
      onClick={handleCopy}
      className={cn(
        "inline-flex items-center gap-1.5 font-mono text-sm px-2 py-0.5 rounded border transition-colors",
        copied
          ? "bg-green-50 border-green-300 text-green-700"
          : "bg-background border-border hover:bg-muted"
      )}
    >
      {copied ? <CheckCheck size={12} /> : <Copy size={12} />}
      {fmt(value)} 円
    </button>
  );
}

function GuideStep({
  step,
  screen,
  children,
}: {
  step: number;
  screen: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border rounded-md mb-4">
      <div className="flex items-center gap-2 bg-muted/40 px-3 py-2 rounded-t-md border-b">
        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs font-medium shrink-0">
          {step}
        </span>
        <span className="text-sm font-medium">{screen}</span>
      </div>
      <div className="p-3 space-y-2.5 text-sm">{children}</div>
    </div>
  );
}

function Field({ label, value, note }: { label: string; value: number; note?: string }) {
  return (
    <div className="flex items-start gap-3 py-1">
      <div className="flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        {note && <p className="text-xs text-amber-600 mt-0.5">{note}</p>}
      </div>
      <CopyValue value={value} />
    </div>
  );
}

export default function GuidePage() {
  return <Suspense fallback={<p className="p-6">読み込み中...</p>}><GuideContent /></Suspense>;
}

function GuideContent() {
  const params = useSearchParams();
  const yearValue = params.get("year") ?? "2025";
  const loader = useCallback(async () => loadAndCalculate(parseFiscalYear(yearValue)), [yearValue]);
  const { data, loading, error, reload } = useAsyncData(loader);
  if (loading || error) return <div className="p-6"><LoadStatus loading={loading} error={error} retry={reload} /></div>;
  if (!data) return (
    <div className="p-6">
      <p className="text-sm text-muted-foreground mb-3">
        申告データがありません。先にウィザードで計算を完了させてください。
      </p>
      <Link href="/tax">
        <Button variant="outline" size="sm" className="gap-1.5">
          <ArrowLeft size={14} />ウィザードに戻る
        </Button>
      </Link>
    </div>
  );

  const { profile, result } = data;
  const year = result.fiscal_year;
  const yearLabel = YEAR_LABEL[year];
  const isExempt = profile.consumption_tax_type === "exempt";

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/tax">
          <Button variant="outline" size="sm" className="gap-1.5">
            <ArrowLeft size={14} />戻る
          </Button>
        </Link>
        <div>
          <h2 className="text-lg font-semibold">e-Tax 入力ガイド</h2>
          <p className="text-xs text-muted-foreground">
            {yearLabel} — 国税庁「確定申告書等作成コーナー」への入力値
          </p>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-md p-3 mb-5 text-xs text-amber-800">
        <strong>ご利用方法：</strong>
        各入力値の右にある数値をクリックするとクリップボードにコピーされます。
        e-Taxの入力フォームに貼り付けてご利用ください。
        <br />
        ※ 国税庁「<a
          href="https://www.keisan.nta.go.jp/"
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >確定申告書等作成コーナー</a>」で対象年度の決算書・所得税の申告を作成してください。
      </div>

      {/* Step 1: 個人情報 */}
      <TaxScope />
      <p className="text-xs text-muted-foreground mb-3">保存済み入力と現在の帳簿・設定から再計算しています。</p>
      <GuideStep step={1} screen="申告者の基本情報">
        <div className="space-y-1 text-sm">
          <InfoRow label="氏名（漢字）" value={profile.name} />
          <InfoRow label="氏名（フリガナ）" value={profile.name_kana} />
          <InfoRow label="住所" value={profile.address} />
          <InfoRow label="生年月日" value={profile.birthday} />
          <InfoRow label="職業・業種" value={profile.business_type} />
          <InfoRow label="電話番号" value={profile.phone} />
        </div>
      </GuideStep>

      {/* Step 2: 所得入力 */}
      <GuideStep step={2} screen="収入・所得の入力">
        <p className="text-xs text-muted-foreground">「事業所得」欄に入力します。</p>
        <Field
          label="事業の収入金額（雑収入を含む）"
          value={result.business_revenue}
        />
        <Field
          label="事業の必要経費（原価＋経費）"
          value={result.business_cost + result.business_expenses}
        />
        <Field
          label="青色申告特別控除額"
          value={result.blue_deduction_amount}
          note={`${parseInt(profile.blue_deduction) === 650000 ? "65万円控除（電子申告）" : parseInt(profile.blue_deduction) === 550000 ? "55万円控除（書面申告）" : "10万円控除"}`}
        />
        <Field
          label="事業所得の金額"
          value={result.business_income}
        />
        {result.salary_income_gross > 0 && (
          <>
            <div className="border-t pt-2 mt-2">
              <p className="text-xs text-muted-foreground mb-1.5">「給与所得」欄：</p>
              <Field label="給与の収入金額（源泉徴収票の「支払金額」）" value={result.salary_income_gross} />
              <Field label="給与所得の金額（控除後・自動計算）" value={result.salary_income_net} />
            </div>
          </>
        )}
        {result.misc_income_net > 0 && (
          <div className="border-t pt-2 mt-2">
            <p className="text-xs text-muted-foreground mb-1.5">「雑所得」欄：</p>
            <Field label="雑所得の金額" value={result.misc_income_net} />
          </div>
        )}
      </GuideStep>

      {/* Step 3: 所得控除 */}
      <GuideStep step={3} screen="所得控除の入力">
        <Field label="社会保険料控除" value={result.social_insurance_deduction} />
        {result.life_insurance_deduction > 0 && (
          <Field label="生命保険料控除" value={result.life_insurance_deduction} />
        )}
        {result.earthquake_deduction > 0 && (
          <Field label="地震保険料控除" value={result.earthquake_deduction} />
        )}
        {result.medical_deduction > 0 && (
          <Field label="医療費控除" value={result.medical_deduction} />
        )}
        {result.disability_deduction > 0 && (
          <Field label="障害者控除" value={result.disability_deduction} />
        )}
        {result.widow_deduction > 0 && (
          <Field label="ひとり親・寡婦控除" value={result.widow_deduction} />
        )}
        {result.working_student_deduction > 0 && (
          <Field label="勤労学生控除" value={result.working_student_deduction} />
        )}
        {result.spouse_deduction > 0 && (
          <Field label="配偶者（特別）控除" value={result.spouse_deduction} />
        )}
        {result.dependent_deduction > 0 && (
          <Field label="扶養控除" value={result.dependent_deduction} />
        )}
        <Field label="基礎控除" value={result.basic_deduction} note="対象年度と合計所得に応じて計算" />
      </GuideStep>

      {/* Step 4: 計算結果確認 */}
      <GuideStep step={4} screen="税額の確認">
        <Field label="課税される所得金額" value={result.taxable_income} />
        <Field label="所得税額（減税前）" value={result.income_tax_before_reduction} />
        <Field label="定額減税" value={result.fixed_tax_reduction} />
        <Field label="基準所得税額" value={result.income_tax} />
        <Field label="予定納税額" value={result.prepaid_tax} />
        <Field label="復興特別所得税額" value={result.reconstruction_tax} />
        <Field label="所得税・復興特別所得税の合計" value={result.total_tax} />
        {result.withheld_tax > 0 && (
          <Field
            label="源泉徴収税額（控除）"
            value={result.withheld_tax}
            note="給与・事業・雑所得の源泉徴収税額の合計"
          />
        )}
        <div className="border-t pt-2 mt-1">
          <Field
            label={result.tax_due >= 0 ? "納付する税額" : "還付される税額"}
            value={Math.abs(result.tax_due)}
            note={result.tax_due < 0 ? "還付申告 — 口座情報も忘れずに入力してください" : undefined}
          />
        </div>
      </GuideStep>

      {/* Step 5: 消費税（免税以外） */}
      {!isExempt && result.consumption_tax_result && (
        <GuideStep step={5} screen="消費税申告書の入力">
          <p className="text-xs text-muted-foreground mb-1">
            課税方式：{CONSUMPTION_TAX_LABELS[result.consumption_tax_result.type]}
          </p>
          <Field label={`課税売上高（${result.consumption_tax_result.type === "simplified" ? "税込" : "税抜"}）`} value={result.consumption_tax_result.taxable_sales} />
          <Field label="売上消費税額（国税）" value={result.consumption_tax_result.output_tax} />
          <Field label="仕入控除税額" value={result.consumption_tax_result.input_tax} />
          <Field label="消費税の納付税額" value={result.consumption_tax_result.consumption_tax_due} />
          <Field label="地方消費税の納付税額" value={result.consumption_tax_result.local_consumption_tax_due} />
          <div className="border-t pt-2 mt-1">
            <Field label="消費税・地方消費税の合計（マイナスは還付）" value={result.consumption_tax_result.total_due} />
          </div>
        </GuideStep>
      )}

      <div className="text-xs text-muted-foreground mt-4 p-3 border rounded-md bg-muted/20">
        <strong>注意事項：</strong>
        このガイドは参考情報です。実際の申告には国税庁の確定申告書等作成コーナーをご利用いただき、
        最終的な数値は必ずご自身でご確認ください。
        医療費明細、生命保険料控除証明書など添付書類の準備もあわせて行ってください。
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <span className="text-xs text-muted-foreground w-32 shrink-0">{label}</span>
      <span className="text-sm">{value || "—"}</span>
    </div>
  );
}
