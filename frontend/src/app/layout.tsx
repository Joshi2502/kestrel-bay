import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, Source_Serif_4 } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";

const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});
const sourceSerif = Source_Serif_4({
  variable: "--font-source-serif",
  subsets: ["latin"],
  weight: ["400", "600"],
  display: "swap",
});
const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Kestrel Bay — Monday screen",
  description: "What will run out before a reorder arrives, and what stock is stuck",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const choice = (await cookies()).get("theme")?.value;
  // "system" renders no attribute, so prefers-color-scheme decides without a flash.
  const theme = choice === "light" || choice === "dark" ? choice : undefined;
  return (
    <html
      lang="en"
      data-theme={theme}
      className={`${plexSans.variable} ${sourceSerif.variable} ${plexMono.variable} h-full`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
