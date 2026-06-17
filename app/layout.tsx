import type { Metadata } from "next";
import React from "react";
import { Toaster } from "react-hot-toast";
import { ThemeProvider } from "next-themes";
import "../styles/globals.css";
import { AppShell } from "@/components/layout/AppShell";
import { SocketProvider } from "@/components/providers/SocketProvider";
import { AuthGate } from "@/components/auth/AuthGate";

/* ── Google Fonts ──────────────────────────────────────────────────────────── */

/* ── Metadata ──────────────────────────────────────────────────────────────── */

export const metadata: Metadata = {
  title: {
    default: "IKF Kenshido — International Kickboxing Federation",
    template: "%s | IKF Kenshido",
  },
  description:
    "The IKF Kenshido martial arts management platform — athlete profiles, fight cards, live scoring, rankings, and statistics for the International Kickboxing Federation.",
  keywords: ["IKF", "kickboxing", "martial arts", "federation", "fighters", "rankings", "fight results"],
  authors: [{ name: "IKF Kenshido" }],
  openGraph: {
    type: "website",
    locale: "en_US",
    title: "IKF Kenshido — International Kickboxing Federation",
    description: "Premium martial arts federation management platform",
    siteName: "IKF Kenshido",
  },
  robots: {
    index: true,
    follow: true,
  },
};

/* ── Root Layout ───────────────────────────────────────────────────────────── */

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="dark"
      suppressHydrationWarning
    >
      <head>
      </head>
      <body
        className="font-body bg-[var(--bg-primary)] text-[var(--text-primary)] antialiased min-h-screen"
        suppressHydrationWarning
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          <SocketProvider>
            <AuthGate>
              <AppShell>
                {children}
              </AppShell>
            </AuthGate>
          </SocketProvider>

          {/* Global notification system */}
          <Toaster
            position="top-right"
            gutter={8}
            toastOptions={{
              duration: 4000,
              style: {
                background: "#111318",
                color: "#f0f2f8",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "12px",
                fontFamily: "Inter, system-ui, sans-serif",
                fontSize: "0.875rem",
                fontWeight: 600,
                boxShadow: "0 10px 40px rgba(0,0,0,0.6), 0 2px 8px rgba(0,0,0,0.4)",
                padding: "12px 16px",
              },
              success: {
                style: { border: "1px solid rgba(34,197,94,0.4)", background: "#0e1a13" },
                iconTheme: { primary: "#22c55e", secondary: "#0e1a13" },
              },
              error: {
                style: { border: "1px solid rgba(200,16,46,0.4)", background: "#1a0b0e" },
                iconTheme: { primary: "#c8102e", secondary: "#1a0b0e" },
              },
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
