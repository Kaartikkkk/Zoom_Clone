import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Zoom - Video Conferencing, Cloud Phone, Webinars",
  description: "Zoom's secure, reliable video platform powers all of your communication needs, including meetings, chat, phone, webinars, and online events.",
  icons: {
    icon: [
      { url: "/favicon.png", type: "image/png" },
      { url: "/icon.png", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: "/favicon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon.png?v=3" />
        <link rel="icon" type="image/x-icon" href="/favicon.ico?v=3" />
        <link rel="shortcut icon" href="/favicon.ico?v=3" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png?v=3" />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
