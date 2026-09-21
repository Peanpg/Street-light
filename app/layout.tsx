import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "สำรวจโคมไฟสาธารณะ | น้ำพอง",
  description: "แผนที่จุดหม้อแปลงและติดตามงานสำรวจโคมไฟสาธารณะในอำเภอน้ำพอง",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="th"><body>{children}</body></html>;
}
