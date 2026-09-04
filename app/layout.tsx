import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import { AuthProvider } from "@/app/components/portal/AuthProvider";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.lastmileassist.com"),
  title: "Last Mile Assist",
  description: "One portal to run your whole delivery operation.",
  openGraph: {
    type: "website",
    siteName: "Last Mile Assist",
    title: "Last Mile Assist — One portal to run your whole delivery operation",
    description:
      "Inspections, maintenance, driver performance, hiring, and reporting — built by an operator, for delivery service partners.",
    url: "https://www.lastmileassist.com",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Last Mile Assist" }],
  },
  twitter: { card: "summary_large_image" },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Last Mile Assist",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-slate-100 text-slate-900">
        <AuthProvider>{children}</AuthProvider>
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-DCNXBQ19QT"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-DCNXBQ19QT');`}
        </Script>
      </body>
    </html>
  );
}
