import type { Metadata, Viewport } from "next";
import { Archivo } from "next/font/google";
import { Toaster } from "sonner";
import { Nav } from "@/components/Nav";
import { BackgroundDecor } from "@/components/BackgroundDecor";
import { AuthProvider } from "@/components/AuthProvider";
import "./globals.css";

// A grotesk with a slightly engineered, technical character — fits the "control room"
// monitoring-dashboard concept without reaching for the Inter/Geist/Plus Jakarta default every
// AI-generated interface converges on. latin-ext carries Turkish's İ/ı/ş/ğ/ç/ö/ü.
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  title: "YouTube Kanal Yönetim Paneli",
  description: "YouTube kanallarını kategori, dil ve ülkeye göre takip eden yönetim paneli",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f0f0f",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="tr" className={`${archivo.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-canvas">
        <AuthProvider>
          <BackgroundDecor />
          <Nav />
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
          <Toaster theme="dark" richColors position="top-right" />
        </AuthProvider>
      </body>
    </html>
  );
}
