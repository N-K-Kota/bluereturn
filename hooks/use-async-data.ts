"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { errorMessage } from "@/lib/validation";

// Pass a stable loader (module function or useCallback). Old requests are ignored
// after a filter change, reload or unmount; stale results are never displayed.
export function useAsyncData<T>(loader: () => Promise<T>) {
  const [revision, setRevision] = useState(0);
  const request = useMemo(() => ({ loader, revision }), [loader, revision]);
  const [state, setState] = useState<{ request: typeof request; data: T | null; error: string } | null>(null);
  useEffect(() => {
    let active = true;
    loader().then(
      (data) => { if (active) setState({ request, data, error: "" }); },
      (error) => { if (active) setState({ request, data: null, error: errorMessage(error) }); },
    );
    return () => { active = false; };
  }, [loader, request]);
  const reload = useCallback(() => setRevision((value) => value + 1), []);
  const current = state?.request === request ? state : null;
  return { data: current?.data ?? null, error: current?.error ?? "", loading: !current, reload };
}
