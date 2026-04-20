import type {
  Indicator,
  IndicatorReviewEntry,
  ReviewHistoryEntry,
  Submission,
} from "@/types/db";

function parseJsonField<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return value as T;
}

export function normalizeIndicatorReviews(
  value: unknown
): Record<string, IndicatorReviewEntry> {
  return parseJsonField<Record<string, IndicatorReviewEntry>>(value, {});
}

export function normalizeReviewHistory(value: unknown): ReviewHistoryEntry[] {
  return parseJsonField<ReviewHistoryEntry[]>(value, []);
}

export function normalizeSubmission(submission: Submission | null): Submission | null {
  if (!submission) return null;
  return {
    ...submission,
    indicator_reviews: normalizeIndicatorReviews(submission.indicator_reviews),
    review_history: normalizeReviewHistory(submission.review_history),
  };
}

export interface ReviewSummaryEntry {
  key: string;
  at: string;
  reviewerLabel: string;
  header: string;
  body: string;
  details: string[];
}

export function reviewerLabel(
  reviewerName: string | undefined,
  stage: "Dekan" | "Ilmiy bo'lim"
): string {
  const trimmed = reviewerName?.trim();
  if (!trimmed || trimmed === "Noma'lum foydalanuvchi") return stage;
  return `${trimmed} (${stage})`;
}

export function buildReviewSummaryEntry(
  history: ReviewHistoryEntry,
  indicators: Indicator[],
  reviewerMap: Map<string, string>,
  key: string
): ReviewSummaryEntry {
  const indicatorMap = new Map(indicators.map((ind) => [ind.id, `${ind.no}. ${ind.name}`]));
  const indicatorNoMap = new Map(indicators.map((ind) => [ind.id, ind.no]));
  const stage = history.stage === "dean" ? "Dekan" : "Ilmiy bo'lim";
  const reviewer = reviewerLabel(reviewerMap.get(history.reviewer_id), stage);
  const rejected = history.decisions.filter((d) => d.status === "rejected");
  const commented = history.decisions.filter((d) => (d.comment ?? "").trim().length > 0);

  const grouped = new Map<string, string[]>();
  for (const decision of commented) {
    const comment = (decision.comment ?? "").trim();
    const no = indicatorNoMap.get(decision.indicator_id) ?? decision.indicator_id;
    grouped.set(comment, [...(grouped.get(comment) ?? []), no]);
  }

  const compactDetails = Array.from(grouped.entries()).map(([comment, nos]) => {
    const sortedNos = nos.sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
    );
    return `${sortedNos.join(", ")}: ${comment}`;
  });

  const detailedItems =
    rejected.length > 0
      ? rejected.map((decision) => {
          const label = indicatorMap.get(decision.indicator_id) ?? decision.indicator_id;
          return `${label}${decision.comment ? ` — ${decision.comment}` : ""}`;
        })
      : compactDetails;

  let body = "Izoh qoldirildi.";
  if (history.outcome === "needs_revision") {
    body = `${rejected.length} ta ko'rsatkich rad etildi — xodimga qaytarildi.`;
  } else if (history.outcome === "advanced") {
    body = "Barcha ko'rsatkichlar tasdiqlandi — keyingi bosqichga yuborildi.";
  } else if (history.outcome === "approved") {
    body = "Barcha ko'rsatkichlar tasdiqlandi.";
  }

  return {
    key,
    at: history.at,
    reviewerLabel: reviewer,
    header: `${new Date(history.at).toLocaleString("sv-SE").replace(" ", " ")} · ${reviewer}`,
    body,
    details: detailedItems,
  };
}

export function buildReviewSummaryEntries(
  reviewHistory: ReviewHistoryEntry[],
  indicators: Indicator[],
  reviewerMap: Map<string, string>
): ReviewSummaryEntry[] {
  return reviewHistory
    .map((history, historyIndex) =>
      buildReviewSummaryEntry(history, indicators, reviewerMap, `${history.at}-${historyIndex}`)
    )
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
}
