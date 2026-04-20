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
      <div className="min-h-screen flex items-center justify-center bg-surface-50 dark:bg-surface-900">
        <div className="animate-spin h-8 w-8 border-2 border-primary-600 rounded-full border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-900">
      <Sidebar unreadCount={unread} />
      <div className="lg:pl-64 flex flex-col min-h-screen">
        <Topbar />
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">{children}</main>
      </div>
    </div>
  );
}
