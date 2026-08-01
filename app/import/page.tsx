"use client";

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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { listAccounts } from "@/lib/db/accounts";
import { listRules, upsertRule } from "@/lib/db/rules";
import { bulkCreateJournalEntries } from "@/lib/db/journal";
import { parseCsvBuffer } from "@/lib/csv/parser";
import type { Account, CsvTransaction, ImportRule } from "@/types";
import { Upload, CheckCircle2 } from "lucide-react";

const CARD_FORMAT_IDS = ["rakuten_card", "smbc_card"];

interface RowState extends CsvTransaction {
  selected: boolean;
  account_id: string;
}

interface RuleLearnItem {
  description: string;
  keyword: string;
  account_id: string;
  entry_type: "debit" | "credit";
}

export default function ImportPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [rules, setRules] = useState<ImportRule[]>([]);
  const [rows, setRows] = useState<RowState[]>([]);
  const [detectedFormatId, setDetectedFormatId] = useState<string | null>(null);
  const [detectedFormatName, setDetectedFormatName] = useState<string | null>(null);
  const [counterAccountId, setCounterAccountId] = useState("");
  const [imported, setImported] = useState(false);
  const [learnItems, setLearnItems] = useState<RuleLearnItem[]>([]);
  const [showLearnDialog, setShowLearnDialog] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function loadRules() {
    const r = await listRules();
    setRules(r);
    return r;
  }

  useEffect(() => {
    listAccounts().then((accs) => {
      setAccounts(accs);
      const bank = accs.find((a) => a.name === "普通預金");
      if (bank) setCounterAccountId(String(bank.id));
    });
    loadRules();
  }, []);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const buffer = await file.arrayBuffer();
    const latestRules = await loadRules();
    const result = await parseCsvBuffer(buffer, latestRules);
    const fmtId = result.format?.id ?? null;
    setDetectedFormatId(fmtId);
    setDetectedFormatName(result.format?.name ?? "不明（汎用パーサー）");

    // クレジットカードのCSVはデフォルトで未払金をカウンター勘定にする
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
      }))
    );
    setImported(false);
    e.target.value = "";
  }

  function updateRow(i: number, field: Partial<RowState>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...field } : r)));
  }

  function handleConfirmImport() {
    const selected = rows.filter((r) => r.selected && r.account_id);
    // ルール未マッチの行についてルール学習候補を作成
    const newItems: RuleLearnItem[] = selected
      .filter((r) => !r.rule_matched)
      .map((r) => ({
        description: r.description,
        // キーワードは摘要の先頭20文字を提案
        keyword: r.description.slice(0, 20),
        account_id: r.account_id,
        entry_type: r.type,
      }));
    if (newItems.length > 0) {
      setLearnItems(newItems);
      setShowLearnDialog(true);
    } else {
      doImport(selected, []);
    }
  }

  async function doImport(selected: RowState[], learnList: RuleLearnItem[]) {
    const counterIdNum = parseInt(counterAccountId);
    if (!counterIdNum) return;

    for (const item of learnList) {
      if (item.keyword.trim()) {
        await upsertRule(item.keyword.trim(), parseInt(item.account_id), item.entry_type);
      }
    }

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
      })
    );

    await loadRules();
    setImported(true);
    setRows([]);
    setShowLearnDialog(false);
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

      {detectedFormatName && (
        <p className="text-sm mb-3">
          検出フォーマット: <Badge variant="secondary">{detectedFormatName}</Badge>
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
          <div className="flex items-center gap-3 mb-3">
            <Label className="text-sm shrink-0">カウンター勘定</Label>
            <Select value={counterAccountId} onValueChange={(v) => setCounterAccountId(v ?? "")}>
              <SelectTrigger className="w-48">
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
            <span className="text-xs text-muted-foreground">
              銀行明細→普通預金、カード明細→未払金
            </span>
          </div>

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
                  <TableHead className="w-24 text-right">金額</TableHead>
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

          <Button onClick={handleConfirmImport} disabled={selectedCount === 0 || !counterAccountId}>
            {selectedCount} 件をインポート
          </Button>
        </>
      )}

      {/* ルール学習ダイアログ */}
      <Dialog open={showLearnDialog} onOpenChange={setShowLearnDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>ルールを保存しますか？</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground mb-3">
            次回同じキーワードが含まれる取引を自動分類します。不要な行は空欄にしてください。
          </p>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {learnItems.map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  className="flex-1 text-xs h-7"
                  value={item.keyword}
                  onChange={(e) =>
                    setLearnItems((prev) =>
                      prev.map((it, idx) => idx === i ? { ...it, keyword: e.target.value } : it)
                    )
                  }
                  placeholder="キーワード"
                />
                <span className="text-xs text-muted-foreground shrink-0 w-32 truncate">
                  → {accounts.find((a) => a.id === parseInt(item.account_id))?.name}
                </span>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => doImport(rows.filter((r) => r.selected && r.account_id), [])}>
              保存しない
            </Button>
            <Button onClick={() => doImport(rows.filter((r) => r.selected && r.account_id), learnItems)}>
              保存してインポート
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
