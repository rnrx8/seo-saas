import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "SEO記事生成",
  description: "AIによるSEO記事自動生成サービス",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <footer className="mt-auto border-t border-gray-100 bg-white px-8 py-4 text-center text-xs text-gray-400">
          <Link href="/privacy" className="hover:text-gray-600 transition-colors">プライバシーポリシー</Link>
        </footer>
      </body>
    </html>
  );
}
