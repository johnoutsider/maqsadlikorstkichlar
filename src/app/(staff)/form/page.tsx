"use client";

import React, { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { Button } from "@/components/ui/Button";
import type {
  Indicator,
  Submission,
  Quarter,
  IndicatorSubmission,
  AppUser,
} from "@/types/db";
import {
  STATUS_LABEL,
  isIndicatorEditable,
  clearRejectedReviews,
} from "@/lib/workflow";
import { buildReviewSummaryEntries, normalizeSubmission } from "@/lib/submission";

const QUARTERS: Quarter[] = ["Q1", "Q2", "Q3", "Q4"];

function currentQuarter(): Quarter {
  const m = new Date().getMonth() + 1;
  if (m <= 3) return "Q1";
  if (m <= 6) return "Q2";
  if (m <= 9) return "Q3";
  return "Q4";
}

export default function FormPage() {
  const supabase = createClient();
  const { user } = useSupabaseAuth();

  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [quarter, setQuarter] = useState<Quarter>(currentQuarter());
  const [periodInit, setPeriodInit] = useState(false);
  const [indicators, setIndicators] = useState<Indicator[]>([]);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [target, setTarget] = useState<import("@/types/db").Target | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<"draft" | "submit" | null>(null);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [reviewerMap, setReviewerMap] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    if (!user?.university_id) return;
    (async () => {
      const { data } = await supabase
        .from("indicators")
        .select("*")
        .eq("university_id", user.university_id)
        .order("order_idx");
      setIndicators((data as Indicator[]) ?? []);
    })();
  }, [supabase, user?.university_id]);

  // On first load, if the staff has a submission needing attention
  // (needs_revision > rejected > any most recent), jump to that period
  // so they aren't staring at a blank current-quarter form.
  useEffect(() => {
    if (periodInit || !user?.department_id) return;
    (async () => {
      const { data } = await supabase
        .from("submissions")
        .select("year, quarter, status, updated_at")
        .eq("department_id", user.department_id)
        .order("updated_at", { ascending: false });
      const rows = (data as { year: number; quarter: Quarter; status: string }[]) ?? [];
      const priority =
        rows.find((r) => r.status === "needs_revision") ??
        rows.find((r) => r.status === "rejected") ??
        null;
      if (priority) {
        setYear(priority.year);
        setQuarter(priority.quarter);
      }
      setPeriodInit(true);
    })();
  }, [supabase, user?.department_id, periodInit]);

  const load = useCallback(async () => {
    if (!user?.department_id) return;
    setLoading(true);
    setError("");
    setMessage("");
    const [subRes, tgtRes] = await Promise.all([
      supabase
        .from("submissions")
        .select("*")
        .eq("department_id", user.department_id)
        .eq("year", year)
        .eq("quarter", quarter)
        .maybeSingle(),
      supabase
        .from("targets")
        .select("*")
        .eq("department_id", user.department_id)
        .eq("year", year)
        .eq("quarter", quarter)
        .maybeSingle()
    ]);

    if (subRes.error) setError(subRes.error.message);
    const sub = normalizeSubmission((subRes.data as Submission) ?? null);
    setSubmission(sub);

    const reviewerIds = new Set<string>();
    (sub?.review_history ?? []).forEach((history) => reviewerIds.add(history.reviewer_id));
    Object.values(sub?.indicator_reviews ?? {}).forEach((review) => {
      if (review?.dean?.by) reviewerIds.add(review.dean.by);
      if (review?.science?.by) reviewerIds.add(review.science.by);
    });
    if (reviewerIds.size > 0) {
      const { data: users } = await supabase
        .from("users")
        .select("id, display_name")
        .in("id", Array.from(reviewerIds));
      const nextMap = new Map<string, string>();
      ((users as Pick<AppUser, "id" | "display_name">[]) ?? []).forEach((row) => {
        nextMap.set(row.id, row.display_name);
      });
      setReviewerMap(nextMap);
    } else {
      setReviewerMap(new Map());
    }

    const tgt = (tgtRes.data as import("@/types/db").Target) ?? null;
    setTarget(tgt);

    const v: Record<string, string> = {};
    const f: Record<string, string[]> = {};
    indicators.forEach((ind) => {
      const cell: IndicatorSubmission | undefined = sub?.indicators?.[ind.id];
      v[ind.id] = cell?.value === null || cell?.value === undefined ? "" : String(cell.value);
      f[ind.id] = cell?.files ?? [];
    });
    setValues(v);
    setFiles(f);
    setLoading(false);
  }, [supabase, user?.department_id, year, quarter, indicators]);

  useEffect(() => {
    if (indicators.length > 0) load();
  }, [load, indicators.length]);

  const status = submission?.status ?? "draft";
  const reviews = submission?.indicator_reviews ?? {};
  // Form-level lock: fully locked (no edits, no submit button) when waiting
  // for a reviewer or already approved.
  const formLocked =
    status === "pending_dean" ||
    status === "pending" ||
    status === "pending_science" ||
    status === "approved";
  const isRevision = status === "needs_revision" || status === "rejected";

  const indicatorEditable = (indicatorId: string) =>
    isIndicatorEditable(status, reviews[indicatorId]);

  // Rejection comments to show per indicator on revision.
  const rejectionNote = (indicatorId: string): { stage: string; comment: string } | null => {
    const r = reviews[indicatorId];
    if (r?.science?.status === "rejected") {
      return { stage: "Ilmiy bo'lim", comment: r.science.comment ?? "" };
    }
    if (r?.dean?.status === "rejected") {
      return { stage: "Dekan", comment: r.dean.comment ?? "" };
    }
    return null;
  };

  const reviewSummaries = buildReviewSummaryEntries(
    submission?.review_history ?? [],
    indicators,
    reviewerMap
  );

  const buildPayload = (newStatus: "draft" | "pending_dean") => {
    if (!user?.university_id || !user?.department_id || !user?.faculty_id) return null;

    // Start from the existing submission's indicators so we preserve locked
    // (already-approved) ones on a revision resubmit. Then overwrite each
    // editable indicator with whatever's in the form state.
    const indicatorsObj: Record<string, IndicatorSubmission> = {
      ...(submission?.indicators ?? {}),
    };
    for (const ind of indicators) {
      const editable = indicatorEditable(ind.id) || status === "draft" || !submission;
      if (!editable) continue;
      const raw = values[ind.id]?.trim();
      let value: number | null = null;
      if (raw) {
        const n = Number(raw);
        if (Number.isNaN(n)) {
          setError(`"${ind.no}. ${ind.name}" Ã¢â‚¬â€ son kiriting yoki bo'sh qoldiring.`);
          return null;
        }
        value = n;
      }
      indicatorsObj[ind.id] = { value, files: files[ind.id] ?? [] };
    }

    // On resubmit from a revision state, clear review decisions for indicators
    // that were rejected (those are the ones being resubmitted with new data).
    const nextReviews =
      newStatus === "pending_dean" && isRevision
        ? clearRejectedReviews(reviews)
        : submission?.indicator_reviews ?? {};

    return {
      university_id: user.university_id,
      faculty_id: user.faculty_id,
      department_id: user.department_id,
      year,
      quarter,
      status: newStatus,
      submitted_by: user.id,
      submitted_at: newStatus === "pending_dean" ? new Date().toISOString() : submission?.submitted_at ?? null,
      indicators: indicatorsObj,
      indicator_reviews: nextReviews,
      updated_at: new Date().toISOString(),
    };
  };

  const persist = async (newStatus: "draft" | "pending_dean") => {
    setError("");
    setMessage("");
    const payload = buildPayload(newStatus);
    if (!payload) return;
    setBusyAction(newStatus === "pending_dean" ? "submit" : "draft");
    const { error: e } = await supabase
      .from("submissions")
      .upsert(payload, { onConflict: "department_id,year,quarter" });
    setBusyAction(null);
    if (e) { setError(e.message); return; }
    if (newStatus === "pending_dean" && user?.university_id && user?.faculty_id) {
      const { notifyDeans } = await import("@/lib/notifications");
      const { data: sub } = await supabase
        .from("submissions")
        .select("id")
        .eq("department_id", user.department_id!)
        .eq("year", year)
        .eq("quarter", quarter)
        .maybeSingle();
      await notifyDeans(supabase, {
        universityId: user.university_id,
        facultyId: user.faculty_id,
        title: isRevision ? "Hisobot qayta yuborildi" : "Yangi hisobot yuborildi",
        message: `${user.display_name} Ã¢â‚¬â€ ${year} ${quarter} chorak hisoboti dekan tasdiqlashi uchun yuborildi.`,
        data: { submission_id: (sub as { id?: string } | null)?.id },
      });
    }
    setMessage(
      newStatus === "pending_dean"
        ? "Yuborildi Ã¢â‚¬â€ dekan tasdiqlashi kutilmoqda."
        : "Qoralama saqlandi."
    );
    load();
  };

  const uploadFile = async (indicatorId: string, file: File) => {
    if (!user?.university_id || !user?.department_id) return;
    setError("");
    setUploadingFor(indicatorId);
    const safeName = file.name.replace(/[^\w.\-]+/g, "_");
    const path = `${user.university_id}/${year}/${quarter}/${user.department_id}/${indicatorId}/${Date.now()}_${safeName}`;
    const { error: e } = await supabase.storage.from("submissions").upload(path, file);
    setUploadingFor(null);
    if (e) { setError(e.message); return; }
    setFiles((prev) => ({ ...prev, [indicatorId]: [...(prev[indicatorId] ?? []), path] }));
  };

  const removeFile = async (indicatorId: string, path: string) => {
    if (!confirm("Faylni o'chirishni tasdiqlaysizmi?")) return;
    const { error: e } = await supabase.storage.from("submissions").remove([path]);
    if (e) { setError(e.message); return; }
    setFiles((prev) => ({
      ...prev,
      [indicatorId]: (prev[indicatorId] ?? []).filter((p) => p !== path),
    }));
  };

  const openFile = async (path: string) => {
    const { data, error: e } = await supabase.storage
      .from("submissions")
      .createSignedUrl(path, 60 * 10);
    if (e || !data) { setError(e?.message ?? "Faylni ochib bo'lmadi"); return; }
    window.open(data.signedUrl, "_blank");
  };

  const rejectedCount = indicators.filter(
    (ind) =>
      reviews[ind.id]?.dean?.status === "rejected" ||
      reviews[ind.id]?.science?.status === "rejected"
  ).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-100">Hisobot formasi</h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
            Kafedrangiz uchun chorakli ko&apos;rsatkichlarni to&apos;ldiring
          </p>
        </div>
        {submission && (
          <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${STATUS_LABEL[status].cls}`}>
            {STATUS_LABEL[status].text}
          </span>
        )}
      </div>

      <div className="bg-white dark:bg-surface-800 rounded-lg border border-surface-200 dark:border-surface-700 p-4 mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">Yil</label>
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              min={2020}
              max={2100}
              className="w-full rounded-md border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">Chorak</label>
            <select
              value={quarter}
              onChange={(e) => setQuarter(e.target.value as Quarter)}
              className="w-full rounded-md border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 px-3 py-2 text-sm"
            >
              {QUARTERS.map((q) => <option key={q} value={q}>{q}</option>)}
            </select>
          </div>
        </div>
      </div>

      {error && <div className="mb-4 p-3 bg-danger-50 dark:bg-danger-900/30 text-danger-600 dark:text-danger-400 rounded-lg text-sm">{error}</div>}
      {message && <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-lg text-sm">{message}</div>}
      {!loading && !target && indicators.length > 0 && (
        <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 rounded-lg text-sm flex items-start gap-2">
          <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          <span>
            <strong>{year} {quarter}</strong> uchun maqsadlar hali belgilanmagan.
          </span>
        </div>
      )}
      {isRevision && (
        <div className="mb-4 p-3 bg-orange-50 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 rounded-lg text-sm">
          <strong>Qayta ko&apos;rib chiqish kerak:</strong> {rejectedCount} ta ko&apos;rsatkich rad etildi.
          Faqat rad etilgan ko&apos;rsatkichlarni tahrirlab, qayta yuboring. Tasdiqlangan ko&apos;rsatkichlar o&apos;zgarmaydi.
        </div>
      )}
      {submission?.review_comment && (status === "rejected" || status === "needs_revision") && (
        <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 rounded-lg text-sm">
          <strong>Umumiy izoh:</strong> {submission.review_comment}
        </div>
      )}
      {formLocked && (
        <div className="mb-4 p-3 bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 rounded-lg text-sm">
          Hisobot {STATUS_LABEL[status].text.toLowerCase()}. Tahrirlash mumkin emas.
        </div>
      )}

      <div className="bg-white dark:bg-surface-800 rounded-lg border border-surface-200 dark:border-surface-700 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-surface-500">Yuklanmoqda...</div>
        ) : indicators.length === 0 ? (
          <div className="p-8 text-center text-surface-500">Universitet ko&apos;rsatkichlari hali sozlanmagan.</div>
        ) : (
          <table className="w-full">
            <thead className="bg-surface-50 dark:bg-surface-900/50 border-b border-surface-200 dark:border-surface-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-surface-600 uppercase w-16">Ã¢â€žâ€“</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-surface-600 uppercase">Ko&apos;rsatkich</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-surface-600 uppercase w-24">Birlik</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-surface-600 uppercase w-24">Maqsad</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-surface-600 uppercase w-32">Bajarilish</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-surface-600 uppercase w-20">Foizi</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-surface-600 uppercase">Tasdiqlovchi fayllar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-200 dark:divide-surface-700">
              {indicators.map((ind) => {
                const f = files[ind.id] ?? [];
                const maqsad = target?.values?.[ind.id] ?? null;
                const parseNum = (v: string) => { const n = Number(v); return isNaN(n) ? 0 : n; };
                const qiymat = values[ind.id] ? parseNum(values[ind.id]) : null;
                let foiz = "Ã¢â‚¬â€";
                if (typeof maqsad === "number" && maqsad > 0 && typeof qiymat === "number") {
                   const p = (qiymat / maqsad) * 100;
                   foiz = (p > 100 ? 100 : p).toFixed(1) + "%";
                } else if (typeof maqsad === "number" && maqsad === 0 && typeof qiymat === "number" && qiymat >= 0) {
                   foiz = "100.0%";
                }

                const editable =
                  !formLocked && (status === "draft" || !submission || indicatorEditable(ind.id));
                const rej = rejectionNote(ind.id);
                const rowHighlight = rej
                  ? "bg-danger-50/40 dark:bg-danger-900/10"
                  : "";

                return (
                  <tr key={ind.id} className={`align-top ${rowHighlight}`}>
                    <td className="px-4 py-3 text-sm font-mono">{ind.no}</td>
                    <td className={`px-4 py-3 text-sm ${ind.is_sub_indicator ? "pl-8 text-surface-600" : ""}`}>
                      {ind.name}
                      {rej && (
                        <div className="mt-1 text-xs text-danger-700 dark:text-danger-400">
                          <strong>{rej.stage} rad etdi:</strong> {rej.comment || "(izohsiz)"}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-surface-500">{ind.unit}</td>
                    <td className="px-4 py-3 text-sm font-medium text-surface-700 dark:text-surface-300">
                      {maqsad !== null ? maqsad : <span className="text-surface-400">Ã¢â‚¬â€</span>}
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        step="any"
                        value={values[ind.id] ?? ""}
                        onChange={(e) => setValues((p) => ({ ...p, [ind.id]: e.target.value }))}
                        disabled={!editable}
                        className="w-full rounded-md border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 px-2 py-1.5 text-sm disabled:opacity-60"
                      />
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-surface-900 dark:text-surface-100">
                      {foiz}
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-1">
                        {f.map((p) => (
                          <div key={p} className="flex items-center gap-2 text-xs">
                            <button
                              type="button"
                              onClick={() => openFile(p)}
                              className="text-primary-600 hover:underline truncate"
                              title={p}
                            >
                              {p.split("/").pop()?.replace(/^\d+_/, "")}
                            </button>
                            {editable && (
                              <button
                                type="button"
                                onClick={() => removeFile(ind.id, p)}
                                className="text-danger-600 hover:text-danger-700"
                                title="O'chirish"
                              >
                                Ã¢Å“â€¢
                              </button>
                            )}
                          </div>
                        ))}
                        {editable && (
                          <label className="inline-block cursor-pointer text-xs text-primary-600 hover:underline">
                            {uploadingFor === ind.id ? "Yuklanmoqda..." : "+ Fayl qo'shish"}
                            <input
                              type="file"
                              className="hidden"
                              disabled={uploadingFor === ind.id}
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) uploadFile(ind.id, file);
                                e.target.value = "";
                              }}
                            />
                          </label>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {reviewSummaries.length > 0 && (
        <div className="mt-4 bg-white dark:bg-surface-800 rounded-lg border border-surface-200 dark:border-surface-700 p-4">
          <h2 className="text-2xl font-semibold text-surface-900 dark:text-surface-100 mb-4">
            Ko&apos;rib chiqish tarixi
          </h2>
          <ol className="space-y-4">
            {reviewSummaries.map((entry) => (
              <li key={entry.key} className="border-l-2 border-surface-200 dark:border-surface-700 pl-4">
                <div className="text-xs text-surface-500 dark:text-surface-400">{entry.header}</div>
                <div className="mt-1 text-sm text-surface-900 dark:text-surface-100">{entry.body}</div>
                {entry.details.length > 0 && (
                  <ul className="mt-2 space-y-0.5">
                    {entry.details.map((detail, idx) => (
                      <li key={`${entry.key}-${idx}`} className="text-sm text-surface-700 dark:text-surface-300">
                        • {detail}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}

      {!formLocked && indicators.length > 0 && (
        <div className="mt-4 flex items-center justify-end gap-2">
          {!isRevision && (
            <Button variant="outline" onClick={() => persist("draft")} isLoading={busyAction === "draft"}>
              Qoralamani saqlash
            </Button>
          )}
          <Button onClick={() => persist("pending_dean")} isLoading={busyAction === "submit"}>
            {isRevision ? "Qayta yuborish" : "Yuborish"}
          </Button>
        </div>
      )}
    </div>
  );
}
