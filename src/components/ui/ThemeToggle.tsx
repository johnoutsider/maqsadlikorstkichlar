"use client";

import React from "react";
import { useTheme } from "@/hooks/useTheme";

export const ThemeToggle: React.FC = () => {
  const { themeMode, setThemeMode } = useTheme();

  return (
    <div className="flex bg-surface-100 dark:bg-surface-800 p-1 rounded-lg border dark:border-surface-700 w-fit">
      <button
        onClick={() => setThemeMode("light")}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
          themeMode === "light" 
            ? "bg-white shadow-sm text-surface-900" 
            : "text-surface-500 hover:text-surface-700 dark:text-surface-400 dark:hover:text-surface-200"
        }`}
        title="Yorug' rejim"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      </button>
      <button
        onClick={() => setThemeMode("system")}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
          themeMode === "system" 
            ? "bg-white dark:bg-surface-600 shadow-sm text-surface-900 dark:text-surface-50" 
            : "text-surface-500 hover:text-surface-700 dark:text-surface-400 dark:hover:text-surface-200"
        }`}
        title="Tizim sozlamasi"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      </button>
      <button
        onClick={() => setThemeMode("dark")}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
          themeMode === "dark" 
            ? "bg-surface-600 shadow-sm text-surface-50" 
            : "text-surface-500 hover:text-surface-700 dark:text-surface-400 dark:hover:text-surface-200"
        }`}
        title="Tungi rejim"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      </button>
    </div>
  );
};
