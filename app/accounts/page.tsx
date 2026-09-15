"use client";
import { useAsyncData } from "@/hooks/use-async-data";
import { useAsyncAction } from "@/hooks/use-async-action";
import { LoadStatus } from "@/components/LoadStatus";

import { useState } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { listAccounts, createAccount, deleteAccount } from "@/lib/db/accounts";
import type { AccountType, AccountSubtype } from "@/types";
import { Plus, Trash2 } from "lucide-react";

const TYPE_LABELS: Record<AccountType, string> = {
  asset: "資産",
  liability: "負債",
  equity: "資本",
  revenue: "収益",
  expense: "費用",
};

const SUBTYPE_OPTIONS: Array<{ value: AccountSubtype; label: string; type: AccountType }> = [
  { value: "current_asset", label: "流動資産", type: "asset" },
  { value: "fixed_asset", label: "固定資産", type: "asset" },
  { value: "current_liability", label: "流動負債", type: "liability" },
  { value: "fixed_liability", label: "固定負債", type: "liability" },
  { value: "equity", label: "資本", type: "equity" },
  { value: "revenue", label: "売上高", type: "revenue" },
  { value: "other_income", label: "営業外収益", type: "revenue" },
  { value: "cost", label: "売上原価", type: "expense" },
  { value: "selling_expense", label: "販管費", type: "expense" },
  { value: "other_expense", label: "営業外費用", type: "expense" },
];

export default function AccountsPage() {
  const { data, loading, error, reload: load } = useAsyncData(listAccounts);
  const accounts = data ?? [];
  const { run, pending } = useAsyncAction();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ code: "", name: "", type: "expense" as AccountType, subtype: "selling_expense" as AccountSubtype });
  const [deleteId, setDeleteId] = useState<number | null>(null);


  async function handleCreate() {
    await run(async () => {
    await createAccount(form);
    setOpen(false);
    setForm({ code: "", name: "", type: "expense", subtype: "selling_expense" });
    load();
    });
  }

  async function handleDelete() {
    await run(async () => {
    if (deleteId == null) return;
    await deleteAccount(deleteId);
    setDeleteId(null);
    load();
    });
  }

  const subtypes = SUBTYPE_OPTIONS.filter((s) => s.type === form.type);

  return (
    <div className="p-6">
      <LoadStatus loading={loading} error={error} retry={load} />
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">勘定科目</h2>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus size={14} className="mr-1" />
          追加
        </Button>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-24">コード</TableHead>
              <TableHead>科目名</TableHead>
              <TableHead className="w-20">種別</TableHead>
              <TableHead className="w-28">区分</TableHead>
              <TableHead className="w-16" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {accounts.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="font-mono text-sm">{a.code}</TableCell>
                <TableCell className="text-sm">{a.name}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">
                    {TYPE_LABELS[a.type]}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {SUBTYPE_OPTIONS.find((s) => s.value === a.subtype)?.label}
                </TableCell>
                <TableCell>
                  {!a.is_system && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setDeleteId(a.id)}
                    >
                      <Trash2 size={13} />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>勘定科目を追加</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>コード</Label>
                <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="例: 761" />
              </div>
              <div>
                <Label>科目名</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="例: 雑費" />
              </div>
            </div>
            <div>
              <Label>種別</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as AccountType, subtype: SUBTYPE_OPTIONS.find((s) => s.type === v)?.value ?? "selling_expense" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(TYPE_LABELS) as AccountType[]).map((t) => (
                    <SelectItem key={t} value={t}>{TYPE_LABELS[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>区分</Label>
              <Select value={form.subtype} onValueChange={(v) => setForm({ ...form, subtype: v as AccountSubtype })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {subtypes.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>キャンセル</Button>
            <Button onClick={handleCreate} disabled={pending || !form.code.trim() || !form.name.trim()}>追加</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteId != null} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>勘定科目を削除しますか？</DialogTitle></DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>キャンセル</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={pending}>削除</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
