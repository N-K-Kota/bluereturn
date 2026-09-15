"use client";
import { useAsyncData } from "@/hooks/use-async-data";
import { LoadStatus } from "@/components/LoadStatus";
import { parseFiscalYear } from "@/lib/tax/validation";
import { TaxScope } from "@/components/tax/TaxScope";
import { CONSUMPTION_TAX_LABELS } from "@/lib/tax/consumption";

import { Suspense, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { loadAndCalculate } from "@/lib/tax/calculate";
import type { FiscalYear } from "@/types/tax";
import { Printer, ArrowLeft } from "lucide-react";
import Link from "next/link";

function fmt(n: number) {
  return n.toLocaleString("ja-JP");
}

const YEAR_LABEL: Record<FiscalYear, string> = {
  "2024": "令和6年分",
  "2025": "令和7年分",
};

export default function PrintPage() {
  return <Suspense fallback={<p className="p-6">読み込み中...</p>}><PrintContent /></Suspense>;
}

function PrintContent() {
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
      <Link href="/tax"><Button variant="outline" size="sm" className="gap-1.5"><ArrowLeft size={14} />ウィザードに戻る</Button></Link>
    </div>
  );

  const { profile, result } = data;
  const year = result.fiscal_year;
  const yearLabel = YEAR_LABEL[year];

  return (
    <div>
      {/* Screen-only controls */}
      <div className="print:hidden p-4 border-b flex items-center gap-3">
        <Link href="/tax"><Button variant="outline" size="sm" className="gap-1.5"><ArrowLeft size={14} />戻る</Button></Link>
        <Button size="sm" onClick={() => window.print()} className="gap-1.5">
          <Printer size={14} />
          印刷 / PDF保存
        </Button>
        <p className="text-xs text-muted-foreground ml-2">
          ブラウザの印刷ダイアログからPDFとして保存できます
        </p>
      </div>

      <div className="px-6 print:hidden"><TaxScope /></div>
      {/* Print body */}
      <div className="p-8 max-w-3xl mx-auto print:p-4 print:max-w-none font-sans text-sm">
        <h1 className="text-lg font-bold text-center mb-1">
          {yearLabel} 申告内容の確認シート
        </h1>
        <p className="text-center text-xs text-gray-500 mb-6">
          ※ このシートは e-Tax または税務署への提出前の確認用です
        </p>

        {/* Profile */}
        <div className="border rounded mb-6">
          <div className="bg-gray-50 px-3 py-1.5 font-medium text-xs border-b">申告者情報</div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 p-3 text-xs">
            <div className="flex gap-2"><span className="text-gray-500 w-20 shrink-0">氏名</span><span>{profile.name}</span></div>
            <div className="flex gap-2"><span className="text-gray-500 w-20 shrink-0">フリガナ</span><span>{profile.name_kana}</span></div>
            <div className="flex gap-2 col-span-2"><span className="text-gray-500 w-20 shrink-0">住所</span><span>{profile.address}</span></div>
            <div className="flex gap-2"><span className="text-gray-500 w-20 shrink-0">生年月日</span><span>{profile.birthday}</span></div>
            <div className="flex gap-2"><span className="text-gray-500 w-20 shrink-0">電話番号</span><span>{profile.phone}</span></div>
            <div className="flex gap-2"><span className="text-gray-500 w-20 shrink-0">業種</span><span>{profile.business_type}</span></div>
          </div>
        </div>

        {/* 損益計算 */}
        <div className="border rounded mb-6">
          <div className="bg-gray-50 px-3 py-1.5 font-medium text-xs border-b">損益計算書（事業所得の計算）</div>
          <table className="w-full text-xs">
            <tbody>
              <PrintRow label="①　売上（収入）金額" value={result.business_revenue} />
              <PrintRow label="②　売上原価" value={result.business_cost} />
              <PrintRow label="③　差引金額（①－②）" value={result.business_revenue - result.business_cost} indent />
              <PrintRow label="④　経費合計" value={result.business_expenses} />
              <PrintRow label="⑤　差引所得金額（③－④）" value={result.business_income_before_blue} bold />
              <PrintRow label={`⑥　青色申告特別控除額（${fmt(parseInt(profile.blue_deduction))}円）`} value={result.blue_deduction_amount} />
              <PrintRow label="⑦　事業所得（⑤－⑥）" value={result.business_income} bold highlight />
            </tbody>
          </table>
        </div>

        {/* 収支内訳 */}
        <div className="border rounded mb-6">
          <div className="bg-gray-50 px-3 py-1.5 font-medium text-xs border-b">申告所得の総合計</div>
          <table className="w-full text-xs">
            <tbody>
              <PrintRow label="事業所得" value={result.business_income} />
              {result.salary_income_gross > 0 && (
                <>
                  <PrintRow label="給与収入" value={result.salary_income_gross} />
                  <PrintRow label="給与所得控除" value={result.salary_deduction} sub />
                  <PrintRow label="給与所得" value={result.salary_income_net} indent />
                </>
              )}
              {result.misc_income_net > 0 && (
                <PrintRow label="雑所得" value={result.misc_income_net} />
              )}
              <PrintRow label="合計所得金額" value={result.total_income} bold highlight />
            </tbody>
          </table>
        </div>

        {/* 所得控除 */}
        <div className="border rounded mb-6">
          <div className="bg-gray-50 px-3 py-1.5 font-medium text-xs border-b">所得控除</div>
          <table className="w-full text-xs">
            <tbody>
              <PrintRow label="基礎控除" value={result.basic_deduction} />
              <PrintRow label="社会保険料控除" value={result.social_insurance_deduction} />
              {result.life_insurance_deduction > 0 && <PrintRow label="生命保険料控除" value={result.life_insurance_deduction} />}
              {result.earthquake_deduction > 0 && <PrintRow label="地震保険料控除" value={result.earthquake_deduction} />}
              {result.medical_deduction > 0 && <PrintRow label="医療費控除" value={result.medical_deduction} />}
              {result.disability_deduction > 0 && <PrintRow label="障害者控除" value={result.disability_deduction} />}
              {result.widow_deduction > 0 && <PrintRow label="ひとり親・寡婦控除" value={result.widow_deduction} />}
              {result.working_student_deduction > 0 && <PrintRow label="勤労学生控除" value={result.working_student_deduction} />}
              {result.spouse_deduction > 0 && <PrintRow label="配偶者（特別）控除" value={result.spouse_deduction} />}
              {result.dependent_deduction > 0 && <PrintRow label="扶養控除" value={result.dependent_deduction} />}
              <PrintRow label="所得控除の合計" value={result.total_deduction} bold />
            </tbody>
          </table>
        </div>

        {/* 税額計算 */}
        <div className="border rounded mb-6">
          <div className="bg-gray-50 px-3 py-1.5 font-medium text-xs border-b">税額計算</div>
          <table className="w-full text-xs">
            <tbody>
              <PrintRow label="課税される所得金額" value={result.taxable_income} />
              <PrintRow label="所得税額（減税前）" value={result.income_tax_before_reduction} />
              <PrintRow label="定額減税" value={result.fixed_tax_reduction} sub />
              <PrintRow label="基準所得税額" value={result.income_tax} />
              <PrintRow label="予定納税額" value={result.prepaid_tax} sub />
              <PrintRow label="復興特別所得税（×2.1%）" value={result.reconstruction_tax} />
              <PrintRow label="所得税および復興特別所得税の合計" value={result.total_tax} bold />
              <PrintRow label="源泉徴収税額（控除）" value={result.withheld_tax} sub />
              <PrintRow
                label={result.tax_due >= 0 ? "納付税額" : "還付金額"}
                value={Math.abs(result.tax_due)}
                bold
                highlight
              />
            </tbody>
          </table>
        </div>

        {/* 消費税 */}
        {result.consumption_tax_result && (
          <div className="border rounded mb-6">
            <div className="bg-gray-50 px-3 py-1.5 font-medium text-xs border-b">
              消費税（{CONSUMPTION_TAX_LABELS[result.consumption_tax_result.type]}）
            </div>
            <table className="w-full text-xs">
              <tbody>
                <PrintRow label={`課税売上高（${result.consumption_tax_result.type === "simplified" ? "税込" : "税抜"}）`} value={result.consumption_tax_result.taxable_sales} />
                <PrintRow label="売上消費税額（国税）" value={result.consumption_tax_result.output_tax} />
                <PrintRow label="仕入控除税額" value={result.consumption_tax_result.input_tax} sub />
                <PrintRow label="消費税額" value={result.consumption_tax_result.consumption_tax_due} />
                <PrintRow label="地方消費税額" value={result.consumption_tax_result.local_consumption_tax_due} />
                <PrintRow label="消費税・地方消費税の合計（マイナスは還付）" value={result.consumption_tax_result.total_due} bold highlight />
              </tbody>
            </table>
          </div>
        )}

        <p className="text-xs text-gray-400 text-center mt-8 print:mt-4">
          青色申告アプリ — {new Date().toLocaleDateString("ja-JP")} 作成
        </p>
      </div>
    </div>
  );
}

function PrintRow({
  label,
  value,
  bold,
  highlight,
  indent,
  sub,
}: {
  label: string;
  value: number;
  bold?: boolean;
  highlight?: boolean;
  indent?: boolean;
  sub?: boolean;
}) {
  return (
    <tr className={highlight ? "bg-yellow-50" : undefined}>
      <td className={`py-1.5 px-3 ${indent ? "pl-6" : ""} ${bold ? "font-semibold" : ""}`}>
        {sub && <span className="mr-1 text-gray-400">△</span>}
        {label}
      </td>
      <td className={`py-1.5 px-3 text-right font-mono ${bold ? "font-semibold" : ""}`}>
        {value.toLocaleString("ja-JP")} 円
      </td>
    </tr>
  );
}
