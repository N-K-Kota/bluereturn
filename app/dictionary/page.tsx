"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { listRules, upsertRule, deleteRule } from "@/lib/db/rules";
import { listAccounts } from "@/lib/db/accounts";
import type { ImportRule, Account } from "@/types";
import { Plus, Trash2, Pencil, Check, X } from "lucide-react";

export default function DictionaryPage() {
  const [rules, setRules] = useState<ImportRule[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [search, setSearch] = useState("");
  const [editId, setEditId] = useState<number | null>(null);
  const [editKeyword, setEditKeyword] = useState("");
  const [editAccountId, setEditAccountId] = useState("");
  const [editType, setEditType] = useState<"debit" | "credit">("debit");

  // 新規追加フォーム
  const [newKeyword, setNewKeyword] = useState("");
  const [newAccountId, setNewAccountId] = useState("");
  const [newType, setNewType] = useState<"debit" | "credit">("debit");

  async function load() {
    const [r, a] = await Promise.all([listRules(), listAccounts()]);
    setRules(r);
    setAccounts(a);
  }

  useEffect(() => { load(); }, []);

  async function handleAdd() {
    if (!newKeyword.trim() || !newAccountId) return;
    await upsertRule(newKeyword.trim(), parseInt(newAccountId), newType);
    setNewKeyword("");
    setNewAccountId("");
    setNewType("debit");
    load();
  }

  function startEdit(rule: ImportRule) {
    setEditId(rule.id);
    setEditKeyword(rule.keyword);
    setEditAccountId(String(rule.account_id));
    setEditType(rule.entry_type);
  }

  async function handleEditSave() {
    if (!editKeyword.trim() || !editAccountId || editId == null) return;
    // 既存ルールを削除して新しいキーワードで保存
    await deleteRule(editId);
    await upsertRule(editKeyword.trim(), parseInt(editAccountId), editType);
    setEditId(null);
    load();
  }

  async function handleDelete(id: number) {
    await deleteRule(id);
    load();
  }

  const filtered = rules.filter(
    (r) =>
      r.keyword.toLowerCase().includes(search.toLowerCase()) ||
      r.account_name?.includes(search)
  );

  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-6">
        <h2 className="text-xl font-semibold">勘定科目辞書</h2>
        <p className="text-sm text-muted-foreground mt-1">
          CSVインポート時に摘要のキーワードで勘定科目を自動判別します
        </p>
      </div>

      {/* 新規追加フォーム */}
      <div className="rounded-md border p-4 mb-6 bg-muted/20">
        <h3 className="text-sm font-medium mb-3">新しいルールを追加</h3>
        <div className="flex items-end gap-2 flex-wrap">
          <div>
            <Label className="text-xs">キーワード（摘要に含まれる文字）</Label>
            <Input
              className="w-44"
              placeholder="例: Amazon、コクミン"
              value={newKeyword}
              onChange={(e) => setNewKeyword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            />
          </div>
          <div>
            <Label className="text-xs">種別</Label>
            <Select value={newType} onValueChange={(v) => setNewType((v ?? "debit") as "debit" | "credit")}>
              <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="debit">出金</SelectItem>
                <SelectItem value="credit">入金</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">勘定科目</Label>
            <Select value={newAccountId} onValueChange={(v) => setNewAccountId(v ?? "")}>
              <SelectTrigger className="w-48"><SelectValue placeholder="選択" /></SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={String(a.id)} className="text-xs">
                    {a.code} {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            size="sm"
            onClick={handleAdd}
            disabled={!newKeyword.trim() || !newAccountId}
          >
            <Plus size={14} className="mr-1" />
            追加
          </Button>
        </div>
      </div>

      {/* 検索 */}
      <Input
        className="max-w-xs mb-3"
        placeholder="キーワード・科目名で絞り込み"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="text-xs text-muted-foreground mb-2">{filtered.length} 件</div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>キーワード</TableHead>
              <TableHead className="w-16">種別</TableHead>
              <TableHead>勘定科目</TableHead>
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8 text-sm">
                  ルールがありません。上のフォームから追加してください
                </TableCell>
              </TableRow>
            )}
            {filtered.map((rule) =>
              editId === rule.id ? (
                // 編集中の行
                <TableRow key={rule.id} className="bg-muted/30">
                  <TableCell>
                    <Input
                      className="h-7 text-xs w-44"
                      value={editKeyword}
                      onChange={(e) => setEditKeyword(e.target.value)}
                      autoFocus
                    />
                  </TableCell>
                  <TableCell>
                    <Select value={editType} onValueChange={(v) => setEditType((v ?? "debit") as "debit" | "credit")}>
                      <SelectTrigger className="h-7 w-20 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="debit">出金</SelectItem>
                        <SelectItem value="credit">入金</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Select value={editAccountId} onValueChange={(v) => setEditAccountId(v ?? "")}>
                      <SelectTrigger className="h-7 text-xs w-44"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {accounts.map((a) => (
                          <SelectItem key={a.id} value={String(a.id)} className="text-xs">
                            {a.code} {a.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleEditSave}>
                        <Check size={13} />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditId(null)}>
                        <X size={13} />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                // 通常表示の行
                <TableRow key={rule.id} className="group">
                  <TableCell className="font-mono text-sm">{rule.keyword}</TableCell>
                  <TableCell>
                    <Badge
                      variant={rule.entry_type === "debit" ? "destructive" : "default"}
                      className="text-xs"
                    >
                      {rule.entry_type === "debit" ? "出金" : "入金"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{rule.account_name}</TableCell>
                  <TableCell>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => startEdit(rule)}
                      >
                        <Pencil size={13} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={() => handleDelete(rule.id)}
                      >
                        <Trash2 size={13} />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
