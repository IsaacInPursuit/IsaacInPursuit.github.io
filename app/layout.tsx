import "../styles/globals.css";
import type { Metadata } from "next";
import FractalDemo from "../components/FractalDemo";

export const metadata: Metadata = {
  title: "Isaac Johnston",
  description: "Entrepreneur • Real Estate and Finance • Startups",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        {/* Fractal buttons on left and canvas layer */}
        <FractalDemo />

        {/* Theme button on right */}
        <div className="fixed top-3 right-3 z-[60]">
          <button id="theme-toggle" className="rounded-md border px-3 py-1 text-sm">
            Theme
          </button>
        </div>

        {children}
      </body>
    </html>
  );
}
