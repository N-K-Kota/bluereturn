"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { listAccounts } from "@/lib/db/accounts";
import { createJournalEntry } from "@/lib/db/journal";
import { useAsyncData } from "@/hooks/use-async-data";
import { useAsyncAction } from "@/hooks/use-async-action";
import { localDate, errorMessage } from "@/lib/validation";
import { LoadStatus } from "@/components/LoadStatus";
import { Plus, Trash2 } from "lucide-react";

interface Line {
  account_id: string;
  debit_amount: string;
  credit_amount: string;
  description: string;
}

function emptyLine(): Line {
  return { account_id: "", debit_amount: "", credit_amount: "", description: "" };
}

export default function NewJournalPage() {
  const router = useRouter();
  const { data, loading, error: loadError, reload } = useAsyncData(listAccounts);
  const accounts = data ?? [];
  const { run, pending } = useAsyncAction();
  const [date, setDate] = useState(() => localDate());
  const [description, setDescription] = useState("");
  const [lines, setLines] = useState<Line[]>([emptyLine(), emptyLine()]);
  const [error, setError] = useState("");

  const totalDebit = lines.reduce((s, l) => s + (Number(l.debit_amount)), 0);
  const totalCredit = lines.reduce((s, l) => s + (Number(l.credit_amount)), 0);
  const balanced = totalDebit === totalCredit && totalDebit > 0;

  function updateLine(i: number, field: keyof Line, value: string) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, [field]: value } : l)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await run(async () => {
    setError("");
    const validLines = lines.filter((l) => l.account_id || l.debit_amount || l.credit_amount || l.description);
    try {
      await createJournalEntry({
        date,
        description,
        lines: validLines.map((l) => ({
          account_id: parseInt(l.account_id),
          debit_amount: Number(l.debit_amount),
          credit_amount: Number(l.credit_amount),
          description: l.description,
        })),
      });
      router.push("/journal");
    } catch (e) {
      setError(errorMessage(e));
    }
    });
  }

  return (
    <div className="p-6 max-w-3xl">
      <h2 className="text-xl font-semibold mb-6">仕訳入力</h2>
      <LoadStatus loading={loading} error={loadError} retry={reload} />
      <form onSubmit={handleSubmit}>
      <fieldset disabled={pending || loading || !!loadError} className="space-y-4">
        <div className="flex gap-4">
          <div className="w-48">
            <Label>日付</Label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>
          <div className="flex-1">
            <Label>摘要</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="取引の概要"
            />
          </div>
        </div>

        <div>
          <div className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-2 text-xs text-muted-foreground mb-1 px-1">
            <span>勘定科目</span>
            <span>借方</span>
            <span>貸方</span>
            <span>補助摘要</span>
            <span />
          </div>
          {lines.map((line, i) => (
            <div key={i} className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-2 mb-2">
              <Select
                value={line.account_id}
                onValueChange={(v) => updateLine(i, "account_id", v ?? "")}
              >
                <SelectTrigger>
                  <SelectValue placeholder="科目を選択" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={String(a.id)}>
                      {a.code} {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="number"
                min="0"
                placeholder="0"
                value={line.debit_amount}
                onChange={(e) => updateLine(i, "debit_amount", e.target.value)}
              />
              <Input
                type="number"
                min="0"
                placeholder="0"
                value={line.credit_amount}
                onChange={(e) => updateLine(i, "credit_amount", e.target.value)}
              />
              <Input
                placeholder="補助摘要"
                value={line.description}
                onChange={(e) => updateLine(i, "description", e.target.value)}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setLines((p) => p.filter((_, idx) => idx !== i))}
                disabled={lines.length <= 2}
              >
                <Trash2 size={14} />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setLines((p) => [...p, emptyLine()])}
          >
            <Plus size={14} className="mr-1" />
            行を追加
          </Button>
        </div>

        <div className="flex gap-8 text-sm border-t pt-3">
          <span>
            借方合計:{" "}
            <strong className={!balanced ? "text-destructive" : ""}>
              {totalDebit.toLocaleString("ja-JP")} 円
            </strong>
          </span>
          <span>
            貸方合計:{" "}
            <strong className={!balanced ? "text-destructive" : ""}>
              {totalCredit.toLocaleString("ja-JP")} 円
            </strong>
          </span>
          {!balanced && (
            <span className="text-destructive">
              差額: {Math.abs(totalDebit - totalCredit).toLocaleString("ja-JP")} 円
            </span>
          )}
        </div>

        {error && <p className="text-destructive text-sm">{error}</p>}

        <div className="flex gap-2">
          <Button type="submit" disabled={!balanced || pending || loading || !!loadError}>
            保存
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            キャンセル
          </Button>
        </div>
      </fieldset>
      </form>
    </div>
  );
}
