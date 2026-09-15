"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { getTaxProfile, upsertTaxProfile } from "@/lib/db/tax";
import type { TaxProfile, FiscalYear, ConsumptionTaxType, BlueDeduction } from "@/types/tax";
import { Save, CheckCircle } from "lucide-react";
import { SIMPLIFIED_TAX_INDUSTRY_LABELS } from "@/lib/tax/constants";
import Link from "next/link";
import { useAsyncAction } from "@/hooks/use-async-action";
import { errorMessage } from "@/lib/validation";

const YEARS: FiscalYear[] = ["2025", "2024"];

const BLANK_PROFILE: Omit<TaxProfile, "id"> = {
  fiscal_year: "2025",
  name: "",
  name_kana: "",
  address: "",
  address_kana: "",
  birthday: "",
  phone: "",
  business_type: "",
  my_number: "",
  consumption_tax_type: "exempt",
  simplified_tax_industry: "5",
  blue_deduction: "650000",
};

export default function SettingsPage() {
  const [year, setYear] = useState<FiscalYear>("2025");
  return <ProfileSettings key={year} year={year} setYear={setYear} />;
}

function ProfileSettings({ year, setYear }: { year: FiscalYear; setYear: (year: FiscalYear) => void }) {
  const [profile, setProfile] = useState<Omit<TaxProfile, "id">>({ ...BLANK_PROFILE, fiscal_year: year });
  const [saved, setSaved] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { run, pending } = useAsyncAction();

  useEffect(() => {
    let active = true;
    getTaxProfile(year).then((profile) => {
      if (!active) return;
      setProfile(profile ?? { ...BLANK_PROFILE, fiscal_year: year });
      setLoading(false);
    }).catch((error) => { if (active) { setError(errorMessage(error)); setLoading(false); } });
    return () => { active = false; };
  }, [year]);

  function setField<K extends keyof Omit<TaxProfile, "id">>(
    key: K,
    value: Omit<TaxProfile, "id">[K]
  ) {
    setProfile((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  async function handleSaveProfile() {
    await run(async () => {
      await upsertTaxProfile(profile);
      setSaved(true);
    });
  }

  return (
    <div className="p-6 max-w-2xl">
      <h2 className="text-xl font-semibold mb-4">設定</h2>

      <p className="text-sm mb-4"><Link href="/dictionary" className="underline">CSVの勘定科目辞書を管理</Link></p>
      {loading && <p role="status" className="text-sm mb-4">読み込み中...</p>}
      {error && <p role="alert" className="text-destructive text-sm mb-4">{error}</p>}
      <fieldset disabled={loading || pending || !!error}>
        <div className="space-y-5">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <Label className="text-sm font-medium">対象年度</Label>
              <Select
                value={year}
                onValueChange={(v) => setYear((v ?? "2025") as FiscalYear)}
              >
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {YEARS.map((y) => (
                    <SelectItem key={y} value={y}>
                      {y === "2024" ? "令和6年分" : "令和7年分"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button size="sm" onClick={handleSaveProfile} disabled={loading || pending || !!error} className="gap-1.5">
              {saved ? (
                <>
                  <CheckCircle size={14} />
                  保存済み
                </>
              ) : (
                <>
                  <Save size={14} />
                  保存
                </>
              )}
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs mb-1 block">氏名</Label>
              <Input
                value={profile.name}
                onChange={(e) => setField("name", e.target.value)}
                placeholder="山田 太郎"
              />
            </div>
            <div>
              <Label className="text-xs mb-1 block">氏名（フリガナ）</Label>
              <Input
                value={profile.name_kana}
                onChange={(e) => setField("name_kana", e.target.value)}
                placeholder="ヤマダ タロウ"
              />
            </div>
            <div className="col-span-2">
              <Label className="text-xs mb-1 block">住所</Label>
              <Input
                value={profile.address}
                onChange={(e) => setField("address", e.target.value)}
                placeholder="東京都千代田区..."
              />
            </div>
            <div className="col-span-2">
              <Label className="text-xs mb-1 block">住所（フリガナ）</Label>
              <Input
                value={profile.address_kana}
                onChange={(e) => setField("address_kana", e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs mb-1 block">生年月日</Label>
              <Input
                type="date"
                value={profile.birthday}
                onChange={(e) => setField("birthday", e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs mb-1 block">電話番号</Label>
              <Input
                value={profile.phone}
                onChange={(e) => setField("phone", e.target.value)}
                placeholder="090-0000-0000"
              />
            </div>
            <div>
              <Label className="text-xs mb-1 block">業種</Label>
              <Input
                value={profile.business_type}
                onChange={(e) => setField("business_type", e.target.value)}
                placeholder="情報処理サービス業"
              />
            </div>
            <div>
              <Label className="text-xs mb-1 block">マイナンバー（個人番号）</Label>
              <Input
                value={profile.my_number}
                onChange={(e) => setField("my_number", e.target.value)}
                placeholder="000000000000"
                maxLength={12}
              />
            </div>
          </div>

          <div className="border-t pt-4 space-y-4">
            <h4 className="text-sm font-medium">申告区分</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs mb-1 block">青色申告特別控除額</Label>
                <Select
                  value={profile.blue_deduction}
                  onValueChange={(v) => setField("blue_deduction", (v ?? "650000") as BlueDeduction)}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="650000">65万円（e-Tax申告または電子帳簿保存）</SelectItem>
                    <SelectItem value="550000">55万円（複式簿記・書面申告）</SelectItem>
                    <SelectItem value="100000">10万円（現金主義・簡易簿記）</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  65万円控除はe-Taxでの電子申告または電子帳簿保存法対応が必要です
                </p>
              </div>
              <div>
                <Label className="text-xs mb-1 block">消費税区分</Label>
                <Select
                  value={profile.consumption_tax_type}
                  onValueChange={(v) =>
                    setField("consumption_tax_type", (v ?? "exempt") as ConsumptionTaxType)
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="exempt">免税事業者</SelectItem>
                    <SelectItem value="general">一般課税（インボイス制度）</SelectItem>
                    <SelectItem value="simplified">簡易課税</SelectItem>
                    <SelectItem value="two_tenth">2割特例（令和5〜8年・課税転換者向け）</SelectItem>
                  </SelectContent>
                </Select>
                {profile.consumption_tax_type === "two_tenth" && (
                  <p className="text-xs text-amber-700 mt-1">
                    ※ 令和5年10月〜令和8年9月の課税期間が対象。免税事業者からの転換者が適用できます。
                  </p>
                )}
              </div>
              {profile.consumption_tax_type === "simplified" && (
                <div className="col-span-2">
                  <Label className="text-xs mb-1 block">事業区分（みなし仕入率）</Label>
                  <Select
                    value={profile.simplified_tax_industry}
                    onValueChange={(v) =>
                      setField("simplified_tax_industry", (v ?? "5") as TaxProfile["simplified_tax_industry"])
                    }
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(SIMPLIFIED_TAX_INDUSTRY_LABELS).map(([k, label]) => (
                        <SelectItem key={k} value={k}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>
        </div>
      </fieldset>
    </div>
  );
}
