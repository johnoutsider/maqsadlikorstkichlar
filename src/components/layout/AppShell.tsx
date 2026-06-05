"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import type { RoleName, University } from "@/types/db";

export interface UniversityBrand {
  name: string;
  shortCode: string;
  logoUrl: string;
  logoPath: string | null;
}

const DEFAULT_BRAND: UniversityBrand = {
  name: "Ilmiy Ko'rsatkichlar",
  shortCode: "IKT",
  logoUrl: "",
  logoPath: null,
};

const brandCache = new Map<string, UniversityBrand>();

function getBrandCacheKey(universityId: string) {
  return `university-brand:${universityId}`;
}

function readStoredBrand(universityId: string): UniversityBrand | null {
  try {
    const raw = window.localStorage.getItem(getBrandCacheKey(universityId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<UniversityBrand>;
    if (!parsed.name || !parsed.shortCode) return null;
    return {
      name: parsed.name,
      shortCode: parsed.shortCode,
      logoPath: parsed.logoPath ?? null,
      logoUrl: parsed.logoUrl ?? "",
    };
  } catch {
    return null;
  }
}

function writeStoredBrand(universityId: string, brand: UniversityBrand) {
  try {
    window.localStorage.setItem(getBrandCacheKey(universityId), JSON.stringify(brand));
  } catch {
    // Storage availability should not block app rendering.
  }
}

export function AppShell({
  allowed,
  fallbackFor,
  children,
}: {
  allowed: RoleName[];
  fallbackFor?: (role: RoleName) => string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const supabase = createClient();
  const { user, loading } = useSupabaseAuth();
  const [unread, setUnread] = useState(0);
  const [brand, setBrand] = useState<UniversityBrand>(DEFAULT_BRAND);
  const [collapsed, setCollapsed] = useState(false);

  // Restore collapsed preference (client-only to avoid hydration mismatch)
  useEffect(() => {
    try {
      if (window.localStorage.getItem("sidebar-collapsed") === "true") {
        setCollapsed(true);
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem("sidebar-collapsed", String(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  };

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (!allowed.includes(user.role)) {
      router.replace(fallbackFor ? fallbackFor(user.role) : "/overview");
    }
  }, [user, loading, router, allowed, fallbackFor]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const fetchUnread = async () => {
      const { count } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("recipient_id", user.id)
        .eq("read", false);
      if (!cancelled) setUnread(count ?? 0);
    };
    fetchUnread();
    const ch = supabase
      .channel(`notif:${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `recipient_id=eq.${user.id}` }, fetchUnread)
      .subscribe();
    const t = setInterval(fetchUnread, 60000);
    return () => { cancelled = true; clearInterval(t); supabase.removeChannel(ch); };
  }, [supabase, user]);

  useEffect(() => {
    let cancelled = false;

    async function loadBrand() {
      if (!user?.university_id) {
        setBrand(DEFAULT_BRAND);
        return;
      }

      const cached = brandCache.get(user.university_id);
      if (cached) {
        setBrand(cached);
      } else {
        const stored = readStoredBrand(user.university_id);
        if (stored) {
          brandCache.set(user.university_id, stored);
          setBrand(stored);
        }
      }

      const { data } = await supabase
        .from("universities")
        .select("id,name,short_code,logo_url,created_at")
        .eq("id", user.university_id)
        .single();

      if (cancelled || !data) return;

      const university = data as University;
      let logoUrl = cached?.logoPath === university.logo_url ? cached.logoUrl : "";

      if (university.logo_url && !logoUrl) {
        const { data: signedLogo } = await supabase.storage
          .from("university-logos")
          .createSignedUrl(university.logo_url, 60 * 60);
        logoUrl = signedLogo?.signedUrl ?? "";
      }

      const nextBrand: UniversityBrand = {
        name: university.name,
        shortCode: university.short_code,
        logoPath: university.logo_url,
        logoUrl,
      };
      brandCache.set(user.university_id, nextBrand);
      writeStoredBrand(user.university_id, nextBrand);
      setBrand(nextBrand);
    }

    loadBrand();

    const handleBrandUpdated = (event: Event) => {
      const detail = (event as CustomEvent<UniversityBrand>).detail;
      if (!detail || !user?.university_id) return;
      brandCache.set(user.university_id, detail);
      writeStoredBrand(user.university_id, detail);
      setBrand(detail);
    };

    window.addEventListener("university-brand:updated", handleBrandUpdated);

    const channel = user?.university_id
      ? supabase
          .channel(`university-brand:${user.university_id}`)
          .on(
            "postgres_changes",
            { event: "UPDATE", schema: "public", table: "universities", filter: `id=eq.${user.university_id}` },
            loadBrand
          )
          .subscribe()
      : null;

    return () => {
      cancelled = true;
      window.removeEventListener("university-brand:updated", handleBrandUpdated);
      if (channel) supabase.removeChannel(channel);
    };
  }, [supabase, user?.university_id]);

  useEffect(() => {
    document.title = `${brand.name} - KPI Tizimi`;
  }, [brand.name]);

  if (loading || !user || !allowed.includes(user.role)) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "var(--surface)" }}
      >
        <div className="flex flex-col items-center gap-4">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #002046 0%, #1b365d 100%)" }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 21h18M9 21V7l4-4 4 4v14M9 12h6" />
            </svg>
          </div>
          <div
            className="w-6 h-6 rounded-full border-2 animate-spin"
            style={{ borderColor: "var(--outline-variant)", borderTopColor: "#002046" }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--surface)" }}>
      <Sidebar
        unreadCount={unread}
        brand={brand}
        collapsed={collapsed}
        onToggleCollapse={toggleCollapsed}
      />
      <div
        className={`flex flex-col min-h-screen transition-[padding] duration-200 ${
          collapsed ? "lg:pl-20" : "lg:pl-64"
        }`}
      >
        <Topbar brand={brand} />
        <main className="flex-1 max-w-[1400px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-7 sm:py-9">
          {children}
        </main>
      </div>
    </div>
  );
}
