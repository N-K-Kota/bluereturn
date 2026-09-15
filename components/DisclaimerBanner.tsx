"use client";

import { useSyncExternalStore, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "disclaimer_accepted_v1";

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}
function readAccepted() {
  try { return localStorage.getItem(STORAGE_KEY) === "1"; } catch { return false; }
}

export function DisclaimerBanner() {
  const [accepted, setAccepted] = useState(false);
  const dismissed = useSyncExternalStore(subscribe, readAccepted, () => true) || accepted;

  if (dismissed) return null;

  function accept() {
    try { localStorage.setItem(STORAGE_KEY, "1"); } catch { /* Allow use when storage is unavailable. */ }
    setAccepted(true);
  }

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="disclaimer-title" className="print:hidden fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-background border rounded-lg shadow-xl max-w-lg w-full mx-4 p-6">
        <div className="flex items-start gap-3 mb-4">
          <AlertTriangle size={20} className="text-amber-500 shrink-0 mt-0.5" />
          <h2 id="disclaimer-title" className="font-semibold text-base">重要事項・免責事項</h2>
        </div>

        <div className="text-sm text-muted-foreground space-y-2 leading-relaxed mb-5">
          <p>
            本ソフトウェアが提供する税額計算は、入力された情報に基づく<strong className="text-foreground">参考値</strong>です。
            確定申告書の正確性を保証するものではありません。
          </p>
          <p>
            税法は毎年改正されます。本アプリは令和6年分・令和7年分の一部の所得・控除を計算します。
            最新の税法・通達との差異が生じる場合があります。
          </p>
          <p>
            実際の確定申告においては、国税庁の
            <strong className="text-foreground">確定申告書等作成コーナー（e-Tax）</strong>
            または税理士・税務署にご相談ください。
          </p>
          <p>
            計算結果に基づく申告内容の責任は申告者ご本人にあります。
            開発者は本ソフトウェアの利用により生じた損害について、いかなる場合も責任を負いません。
          </p>
          <p className="text-xs">
            ※ マイナンバーを登録する場合、端末のセキュリティ管理はご利用者の責任において行ってください。
          </p>
        </div>

        <Button onClick={accept} className="w-full">
          内容を確認しました
        </Button>
      </div>
    </div>
  );
}
