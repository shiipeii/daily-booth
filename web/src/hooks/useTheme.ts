import { useEffect, useState } from "react";

export type Theme = "system" | "light" | "dark";
const KEY = "booth.theme";

/** light / dark / follow the phone. stored per device. */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem(KEY) as Theme) || "system");

  useEffect(() => {
    localStorage.setItem(KEY, theme);
    const root = document.documentElement;
    if (theme === "system") delete root.dataset.theme;
    else root.dataset.theme = theme;

    // keep the ios status bar / browser chrome in step with the background
    const meta = document.querySelector('meta[name="theme-color"]');
    const bg = getComputedStyle(root).getPropertyValue("--bg").trim();
    if (meta && bg) meta.setAttribute("content", bg);
  }, [theme]);

  return [theme, setTheme] as const;
}
