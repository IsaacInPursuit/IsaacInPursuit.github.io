import "../styles/globals.css";
import type { Metadata } from "next";
import FractalDemo, { FractalModeButton, FractalToggleButton } from "../components/FractalDemo";
import ThemeToggleButton from "../components/ThemeToggleButton";

export const metadata: Metadata = {
  title: "Isaac Johnston",
  description: "Entrepreneur • Real Estate and Finance • Startups",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        {/* Fractal controls and theme toggle */}
        <FractalDemo>
          <div className="fixed top-3 right-3 z-[60] flex items-center gap-2">
            <FractalToggleButton
              variant="subtle"
              labelWhenOff="Fractal"
              labelWhenOn="Hide fractal"
              title="Toggle fractal demo"
            />
            <FractalModeButton className="hidden sm:inline-flex" />
            <ThemeToggleButton />
          </div>
        </FractalDemo>

        {children}
      </body>
    </html>
  );
}
