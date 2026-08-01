"use client";

import { useEffect, useState } from "react";
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
import { getBSReport } from "@/lib/db/reports";
import type { BSReport, BSItem } from "@/types";

function fmt(n: number) {
  return n.toLocaleString("ja-JP") + " 円";
}

function Section({ title, items }: { title: string; items: BSItem[] }) {
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

function TotalRow({ label, amount }: { label: string; amount: number }) {
  return (
    <TableRow className="border-t-2">
      <TableCell className="font-semibold text-sm">{label}</TableCell>
      <TableCell className="text-right font-semibold tabular-nums">{fmt(amount)}</TableCell>
    </TableRow>
  );
}

export default function BSPage() {
  const [asOf, setAsOf] = useState(() => new Date().toISOString().slice(0, 10));
  const [report, setReport] = useState<BSReport | null>(null);

  async function load() {
    setReport(await getBSReport(asOf));
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">貸借対照表</h2>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">基準日</span>
          <Input type="date" className="w-36" value={asOf} onChange={(e) => setAsOf(e.target.value)} />
          <Button size="sm" onClick={load}>表示</Button>
        </div>
      </div>

      {report && (
        <div className="grid grid-cols-2 gap-4">
          {/* 資産 */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead colSpan={2} className="text-center">資産の部</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <Section title="流動資産" items={report.current_assets} />
                <Section title="固��資産" items={report.fixed_assets} />
                <TotalRow label="資産合��" amount={report.total_assets} />
              </TableBody>
            </Table>
          </div>

          {/* 負債・資本 */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead colSpan={2} className="text-center">負債・資本��部</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <Section title="流動負債" items={report.current_liabilities} />
                <Section title="固定負債" items={report.fixed_liabilities} />
                <TotalRow label="負債合計" amount={report.total_liabilities} />
                <Section title="資本" items={report.equity} />
                <TotalRow label="資本合計" amount={report.total_equity} />
                <TotalRow label="負債・資本合計" amount={report.total_liabilities + report.total_equity} />
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
