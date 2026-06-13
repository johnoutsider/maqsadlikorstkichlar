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
      {
        href: "/statistics/talabalar",
        label: "Talabalar (HEMIS)",
        roles: ["university_admin", "vice_rector", "science_department", "dean"],
      },
    ],
  },
  {
    label: "Ilmiy bo'lim",
    icon: <Icon d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />,
    roles: ["university_admin", "science_department", "vice_rector", "dean"],
    children: [
      {
        href: "/indicators",
        label: "Ilmiy ko'rsatkichlar",
        roles: ["university_admin", "science_department"],
      },
      {
        href: "/targets",
        label: "Ilmiy rejalar",
        roles: ["university_admin", "science_department", "vice_rector", "dean"],
      },
      {
        href: "/submissions",
        label: "Ilmiy hisobotlar",
        roles: ["university_admin", "science_department", "vice_rector", "dean"],
      },
    ],
  },
  // O'quv jarayoni — temporarily hidden
  // {
  //   label: "O'quv jarayoni",
  //   icon: <Icon d="M12 14l9-5-9-5-9 5 9 5zm0 7v-7m-7 2l7 5 7-5" />,
  //   roles: ["dean", "staff_manager"],
  //   children: [
  //     { href: "/curriculum/subjects",          label: "Fanlar",           roles: ["dean"] },
  //     { href: "/curriculum/groups",            label: "Guruhlar",         roles: ["dean"] },
  //     { href: "/curriculum/subject-workload",  label: "Fan yuklamasi",    roles: ["dean"] },
  //     { href: "/curriculum/personal-plans",    label: "Shaxsiy ish reja", roles: ["staff_manager", "dean"] },
  //     { href: "/curriculum/approvals",         label: "Tasdiqlash",       roles: ["dean"] },
  //   ],
  // },
  {
    label: "O'quv bo'limi",
    icon: <Icon d="M3 7l9-4 9 4-9 4-9-4zm0 6l9 4 9-4M3 17l9 4 9-4" />,
    roles: ["oquv_bolimi"],
    children: [
      { href: "/oquv-bolimi/workload",          label: "Kafedralar yuklamasi",  roles: ["oquv_bolimi"] },
      { href: "/oquv-bolimi/subject-workload",  label: "Fan bo'yicha yuklama",  roles: ["oquv_bolimi"] },
    ],
  },
  {
    href: "/teachers",
    label: "O'qituvchilar ro'yxati",
    icon: <Icon d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8m13 2v2m0-4v2m-2-2h4" />,
    roles: ["staff_manager", "dean", "science_department", "university_admin", "vice_rector", "oquv_bolimi"],
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
    href: "/himoya-arizalari",
    label: "Himoya arizalari",
    icon: <Icon d="M9 12h6m-6 4h6m-7 5h8a2 2 0 002-2V7.414a1 1 0 00-.293-.707l-3.414-3.414A1 1 0 0013.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />,
    roles: ["science_department", "vice_rector"],
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
    roles: ["super_admin", "university_admin", "vice_rector", "science_department", "dean", "staff_manager", "oquv_bolimi", "doktorant", "supervisor"],
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

export function Sidebar({
  unreadCount = 0,
  brand,
  collapsed = false,
  onToggleCollapse,
}: {
  unreadCount?: number;
  brand: UniversityBrand;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}) {
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

  const renderItem = (item: NavItem, depth: number, siblings: NavItem[], isCollapsed: boolean): React.ReactNode => {
    const active = isItemActive(item);

    // Group (has children)
    if (item.children && item.children.length > 0) {
      const isOpen = openGroups[item.label] ?? false;
      const isTopLevel = depth === 0;

      return (
        <div key={item.label}>
          <button
            onClick={() => {
              if (isCollapsed) {
                // Expand the rail first, then open this group
                onToggleCollapse?.();
                setOpenGroups((prev) => ({ ...prev, [item.label]: true }));
              } else {
                toggleGroup(item.label, siblings);
              }
            }}
            title={isCollapsed ? item.label : undefined}
            className="w-full flex items-center gap-2 rounded-lg transition-colors"
            style={{
              padding: isTopLevel ? "8px 10px" : "6px 10px",
              justifyContent: isCollapsed ? "center" : "flex-start",
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

            {!isCollapsed && (
              <>
                {/* Label */}
                <span
                  className="flex-1 text-left truncate"
                  style={{ fontSize: isTopLevel ? "0.8125rem" : "0.75rem", fontWeight: 500 }}
                >
                  {item.label}
                </span>

                {/* Chevron */}
                <Chevron open={isOpen} size={isTopLevel ? 15 : 13} />
              </>
            )}
          </button>

          {isOpen && !isCollapsed && (
            <div style={{ paddingLeft: isTopLevel ? 22 : 14, paddingTop: 2, paddingBottom: 2 }}>
              {item.children.map(child => renderItem(child, depth + 1, item.children!, isCollapsed))}
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
        title={isCollapsed ? item.label : undefined}
        className="relative flex items-center gap-2 rounded-lg transition-colors"
        style={{
          padding: depth === 0 ? "8px 10px" : "6px 10px",
          justifyContent: isCollapsed ? "center" : "flex-start",
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

        {!isCollapsed && (
          /* Label */
          <span
            className="flex-1 truncate"
            style={{ fontSize: depth === 0 ? "0.8125rem" : "0.75rem", fontWeight: 500 }}
          >
            {item.label}
          </span>
        )}

        {/* Notification badge */}
        {isNotif && unreadCount > 0 && (
          isCollapsed ? (
            <span
              className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full"
              style={{ background: "#ba1a1a" }}
            />
          ) : (
            <span
              className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold rounded-full shrink-0"
              style={{
                background: active ? "rgba(255,255,255,0.25)" : "#ba1a1a",
                color: "#ffffff",
              }}
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )
        )}
      </Link>
    );
  };

  const SidebarContent = ({ isCollapsed, showToggle }: { isCollapsed: boolean; showToggle: boolean }) => (
    <div className="flex flex-col h-full" style={{ background: "var(--sidebar-bg)" }}>
      {/* Logo / Branding */}
      <div className="h-16 flex items-center px-4 shrink-0" style={{ justifyContent: isCollapsed ? "center" : "flex-start" }}>
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
          {!isCollapsed && (
            <div className="min-w-0">
              <p className="truncate text-white font-display font-semibold text-sm leading-tight">
                {brand.name}
              </p>
              <p style={{ color: "rgba(255,255,255,0.45)", fontSize: "0.625rem", letterSpacing: "0.08em" }} className="uppercase font-medium">
                KPI Tizimi
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Nav Items */}
      <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
        {items.map(item => renderItem(item, 0, items, isCollapsed))}
      </nav>

      {/* Footer */}
      <div className="shrink-0" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
        {showToggle && (
          <button
            onClick={onToggleCollapse}
            title={isCollapsed ? "Yoyish" : "Yig'ish"}
            className="w-full flex items-center gap-2 px-4 py-3 transition-colors"
            style={{ color: "rgba(255,255,255,0.6)", justifyContent: isCollapsed ? "center" : "flex-start" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--sidebar-hover-bg)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              {isCollapsed
                ? <path d="M13 5l7 7-7 7M5 5l7 7-7 7" />     /* chevrons right »  */
                : <path d="M11 19l-7-7 7-7M19 19l-7-7 7-7" />} {/* chevrons left  «  */}
            </svg>
            {!isCollapsed && <span className="text-xs font-medium">Yig&apos;ish</span>}
          </button>
        )}
        {!isCollapsed && (
          <div className="px-4 pb-3">
            <p className="text-xs truncate font-medium" style={{ color: "rgba(255,255,255,0.4)" }}>
              {user.email}
            </p>
          </div>
        )}
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
            <SidebarContent isCollapsed={false} showToggle={false} />
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside
        className={`hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:left-0 overflow-hidden transition-[width] duration-200 ${
          collapsed ? "lg:w-20" : "lg:w-64"
        }`}
        style={{ zIndex: 40 }}
      >
        <SidebarContent isCollapsed={collapsed} showToggle={true} />
      </aside>
    </>
  );
}
