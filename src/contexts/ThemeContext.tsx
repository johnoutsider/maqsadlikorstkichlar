"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { THEME_STORAGE_KEY } from "@/lib/constants";
import type { ThemeMode } from "@/types";

interface ThemeContextType {
  theme: "light" | "dark";
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
}

export const ThemeContext = createContext<ThemeContextType>({
  theme: "light",
  themeMode: "system",
  setThemeMode: () => {},
});

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [themeMode, setThemeModeState] = useState<ThemeMode>("system");
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    // 1. Restore mode from local storage
    const savedMode = (window.localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode) || "system";
    setThemeModeState(savedMode);
  }, []);

  useEffect(() => {
    // 2. Apply theme based on mode
    const applyTheme = (isDark: boolean) => {
      setTheme(isDark ? "dark" : "light");
      if (isDark) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    };

    if (themeMode === "system") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      applyTheme(mediaQuery.matches);
      
      const listener = (e: MediaQueryListEvent) => applyTheme(e.matches);
      mediaQuery.addEventListener("change", listener);
      return () => mediaQuery.removeEventListener("change", listener);
    } else {
      applyTheme(themeMode === "dark");
    }
  }, [themeMode]);

  const setThemeMode = (mode: ThemeMode) => {
    setThemeModeState(mode);
    window.localStorage.setItem(THEME_STORAGE_KEY, mode);
  };

  return (
    <ThemeContext.Provider value={{ theme, themeMode, setThemeMode }}>
      {children}
    </ThemeContext.Provider>
  );
};
