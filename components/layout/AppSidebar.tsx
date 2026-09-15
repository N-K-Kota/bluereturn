"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  BarChart3,
  Upload,
  Settings,
  LayoutDashboard,
  Tags,
  Library,
  ClipboardList,
} from "lucide-react";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/", label: "ダッシュボード", icon: LayoutDashboard },
  { href: "/journal", label: "仕訳帳", icon: BookOpen },
  { href: "/accounts", label: "勘定科目", icon: Tags },
  { href: "/import", label: "CSVインポート", icon: Upload },
  { href: "/dictionary", label: "辞書", icon: Library },
  { href: "/reports/pl", label: "損益計算書", icon: BarChart3 },
  { href: "/reports/bs", label: "貸借対照表", icon: BarChart3 },
  { href: "/tax", label: "確定申告", icon: ClipboardList },
  { href: "/settings", label: "設定", icon: Settings },
];

export function AppSidebar() {
  const pathname = usePathname();
  return (
    <aside className="print:hidden w-52 shrink-0 border-r bg-sidebar h-screen flex flex-col">
      <div className="px-4 py-5 border-b">
        <h1 className="text-base font-semibold text-sidebar-foreground">青色申告</h1>
      </div>
      <nav className="flex-1 py-3 overflow-y-auto">
        {nav.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            aria-current={pathname === href || (href !== "/" && pathname.startsWith(`${href}/`)) ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 px-4 py-2 text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground rounded-none transition-colors",
              (pathname === href || (href !== "/" && pathname.startsWith(`${href}/`))) && "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
            )}
          >
            <Icon size={16} />
            {label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
