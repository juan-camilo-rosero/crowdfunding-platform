import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import { es } from "@/i18n";
import "./globals.css";

// Geometric sans matching the brand reference. Exposed as --font-sans, which is
// what the Tailwind theme in globals.css reads.
const poppins = Poppins({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: es.app.name,
  description: es.app.description,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${poppins.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
