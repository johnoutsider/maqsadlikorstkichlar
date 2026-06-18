"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { Button } from "@/components/ui/Button";
import type {
  Indicator,
  Submission,
  SubmissionStatus,
  Quarter,
  IndicatorSubmission,
  AppUser,
  Faculty,
  Department,
} from "@/types/db";
import {
  STATUS_LABEL,
  isIndicatorEditable,
  clearRejectedReviews,
} from "@/lib/workflow";
import { buildReviewSummaryEntries, normalizeSubmission } from "@/lib/submission";
import {
  acceptAttribute,
  safeStorageFileName,
  validateFile,
  isPdf,
  getPdfPageCount,
  validatePageRange,
  submissionFileRule,
} from "@/lib/upload-validation";

const QUARTERS: Quarter[] = ["Q1", "Q2", "Q3", "Q4"];

function currentQuarter(): Quarter {
  const m = new Date().getMonth() + 1;
  if (m <= 3) return "Q1";
  if (m <= 6) return "Q2";
  if (m <= 9) return "Q3";
  return "Q4";
}

// ---------------------------------------------------------------------------
// Module-level cache for indicators — static per university, never changes
// during a session. Survives route navigations.
// ---------------------------------------------------------------------------
let _cachedIndicators: { universityId: string; data: Indicator[] } | null = null;

export default function FormPage() {
  // Stable Supabase client — never recreated on re-renders
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;

  const { user } = useSupabaseAuth();

  const [faculty, setFaculty] = useState<Faculty | null>(null);
  const [department, setDepartment] = useState<Department | null>(null);
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [quarter, setQuarter] = useState<Quarter>(currentQuarter());
  const [periodInit, setPeriodInit] = useState(false);
  const [indicators, setIndicators] = useState<Indicator[]>(
    (_cachedIndicators !== null && _cachedIndicators.universityId === user?.university_id) ? _cachedIndicators.data : []
  );
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [target, setTarget] = useState<import("@/types/db").Target | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<"submit" | "save" | null>(null);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const [uploadErrors, setUploadErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [reviewerMap, setReviewerMap] = useState<Map<string, string>>(new Map());

  // Auto-save: every value edit / file change is persisted automatically, so
  // there is no manual "save draft" button. Refs mirror the latest values/files
  // so the debounced + post-upload saves never read stale closure state.
  const [autoSaveState, setAutoSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const valuesRef = useRef<Record<string, string>>({});
  const filesRef = useRef<Record<string, string[]>>({});
  const autoSavingRef = useRef(false);
  const pendingSaveRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoPersistRef = useRef<() => void>(() => {});
  // Pause auto-save while a manual submit is in flight so a late save can't
  // overwrite the just-submitted status back to draft.
  const blockAutoSaveRef = useRef(false);

  useEffect(() => {
    if (!user?.university_id) return;
    // Use cache if it's for the same university
    if (_cachedIndicators?.universityId === user.university_id) {
      setIndicators(_cachedIndicators.data);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("indicators")
        .select("*")
        .eq("university_id", user.university_id)
        .order("order_idx");
      const list = (data as Indicator[]) ?? [];
      _cachedIndicators = { universityId: user.university_id!, data: list };
      setIndicators(list);
    })();
  }, [user?.university_id, supabase]);

  useEffect(() => {
    if (!user?.faculty_id) return;
    (async () => {
      const [fRes, dRes] = await Promise.all([
        supabase.from("faculties").select("*").eq("id", user.faculty_id!).maybeSingle(),
        user.department_id
          ? supabase.from("departments").select("*").eq("id", user.department_id).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      setFaculty((fRes.data as Faculty) ?? null);
      setDepartment((dRes.data as Department) ?? null);
    })();
  }, [user?.faculty_id, user?.department_id, supabase]);

  // On first load, if the staff has a submission needing attention
  // (needs_revision > rejected > any most recent), jump to that period
  // so they aren't staring at a blank current-quarter form.
  useEffect(() => {
    if (periodInit || !user?.id) return;
    (async () => {
      const { data } = await supabase
        .from("submissions")
        .select("year, quarter, status, updated_at")
        .eq("submitted_by", user.id)
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
  }, [user?.id, periodInit, supabase]);

  const load = useCallback(async () => {
    if (!user?.id || !user?.department_id) return;
    setLoading(true);
    setError("");
    setMessage("");
    const [subRes, tgtRes] = await Promise.all([
      supabase
        .from("submissions")
        .select("*")
        .eq("submitted_by", user.id)
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
    valuesRef.current = v;
    filesRef.current = f;
    setValues(v);
    setFiles(f);
    setAutoSaveState("idle");
    blockAutoSaveRef.current = false;
    setLoading(false);
  }, [user?.id, user?.department_id, year, quarter, indicators, supabase]);

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

  // Build the row to upsert. `lenient` (used by auto-save) keeps a previously
  // saved value instead of erroring on a half-typed/invalid number, so an
  // in-progress edit never blocks an auto-save. Reads from refs so debounced
  // and post-upload saves always see the freshest values/files.
  const buildPayload = (newStatus: SubmissionStatus, opts?: { lenient?: boolean }) => {
    if (!user?.university_id || !user?.department_id || !user?.faculty_id) return null;
    const curValues = valuesRef.current;
    const curFiles = filesRef.current;

    // Start from the existing submission's indicators so we preserve locked
    // (already-approved) ones on a revision resubmit. Then overwrite each
    // editable indicator with whatever's in the form state.
    const indicatorsObj: Record<string, IndicatorSubmission> = {
      ...(submission?.indicators ?? {}),
    };
    for (const ind of indicators) {
      const editable = indicatorEditable(ind.id) || status === "draft" || !submission;
      if (!editable) continue;
      const raw = curValues[ind.id]?.trim();
      let value: number | null = null;
      if (raw) {
        const n = Number(raw);
        if (Number.isNaN(n)) {
          if (opts?.lenient) {
            value = submission?.indicators?.[ind.id]?.value ?? null;
          } else {
          setError(`"${ind.no}. ${ind.name}" — son kiriting yoki bo'sh qoldiring.`);
            return null;
          }
        } else {
          value = n;
        }
      }
      indicatorsObj[ind.id] = { value, files: curFiles[ind.id] ?? [] };
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

  const persist = async (newStatus: "pending_dean") => {
    setError("");
    setMessage("");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    blockAutoSaveRef.current = true;

    // Validate: if files are uploaded for an indicator, a numeric value is required.
    for (const ind of indicators) {
      const editable = indicatorEditable(ind.id) || status === "draft" || !submission;
      if (!editable) continue;
      const hasFiles = (filesRef.current[ind.id] ?? []).length > 0;
      const hasValue = (valuesRef.current[ind.id] ?? "").trim() !== "";
      if (hasFiles && !hasValue) {
        setError(`"${ind.no}. ${ind.name}" — fayl yuklangan, ammo raqam kiritilmagan. Iltimos, raqam kiriting.`);
        blockAutoSaveRef.current = false;
        return;
      }
    }

    const payload = buildPayload(newStatus);
    if (!payload) { blockAutoSaveRef.current = false; return; }
    setBusyAction("submit");
    const { error: e } = await supabase
      .from("submissions")
      .upsert(payload, { onConflict: "submitted_by,year,quarter" });
    setBusyAction(null);
    if (e) { setError(e.message); blockAutoSaveRef.current = false; return; }
    if (newStatus === "pending_dean" && user?.university_id && user?.faculty_id) {
      const { notifyDeans } = await import("@/lib/notifications");
      const { data: sub } = await supabase
        .from("submissions")
        .select("id")
        .eq("submitted_by", user.id)
        .eq("year", year)
        .eq("quarter", quarter)
        .maybeSingle();
      await notifyDeans(supabase, {
        universityId: user.university_id,
        facultyId: user.faculty_id,
        title: isRevision ? "Hisobot qayta yuborildi" : "Yangi hisobot yuborildi",
        message: `${user.display_name} — ${year} ${quarter} chorak hisoboti dekan tasdiqlashi uchun yuborildi.`,
        data: { submission_id: (sub as { id?: string } | null)?.id },
      });
    }
    setMessage(
      newStatus === "pending_dean"
        ? "Yuborildi — dekan tasdiqlashi kutilmoqda."
        : "Qoralama saqlandi."
    );
    load();
  };

  const saveDraft = async () => {
    if (!user?.id) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setBusyAction("save");
    const targetStatus: SubmissionStatus = isRevision ? status : "draft";
    const payload = buildPayload(targetStatus, { lenient: true });
    if (!payload) { setBusyAction(null); return; }
    const { error: e } = await supabase
      .from("submissions")
      .upsert(payload, { onConflict: "submitted_by,year,quarter" });
    setBusyAction(null);
    if (e) { setError(e.message); return; }
    setMessage("Qoralama saqlandi.");
    load();
  };

  // ── Auto-save ────────────────────────────────────────────────────────────
  // Persist the current form silently, keeping the current status (a brand-new
  // form becomes a draft; a returned report stays needs_revision/rejected so
  // the user can keep working and come back later). Never touches submitted_at
  // or review decisions. Runs after every file change and (debounced) value
  // edit, so there is no manual "save draft" button.
  const autoPersist = async () => {
    if (blockAutoSaveRef.current || formLocked || !user?.id) return;
    if (autoSavingRef.current) { pendingSaveRef.current = true; return; }
    autoSavingRef.current = true;
    setAutoSaveState("saving");
    const targetStatus: SubmissionStatus = isRevision ? status : "draft";
    const payload = buildPayload(targetStatus, { lenient: true });
    if (!payload) { autoSavingRef.current = false; setAutoSaveState("idle"); return; }
    const { error: e } = await supabase
      .from("submissions")
      .upsert(payload, { onConflict: "submitted_by,year,quarter" });
    autoSavingRef.current = false;
    if (e) { setAutoSaveState("error"); return; }
    setAutoSaveState("saved");
    if (pendingSaveRef.current) { pendingSaveRef.current = false; void autoPersistRef.current(); }
  };
  autoPersistRef.current = autoPersist;

  const scheduleAutoSave = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { void autoPersistRef.current(); }, 800);
  };

  // Clear any pending debounce timer on unmount.
  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  const setUploadError = (indicatorId: string, msg: string) =>
    setUploadErrors((prev) => ({ ...prev, [indicatorId]: msg }));
  const clearUploadError = (indicatorId: string) =>
    setUploadErrors((prev) => { const next = { ...prev }; delete next[indicatorId]; return next; });

  const uploadFile = async (indicatorId: string, file: File) => {
    if (!user?.university_id || !user?.department_id) return;
    setError("");
    clearUploadError(indicatorId);
    const ind = indicators.find((i) => i.id === indicatorId);
    if (!ind) return;
    const fileRule = submissionFileRule(ind.allowed_file_extensions);
    const validationError = validateFile(file, fileRule);
    if (validationError) {
      setUploadError(indicatorId, validationError);
      return;
    }
    if (isPdf(file) && (ind.min_pages !== null || ind.max_pages !== null)) {
      try {
        const pages = await getPdfPageCount(file);
        const rangeError = validatePageRange(pages, ind.min_pages, ind.max_pages);
        if (rangeError) {
          setUploadError(indicatorId, rangeError);
          return;
        }
      } catch {
        setUploadError(indicatorId, "PDF faylni o'qib bo'lmadi. Fayl buzilgan bo'lishi mumkin.");
        return;
      }
    }
    setUploadingFor(indicatorId);
    const safeName = safeStorageFileName(file.name);
    const path = `${user.university_id}/${year}/${quarter}/${user.department_id}/${indicatorId}/${Date.now()}_${safeName}`;
    const { error: e } = await supabase.storage.from("submissions").upload(path, file);
    setUploadingFor(null);
    if (e) { setUploadError(indicatorId, e.message); return; }
    filesRef.current = {
      ...filesRef.current,
      [indicatorId]: [...(filesRef.current[indicatorId] ?? []), path],
    };
    setFiles({ ...filesRef.current });
    void autoPersistRef.current();
  };

  const removeFile = async (indicatorId: string, path: string) => {
    if (!confirm("Faylni o'chirishni tasdiqlaysizmi?")) return;
    const { error: e } = await supabase.storage.from("submissions").remove([path]);
    if (e) { setError(e.message); return; }
    filesRef.current = {
      ...filesRef.current,
      [indicatorId]: (filesRef.current[indicatorId] ?? []).filter((p) => p !== path),
    };
    setFiles({ ...filesRef.current });
    void autoPersistRef.current();
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
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">Fakultet</label>
            <select
              disabled
              value={faculty?.id ?? ""}
              className="w-full rounded-md border border-surface-300 dark:border-surface-600 bg-surface-50 dark:bg-surface-900 px-3 py-2 text-sm opacity-75 cursor-not-allowed"
            >
              {faculty ? (
                <option value={faculty.id}>{faculty.short_code} — {faculty.name}</option>
              ) : (
                <option value="">—</option>
              )}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">Kafedra</label>
            <select
              disabled
              value={department?.id ?? ""}
              className="w-full rounded-md border border-surface-300 dark:border-surface-600 bg-surface-50 dark:bg-surface-900 px-3 py-2 text-sm opacity-75 cursor-not-allowed"
            >
              {department ? (
                <option value={department.id}>{department.short_code} — {department.name}</option>
              ) : (
                <option value="">—</option>
              )}
            </select>
          </div>
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
            <strong>{year} {quarter}</strong> uchun rejalar hali belgilanmagan.
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
                <th className="px-4 py-3 text-left text-xs font-semibold text-surface-600 uppercase w-16">№</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-surface-600 uppercase">Ko&apos;rsatkich</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-surface-600 uppercase w-24">Birlik</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-surface-600 uppercase w-24">Reja</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-surface-600 uppercase w-32">Amal</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-surface-600 uppercase w-20">Foizi</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-surface-600 uppercase w-52">Tasdiqlovchi fayllar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-200 dark:divide-surface-700">
              {indicators.map((ind) => {
                const f = files[ind.id] ?? [];
                const fileRule = submissionFileRule(ind.allowed_file_extensions);
                const maqsad = target?.values?.[ind.id] ?? null;
                const parseNum = (v: string) => { const n = Number(v); return isNaN(n) ? 0 : n; };
                const qiymat = values[ind.id] ? parseNum(values[ind.id]) : null;
                let foiz = "—";
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
                      {maqsad !== null ? maqsad : <span className="text-surface-400">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="relative">
                        <input
                          type="number"
                          step="any"
                          value={values[ind.id] ?? ""}
                          onChange={(e) => {
                            const next = e.target.value;
                            valuesRef.current = { ...valuesRef.current, [ind.id]: next };
                            setValues((p) => ({ ...p, [ind.id]: next }));
                            scheduleAutoSave();
                          }}
                          onBlur={() => {
                            if (debounceRef.current) clearTimeout(debounceRef.current);
                            void autoPersistRef.current();
                          }}
                          disabled={!editable}
                          className={`w-full rounded-md border px-2 py-1.5 text-sm disabled:opacity-60 ${
                            (f.length > 0 && !(values[ind.id] ?? "").trim())
                              ? "border-amber-400 dark:border-amber-500 bg-amber-50 dark:bg-amber-900/20"
                              : "border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800"
                          }`}
                        />
                        {editable && f.length > 0 && !(values[ind.id] ?? "").trim() && (
                          <span
                            title="Fayl yuklangan — raqam kiriting"
                            className="absolute right-1.5 top-1/2 -translate-y-1/2 text-amber-500 text-xs leading-none pointer-events-none"
                          >
                            ⚠
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-surface-900 dark:text-surface-100">
                      {foiz}
                    </td>
                    <td className="px-4 py-3 w-52 max-w-52">
                      <div className="space-y-1">
                        {f.map((p) => (
                          <div key={p} className="flex items-center gap-2 text-xs min-w-0">
                            <button
                              type="button"
                              onClick={() => openFile(p)}
                              className="text-primary-600 hover:underline truncate min-w-0"
                              title={p.split("/").pop()?.replace(/^\d+_/, "")}
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
                                ✕
                              </button>
                            )}
                          </div>
                        ))}
                        {(ind.min_pages !== null || ind.max_pages !== null) && (
                          <div className="text-[10px] text-surface-400 dark:text-surface-500">
                            PDF: {ind.min_pages ?? 1}–{ind.max_pages ?? "∞"} bet
                          </div>
                        )}
                        {editable && (
                          <>
                            <label className="inline-block cursor-pointer text-xs text-primary-600 hover:underline">
                              {uploadingFor === ind.id ? "Yuklanmoqda..." : "+ Fayl qo'shish"}
                              <input
                                type="file"
                                accept={acceptAttribute(fileRule)}
                                className="hidden"
                                disabled={uploadingFor === ind.id}
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) uploadFile(ind.id, file);
                                  e.target.value = "";
                                }}
                              />
                            </label>
                            <div className="text-[10px] text-surface-400 dark:text-surface-500">
                              Ruxsat: {fileRule.label}. Maksimal hajm: 10 MB.
                            </div>
                            {uploadErrors[ind.id] && (
                              <div className="mt-1 flex items-start gap-1.5 rounded-md bg-danger-50 dark:bg-danger-900/30 border border-danger-200 dark:border-danger-700 px-2 py-1.5 text-xs text-danger-700 dark:text-danger-400">
                                <svg className="w-3.5 h-3.5 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                                </svg>
                                <span>{uploadErrors[ind.id]}</span>
                              </div>
                            )}
                          </>
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
        <div className="mt-4 flex items-center justify-end gap-3">
          <span className="text-xs text-surface-500 dark:text-surface-400" aria-live="polite">
            {autoSaveState === "saving" && "Saqlanmoqda…"}
            {autoSaveState === "saved" && "Avtomatik saqlandi ✓"}
            {autoSaveState === "error" && (
              <span className="text-danger-600 dark:text-danger-400">
                Saqlanmadi — internet aloqasini tekshiring
              </span>
            )}
          </span>
          {busyAction !== "submit" && (
            <Button
              variant="outline"
              onClick={saveDraft}
              isLoading={busyAction === "save"}
            >
              Qoralama saqlash
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
