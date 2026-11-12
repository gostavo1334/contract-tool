import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ប្រព័ន្ធបំពេញកិច្ចសន្យាភ្នាក់ងារ មិត្តហ្វូន អ៊ិចប្រេស",
  description: "Metfone Express Agent Contract Filling System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="km">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Kantumruy+Pro:wght@400;500;600;700&family=Moul&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
