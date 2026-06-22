"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { Button } from "@/components/ui/Button";
import type { Notification } from "@/types/db";

function hrefFor(n: Notification): string | null {
  const subId = (n.data as { submission_id?: string })?.submission_id;
  if (subId) {
    if (n.type === "submission_submitted") return `/submissions/${subId}`;
    if (n.type === "submission_approved" || n.type === "submission_rejected") return `/my-submissions`;
  }
  const defenseAppId = (n.data as { defense_application_id?: string })?.defense_application_id;
  if (defenseAppId) return `/himoya-arizalari/${defenseAppId}`;
  return null;
}

export default function NotificationsPage() {
  const supabase = createClient();
  const { user } = useSupabaseAuth();
  const [items, setItems] = useState<Notification[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setError("");
    const { data, error: e } = await supabase
      .from("notifications")
      .select("*")
      .eq("recipient_id", user.id)
      .order("created_at", { ascending: false })
      .limit(200);
    if (e) { setError(e.message); return; }
    setItems((data as Notification[]) ?? []);
  }, [supabase, user]);

  useEffect(() => { load(); }, [load]);

  const markRead = async (id: string) => {
    const { error: e } = await supabase.from("notifications").update({ read: true }).eq("id", id);
    if (e) { setError(e.message); return; }
    setItems((prev) => prev?.map((n) => n.id === id ? { ...n, read: true } : n) ?? null);
  };

  const markAllRead = async () => {
    if (!user) return;
    setBusy(true);
    const { error: e } = await supabase
      .from("notifications")
      .update({ read: true })
      .eq("recipient_id", user.id)
      .eq("read", false);
    setBusy(false);
    if (e) { setError(e.message); return; }
    setItems((prev) => prev?.map((n) => ({ ...n, read: true })) ?? null);
  };

  if (!user) return null;

  const unreadCount = items?.filter((n) => !n.read).length ?? 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-100">Bildirishnomalar</h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
            {unreadCount > 0 ? `${unreadCount} ta o'qilmagan` : "Hammasi o'qilgan"}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" onClick={markAllRead} isLoading={busy}>
            Hammasini o&apos;qilgan deb belgilash
          </Button>
        )}
      </div>

      {error && <div className="mb-4 p-3 bg-danger-50 dark:bg-danger-900/30 text-danger-600 dark:text-danger-400 rounded-lg text-sm">{error}</div>}

      {items === null ? (
        <div className="p-8 text-center text-surface-500">Yuklanmoqda...</div>
      ) : items.length === 0 ? (
        <div className="p-8 text-center text-surface-500">Bildirishnomalar yo&apos;q.</div>
      ) : (
        <div className="bg-white dark:bg-surface-800 rounded-lg border border-surface-200 dark:border-surface-700 divide-y divide-surface-200 dark:divide-surface-700">
          {items.map((n) => {
            const href = hrefFor(n);
            const body = (
              <div className={`p-4 flex items-start gap-3 ${!n.read ? "bg-primary-50/50 dark:bg-primary-900/10" : ""}`}>
                <div className={`mt-1.5 h-2 w-2 rounded-full flex-shrink-0 ${n.read ? "bg-surface-300 dark:bg-surface-600" : "bg-primary-500"}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-surface-900 dark:text-surface-100">{n.title}</p>
                  <p className="text-sm text-surface-600 dark:text-surface-400 mt-0.5">{n.message}</p>
                  <p className="text-xs text-surface-400 mt-1">{new Date(n.created_at).toLocaleString("uz-UZ")}</p>
                </div>
                {!n.read && (
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); markRead(n.id); }}
                    className="text-xs text-primary-600 hover:underline flex-shrink-0"
                  >
                    O&apos;qildi
                  </button>
                )}
              </div>
            );
            return href ? (
              <Link key={n.id} href={href} onClick={() => !n.read && markRead(n.id)} className="block hover:bg-surface-50 dark:hover:bg-surface-900/30">
                {body}
              </Link>
            ) : (
              <div key={n.id}>{body}</div>
            );
          })}
        </div>
      )}
    </div>
  );
}
