import type { ImportRule } from "@/types";

export function matchRule(description: string, rules: ImportRule[], type: "debit" | "credit"): ImportRule | null {
  const lower = description.toLowerCase();
  return rules.filter((rule) => rule.entry_type === type && rule.keyword.trim() && lower.includes(rule.keyword.toLowerCase()))
    .sort((a, b) => b.keyword.length - a.keyword.length || a.id - b.id)[0] ?? null;
}
