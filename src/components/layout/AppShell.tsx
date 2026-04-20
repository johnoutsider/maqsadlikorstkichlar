"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import type { RoleName } from "@/types/db";

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
      <Sidebar unreadCount={unread} />
      <div className="lg:pl-64 flex flex-col min-h-screen">
        <Topbar />
        <main className="flex-1 max-w-[1400px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-7 sm:py-9">
          {children}
        </main>
      </div>
    </div>
  );
}
