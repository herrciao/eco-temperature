import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "宏觀溫度看板 | Macro Regime",
  description: "Macro regime research dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant" className="dark">
      <body className="min-h-screen bg-slate-950 font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
