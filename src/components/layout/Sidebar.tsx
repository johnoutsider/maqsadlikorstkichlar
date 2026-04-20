"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import type { RoleName } from "@/types/db";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  roles: RoleName[];
}

const Icon = ({ d, size = 16 }: { d: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const NAV: NavItem[] = [
  {
    href: "/overview",
    label: "Statistika",
    icon: <Icon d="M3 3v18h18M7 16l4-4 4 4 4-6" />,
    roles: ["super_admin","university_admin","vice_rector","science_department","dean","staff_manager"],
  },
  {
    href: "/universities",
    label: "Universitetlar",
    icon: <Icon d="M3 21h18M9 21V7l4-4 4 4v14M9 12h6" />,
    roles: ["super_admin"],
  },
  {
    href: "/users",
    label: "Foydalanuvchilar",
    icon: <Icon d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zm8 2a3 3 0 016 0v1" />,
    roles: ["university_admin"],
  },
  {
    href: "/faculties",
    label: "Fakultetlar",
    icon: <Icon d="M12 3L2 9l10 6 10-6-10-6zM2 17l10 6 10-6M2 13l10 6 10-6" />,
    roles: ["university_admin"],
  },
  {
    href: "/departments",
    label: "Kafedralar",
    icon: <Icon d="M4 21V8a2 2 0 012-2h12a2 2 0 012 2v13M8 10h8M8 14h8M8 18h4" />,
    roles: ["university_admin"],
  },
  {
    href: "/indicators",
    label: "Ko'rsatkichlar",
    icon: <Icon d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />,
    roles: ["university_admin","science_department"],
  },
  {
    href: "/targets",
    label: "Maqsadlar",
    icon: <Icon d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 14l-4-4 1.41-1.41L12 13.17l6.59-6.58L20 8l-8 8z" />,
    roles: ["university_admin","science_department","vice_rector","dean"],
  },
  {
    href: "/submissions",
    label: "Hisobotlar",
    icon: <Icon d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />,
    roles: ["university_admin","science_department","vice_rector","dean"],
  },
  {
    href: "/form",
    label: "Hisobot formasi",
    icon: <Icon d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />,
    roles: ["staff_manager"],
  },
  {
    href: "/my-submissions",
    label: "Mening hisobotlarim",
    icon: <Icon d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />,
    roles: ["staff_manager"],
  },
  {
    href: "/notifications",
    label: "Bildirishnomalar",
    icon: <Icon d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />,
    roles: ["super_admin","university_admin","vice_rector","science_department","dean","staff_manager"],
  },
];

export function Sidebar({ unreadCount = 0 }: { unreadCount?: number }) {
  const pathname = usePathname();
  const { user } = useSupabaseAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (!user) return null;
  const items = NAV.filter((n) => n.roles.includes(user.role));

  const SidebarContent = () => (
    <div className="flex flex-col h-full" style={{ background: "var(--sidebar-bg)" }}>
      {/* Logo / Branding */}
      <div className="h-16 flex items-center px-5 shrink-0">
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: "rgba(255,255,255,0.12)" }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 21h18M9 21V7l4-4 4 4v14M9 12h6" />
            </svg>
          </div>
          <div>
            <p className="text-white font-display font-semibold text-sm leading-tight">Ilmiy Ko&apos;rsatkichlar</p>
            <p style={{ color: "rgba(255,255,255,0.45)", fontSize: "0.625rem", letterSpacing: "0.08em" }} className="uppercase font-medium">
              KPI Tizimi
            </p>
          </div>
        </div>
      </div>

      {/* Nav Items */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          const isNotif = item.href === "/notifications";
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className="flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-all group"
              style={{
                background: active ? "var(--sidebar-active-bg)" : "transparent",
                color: active ? "var(--sidebar-active-text)" : "var(--sidebar-text)",
              }}
              onMouseEnter={(e) => {
                if (!active) (e.currentTarget as HTMLElement).style.background = "var(--sidebar-hover-bg)";
              }}
              onMouseLeave={(e) => {
                if (!active) (e.currentTarget as HTMLElement).style.background = "transparent";
              }}
            >
              <span className="flex items-center gap-3">
                <span
                  className="shrink-0 transition-opacity"
                  style={{ opacity: active ? 1 : 0.6 }}
                >
                  {item.icon}
                </span>
                <span className="font-medium" style={{ fontSize: "0.8125rem" }}>{item.label}</span>
              </span>
              {isNotif && unreadCount > 0 && (
                <span
                  className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold rounded-full shrink-0"
                  style={{
                    background: active ? "rgba(255,255,255,0.25)" : "#ba1a1a",
                    color: "#ffffff",
                  }}
                >
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer: email */}
      <div className="px-4 py-4 shrink-0" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
        <p
          className="text-xs truncate font-medium"
          style={{ color: "rgba(255,255,255,0.4)" }}
        >
          {user.email}
        </p>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile top bar (hamburger) */}
      <div
        className="lg:hidden sticky top-0 z-40 h-14 flex items-center justify-between px-4"
        style={{ background: "var(--sidebar-bg)", boxShadow: "0 2px 8px rgba(0,0,0,0.2)" }}
      >
        <button
          onClick={() => setMobileOpen(true)}
          className="p-2 -ml-1.5 text-white/70 hover:text-white transition-colors"
          aria-label="Menyu"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <span className="text-white font-display font-semibold text-sm">IKT</span>
        <span className="w-9" />
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex animate-fade-in">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative w-72 max-w-[85%] flex flex-col shadow-institutional-lg overflow-hidden">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:left-0 lg:w-64 overflow-hidden" style={{ zIndex: 40 }}>
        <SidebarContent />
      </aside>
    </>
  );
}
