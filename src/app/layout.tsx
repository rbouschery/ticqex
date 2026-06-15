import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { cn } from "@/lib/utils";
import { ThemeProvider } from "@/components/theme-provider";
import { QueryProvider } from "@/components/query-provider";
import { AppToaster } from "@/components/ui/toaster";

const calSans = localFont({
  src: "../../node_modules/cal-sans/fonts/webfonts/CalSans-SemiBold.woff2",
  variable: "--font-cal-sans",
  weight: "600",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Ticqex",
  description: "Agent-first support platform",
  manifest: "/manifest.json",
  appleWebApp: {
    title: "Ticqex",
  },
};

export const viewport: Viewport = {
  themeColor: "#1a1a1b",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        "h-full overflow-hidden antialiased font-sans",
        calSans.variable,
      )}
    >
      <body className="flex h-full flex-col overflow-hidden">
        <QueryProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="light"
            enableSystem
            storageKey="ticqex-theme"
            disableTransitionOnChange
          >
            {children}
          </ThemeProvider>
        </QueryProvider>
        <AppToaster />
      </body>
    </html>
  );
}
