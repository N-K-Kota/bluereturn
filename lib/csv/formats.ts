export interface BankFormat {
  id: string;
  name: string;
  headers: string[];
  parse: (row: Record<string, string>) => {
    date: string;
    description: string;
    debit: number;
    credit: number;
  } | null;
}

function parseDate(s: string): string {
  // YYYY/MM/DD or YYYY-MM-DD or YYYYMMDD → YYYY-MM-DD
  const cleaned = s.replace(/\//g, "-").replace(/\./g, "-");
  if (/^\d{8}$/.test(cleaned)) {
    return `${cleaned.slice(0, 4)}-${cleaned.slice(4, 6)}-${cleaned.slice(6, 8)}`;
  }
  return cleaned;
}

function parseAmount(s: string): number {
  if (!s || s.trim() === "") return 0;
  return parseFloat(s.replace(/,/g, "").replace(/￥/g, "").trim()) || 0;
}

export const BANK_FORMATS: BankFormat[] = [
  {
    id: "mufg",
    name: "三菱UFJ銀行",
    headers: ["取引日", "摘要", "摘要内容", "支払い金額", "預かり金額", "差引残高"],
    parse: (row) => ({
      date: parseDate(row["取引日"]),
      description: row["摘要内容"] || row["摘要"] || "",
      debit: parseAmount(row["支払い金額"]),
      credit: parseAmount(row["預かり金額"]),
    }),
  },
  {
    id: "mizuho",
    name: "みずほ銀行",
    headers: ["年月日", "摘要", "お支払金額", "お預り金額", "差引残高"],
    parse: (row) => ({
      date: parseDate(row["年月日"]),
      description: row["摘要"] || "",
      debit: parseAmount(row["お支払金額"]),
      credit: parseAmount(row["お預り金額"]),
    }),
  },
  {
    id: "smbc",
    name: "三井住友銀行",
    headers: ["年月日", "摘要", "お支払金額（円）", "お預り金額（円）", "残高（円）"],
    parse: (row) => ({
      date: parseDate(row["年月日"]),
      description: row["摘要"] || "",
      debit: parseAmount(row["お支払金額（円）"]),
      credit: parseAmount(row["お預り金額（円）"]),
    }),
  },
  {
    id: "rakuten_bank",
    name: "楽天銀行",
    headers: ["取引日", "入出金種別", "入出金額（円）", "取引後残高（円）", "取引内容"],
    parse: (row) => {
      const type = row["入出金種別"] || "";
      const amount = parseAmount(row["入出金額（円）"]);
      return {
        date: parseDate(row["取引日"]),
        description: row["取引内容"] || "",
        debit: type === "出金" ? amount : 0,
        credit: type === "入金" ? amount : 0,
      };
    },
  },
  {
    id: "gmo_aozora",
    name: "GMOあおぞらネット銀行",
    headers: ["取引日", "摘要", "出金金額（円）", "入金金額（円）", "残高（円）"],
    parse: (row) => ({
      date: parseDate(row["取引日"]),
      description: row["摘要"] || "",
      debit: parseAmount(row["出金金額（円）"]),
      credit: parseAmount(row["入金金額（円）"]),
    }),
  },
  {
    id: "rakuten_card",
    name: "楽天カード",
    headers: ["利用日", "利用店名・商品名", "利用者", "支払方法", "利用金額", "支払金額"],
    parse: (row) => ({
      date: parseDate(row["利用日"]),
      description: row["利用店名・商品名"] || "",
      debit: parseAmount(row["利用金額"]),
      credit: 0,
    }),
  },
  {
    id: "smbc_card",
    name: "三井住友カード",
    headers: ["ご利用日", "ご利用店名", "ご本人様のご利用金額（円）"],
    parse: (row) => ({
      date: parseDate(row["ご利用日"]),
      description: row["ご利用店名"] || "",
      debit: parseAmount(row["ご本人様のご利用金額（円）"]),
      credit: 0,
    }),
  },
];

export function detectFormat(headers: string[]): BankFormat | null {
  for (const fmt of BANK_FORMATS) {
    const required = fmt.headers.slice(0, 3);
    if (required.every((h) => headers.includes(h))) {
      return fmt;
    }
  }
  return null;
}
