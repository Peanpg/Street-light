import type { Metadata } from "next";
import "./globals.css";
import "./map-controls.css";
import "./follow-button.css";

export const metadata: Metadata = {
  title: "สำรวจมิเตอร์ไฟสาธารณะ | น้ำพอง",
  description: "แผนที่จุดหม้อแปลงและติดตามงานสำรวจมิเตอร์ไฟสาธารณะในอำเภอน้ำพอง",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="th"><body>{children}</body></html>;
}
