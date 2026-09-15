"use client";

import { useRef, useState } from "react";
import { toast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/validation";

export function useAsyncAction() {
  const lock = useRef(false);
  const [pending, setPending] = useState(false);
  async function run(action: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setPending(true);
    try { await action(); }
    catch (error) { toast.add({ type: "error", title: "処理を完了できませんでした", description: errorMessage(error) }); }
    finally { lock.current = false; setPending(false); }
  }
  return { run, pending };
}
