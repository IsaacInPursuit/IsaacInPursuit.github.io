"use client";

import {
  useCallback,
  useEffect,
  useState,
  type ButtonHTMLAttributes,
  type MouseEvent,
  type ReactNode,
} from "react";

const THEME_STORAGE_KEY = "theme-preference";

type Theme = "light" | "dark";

export type ThemeToggleButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children?: ReactNode;
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

const baseClasses =
  "rounded-md border px-3 py-1 text-sm backdrop-blur border-neutral-300 dark:border-neutral-700 bg-white/60 dark:bg-neutral-900/60 hover:bg-white dark:hover:bg-neutral-800 transition";

export default function ThemeToggleButton({
  className,
  children,
  onClick,
  title,
  ...rest
}: ThemeToggleButtonProps) {
  const [theme, setTheme] = useState<Theme | null>(null);

  const applyTheme = useCallback(
    (value: Theme, persist = false) => {
      if (typeof document === "undefined") return;
      const root = document.documentElement;
      root.classList.toggle("dark", value === "dark");
      root.style.colorScheme = value;
      setTheme(value);
      if (persist && typeof window !== "undefined") {
        try {
          window.localStorage.setItem(THEME_STORAGE_KEY, value);
        } catch {
          // Ignore storage errors (e.g., private browsing)
        }
      }
    },
    [],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    } catch {
      stored = null;
    }

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const initial: Theme =
      stored === "light" || stored === "dark"
        ? (stored as Theme)
        : media.matches
          ? "dark"
          : "light";

    applyTheme(initial);

    const handleSchemeChange = (event: MediaQueryListEvent) => {
      let saved: string | null = null;
      try {
        saved = window.localStorage.getItem(THEME_STORAGE_KEY);
      } catch {
        saved = null;
      }
      if (saved === "light" || saved === "dark") {
        return;
      }
      applyTheme(event.matches ? "dark" : "light");
    };

    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", handleSchemeChange);
    } else if (typeof media.addListener === "function") {
      media.addListener(handleSchemeChange);
    }

    return () => {
      if (typeof media.removeEventListener === "function") {
        media.removeEventListener("change", handleSchemeChange);
      } else if (typeof media.removeListener === "function") {
        media.removeListener(handleSchemeChange);
      }
    };
  }, [applyTheme]);

  const handleClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      const root = typeof document !== "undefined" ? document.documentElement : null;
      const currentTheme: Theme =
        theme ?? (root?.classList.contains("dark") ? "dark" : "light");
      const nextTheme: Theme = currentTheme === "dark" ? "light" : "dark";
      applyTheme(nextTheme, true);
      onClick?.(event);
    },
    [applyTheme, onClick, theme],
  );

  const label =
    children ??
    (theme === "dark" ? "Light mode" : theme === "light" ? "Dark mode" : "Theme");
  const buttonTitle =
    title ??
    (theme === "dark"
      ? "Switch to light mode"
      : theme === "light"
        ? "Switch to dark mode"
        : "Toggle color theme");
  const pressed = theme === "dark" ? true : theme === "light" ? false : undefined;

  return (
    <button
      type="button"
      {...rest}
      onClick={handleClick}
      className={cx(baseClasses, className)}
      aria-pressed={pressed}
      aria-label={typeof label === "string" ? label : undefined}
      title={buttonTitle}
    >
      {label}
    </button>
  );
}
