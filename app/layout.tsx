import type { Metadata } from "next";
import {
  Instrument_Sans,
  Bricolage_Grotesque,
  JetBrains_Mono,
} from "next/font/google";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { MotionProvider } from "@/components/motion-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const sans = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const display = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Final Showdown — Job Tracker",
  description: "Track new-grad applications together. May the best applicant win.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${sans.variable} ${display.variable} ${mono.variable}`}
    >
      <body className="min-h-screen font-sans">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          themes={["light", "graphite", "dark"]}
          disableTransitionOnChange={false}
        >
          <MotionProvider>
            <TooltipProvider delayDuration={200}>
              {children}
            </TooltipProvider>
          </MotionProvider>
          <Toaster
            position="bottom-right"
            toastOptions={{
              classNames: {
                toast:
                  "!bg-card !text-card-foreground !border !shadow-xl !rounded-xl",
              },
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
