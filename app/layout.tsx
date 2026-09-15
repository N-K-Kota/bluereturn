import type { Metadata } from "next";
import "./globals.css";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { DisclaimerBanner } from "@/components/DisclaimerBanner";
import { Toaster } from "@/components/ui/toast";

export const metadata: Metadata = {
  title: "青色申告",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="h-full flex overflow-hidden">
        <DisclaimerBanner />
        <AppSidebar />
        <main className="flex-1 overflow-y-auto bg-background">
          {children}
        </main>
        <Toaster />
      </body>
    </html>
  );
}
