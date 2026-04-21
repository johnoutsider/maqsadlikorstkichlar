"use client";

import React, { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";

export default function RahbarFikriPage() {
  const [evaluations, setEvaluations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();
  const { user } = useSupabaseAuth();

  useEffect(() => {
    async function fetchData() {
      if (!user) return;

      const { data: doc } = await supabase
        .from("doktorantlar")
        .select("id")
        .eq("auth_user_id", user.id)
        .single();

      if (!doc) return;

      const { data: evals } = await supabase
        .from("evaluations")
        .select(`
          *,
          supervisors(full_name, academic_title)
        `)
        .eq("doktorant_id", doc.id)
        .order("created_at", { ascending: false });
      
      if (evals) setEvaluations(evals);
      setLoading(false);
    }
    fetchData();
  }, [supabase]);

  const recMap: Record<string, { label: string, color: string }> = {
    davom_etsin: { label: "Davom etsin", color: "bg-emerald-100 text-emerald-800 border-emerald-200" },
    qayta_korib_chiqsin: { label: "Qayta ko'rib chiqsin", color: "bg-amber-100 text-amber-800 border-amber-200" },
    muddatni_uzaytirsin: { label: "Muddatni uzaytirsin", color: "bg-blue-100 text-blue-800 border-blue-200" },
  };

  if (loading) return <div className="p-10 text-center">Yuklanmoqda...</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold font-display text-(--on-surface)">Rahbar Fikri va Baholashlar</h1>
        <p className="text-(--on-surface-variant) text-sm mt-1">Ilmiy rahbardan davriy baholash xulosalari</p>
      </div>

      {evaluations.length === 0 ? (
        <div className="py-8 text-center text-(--on-surface-variant) bg-(--surface-container-lowest) border border-(--outline-variant) rounded-2xl">
          Hozircha ilmiy rahbaringiz tomonidan baholash xulosalari kiritilmagan.
        </div>
      ) : (
        <div className="space-y-6">
          {evaluations.map(ev => {
            const recInfo = recMap[ev.recommendation] || { label: ev.recommendation, color: "bg-gray-100 text-gray-800" };
            return (
              <div key={ev.id} className="bg-(--surface-container-lowest) rounded-2xl border border-(--outline-variant) shadow-sm overflow-hidden">
                <div className="bg-(--surface-container) border-b border-(--outline-variant) p-5 flex flex-wrap gap-4 items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-(--on-surface-variant) uppercase tracking-wider mb-1">Davr</p>
                    <p className="font-semibold text-(--on-surface)">{ev.period_start} dan {ev.period_end} gacha</p>
                  </div>
                  <div className="flex gap-4 items-center">
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map(star => (
                        <svg key={star} width="16" height="16" viewBox="0 0 24 24" fill={star <= ev.overall_rating ? "#f59e0b" : "none"} stroke={star <= ev.overall_rating ? "#f59e0b" : "var(--outline)"} strokeWidth={2}>
                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                        </svg>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="p-6 space-y-6">
                  <div>
                    <h4 className="text-sm font-semibold text-(--on-surface-variant) mb-2 uppercase tracking-wider">Tadqiqotdagi siljish</h4>
                    <p className="text-(--on-surface) text-sm leading-relaxed">{ev.research_progress}</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {ev.strengths && (
                      <div className="bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 p-4 rounded-xl">
                        <h4 className="text-sm font-semibold text-emerald-800 dark:text-emerald-300 mb-2 uppercase tracking-wide flex items-center gap-2">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><polyline points="20 6 9 17 4 12"/></svg>
                          Kuchli Jihatlari
                        </h4>
                        <p className="text-sm text-emerald-900 dark:text-emerald-200">{ev.strengths}</p>
                      </div>
                    )}

                    {ev.areas_to_improve && (
                      <div className="bg-amber-50/50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 p-4 rounded-xl">
                        <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-2 uppercase tracking-wide flex items-center gap-2">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>
                          Yaxshilanishi Kerak
                        </h4>
                        <p className="text-sm text-amber-900 dark:text-amber-200">{ev.areas_to_improve}</p>
                      </div>
                    )}
                  </div>

                  {ev.comments && (
                    <div>
                      <h4 className="text-sm font-semibold text-(--on-surface-variant) mb-2 uppercase tracking-wider">Qo'shimcha izoh</h4>
                      <p className="text-(--on-surface) text-sm italic py-2 px-3 border-l-2 border-(--outline-variant)">{ev.comments}</p>
                    </div>
                  )}

                  <div className="pt-4 border-t border-(--outline-variant) flex items-center justify-between">
                    <div>
                      <p className="text-xs text-(--on-surface-variant) mb-1">Ilmiy rahbar</p>
                      <p className="font-medium text-sm text-(--on-surface)">{ev.supervisors?.full_name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-(--on-surface-variant) mb-1">Xulosa tavsiyasi</p>
                      <span className={`inline-block px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-full border ${recInfo.color}`}>
                        {recInfo.label}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
