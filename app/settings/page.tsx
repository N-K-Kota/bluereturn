"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { listRules, upsertRule, deleteRule } from "@/lib/db/rules";
import { listAccounts } from "@/lib/db/accounts";
import type { ImportRule, Account } from "@/types";
import { Trash2, Plus } from "lucide-react";

export default function SettingsPage() {
  const [rules, setRules] = useState<ImportRule[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [keyword, setKeyword] = useState("");
  const [accountId, setAccountId] = useState("");
  const [entryType, setEntryType] = useState<"debit" | "credit">("debit");

  async function load() {
    setRules(await listRules());
    setAccounts(await listAccounts());
  }

  useEffect(() => { load(); }, []);

  async function handleAdd() {
    if (!keyword || !accountId) return;
    await upsertRule(keyword, parseInt(accountId), entryType);
    setKeyword("");
    setAccountId("");
    load();
  }

  async function handleDelete(id: number) {
    await deleteRule(id);
    load();
  }

  return (
    <div className="p-6 max-w-2xl">
      <h2 className="text-xl font-semibold mb-6">設定</h2>

      <h3 className="font-medium mb-3">CSVインポート ルール管理</h3>
      <p className="text-sm text-muted-foreground mb-4">
        摘要テキストにキーワードが含まれる場合、自動的に勘定科目を割り当てます。
      </p>

      <div className="flex gap-2 mb-4 items-end">
        <div>
          <Label className="text-xs">キーワード</Label>
          <Input
            className="w-40"
            placeholder="例: Amazon"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
        </div>
        <div>
          <Label className="text-xs">種別</Label>
          <Select value={entryType} onValueChange={(v) => setEntryType(v as "debit" | "credit")}>
            <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="debit">出金</SelectItem>
              <SelectItem value="credit">入金</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">勘定科目</Label>
          <Select value={accountId} onValueChange={(v) => setAccountId(v ?? "")}>
            <SelectTrigger className="w-44"><SelectValue placeholder="選択" /></SelectTrigger>
            <SelectContent>
              {accounts.map((a) => (
                <SelectItem key={a.id} value={String(a.id)} className="text-xs">
                  {a.code} {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" onClick={handleAdd} disabled={!keyword || !accountId}>
          <Plus size={14} className="mr-1" />
          追加
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>キーワード</TableHead>
              <TableHead className="w-20">種別</TableHead>
              <TableHead>勘定科目</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rules.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-6 text-sm">
                  ルールがありません
                </TableCell>
              </TableRow>
            )}
            {rules.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-sm">{r.keyword}</TableCell>
                <TableCell className="text-sm">{r.entry_type === "debit" ? "出金" : "入金"}</TableCell>
                <TableCell className="text-sm">{r.account_name}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(r.id)}>
                    <Trash2 size={13} />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
