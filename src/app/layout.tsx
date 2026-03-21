import type { Metadata } from "next";
import { Noto_Sans_JP, Zen_Old_Mincho } from "next/font/google";
import "./globals.css";

const bodyFont = Noto_Sans_JP({
  variable: "--font-body",
  subsets: ["latin"],
});

const displayFont = Zen_Old_Mincho({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "出店フォームビルダー",
  description: "イベント出店フォームの作成と回答管理ができるツールです。",
  applicationName: "出店フォームビルダー",
  openGraph: {
    title: "出店フォームビルダー",
    description: "イベント出店フォームの作成と回答管理ができるツールです。",
    siteName: "出店フォームビルダー",
    locale: "ja_JP",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "出店フォームビルダー",
    description: "イベント出店フォームの作成と回答管理ができるツールです。",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ja"
      className={`${bodyFont.variable} ${displayFont.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
