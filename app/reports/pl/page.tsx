"use client";
import { useAsyncData } from "@/hooks/use-async-data";
import { LoadStatus } from "@/components/LoadStatus";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getPLReport } from "@/lib/db/reports";
import type { PLItem } from "@/types";

function fmt(n: number) {
  return n.toLocaleString("ja-JP") + " 円";
}

function Section({ title, items }: { title: string; items: PLItem[] }) {
  return (
    <>
      <TableRow className="bg-muted/40">
        <TableCell colSpan={2} className="font-medium text-sm py-2">{title}</TableCell>
      </TableRow>
      {items.map((item) => (
        <TableRow key={item.account_id}>
          <TableCell className="pl-8 text-sm text-muted-foreground">
            {item.account_code} {item.account_name}
          </TableCell>
          <TableCell className="text-right text-sm tabular-nums">{fmt(item.amount)}</TableCell>
        </TableRow>
      ))}
    </>
  );
}

function TotalRow({ label, amount, bold }: { label: string; amount: number; bold?: boolean }) {
  return (
    <TableRow className={bold ? "border-t-2" : ""}>
      <TableCell className={`text-sm ${bold ? "font-semibold" : "font-medium pl-8"}`}>{label}</TableCell>
      <TableCell className={`text-right tabular-nums ${bold ? "font-semibold text-base" : "text-sm"} ${amount < 0 ? "text-destructive" : ""}`}>
        {fmt(amount)}
      </TableCell>
    </TableRow>
  );
}

export default function PLPage() {
  const year = new Date().getFullYear();
  const [from, setFrom] = useState(`${year}-01-01`);
  const [to, setTo] = useState(`${year}-12-31`);
  const [range, setRange] = useState({ from, to });
  const loader = useCallback(() => getPLReport(range.from, range.to), [range]);
  const { data: report, loading, error, reload } = useAsyncData(loader);
  function load() { setRange({ from, to }); }


  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">損益計算書</h2>
        <div className="flex items-center gap-2">
          <Input type="date" className="w-36" value={from} onChange={(e) => setFrom(e.target.value)} />
          <span className="text-muted-foreground">〜</span>
          <Input type="date" className="w-36" value={to} onChange={(e) => setTo(e.target.value)} />
          <Button size="sm" onClick={load}>表示</Button>
        </div>
      </div>

      <LoadStatus loading={loading} error={error} retry={reload} />
      {report && (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>科目</TableHead>
                <TableHead className="text-right w-40">金額</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <Section title="売上高" items={report.revenues} />
              <TotalRow label="売上高合計" amount={report.total_revenue} />
              <Section title="売上原価" items={report.costs} />
              <TotalRow label="売上原価合計" amount={report.total_cost} />
              <TotalRow label="売上総利益" amount={report.gross_profit} bold />
              <Section title="販売費及び一般管理費" items={report.selling_expenses} />
              <TotalRow label="販管費合計" amount={report.total_selling_expense} />
              <TotalRow label="営業利益" amount={report.operating_profit} bold />
              {report.other_incomes.length > 0 && (
                <Section title="営業外収益" items={report.other_incomes} />
              )}
              {report.other_expenses.length > 0 && (
                <Section title="営業外費用" items={report.other_expenses} />
              )}
              <TotalRow label="当期純利益" amount={report.net_profit} bold />
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
