"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getPLReport } from "@/lib/db/reports";
import type { PLReport } from "@/types";

function fmt(n: number) {
  return n.toLocaleString("ja-JP") + " 円";
}

function currentFiscalYear() {
  const now = new Date();
  const year = now.getFullYear();
  return { start: `${year}-01-01`, end: `${year}-12-31` };
}

export default function DashboardPage() {
  const [report, setReport] = useState<PLReport | null>(null);
  const { start, end } = currentFiscalYear();

  useEffect(() => {
    getPLReport(start, end)
      .then(setReport)
      .catch(() => {});
  }, [start, end]);

  const cards = report
    ? [
        { label: "売上高", value: report.total_revenue },
        { label: "売上原価", value: report.total_cost },
        { label: "売上総利益", value: report.gross_profit },
        { label: "販管費合計", value: report.total_selling_expense },
        { label: "営業利益", value: report.operating_profit },
        { label: "当期純利益", value: report.net_profit },
      ]
    : [];

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold">ダッシュボード</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {start.replace(/-/g, "/")} 〜 {end.replace(/-/g, "/")}
        </p>
      </div>

      {report ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {cards.map(({ label, value }) => (
            <Card key={label}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className={`text-2xl font-bold ${value < 0 ? "text-destructive" : ""}`}>
                  {fmt(value)}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">読み込み中...</p>
      )}
    </div>
  );
}
