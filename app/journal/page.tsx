"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { listJournalEntries, deleteJournalEntry } from "@/lib/db/journal";
import type { JournalEntryWithLines } from "@/types";
import { Plus, Trash2, ChevronDown, ChevronRight } from "lucide-react";

function fmt(n: number) {
  return n === 0 ? "" : n.toLocaleString("ja-JP");
}

export default function JournalPage() {
  const [entries, setEntries] = useState<JournalEntryWithLines[]>([]);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState("");
  const [deleteId, setDeleteId] = useState<number | null>(null);

  async function load() {
    const data = await listJournalEntries();
    setEntries(data);
  }

  useEffect(() => { load(); }, []);

  const filtered = entries.filter(
    (e) =>
      e.description.includes(search) ||
      e.date.includes(search) ||
      e.lines.some((l) => l.account_name?.includes(search))
  );

  function toggleExpand(id: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleDelete() {
    if (deleteId == null) return;
    await deleteJournalEntry(deleteId);
    setDeleteId(null);
    load();
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">仕訳帳</h2>
        <Link href="/journal/new">
          <Button size="sm">
            <Plus size={14} className="mr-1" />
            新規仕訳
          </Button>
        </Link>
      </div>
      <Input
        className="max-w-xs mb-4"
        placeholder="日付・摘要・科目で絞り込み"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead className="w-32">日付</TableHead>
              <TableHead>摘要</TableHead>
              <TableHead className="w-24 text-right">借方</TableHead>
              <TableHead className="w-24 text-right">貸方</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  仕訳がありません
                </TableCell>
              </TableRow>
            )}
            {filtered.map((entry) => {
              const totalDebit = entry.lines.reduce((s, l) => s + l.debit_amount, 0);
              const totalCredit = entry.lines.reduce((s, l) => s + l.credit_amount, 0);
              const isExpanded = expanded.has(entry.id);
              return [
                <TableRow
                  key={entry.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => toggleExpand(entry.id)}
                >
                  <TableCell>
                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </TableCell>
                  <TableCell className="text-sm">{entry.date}</TableCell>
                  <TableCell className="text-sm">{entry.description}</TableCell>
                  <TableCell className="text-right text-sm tabular-nums">
                    {totalDebit.toLocaleString("ja-JP")}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums">
                    {totalCredit.toLocaleString("ja-JP")}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={(e) => { e.stopPropagation(); setDeleteId(entry.id); }}
                    >
                      <Trash2 size={13} />
                    </Button>
                  </TableCell>
                </TableRow>,
                ...(isExpanded
                  ? entry.lines.map((line) => (
                      <TableRow key={`line-${line.id}`} className="bg-muted/30">
                        <TableCell />
                        <TableCell />
                        <TableCell className="text-sm pl-8 text-muted-foreground">
                          {line.account_code} {line.account_name}
                          {line.description && ` — ${line.description}`}
                        </TableCell>
                        <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
                          {fmt(line.debit_amount)}
                        </TableCell>
                        <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
                          {fmt(line.credit_amount)}
                        </TableCell>
                        <TableCell />
                      </TableRow>
                    ))
                  : []),
              ];
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={deleteId != null} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>仕訳を削除しますか？</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">この操作は取り消せません。</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>キャンセル</Button>
            <Button variant="destructive" onClick={handleDelete}>削除</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
