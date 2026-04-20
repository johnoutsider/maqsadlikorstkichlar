// Workflow helpers for the staff -> dean -> science approval pipeline.

import type {
  IndicatorReviewEntry,
  ReviewStage,
  SubmissionStatus,
  Submission,
} from "@/types/db";

export const STATUS_LABEL: Record<SubmissionStatus, { text: string; cls: string }> = {
  draft:            { text: "Qoralama",                        cls: "bg-surface-200 text-surface-700 dark:bg-surface-700 dark:text-surface-200" },
  pending:          { text: "Dekan tasdiqlashi kutilmoqda",    cls: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
  pending_dean:     { text: "Dekan tasdiqlashi kutilmoqda",    cls: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
  pending_science:  { text: "Ilmiy bo'lim tasdiqlashi kutilmoqda", cls: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300" },
  needs_revision:   { text: "Qayta ko'rib chiqish kerak",      cls: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300" },
  approved:         { text: "Tasdiqlangan",                    cls: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300" },
  rejected:         { text: "Rad etilgan",                     cls: "bg-danger-100 text-danger-800 dark:bg-danger-900/40 dark:text-danger-300" },
};

export const SELECTABLE_STATUSES: SubmissionStatus[] = [
  "draft",
  "pending_dean",
  "pending_science",
  "needs_revision",
  "approved",
  "rejected",
];

// Given the submission status and an indicator's review record, decide whether
// the staff manager can edit that indicator's value/files.
export function isIndicatorEditable(
  status: SubmissionStatus,
  review: IndicatorReviewEntry | undefined
): boolean {
  if (status === "draft") return true;
  if (status === "needs_revision" || status === "rejected") {
    return (
      review?.dean?.status === "rejected" ||
      review?.science?.status === "rejected"
    );
  }
  return false;
}

// Given the reviewer's current stage and an indicator's review record, decide
// whether this reviewer still needs to act on this indicator.
// A reviewer only needs to (re)act on:
//   - indicators with no decision yet for their stage, or
//   - indicators their own stage previously rejected that the staff has now resubmitted
//     (the staff resubmit clears prior decisions on rejected indicators).
export function needsReviewerAction(
  stage: ReviewStage,
  review: IndicatorReviewEntry | undefined
): boolean {
  const mine = review?.[stage];
  return !mine;
}

// After staff resubmits, clear the review decisions for indicators that were
// rejected (by either stage). Unchanged / previously-approved indicators keep
// their existing decisions so reviewers don't repeat work.
export function clearRejectedReviews(
  reviews: Record<string, IndicatorReviewEntry>
): Record<string, IndicatorReviewEntry> {
  const next: Record<string, IndicatorReviewEntry> = {};
  for (const [id, r] of Object.entries(reviews ?? {})) {
    const rejected =
      r?.dean?.status === "rejected" || r?.science?.status === "rejected";
    if (rejected) {
      // Full clear so both stages re-review after staff edits the data.
      next[id] = { dean: null, science: null };
    } else {
      next[id] = {
        dean: r?.dean ?? null,
        science: r?.science ?? null,
      };
    }
  }
  return next;
}

// Who can review this submission right now?
export function currentReviewerStage(status: SubmissionStatus): ReviewStage | null {
  if (status === "pending_dean" || status === "pending") return "dean";
  if (status === "pending_science") return "science";
  return null;
}

export function canRoleReviewNow(role: string, status: SubmissionStatus): boolean {
  const stage = currentReviewerStage(status);
  if (!stage) return false;
  if (stage === "dean") return role === "dean";
  return role === "science_department" || role === "university_admin";
}

// Derive the next form status from a reviewer's per-indicator decisions.
// If any indicator is rejected at this stage -> needs_revision.
// Otherwise advance: dean -> pending_science, science -> approved.
export function deriveNextStatus(
  stage: ReviewStage,
  reviews: Record<string, IndicatorReviewEntry>,
  indicatorIds: string[]
): { status: SubmissionStatus; anyRejected: boolean } {
  const anyRejected = indicatorIds.some(
    (id) => reviews[id]?.[stage]?.status === "rejected"
  );
  if (anyRejected) return { status: "needs_revision", anyRejected: true };
  if (stage === "dean") return { status: "pending_science", anyRejected: false };
  return { status: "approved", anyRejected: false };
}

// Does this form have ANY review activity recorded? Used to decide whether to
// render the audit-trail section.
export function hasReviewActivity(sub: Submission): boolean {
  return (sub.review_history?.length ?? 0) > 0;
}
