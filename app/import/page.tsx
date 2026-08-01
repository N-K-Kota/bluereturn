"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { listAccounts } from "@/lib/db/accounts";
import { listRules, upsertRule } from "@/lib/db/rules";
import { bulkCreateJournalEntries } from "@/lib/db/journal";
import { parseCsvBuffer } from "@/lib/csv/parser";
import { BANK_FORMATS } from "@/lib/csv/formats";
import type { Account, CsvTransaction, ImportRule } from "@/types";
import { Upload, CheckCircle2 } from "lucide-react";

interface RowState extends CsvTransaction {
  selected: boolean;
  account_id: string;
  // for rule learning
  originalAccountId?: number;
}

export default function ImportPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [rules, setRules] = useState<ImportRule[]>([]);
  const [rows, setRows] = useState<RowState[]>([]);
  const [detectedFormat, setDetectedFormat] = useState<string | null>(null);
  const [imported, setImported] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    listAccounts().then(setAccounts);
    listRules().then(setRules);
  }, []);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const buffer = await file.arrayBuffer();
    const result = await parseCsvBuffer(buffer, rules);
    setDetectedFormat(result.format?.name ?? "不明（汎用パーサー）");
    setRows(
      result.transactions.map((t) => ({
        ...t,
        selected: true,
        account_id: t.suggested_account_id ? String(t.suggested_account_id) : "",
      }))
    );
    setImported(false);
    e.target.value = "";
  }

  function updateRow(i: number, field: Partial<RowState>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...field } : r)));
  }

  async function handleImport() {
    const selected = rows.filter((r) => r.selected && r.account_id);

    // Learn rules for newly assigned accounts
    for (const row of selected) {
      if (row.account_id && !row.rule_matched) {
        await upsertRule(
          row.description,
          parseInt(row.account_id),
          row.type
        );
      }
    }

    // Determine counter account (cash/bank) — use 普通預金 by default
    const bankAccount = accounts.find((a) => a.name === "普通預金") ?? accounts[0];

    await bulkCreateJournalEntries(
      selected.map((row) => {
        const accountId = parseInt(row.account_id);
        const isDebit = row.type === "debit";
        return {
          date: row.date,
          description: row.description,
          lines: [
            {
              account_id: isDebit ? accountId : bankAccount.id,
              debit_amount: row.amount,
              credit_amount: 0,
              description: "",
            },
            {
              account_id: isDebit ? bankAccount.id : accountId,
              debit_amount: 0,
              credit_amount: row.amount,
              description: "",
            },
          ],
        };
      })
    );

    setImported(true);
    setRows([]);
  }

  const selectedCount = rows.filter((r) => r.selected && r.account_id).length;

  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold mb-6">CSVインポート</h2>

      <div
        className="border-2 border-dashed rounded-lg p-10 text-center cursor-pointer hover:bg-muted/30 transition-colors mb-6"
        onClick={() => fileRef.current?.click()}
      >
        <Upload className="mx-auto mb-2 text-muted-foreground" size={28} />
        <p className="text-sm text-muted-foreground">
          銀行・クレジットカードのCSVファイルをクリックして選択
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          対応: 三菱UFJ・みずほ・三井住友・楽天銀行・GMOあおぞら・楽天カード・三井住友カード
        </p>
        <input
          ref={fileRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={handleFile}
        />
      </div>

      {detectedFormat && (
        <p className="text-sm mb-3">
          検出フォーマット: <Badge variant="secondary">{detectedFormat}</Badge>
        </p>
      )}

      {imported && (
        <div className="flex items-center gap-2 text-green-600 mb-4 text-sm">
          <CheckCircle2 size={16} />
          インポートが完了しました
        </div>
      )}

      {rows.length > 0 && (
        <>
          <div className="rounded-md border mb-4 max-h-[50vh] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">
                    <input
                      type="checkbox"
                      checked={rows.every((r) => r.selected)}
                      onChange={(e) =>
                        setRows((prev) => prev.map((r) => ({ ...r, selected: e.target.checked })))
                      }
                    />
                  </TableHead>
                  <TableHead className="w-28">日付</TableHead>
                  <TableHead>摘要</TableHead>
                  <TableHead className="w-20 text-right">金額</TableHead>
                  <TableHead className="w-16">種別</TableHead>
                  <TableHead className="w-48">勘定科目</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, i) => (
                  <TableRow key={i} className={!row.selected ? "opacity-40" : ""}>
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={row.selected}
                        onChange={(e) => updateRow(i, { selected: e.target.checked })}
                      />
                    </TableCell>
                    <TableCell className="text-sm">{row.date}</TableCell>
                    <TableCell className="text-sm">
                      {row.description}
                      {row.rule_matched && (
                        <Badge variant="outline" className="ml-2 text-xs">ルール</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {row.amount.toLocaleString("ja-JP")}
                    </TableCell>
                    <TableCell>
                      <Badge variant={row.type === "debit" ? "destructive" : "default"} className="text-xs">
                        {row.type === "debit" ? "出金" : "入金"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={row.account_id}
                        onValueChange={(v) => updateRow(i, { account_id: v ?? "" })}
                      >
                        <SelectTrigger className="h-7 text-xs">
                          <SelectValue placeholder="科目を選択" />
                        </SelectTrigger>
                        <SelectContent>
                          {accounts.map((a) => (
                            <SelectItem key={a.id} value={String(a.id)} className="text-xs">
                              {a.code} {a.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <Button onClick={handleImport} disabled={selectedCount === 0}>
            {selectedCount} 件をインポート
          </Button>
        </>
      )}
    </div>
  );
}
