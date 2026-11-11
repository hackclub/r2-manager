"use client";
import { useEffect, useState } from "react";
import { Button } from "@cloudflare/kumo/components/button";

// Mirrors the pre-paint script in layout.tsx.
const apply = (dark: boolean) => {
  document.documentElement.dataset.mode = dark ? "dark" : "light";
  return dark;
};

export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => {
      let choice: string | null = null;
      try {
        choice = localStorage.getItem("r2-theme");
      } catch {
        /* Use system preference. */
      }
      setDark(apply(choice === "dark" || (choice !== "light" && media.matches)));
    };
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);
  function toggle() {
    setDark(apply(!dark));
    try {
      localStorage.setItem("r2-theme", dark ? "light" : "dark");
    } catch {
      /* Keep the choice for this page. */
    }
  }
  return (
    <Button
      variant="ghost"
      type="button"
      onClick={toggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {dark ? "☀" : "☾"}
    </Button>
  );
}
