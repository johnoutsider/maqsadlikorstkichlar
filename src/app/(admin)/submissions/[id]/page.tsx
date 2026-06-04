"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { Button } from "@/components/ui/Button";
import type {
  Submission,
  Indicator,
  Faculty,
  Department,
  Target,
  IndicatorSubmission,
  IndicatorReviewEntry,
  ReviewStage,
  ReviewHistoryEntry,
  AppUser,
} from "@/types/db";
import {
  STATUS_LABEL,
  currentReviewerStage,
  deriveNextStatus,
} from "@/lib/workflow";
import { buildReviewSummaryEntries, normalizeSubmission } from "@/lib/submission";

// What the reviewer is marking *right now* per indicator. "pending" = no
// decision yet (blocks finalize).
type Draft = "approved" | "rejected";

export default function SubmissionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();
  const { user } = useSupabaseAuth();

  const [submission, setSubmission] = useState<Submission | null>(null);
  const [indicators, setIndicators] = useState<Indicator[]>([]);
  const [faculty, setFaculty] = useState<Faculty | null>(null);
  const [department, setDepartment] = useState<Department | null>(null);
  const [target, setTarget] = useState<Target | null>(null);
  const [reviewerMap, setReviewerMap] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // Reviewer's draft per-indicator decisions (before they click "Finalize").
  const [decisions, setDecisions] = useState<Record<string, Draft>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [overallComment, setOverallComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Router is unused but kept for parity with prior file; silence lint.
  void router;

  const load = useCallback(async () => {
    if (!id || !user?.university_id) return;
    setLoading(true);
    setError("");
    const { data: sub, error: e } = await supabase
      .from("submissions")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (e || !sub) {
      setError(e?.message ?? "Hisobot topilmadi");
      setLoading(false);
      return;
    }
    const s = normalizeSubmission(sub as Submission)!;
    setSubmission(s);

    const [ind, fac, dep, tgt] = await Promise.all([
      supabase.from("indicators").select("*").eq("university_id", s.university_id).order("order_idx"),
      supabase.from("faculties").select("*").eq("id", s.faculty_id).maybeSingle(),
      supabase.from("departments").select("*").eq("id", s.department_id).maybeSingle(),
      supabase.from("targets").select("*").eq("department_id", s.department_id).eq("year", s.year).eq("quarter", s.quarter).maybeSingle(),
    ]);
    setIndicators((ind.data as Indicator[]) ?? []);
    setFaculty((fac.data as Faculty) ?? null);
    setDepartment((dep.data as Department) ?? null);
    setTarget((tgt.data as Target) ?? null);

    // Resolve reviewer names for the audit trail.
    const reviewerIds = new Set<string>();
    (s.review_history ?? []).forEach((h) => reviewerIds.add(h.reviewer_id));
    Object.values(s.indicator_reviews ?? {}).forEach((r) => {
      if (r?.dean?.by) reviewerIds.add(r.dean.by);
      if (r?.science?.by) reviewerIds.add(r.science.by);
    });
    if (reviewerIds.size > 0) {
      const { data: u } = await supabase
        .from("users")
        .select("id, display_name")
        .in("id", Array.from(reviewerIds));
      const m = new Map<string, string>();
      ((u as Pick<AppUser, "id" | "display_name">[]) ?? []).forEach((row) =>
        m.set(row.id, row.display_name)
      );
      setReviewerMap(m);
    }

    setLoading(false);
  }, [supabase, id, user?.university_id]);

  useEffect(() => { load(); }, [load]);

  const stage: ReviewStage | null = useMemo(
    () => (submission ? currentReviewerStage(submission.status) : null),
    [submission]
  );
  const canReview = useMemo(() => {
    if (!submission || !user || !stage) return false;
    if (stage === "dean") return user.role === "dean" && submission.faculty_id === user.faculty_id;
    return user.role === "science_department" || user.role === "university_admin";
  }, [submission, user, stage]);

  // Seed the reviewer's draft when entering review mode: any indicator that
  // doesn't have a decision for this stage yet defaults to "approved" (the
  // reviewer flips to "rejected" as needed).
  useEffect(() => {
    if (!canReview || !submission || !stage) return;
    const d: Record<string, Draft> = {};
    const c: Record<string, string> = {};
    for (const ind of indicators) {
      const existing = submission.indicator_reviews?.[ind.id]?.[stage];
      if (existing) {
        d[ind.id] = existing.status;
        c[ind.id] = existing.comment ?? "";
      } else {
        d[ind.id] = "approved";
        c[ind.id] = "";
      }
    }
    setDecisions(d);
    setComments(c);
  }, [canReview, submission, stage, indicators]);

  const openFile = async (path: string) => {
    const { data, error: e } = await supabase.storage.from("submissions").createSignedUrl(path, 60 * 10);
    if (e || !data) { setError(e?.message ?? "Faylni ochib bo'lmadi"); return; }
    window.open(data.signedUrl, "_blank");
  };

  const finalize = async () => {
    if (!submission || !user || !stage) return;
    // Require a rejection comment for each rejected indicator.
    for (const ind of indicators) {
      if (decisions[ind.id] === "rejected" && !comments[ind.id]?.trim()) {
        setError(`"${ind.no}. ${ind.name}" — rad etish sababini kiriting.`);
        return;
      }
    }
    setError(""); setMessage(""); setSubmitting(true);

    const now = new Date().toISOString();
    // Merge our stage decisions into existing indicator_reviews, preserving
    // the other stage's decisions untouched.
    const nextReviews: Record<string, IndicatorReviewEntry> = {};
    for (const ind of indicators) {
      const prior = submission.indicator_reviews?.[ind.id] ?? { dean: null, science: null };
      const decision = decisions[ind.id] ?? "approved";
      const entry: IndicatorReviewEntry = {
        dean: prior.dean ?? null,
        science: prior.science ?? null,
      };
      entry[stage] = {
        status: decision,
        comment: decision === "rejected" ? (comments[ind.id]?.trim() || null) : (comments[ind.id]?.trim() || null),
        by: user.id,
        at: now,
      };
      nextReviews[ind.id] = entry;
    }

    const { status: nextStatus, anyRejected } = deriveNextStatus(
      stage,
      nextReviews,
      indicators.map((i) => i.id)
    );

    const historyEntry: ReviewHistoryEntry = {
      stage,
      reviewer_id: user.id,
      at: now,
      outcome: anyRejected
        ? "needs_revision"
        : stage === "dean"
          ? "advanced"
          : "approved",
      overall_comment: overallComment.trim() || null,
      decisions: indicators.map((ind) => ({
        indicator_id: ind.id,
        status: decisions[ind.id] ?? "approved",
        comment: comments[ind.id]?.trim() || null,
      })),
    };

    const nextHistory = [...(submission.review_history ?? []), historyEntry];

    const { error: e } = await supabase
      .from("submissions")
      .update({
        status: nextStatus,
        indicator_reviews: nextReviews,
        review_history: nextHistory,
        reviewed_by: user.id,
        reviewed_at: now,
        review_comment: overallComment.trim() || null,
        updated_at: now,
      })
      .eq("id", submission.id);

    if (e) { setSubmitting(false); setError(e.message); return; }

    // Notifications downstream.
    const { createNotifications, notifyScienceDepartment } = await import("@/lib/notifications");
    if (nextStatus === "pending_science") {
      await notifyScienceDepartment(supabase, {
        universityId: submission.university_id,
        title: "Hisobot ilmiy bo'lim ko'rib chiqishi uchun tayyor",
        message: `${department?.name ?? ""} — ${submission.year} ${submission.quarter} hisobot dekan tomonidan tasdiqlandi.`,
        data: { submission_id: submission.id },
      });
    } else if (nextStatus === "needs_revision") {
      await createNotifications(supabase, [{
        university_id: submission.university_id,
        recipient_id: submission.submitted_by,
        type: "submission_needs_revision",
        title: "Hisobotingiz qayta ko'rib chiqishni talab qiladi",
        message: overallComment.trim() || "Ba'zi ko'rsatkichlar rad etildi. Iltimos, qayta ko'rib chiqing.",
        data: { submission_id: submission.id },
      }]);
    } else if (nextStatus === "approved") {
      await createNotifications(supabase, [{
        university_id: submission.university_id,
        recipient_id: submission.submitted_by,
        type: "submission_approved",
        title: "Hisobotingiz tasdiqlandi",
        message: `${submission.year} ${submission.quarter} chorak hisoboti tasdiqlandi.`,
        data: { submission_id: submission.id },
      }]);
    }

    setSubmitting(false);
    setMessage(
      nextStatus === "needs_revision"
        ? "Qayta ko'rib chiqish uchun yuborildi."
        : nextStatus === "pending_science"
          ? "Ilmiy bo'limga yuborildi."
          : "Tasdiqlandi."
    );
    load();
  };

  if (loading) {
    return <div className="p-8 text-center text-surface-500">Yuklanmoqda...</div>;
  }
  if (!submission) {
    return (
      <div className="p-8 text-center">
        <p className="text-danger-600">{error || "Topilmadi"}</p>
        <Link href="/submissions" className="text-primary-600 hover:underline text-sm mt-4 inline-block">
          Orqaga
        </Link>
      </div>
    );
  }

  const statusInfo = STATUS_LABEL[submission.status];

  let totalScore = 0;
  let scoredItemsCount = 0;
  indicators.forEach(ind => {
    const maqsad = target?.values?.[ind.id] ?? null;
    const qiymat = submission.indicators[ind.id]?.value ?? null;
    if (typeof maqsad === "number" && typeof qiymat === "number") {
      scoredItemsCount++;
      if (maqsad > 0) {
        totalScore += Math.min((qiymat / maqsad) * 100, 100);
      } else if (maqsad === 0 && qiymat >= 0) {
        totalScore += 100;
      }
    }
  });
  const overallScore = scoredItemsCount > 0 ? (totalScore / scoredItemsCount).toFixed(1) : "0.0";

  const rejectedDraftCount = Object.values(decisions).filter((d) => d === "rejected").length;
  const reviewSummaries = buildReviewSummaryEntries(
    submission.review_history ?? [],
    indicators,
    reviewerMap
  );

  return (
    <div>
      <Link href="/submissions" className="text-sm text-primary-600 hover:underline">Orqaga</Link>

      <div className="flex items-center justify-between mt-2 mb-6 gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-100 flex items-center gap-3">
            {department?.name ?? "..."}
            <span className="text-lg font-semibold bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300 px-3 py-1 rounded-md">
              Umumiy ball: {overallScore}%
            </span>
          </h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
            {faculty?.name} • {submission.year} {submission.quarter}
          </p>
        </div>
        <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${statusInfo.cls}`}>
          {statusInfo.text}
        </span>
      </div>

      {error && <div className="mb-4 p-3 bg-danger-50 dark:bg-danger-900/30 text-danger-600 dark:text-danger-400 rounded-lg text-sm">{error}</div>}
      {message && <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-lg text-sm">{message}</div>}

      {canReview && (
        <div className="mb-4 p-3 bg-primary-50 dark:bg-primary-900/20 text-primary-800 dark:text-primary-300 rounded-lg text-sm">
          {stage === "dean"
            ? "Siz dekan sifatida ko'rib chiqmoqdasiz. Har bir ko'rsatkichni tasdiqlang yoki rad eting. Kamida bittasi rad etilsa, hisobot xodimga qaytariladi."
            : "Siz ilmiy bo'lim sifatida yakuniy ko'rib chiqishni amalga oshirmoqdasiz. Dekan tomonidan tasdiqlangan bo'lsa ham, istagan ko'rsatkichni rad etishingiz mumkin."}
        </div>
      )}

      <div className="bg-white dark:bg-surface-800 rounded-lg border border-surface-200 dark:border-surface-700 overflow-hidden">
        <table className="w-full">
          <thead className="bg-surface-50 dark:bg-surface-900/50 border-b border-surface-200 dark:border-surface-700">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-surface-600 uppercase w-16">№</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-surface-600 uppercase">Ko&apos;rsatkich</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-surface-600 uppercase w-20">Birlik</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-surface-600 uppercase w-24">Reja</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-surface-600 uppercase w-24">Amal</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-surface-600 uppercase w-20">Foiz</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-surface-600 uppercase">Fayllar</th>
              {canReview && (
                <th className="px-4 py-3 text-left text-xs font-semibold text-surface-600 uppercase w-72">Sizning qaroringiz</th>
              )}
              {!canReview && (
                <th className="px-4 py-3 text-left text-xs font-semibold text-surface-600 uppercase w-48">Holat</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-200 dark:divide-surface-700">
            {indicators.map((ind) => {
              const cell: IndicatorSubmission | undefined = submission.indicators[ind.id];
              const tgtVal = target?.values?.[ind.id];
              const rev = submission.indicator_reviews?.[ind.id];

              let foiz = "—";
              if (typeof tgtVal === "number" && typeof cell?.value === "number") {
                if (tgtVal > 0) {
                  const p = (cell.value / tgtVal) * 100;
                  foiz = (p > 100 ? 100 : p).toFixed(1) + "%";
                } else if (tgtVal === 0 && cell.value >= 0) {
                  foiz = "100.0%";
                }
              }

              const drafting = canReview;
              const draft = decisions[ind.id];
              const rowCls = drafting
                ? draft === "rejected"
                  ? "bg-danger-50/40 dark:bg-danger-900/10"
                  : ""
                : rev?.science?.status === "rejected" || rev?.dean?.status === "rejected"
                  ? "bg-danger-50/40 dark:bg-danger-900/10"
                  : rev?.science?.status === "approved" || rev?.dean?.status === "approved"
                    ? "bg-green-50/40 dark:bg-green-900/10"
                    : "";

              return (
                <tr key={ind.id} className={`align-top ${rowCls}`}>
                  <td className="px-4 py-3 text-sm font-mono">{ind.no}</td>
                  <td className={`px-4 py-3 text-sm ${ind.is_sub_indicator ? "pl-8 text-surface-600" : ""}`}>{ind.name}</td>
                  <td className="px-4 py-3 text-sm text-surface-500">{ind.unit}</td>
                  <td className="px-4 py-3 text-sm text-surface-700 dark:text-surface-300">
                    {tgtVal === null || tgtVal === undefined ? <span className="text-surface-400">—</span> : tgtVal}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium">
                    {cell?.value === null || cell?.value === undefined ? <span className="text-surface-400">—</span> : cell.value}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-primary-600 dark:text-primary-400">{foiz}</td>
                  <td className="px-4 py-3">
                    <div className="space-y-1">
                      {(cell?.files ?? []).length === 0 ? (
                        <span className="text-xs text-surface-400">—</span>
                      ) : (
                        (cell!.files).map((p) => (
                          <button
                            key={p}
                            type="button"
                            onClick={() => openFile(p)}
                            className="block text-xs text-primary-600 hover:underline truncate max-w-xs"
                            title={p}
                          >
                            {p.split("/").pop()?.replace(/^\d+_/, "")}
                          </button>
                        ))
                      )}
                    </div>
                  </td>
                  {drafting && stage && (
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-2">
                        <div className="inline-flex rounded-md border border-surface-300 dark:border-surface-600 overflow-hidden text-xs">
                          <button
                            type="button"
                            onClick={() => setDecisions((p) => ({ ...p, [ind.id]: "approved" }))}
                            className={`px-2 py-1 ${draft === "approved" ? "bg-green-600 text-white" : "bg-white dark:bg-surface-800 text-surface-700 dark:text-surface-300"}`}
                          >
                            Tasdiqlash
                          </button>
                          <button
                            type="button"
                            onClick={() => setDecisions((p) => ({ ...p, [ind.id]: "rejected" }))}
                            className={`px-2 py-1 border-l border-surface-300 dark:border-surface-600 ${draft === "rejected" ? "bg-danger-600 text-white" : "bg-white dark:bg-surface-800 text-surface-700 dark:text-surface-300"}`}
                          >
                            Rad etish
                          </button>
                        </div>
                        {draft === "rejected" && (
                          <textarea
                            value={comments[ind.id] ?? ""}
                            onChange={(e) => setComments((p) => ({ ...p, [ind.id]: e.target.value }))}
                            rows={2}
                            placeholder="Rad etish sababi..."
                            className="w-full rounded-md border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 px-2 py-1 text-xs"
                          />
                        )}
                        {/* Show the other stage's prior decision for context */}
                        {stage === "science" && rev?.dean && (
                          <div className={`text-xs ${rev.dean.status === "approved" ? "text-green-700 dark:text-green-400" : "text-danger-700 dark:text-danger-400"}`}>
                            Dekan: {rev.dean.status === "approved" ? "tasdiqlangan" : "rad etgan"}
                            {rev.dean.comment ? ` — ${rev.dean.comment}` : ""}
                          </div>
                        )}
                      </div>
                    </td>
                  )}
                  {!drafting && (
                    <td className="px-4 py-3 text-xs">
                      <IndicatorStatusPill review={rev} reviewerMap={reviewerMap} />
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {canReview && (
        <div className="mt-6 bg-white dark:bg-surface-800 rounded-lg border border-surface-200 dark:border-surface-700 p-4 space-y-3">
          <label className="block text-sm font-medium text-surface-700 dark:text-surface-300">
            Umumiy izoh (ixtiyoriy)
          </label>
          <textarea
            value={overallComment}
            onChange={(e) => setOverallComment(e.target.value)}
            rows={2}
            placeholder="Umumiy sharh yoki tavsiyalar..."
            className="w-full rounded-md border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 px-3 py-2 text-sm"
          />
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-xs text-surface-500">
              {rejectedDraftCount > 0
                ? `${rejectedDraftCount} ta ko'rsatkich rad etiladi — hisobot xodimga qaytariladi.`
                : stage === "dean"
                  ? "Barcha ko'rsatkichlar tasdiqlanadi — hisobot ilmiy bo'limga yuboriladi."
                  : "Barcha ko'rsatkichlar tasdiqlanadi — hisobot yakuniy tasdiqlanadi."}
            </p>
            <Button onClick={finalize} isLoading={submitting}>
              Yakunlash
            </Button>
          </div>
        </div>
      )}

      {/* Audit trail */}
      {submission.review_history && submission.review_history.length > 0 && (
        <div className="mt-6 bg-white dark:bg-surface-800 rounded-lg border border-surface-200 dark:border-surface-700 p-4">
          <h2 className="text-2xl font-semibold text-surface-900 dark:text-surface-100 mb-4">Ko&apos;rib chiqish tarixi</h2>
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
    </div>
  );
}
function IndicatorStatusPill({
  review,
  reviewerMap,
}: {
  review: IndicatorReviewEntry | undefined;
  reviewerMap: Map<string, string>;
}) {
  if (!review || (!review.dean && !review.science)) {
    return <span className="text-surface-400">Ko&apos;rib chiqilmagan</span>;
  }
  return (
    <div className="space-y-1">
      {review.dean && (
        <div className={review.dean.status === "approved" ? "text-green-700 dark:text-green-400" : "text-danger-700 dark:text-danger-400"}>
          Dekan: {review.dean.status === "approved" ? "✓" : "✗"}
          {review.dean.comment ? ` — ${review.dean.comment}` : ""}
          <span className="text-surface-400 ml-1">({reviewerMap.get(review.dean.by) ?? ""})</span>
        </div>
      )}
      {review.science && (
        <div className={review.science.status === "approved" ? "text-green-700 dark:text-green-400" : "text-danger-700 dark:text-danger-400"}>
          Ilmiy b.: {review.science.status === "approved" ? "✓" : "✗"}
          {review.science.comment ? ` — ${review.science.comment}` : ""}
          <span className="text-surface-400 ml-1">({reviewerMap.get(review.science.by) ?? ""})</span>
        </div>
      )}
    </div>
  );
}
