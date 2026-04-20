"use client";

import React, { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import type { Submission } from "@/types/db";
import { STATUS_LABEL } from "@/lib/workflow";
import { normalizeSubmission } from "@/lib/submission";

export default function MySubmissionsPage() {
  const supabase = createClient();
  const { user } = useSupabaseAuth();
  const [rows, setRows] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user?.department_id) return;
    setLoading(true);
    const { data } = await supabase
      .from("submissions")
      .select("*")
      .eq("department_id", user.department_id)
      .order("year", { ascending: false })
      .order("quarter", { ascending: false });
    setRows((((data as Submission[]) ?? []).map((row) => normalizeSubmission(row)!)));
    setLoading(false);
  }, [supabase, user?.department_id]);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-100 mb-6">Mening hisobotlarim</h1>

      <div className="bg-white dark:bg-surface-800 rounded-lg border border-surface-200 dark:border-surface-700 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-surface-500">Yuklanmoqda...</div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-surface-500">Hali hisobot yo&apos;q.</div>
        ) : (
          <table className="w-full">
            <thead className="bg-surface-50 dark:bg-surface-900/50 border-b border-surface-200 dark:border-surface-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-surface-600 uppercase">Davr</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-surface-600 uppercase">Holat</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-surface-600 uppercase">Yuborilgan</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-surface-600 uppercase">Ko&apos;rib chiqilgan</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-surface-600 uppercase">Izoh</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-200 dark:divide-surface-700">
              {rows.map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-3 text-sm font-medium">{s.year} {s.quarter}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_LABEL[s.status].cls}`}>
                      {STATUS_LABEL[s.status].text}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-surface-500">
                    {s.submitted_at ? new Date(s.submitted_at).toLocaleString("uz-UZ") : "—"}
                  </td>
                  <td className="px-4 py-3 text-sm text-surface-500">
                    {s.reviewed_at ? new Date(s.reviewed_at).toLocaleString("uz-UZ") : "—"}
                  </td>
                  <td className="px-4 py-3 text-sm text-surface-600 dark:text-surface-400">
                    {s.review_comment ?? <span className="text-surface-400">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
