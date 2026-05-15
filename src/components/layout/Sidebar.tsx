"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import type { UniversityBrand } from "./AppShell";
import type { RoleName } from "@/types/db";

interface NavItem {
  href?: string;
  label: string;
  icon?: React.ReactNode;
  roles: RoleName[];
  children?: NavItem[];
}

const Icon = ({ d, size = 16 }: { d: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

// Small circle bullet used for sub-items
const Dot = ({ active }: { active: boolean }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ opacity: active ? 1 : 0.45, flexShrink: 0 }}>
    <circle cx="12" cy="12" r="5" />
  </svg>
);

// Chevron-left for collapsed, chevron-down for expanded
const Chevron = ({ open, size = 14 }: { open: boolean; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.6 }}>
    {open
      ? <path d="M19 9l-7 7-7-7" />       /* chevron-down  v */
      : <path d="M15 18l-6-6 6-6" />}     {/* chevron-left  < */}
  </svg>
);

const NAV: NavItem[] = [
  {
    label: "Statistika",
    icon: <Icon d="M3 3v18h18M7 16l4-4 4 4 4-6" />,
    roles: ["university_admin", "vice_rector", "science_department", "dean"],
    children: [
      {
        href: "/overview",
        label: "Asosiy",
        roles: ["university_admin", "vice_rector", "science_department", "dean"],
      },
      {
        href: "/monitoring",
        label: "Monitoring",
        roles: ["university_admin", "vice_rector", "science_department", "dean"],
      },
      {
        href: "/statistics/employees",
        label: "Hodimlar (HEMIS)",
        roles: ["university_admin", "vice_rector", "science_department", "dean"],
      },
      {
        href: "/statistics/structure",
        label: "Tuzilma (HEMIS)",
        roles: ["university_admin", "vice_rector", "science_department", "dean"],
      },
    ],
  },
  {
    href: "/indicators",
    label: "Ko'rsatkichlar",
    icon: <Icon d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />,
    roles: ["university_admin", "science_department"],
  },
  {
    href: "/targets",
    label: "Maqsadlar",
    icon: <Icon d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />,
    roles: ["university_admin", "science_department", "vice_rector", "dean"],
  },
  {
    href: "/submissions",
    label: "Hisobotlar",
    icon: <Icon d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />,
    roles: ["university_admin", "science_department", "vice_rector", "dean"],
  },
  {
    href: "/teachers",
    label: "O'qituvchilar ro'yxati",
    icon: <Icon d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8m13 2v2m0-4v2m-2-2h4" />,
    roles: ["staff_manager", "dean", "science_department", "university_admin", "vice_rector"],
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
    label: "Doktorantura",
    icon: <Icon d="M12 14l9-5-9-5-9 5 9 5zM12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />,
    roles: ["science_department", "supervisor", "doktorant"],
    children: [
      {
        href: "/doktorantura",
        label: "Doktorantlar",
        roles: ["science_department"],
      },
      {
        href: "/doktorantura/supervisors",
        label: "Ilmiy Rahbarlar",
        roles: ["science_department"],
      },
      {
        href: "/doktorantura/mening-talabalarim",
        label: "Mening Talabalarim",
        roles: ["supervisor"],
      },
      {
        href: "/doktorantura/baholash",
        label: "Baholash",
        roles: ["supervisor"],
      },
      {
        href: "/doktorantura/holat-yangilash",
        label: "Holat Yangilash",
        roles: ["supervisor"],
      },
      {
        href: "/doktorantura/mening-profilim",
        label: "Mening Profilim",
        roles: ["doktorant"],
      },
      {
        href: "/doktorantura/hisobot-yuborish",
        label: "Hisobot Yuborish",
        roles: ["doktorant"],
      },
      {
        href: "/doktorantura/rahbar-fikri",
        label: "Rahbar Fikri",
        roles: ["doktorant"],
      },
    ]
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
    roles: ["university_admin", "science_department"],
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
    href: "/university-settings",
    label: "Universitet Sozlamalari",
    icon: <Icon d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM15 12a3 3 0 11-6 0 3 3 0 016 0z" />,
    roles: ["university_admin"],
  },
  {
    href: "/notifications",
    label: "Bildirishnomalar",
    icon: <Icon d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />,
    roles: ["super_admin", "university_admin", "vice_rector", "science_department", "dean", "staff_manager", "doktorant", "supervisor"],
  },
];

// Compute which groups should be open for the current pathname
function findInitialOpen(navItems: NavItem[], pathname: string): Record<string, boolean> {
  const result: Record<string, boolean> = {};
  function walk(items: NavItem[]): boolean {
    for (const item of items) {
      if (item.children) {
        if (walk(item.children)) {
          result[item.label] = true;
          return true;
        }
      } else if (item.href && (pathname === item.href || pathname.startsWith(item.href + "/"))) {
        return true;
      }
    }
    return false;
  }
  walk(navItems);
  return result;
}

export function Sidebar({ unreadCount = 0, brand }: { unreadCount?: number; brand: UniversityBrand }) {
  const pathname = usePathname();
  const { user } = useSupabaseAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({ "Statistika": true });

  if (!user) return null;

  const filterItems = (items: NavItem[]): NavItem[] => {
    return items
      .filter((item) => item.roles.includes(user.role))
      .map((item) => ({
        ...item,
        children: item.children ? filterItems(item.children) : undefined,
      }))
      .filter((item) => !item.children || item.children.length > 0);
  };

  const items = filterItems(NAV);

  const isItemActive = (item: NavItem): boolean => {
    if (item.href && (pathname === item.href || pathname.startsWith(item.href + "/"))) return true;
    return item.children?.some(isItemActive) ?? false;
  };

  // Accordion: close all sibling groups, then toggle this one
  function toggleGroup(label: string, siblings: NavItem[]) {
    setOpenGroups(prev => {
      const next = { ...prev };
      for (const sib of siblings) {
        if (sib.children) next[sib.label] = false;
      }
      next[label] = !prev[label];
      return next;
    });
  }

  const renderItem = (item: NavItem, depth: number, siblings: NavItem[]): React.ReactNode => {
    const active = isItemActive(item);

    // Group (has children)
    if (item.children && item.children.length > 0) {
      const isOpen = openGroups[item.label] ?? false;
      const isTopLevel = depth === 0;

      return (
        <div key={item.label}>
          <button
            onClick={() => toggleGroup(item.label, siblings)}
            className="w-full flex items-center gap-2 rounded-lg transition-colors"
            style={{
              padding: isTopLevel ? "8px 10px" : "6px 10px",
              color: active ? "var(--sidebar-active-text)" : "var(--sidebar-text)",
              background: active && !isTopLevel ? "var(--sidebar-active-bg)" : "transparent",
            }}
            onMouseEnter={(e) => {
              if (!active || isTopLevel) (e.currentTarget as HTMLElement).style.background = "var(--sidebar-hover-bg)";
            }}
            onMouseLeave={(e) => {
              if (active && !isTopLevel) (e.currentTarget as HTMLElement).style.background = "var(--sidebar-active-bg)";
              else (e.currentTarget as HTMLElement).style.background = "transparent";
            }}
          >
            {/* Left: icon (top-level) or dot (sub-level) */}
            {isTopLevel ? (
              <span style={{ opacity: active ? 1 : 0.6, flexShrink: 0 }}>{item.icon}</span>
            ) : (
              <Dot active={active} />
            )}

            {/* Label */}
            <span
              className="flex-1 text-left truncate"
              style={{ fontSize: isTopLevel ? "0.8125rem" : "0.75rem", fontWeight: 500 }}
            >
              {item.label}
            </span>

            {/* Chevron */}
            <Chevron open={isOpen} size={isTopLevel ? 15 : 13} />
          </button>

          {isOpen && (
            <div style={{ paddingLeft: isTopLevel ? 22 : 14, paddingTop: 2, paddingBottom: 2 }}>
              {item.children.map(child => renderItem(child, depth + 1, item.children!))}
            </div>
          )}
        </div>
      );
    }

    // Leaf link
    const isNotif = item.href === "/notifications";
    return (
      <Link
        key={item.href || item.label}
        href={item.href!}
        onClick={() => setMobileOpen(false)}
        className="flex items-center gap-2 rounded-lg transition-colors"
        style={{
          padding: depth === 0 ? "8px 10px" : "6px 10px",
          color: active ? "var(--sidebar-active-text)" : "var(--sidebar-text)",
          background: active ? "var(--sidebar-active-bg)" : "transparent",
        }}
        onMouseEnter={(e) => {
          if (!active) (e.currentTarget as HTMLElement).style.background = "var(--sidebar-hover-bg)";
        }}
        onMouseLeave={(e) => {
          if (!active) (e.currentTarget as HTMLElement).style.background = active ? "var(--sidebar-active-bg)" : "transparent";
        }}
      >
        {/* Left: icon (top-level) or dot (sub-level) */}
        {depth === 0 ? (
          item.icon && (
            <span style={{ opacity: active ? 1 : 0.6, flexShrink: 0 }}>{item.icon}</span>
          )
        ) : (
          <Dot active={active} />
        )}

        {/* Label */}
        <span
          className="flex-1 truncate"
          style={{ fontSize: depth === 0 ? "0.8125rem" : "0.75rem", fontWeight: 500 }}
        >
          {item.label}
        </span>

        {/* Notification badge */}
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
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full" style={{ background: "var(--sidebar-bg)" }}>
      {/* Logo / Branding */}
      <div className="h-16 flex items-center px-4 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: "rgba(255,255,255,0.12)" }}
          >
            {brand.logoUrl ? (
              <img src={brand.logoUrl} alt="Universitet logotipi" className="h-8 w-8 rounded-lg object-cover" />
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 21h18M9 21V7l4-4 4 4v14M9 12h6" />
              </svg>
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-white font-display font-semibold text-sm leading-tight">
              {brand.name}
            </p>
            <p style={{ color: "rgba(255,255,255,0.45)", fontSize: "0.625rem", letterSpacing: "0.08em" }} className="uppercase font-medium">
              KPI Tizimi
            </p>
          </div>
        </div>
      </div>

      {/* Nav Items */}
      <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
        {items.map(item => renderItem(item, 0, items))}
      </nav>

      {/* Footer: email */}
      <div className="px-4 py-3 shrink-0" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
        <p className="text-xs truncate font-medium" style={{ color: "rgba(255,255,255,0.4)" }}>
          {user.email}
        </p>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile top bar */}
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
        <span className="max-w-[12rem] truncate text-white font-display font-semibold text-sm">{brand.shortCode || "IKT"}</span>
        <span className="w-9" />
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex animate-fade-in">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
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
