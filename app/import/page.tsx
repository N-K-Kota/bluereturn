"use client";
import { useAsyncAction } from "@/hooks/use-async-action";
import { errorMessage } from "@/lib/validation";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { listRules } from "@/lib/db/rules";
import { bulkCreateJournalEntries } from "@/lib/db/journal";
import { parseCsvBuffer } from "@/lib/csv/parser";
import type { Account, CsvTransaction } from "@/types";
import { Upload, CheckCircle2, BookOpen } from "lucide-react";
import Link from "next/link";

const CARD_FORMAT_IDS = ["rakuten_card", "smbc_card"];

interface RowState extends CsvTransaction {
  selected: boolean;
  account_id: string;
  // 辞書登録用
  save_rule: boolean;
  keyword: string;
}

function suggestKeyword(description: string): string {
  // 全角スペースや記号を除いた先頭の意味のある部分を提案
  return description.replace(/[\s　]+.*$/, "").slice(0, 20).trim() || description.slice(0, 20);
}

export default function ImportPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const { run, pending } = useAsyncAction();
  const [loadError, setLoadError] = useState("");
  const [rows, setRows] = useState<RowState[]>([]);
  const [detectedFormatName, setDetectedFormatName] = useState<string | null>(null);
  const [counterAccountId, setCounterAccountId] = useState("");
  const [imported, setImported] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [newRuleCount, setNewRuleCount] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    listAccounts().then((accs) => {
      setAccounts(accs);
      const bank = accs.find((a) => a.name === "普通預金");
      if (bank) setCounterAccountId(String(bank.id));
    }).catch((error) => setLoadError(errorMessage(error)));
  }, []);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    await run(async () => {
    const file = e.target.files?.[0];
    if (!file) return;
    setRows([]);
    setDetectedFormatName(null);
    setImported(false);
    const buffer = await file.arrayBuffer();
    const latestRules = await listRules();
    const result = await parseCsvBuffer(buffer, latestRules);
    const fmtId = result.format?.id ?? null;
    setDetectedFormatName(result.format?.name ?? "不明（汎用パーサー）");

    if (fmtId && CARD_FORMAT_IDS.includes(fmtId)) {
      const unpaid = accounts.find((a) => a.name === "未払金");
      if (unpaid) setCounterAccountId(String(unpaid.id));
    } else {
      const bank = accounts.find((a) => a.name === "普通預金");
      if (bank) setCounterAccountId(String(bank.id));
    }

    setRows(
      result.transactions.map((t) => ({
        ...t,
        selected: true,
        account_id: t.suggested_account_id ? String(t.suggested_account_id) : "",
        save_rule: false,
        keyword: suggestKeyword(t.description),
      }))
    );
    setImported(false);
    if (fileRef.current) fileRef.current.value = "";
    });
  }

  function updateRow(i: number, field: Partial<RowState>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...field } : r)));
  }

  // 勘定科目が手動選択されたとき、自動的に辞書登録をONにする
  function handleAccountChange(i: number, accountId: string) {
    const row = rows[i];
    const willSave = !row.rule_matched && accountId !== "";
    updateRow(i, {
      account_id: accountId,
      save_rule: willSave,
    });
  }

  async function handleImport() {
    await run(async () => {
    const selected = rows.filter((r) => r.selected && r.account_id);
    const counterIdNum = parseInt(counterAccountId);
    if (!counterIdNum) return;

    if (rows.some((row) => row.selected && !row.account_id)) throw new Error("選択した明細の勘定科目をすべて指定してください");
    if (selected.some((row) => Number(row.account_id) === counterIdNum)) throw new Error("相手科目とカウンター勘定には異なる科目を指定してください");
    const ruleInputs = selected.filter((row) => row.save_rule && row.keyword.trim()).map((row) => ({
      keyword: row.keyword.trim(), account_id: Number(row.account_id), entry_type: row.type,
    }));
    await bulkCreateJournalEntries(
      selected.map((row) => {
        const accountId = parseInt(row.account_id);
        const isDebit = row.type === "debit";
        return {
          date: row.date,
          description: row.description,
          lines: [
            {
              account_id: isDebit ? accountId : counterIdNum,
              debit_amount: row.amount,
              credit_amount: 0,
              description: "",
            },
            {
              account_id: isDebit ? counterIdNum : accountId,
              debit_amount: 0,
              credit_amount: row.amount,
              description: "",
            },
          ],
        };
      }),
      ruleInputs
    );
    setImportedCount(selected.length);
    setNewRuleCount(ruleInputs.length);
    setImported(true);
    setRows([]);
    });
  }

  const selectedCount = rows.filter((r) => r.selected && r.account_id).length;
  const unmatchedCount = rows.filter((r) => r.selected && !r.rule_matched && !r.account_id).length;

  return (
    <div className="p-6">
      {loadError && <p role="alert" className="text-destructive text-sm mb-4">{loadError}</p>}
      <fieldset disabled={pending || !!loadError} className="min-w-0">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">CSVインポート</h2>
        <Link href="/dictionary">
          <Button variant="outline" size="sm">
            <BookOpen size={14} className="mr-1" />
            辞書を編集
          </Button>
        </Link>
      </div>

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
        <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
      </div>

      {detectedFormatName && (
        <p className="text-sm mb-3">
          検出フォーマット: <Badge variant="secondary">{detectedFormatName}</Badge>
        </p>
      )}

      {imported && (
        <div className="flex items-center gap-2 text-green-600 mb-4 text-sm">
          <CheckCircle2 size={16} />
          {importedCount} 件をインポートしました
          {newRuleCount > 0 && `（辞書に ${newRuleCount} 件追加）`}
        </div>
      )}

      {rows.length > 0 && (
        <>
          <div className="flex items-center gap-3 mb-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Label className="text-sm shrink-0">カウンター勘定</Label>
              <Select value={counterAccountId} onValueChange={(v) => setCounterAccountId(v ?? "")}>
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="選択" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={String(a.id)} className="text-xs">
                      {a.code} {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {unmatchedCount > 0 && (
              <p className="text-xs text-amber-600">
                ⚠ {unmatchedCount} 件が未分類です。勘定科目を選択してください
              </p>
            )}
          </div>

          <div className="rounded-md border mb-4 max-h-[55vh] overflow-y-auto">
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
                  <TableHead className="w-24">日付</TableHead>
                  <TableHead>摘要</TableHead>
                  <TableHead className="w-20 text-right">金額</TableHead>
                  <TableHead className="w-14">種別</TableHead>
                  <TableHead className="w-44">勘定科目</TableHead>
                  <TableHead className="w-36">辞書登録キーワード</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, i) => (
                  <TableRow
                    key={i}
                    className={!row.selected ? "opacity-40" : row.rule_matched ? "" : !row.account_id ? "bg-amber-50/50" : ""}
                  >
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={row.selected}
                        onChange={(e) => updateRow(i, { selected: e.target.checked })}
                      />
                    </TableCell>
                    <TableCell className="text-xs">{row.date}</TableCell>
                    <TableCell className="text-xs">{row.description}</TableCell>
                    <TableCell className="text-right text-xs tabular-nums">
                      {row.amount.toLocaleString("ja-JP")}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={row.type === "debit" ? "destructive" : "default"}
                        className="text-xs"
                      >
                        {row.type === "debit" ? "出金" : "入金"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {row.rule_matched ? (
                        // ルールで自動分類された行
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Badge variant="outline" className="text-xs">自動</Badge>
                          {accounts.find((a) => a.id === parseInt(row.account_id))?.name}
                        </span>
                      ) : (
                        // 手動選択が必要な行
                        <Select
                          value={row.account_id}
                          onValueChange={(v) => handleAccountChange(i, v ?? "")}
                        >
                          <SelectTrigger className="h-7 text-xs">
                            <SelectValue placeholder="選択してください" />
                          </SelectTrigger>
                          <SelectContent>
                            {accounts.map((a) => (
                              <SelectItem key={a.id} value={String(a.id)} className="text-xs">
                                {a.code} {a.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </TableCell>
                    <TableCell>
                      {/* 手動選択行のみ辞書登録UIを表示 */}
                      {!row.rule_matched && row.account_id && (
                        <div className="flex items-center gap-1">
                          <input
                            type="checkbox"
                            checked={row.save_rule}
                            onChange={(e) => updateRow(i, { save_rule: e.target.checked })}
                            className="shrink-0"
                          />
                          <Input
                            className="h-6 text-xs px-1"
                            value={row.keyword}
                            disabled={!row.save_rule}
                            onChange={(e) => updateRow(i, { keyword: e.target.value })}
                            placeholder="キーワード"
                          />
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <Button onClick={handleImport} disabled={selectedCount === 0 || !counterAccountId}>
            {selectedCount} 件をインポート
            {rows.filter((r) => r.selected && r.save_rule && r.keyword.trim()).length > 0 &&
              `（辞書 ${rows.filter((r) => r.selected && r.save_rule && r.keyword.trim()).length} 件追加）`}
          </Button>
        </>
      )}
      </fieldset>
    </div>
  );
}
