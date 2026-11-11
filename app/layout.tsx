import type { Metadata } from "next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Shell } from "./shell";
import { KumoProvider } from "./kumo-provider";

const sans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const mono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "R2 Manager",
  description: "Manage Cloudflare R2",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${sans.variable} ${mono.variable} h-full antialiased`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('r2-theme');document.documentElement.dataset.mode=t==='dark'||(t!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches)?'dark':'light'}catch(e){}})()`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <KumoProvider>
          <Shell>{children}</Shell>
        </KumoProvider>
        <SpeedInsights />
      </body>
    </html>
  );
}
