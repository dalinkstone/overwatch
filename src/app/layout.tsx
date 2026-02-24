import type { Metadata } from "next";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: "Overwatch — Military Movement Tracker",
  description:
    "Real-time military movement intelligence dashboard tracking aircraft, vessels, and satellites using publicly available data sources on an interactive map.",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
