"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import type { UniversityBrand } from "./AppShell";

const ROLE_LABEL: Record<string, string> = {
  super_admin: "Super Admin",
  university_admin: "Universitet Admin",
  vice_rector: "Prorektor",
  science_department: "Ilmiy Bo'lim",
  dean: "Dekan",
  staff_manager: "Kafedra Mas'uli",
};

const BREADCRUMB_LABELS: Record<string, string> = {
  overview: "Statistika",
  monitoring: "Monitoring",
  universities: "Universitetlar",
  users: "Foydalanuvchilar",
  faculties: "Fakultetlar",
  departments: "Kafedralar",
  indicators: "Ko'rsatkichlar",
  targets: "Maqsadlar",
  submissions: "Hisobotlar",
  form: "Hisobot Formasi",
  "my-submissions": "Mening Hisobotlarim",
  notifications: "Bildirishnomalar",
};

export function Topbar({ brand }: { brand: UniversityBrand }) {
  const { user, signOut } = useSupabaseAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  // Build breadcrumb from pathname
  const segments = pathname.split("/").filter(Boolean);
  const crumbs = segments.map((seg) => ({
    label: BREADCRUMB_LABELS[seg] || seg,
  }));

  return (
    <header
      className="sticky top-0 z-30 h-14 flex items-center justify-between px-5 sm:px-7"
      style={{
        background: "var(--surface-container-lowest)",
        boxShadow: "0 1px 0 var(--outline-variant)",
      }}
    >
      {/* Breadcrumb */}
      <div className="hidden lg:flex items-center gap-2 min-w-0">
        {crumbs.map((crumb, i) => (
          <React.Fragment key={i}>
            {i > 0 && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--outline)" strokeWidth={2}>
                <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
            <span
              className="font-medium truncate"
              style={{
                fontFamily: "'Manrope', sans-serif",
                fontSize: "0.8125rem",
                color: i === crumbs.length - 1 ? "var(--on-surface)" : "var(--on-surface-variant)",
                fontWeight: i === crumbs.length - 1 ? 600 : 400,
              }}
            >
              {crumb.label}
            </span>
          </React.Fragment>
        ))}
      </div>

      {/* Mobile: App name */}
      <div className="lg:hidden">
        <span
          className="font-display font-semibold text-sm"
          style={{ color: "var(--on-surface)" }}
        >
          {brand.shortCode || "IKT"}
        </span>
      </div>

      {/* Right: User profile dropdown */}
      <div className="flex items-center gap-3">
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl transition-all"
            style={{
              background: open ? "var(--surface-container)" : "transparent",
              color: "var(--on-surface)",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--surface-container-low)"; }}
            onMouseLeave={(e) => { if (!open) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
            aria-expanded={open}
            aria-haspopup="true"
          >
            {/* Avatar */}
            <span
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 select-none text-xs font-bold text-white"
              style={{ background: "linear-gradient(135deg, #002046 0%, #1b365d 100%)" }}
            >
              {initials || "?"}
            </span>
            <div className="text-left hidden sm:block">
              <p
                className="leading-tight max-w-[160px] truncate font-semibold"
                style={{ fontSize: "0.8125rem", color: "var(--on-surface)" }}
              >
                {user.display_name}
              </p>
              <p
                className="leading-tight truncate"
                style={{ fontSize: "0.6875rem", color: "var(--on-surface-variant)" }}
              >
                {ROLE_LABEL[user.role] ?? user.role}
              </p>
            </div>
            <svg
              className={`w-3.5 h-3.5 transition-transform shrink-0`}
              style={{
                color: "var(--outline)",
                transform: open ? "rotate(180deg)" : "rotate(0)",
              }}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Dropdown */}
          {open && (
            <div
              className="absolute right-0 mt-2 w-72 rounded-2xl overflow-hidden animate-slide-up"
              style={{
                background: "var(--surface-container-lowest)",
                boxShadow: "0 20px 60px rgba(0, 32, 70, 0.12), 0 0 0 1px var(--outline-variant)",
              }}
            >
              {/* Profile header */}
              <div
                className="px-4 py-4 flex items-center gap-3"
                style={{ borderBottom: "1px solid var(--outline-variant)" }}
              >
                <span
                  className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 select-none text-white font-bold"
                  style={{ background: "linear-gradient(135deg, #002046 0%, #1b365d 100%)", fontSize: "1rem" }}
                >
                  {initials || "?"}
                </span>
                <div className="min-w-0">
                  <p
                    className="font-semibold truncate"
                    style={{ fontSize: "0.875rem", color: "var(--on-surface)" }}
                  >
                    {user.display_name}
                  </p>
                  <p
                    className="truncate"
                    style={{ fontSize: "0.75rem", color: "var(--on-surface-variant)" }}
                  >
                    {user.email}
                  </p>
                  <span
                    className="inline-block mt-1.5 px-2 py-0.5 rounded-full font-medium"
                    style={{
                      fontSize: "0.625rem",
                      background: "var(--surface-container-high)",
                      color: "var(--on-surface-variant)",
                      letterSpacing: "0.05em",
                      textTransform: "uppercase",
                    }}
                  >
                    {ROLE_LABEL[user.role] ?? user.role}
                  </span>
                </div>
              </div>

              {/* Theme toggle */}
              <div
                className="px-4 py-3"
                style={{ borderBottom: "1px solid var(--outline-variant)" }}
              >
                <p
                  className="mb-2 font-medium uppercase"
                  style={{ fontSize: "0.625rem", letterSpacing: "0.08em", color: "var(--on-surface-variant)" }}
                >
                  Interfeys Rejimi
                </p>
                <ThemeToggle />
              </div>

              {/* Sign out */}
              <div className="p-2">
                <button
                  onClick={async () => {
                    setOpen(false);
                    await signOut();
                    router.replace("/login");
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-colors text-left"
                  style={{ color: "var(--on-surface-variant)" }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background = "#ffdad6";
                    (e.currentTarget as HTMLElement).style.color = "#410002";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = "transparent";
                    (e.currentTarget as HTMLElement).style.color = "var(--on-surface-variant)";
                  }}
                >
                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Tizimdan chiqish
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
