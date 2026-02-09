import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import Navbar from "@/components/Navbar";
import DevBanner from "@/components/DevBanner";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "NBA Analytics",
  description: "AI-powered NBA stats, shot charts, and analytics",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          <Navbar />
          <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">{children}</main>
          <DevBanner />
        </AuthProvider>
      </body>
    </html>
  );
}
