import { Button } from "@/components/ui/button";

export function LoadStatus({ loading, error, retry }: { loading: boolean; error: string; retry: () => void }) {
  if (error) return <div role="alert" className="mb-4 text-sm text-destructive"><p>{error}</p><Button variant="outline" size="sm" onClick={retry} className="mt-2">再読み込み</Button></div>;
  if (loading) return <p role="status" className="mb-4 text-sm text-muted-foreground">読み込み中...</p>;
  return null;
}
