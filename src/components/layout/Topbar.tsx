"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

const ROLE_LABEL: Record<string, string> = {
  super_admin: "Super admin",
  university_admin: "Universitet admin",
  vice_rector: "Prorektor",
  science_department: "Ilmiy bo'lim",
  dean: "Dekan",
  staff_manager: "Kafedra mas'uli",
};

export function Topbar() {
  const { user, signOut } = useSupabaseAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (!user) return null;

  const initials = user.display_name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <header className="sticky top-0 z-30 h-14 bg-white dark:bg-surface-900 border-b border-surface-200 dark:border-surface-700 flex items-center justify-between px-4 sm:px-6">
      {/* Left: Page context label (shown on mobile since sidebar is hidden) */}
      <div className="lg:hidden">
        <span className="font-semibold text-sm text-surface-900 dark:text-surface-100">
          Ilmiy Ko&apos;rsatkichlar
        </span>
      </div>
      <div className="hidden lg:block" />

      {/* Right: profile dropdown */}
      <div className="flex items-center gap-3">
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-2.5 rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 px-3 py-1.5 hover:bg-surface-50 dark:hover:bg-surface-700 transition-colors"
            aria-expanded={open}
            aria-haspopup="true"
          >
            {/* Avatar */}
            <span className="w-7 h-7 rounded-full bg-primary-600 text-white text-xs font-bold flex items-center justify-center shrink-0 select-none">
              {initials || "?"}
            </span>
            <div className="text-left hidden sm:block">
              <p className="text-sm font-medium text-surface-900 dark:text-surface-100 leading-tight max-w-[160px] truncate">
                {user.display_name}
              </p>
              <p className="text-xs text-surface-500 dark:text-surface-400 leading-tight">
                {ROLE_LABEL[user.role] ?? user.role}
              </p>
            </div>
            <svg
              className={`w-3.5 h-3.5 text-surface-400 transition-transform ${open ? "rotate-180" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Dropdown */}
          {open && (
            <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-surface-800 rounded-xl shadow-xl border border-surface-200 dark:border-surface-700 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
              {/* Profile header */}
              <div className="px-4 py-3.5 border-b border-surface-200 dark:border-surface-700 flex items-center gap-3">
                <span className="w-10 h-10 rounded-full bg-primary-600 text-white text-sm font-bold flex items-center justify-center shrink-0 select-none">
                  {initials || "?"}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-surface-900 dark:text-surface-100 truncate">
                    {user.display_name}
                  </p>
                  <p className="text-xs text-surface-500 dark:text-surface-400 truncate">
                    {user.email}
                  </p>
                  <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300">
                    {ROLE_LABEL[user.role] ?? user.role}
                  </span>
                </div>
              </div>

              {/* Theme toggle */}
              <div className="px-4 py-3 border-b border-surface-200 dark:border-surface-700">
                <p className="text-xs font-medium text-surface-500 dark:text-surface-400 mb-2">Interfeys rejimi</p>
                <ThemeToggle />
              </div>

              {/* Sign out */}
              <div className="px-3 py-2">
                <button
                  onClick={async () => {
                    setOpen(false);
                    await signOut();
                    router.replace("/login");
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-surface-600 dark:text-surface-400 hover:bg-danger-50 hover:text-danger-600 dark:hover:bg-danger-900/30 dark:hover:text-danger-400 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Chiqish
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
