"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import type { RoleName } from "@/types/db";

interface NavItem {
  href: string;
  label: string;
  roles: RoleName[];
}

const NAV: NavItem[] = [
  { href: "/overview",       label: "Statistika",       roles: ["super_admin","university_admin","vice_rector","science_department","dean","staff_manager"] },
  { href: "/universities",   label: "Universitetlar",   roles: ["super_admin"] },
  { href: "/users",          label: "Foydalanuvchilar", roles: ["university_admin"] },
  { href: "/faculties",      label: "Fakultetlar",      roles: ["university_admin"] },
  { href: "/departments",    label: "Kafedralar",       roles: ["university_admin"] },
  { href: "/indicators",     label: "Ko'rsatkichlar",   roles: ["university_admin","science_department"] },
  { href: "/targets",        label: "Maqsadlar",        roles: ["university_admin","science_department","vice_rector","dean"] },
  { href: "/submissions",    label: "Hisobotlar",       roles: ["university_admin","science_department","vice_rector","dean"] },
  { href: "/form",           label: "Hisobot formasi",  roles: ["staff_manager"] },
  { href: "/my-submissions", label: "Mening hisobotlarim", roles: ["staff_manager"] },
  { href: "/notifications",  label: "Bildirishnomalar", roles: ["super_admin","university_admin","vice_rector","science_department","dean","staff_manager"] },
];

const ROLE_LABEL: Record<string, string> = {
  super_admin: "Super admin",
  university_admin: "Universitet admin",
  vice_rector: "Prorektor",
  science_department: "Ilmiy bo'lim",
  dean: "Dekan",
  staff_manager: "Kafedra mas'uli",
};

export function Sidebar({ unreadCount = 0 }: { unreadCount?: number }) {
  const pathname = usePathname();
  const { user } = useSupabaseAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (!user) return null;
  const items = NAV.filter((n) => n.roles.includes(user.role));

  const nav = (
    <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + "/");
        const isNotif = item.href === "/notifications";
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMobileOpen(false)}
            className={`flex items-center justify-between px-3 py-2 rounded-md text-sm transition ${
              active
                ? "bg-primary-600 text-white"
                : "text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800"
            }`}
          >
            <span>{item.label}</span>
            {isNotif && unreadCount > 0 && (
              <span className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-semibold rounded-full ${
                active ? "bg-white text-primary-600" : "bg-danger-600 text-white"
              }`}>
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );

  const footer = (
    <div className="p-3 border-t border-surface-200 dark:border-surface-700">
      <p className="px-2 text-xs text-surface-400 dark:text-surface-500 truncate">{user.email}</p>
    </div>
  );

  const header = (
    <div className="h-14 flex items-center px-4 border-b border-surface-200 dark:border-surface-700">
      <span className="font-semibold text-surface-900 dark:text-surface-100 text-sm">
        Ilmiy Ko&apos;rsatkichlar
      </span>
    </div>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="lg:hidden sticky top-0 z-40 h-14 bg-white dark:bg-surface-900 border-b border-surface-200 dark:border-surface-700 flex items-center justify-between px-4">
        <button
          onClick={() => setMobileOpen(true)}
          className="p-2 -ml-2 text-surface-700 dark:text-surface-300"
          aria-label="Menyu"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
        <span className="font-semibold text-sm text-surface-900 dark:text-surface-100">Ilmiy Ko&apos;rsatkichlar</span>
        <span className="w-5" />
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-64 max-w-[80%] bg-white dark:bg-surface-900 flex flex-col">
            {header}
            {nav}
            {footer}
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:left-0 lg:w-64 lg:border-r lg:border-surface-200 lg:dark:border-surface-700 lg:bg-white lg:dark:bg-surface-900">
        {header}
        {nav}
        {footer}
      </aside>
    </>
  );
}
