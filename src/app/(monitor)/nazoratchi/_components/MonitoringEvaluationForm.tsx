"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { createClient } from "@/lib/supabase/client";
import { MONITORING_RUBRIC } from "@/lib/monitoring-rubric";
import { invalidateIzlanuvchilarCache } from "@/app/(shared)/izlanuvchilar/_lib/cache";
import {
  logEvaluationChanges,
  type EvaluationChangeInput,
} from "../_actions/log-evaluation-changes";
import type {
  Department,
  IzlanuvchiTuri,
  MonitoringEvaluationDeviceKind,
  MonitoringEvaluationItem,
  MonitoringEvaluationLog,
  MonitoringResearcherSource,
} from "@/types/db";

type SearchResult = {
  id: string;
  source: MonitoringResearcherSource;
  fullName: string;
  identifier: string;
  departmentId: string;
  departmentName: string;
  level: string;
  specialtyCode: string;
  researchTopic: string;
  advisor: string;
  course: string;
  admissionYear: string;
  submissionDate: string;
};

type EvaluationForm = {
  fullName: string;
  departmentId: string;
  level: string;
  specialtyCode: string;
  researchTopic: string;
  advisor: string;
  course: string;
  admissionYear: string;
  submissionDate: string;
  period: string;
};

function currentMonitoringPeriod() {
  return "2026 yil, 1 yarim yillik hisobot";
}

const EMPTY_FORM: EvaluationForm = {
  fullName: "",
  departmentId: "",
  level: "PhD",
  specialtyCode: "",
  researchTopic: "",
  advisor: "",
  course: "",
  admissionYear: "",
  submissionDate: "",
  period: currentMonitoringPeriod(),
};

function relationOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function detectDeviceKind(): MonitoringEvaluationDeviceKind {
  if (typeof navigator === "undefined") return "kompyuter";
  const uaData = (navigator as Navigator & { userAgentData?: { mobile?: boolean } })
    .userAgentData;
  if (uaData?.mobile !== undefined) {
    return uaData.mobile ? "mobil" : "kompyuter";
  }
  return /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)
    ? "mobil"
    : "kompyuter";
}

function formatLogTimestamp(value: string) {
  return new Intl.DateTimeFormat("uz-UZ", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function fieldClassName(readOnly = false) {
  return `w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-surface-600 dark:bg-surface-800 ${
    readOnly
      ? "cursor-default bg-slate-100 text-slate-600 dark:bg-surface-700"
      : "bg-white text-slate-800"
  }`;
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  readOnly = false,
  type = "text",
}: {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  type?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-semibold text-slate-700 dark:text-surface-200">
        {label}
      </span>
      <input
        type={type}
        value={value}
        readOnly={readOnly}
        placeholder={placeholder}
        onChange={(event) => onChange?.(event.target.value)}
        className={fieldClassName(readOnly)}
      />
    </label>
  );
}

export function MonitoringEvaluationForm({
  evaluationId,
  readOnly = false,
}: {
  evaluationId?: string;
  readOnly?: boolean;
}) {
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;
  const router = useRouter();
  const { user } = useSupabaseAuth();
  // The monitor works entirely off the izlanuvchilar table; the radio selects
  // which turi (doktorant vs mustaqil) to search within it.
  const [researcherTuri, setResearcherTuri] =
    useState<IzlanuvchiTuri>("doktorant");
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [selected, setSelected] = useState<SearchResult | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [form, setForm] = useState<EvaluationForm>(EMPTY_FORM);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [editLoading, setEditLoading] = useState(Boolean(evaluationId));
  const [error, setError] = useState("");
  const scoreInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const commentInputRefs = useRef<Record<string, HTMLTextAreaElement | null>>(
    {}
  );
  const [savedResult, setSavedResult] = useState<{
    id: string;
    total: number;
  } | null>(null);
  const initialScoresRef = useRef<Record<string, number>>({});
  const initialCommentsRef = useRef<Record<string, string>>({});
  const [logs, setLogs] = useState<MonitoringEvaluationLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const resultsPath =
    user?.role === "science_department" ||
    user?.role === "university_admin" ||
    user?.role === "super_admin"
      ? "/monitoring-natijalari"
      : "/nazoratchi/natijalar";

  useEffect(() => {
    if (!user?.university_id) return;
    let cancelled = false;

    supabase
      .from("departments")
      .select("*")
      .eq("university_id", user.university_id)
      .order("name")
      .then(({ data }) => {
        if (!cancelled) setDepartments((data as Department[] | null) ?? []);
      });

    return () => {
      cancelled = true;
    };
  }, [supabase, user?.university_id]);

  useEffect(() => {
    if (!evaluationId) {
      setEditLoading(false);
      return;
    }
    if (!user?.university_id) return;

    let cancelled = false;
    const currentUserId = user.id;
    const universityId = user.university_id;

    async function loadEvaluation() {
      setEditLoading(true);
      setError("");

      const { data, error: loadError } = await supabase
        .from("monitoring_evaluations")
        .select("*, monitoring_evaluation_items(*)")
        .eq("id", evaluationId)
        .eq("university_id", universityId)
        .maybeSingle();

      if (cancelled) return;
      if (loadError || !data) {
        setError(
          loadError?.message ?? "Tahrirlanadigan monitoring natijasi topilmadi."
        );
        setEditLoading(false);
        return;
      }
      if (!readOnly && data.created_by !== currentUserId) {
        setError("Bu monitoring natijasini tahrirlashga ruxsat yo'q.");
        setEditLoading(false);
        return;
      }

      const researcherId =
        data.researcher_source === "doktorantlar"
          ? data.doktorant_id
          : data.izlanuvchi_id;
      if (!researcherId) {
        setError("Monitoring natijasiga bog'langan izlanuvchi topilmadi.");
        setEditLoading(false);
        return;
      }

      setSelected({
        id: researcherId,
        source: data.researcher_source as MonitoringResearcherSource,
        fullName: data.full_name,
        identifier: researcherId,
        departmentId: data.department_id ?? "",
        departmentName: "",
        level: data.education_level ?? "PhD",
        specialtyCode: data.specialty_code ?? "",
        researchTopic: data.research_topic ?? "",
        advisor: data.advisor_name ?? "",
        course: data.course ?? "",
        admissionYear: data.admission_year ?? "",
        submissionDate: data.submission_date ?? "",
      });
      setSearchQuery(data.full_name);
      setForm({
        fullName: data.full_name,
        departmentId: data.department_id ?? "",
        level: data.education_level ?? "PhD",
        specialtyCode: data.specialty_code ?? "",
        researchTopic: data.research_topic ?? "",
        advisor: data.advisor_name ?? "",
        course: data.course ?? "",
        admissionYear: data.admission_year ?? "",
        submissionDate: data.submission_date ?? "",
        period: data.monitoring_period,
      });

      const nextScores: Record<string, number> = {};
      const nextComments: Record<string, string> = {};
      (
        (data.monitoring_evaluation_items as MonitoringEvaluationItem[]) ?? []
      ).forEach((item) => {
        if (!item.disabled && item.score !== null) {
          nextScores[item.criterion_key] = item.score <= 2 ? 2 : item.score;
        }
        if (item.comment) nextComments[item.criterion_key] = item.comment;
      });
      setScores(nextScores);
      setComments(nextComments);
      initialScoresRef.current = nextScores;
      initialCommentsRef.current = nextComments;
      setEditLoading(false);
    }

    loadEvaluation();
    return () => {
      cancelled = true;
    };
  }, [evaluationId, readOnly, supabase, user?.id, user?.university_id]);

  async function loadLogs() {
    if (!evaluationId) return;
    setLogsLoading(true);
    const { data } = await supabase
      .from("monitoring_evaluation_logs")
      .select("*")
      .eq("evaluation_id", evaluationId)
      .order("created_at", { ascending: false });
    setLogs((data as MonitoringEvaluationLog[] | null) ?? []);
    setLogsLoading(false);
  }

  useEffect(() => {
    if (!evaluationId) {
      setLogs([]);
      return;
    }
    loadLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evaluationId]);

  useEffect(() => {
    if (evaluationId || selected) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    const query = searchQuery.trim();
    if (!user?.university_id || query.length < 2) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setSearching(true);
      setError("");
      const tokens = query
        .replace(/[,%()'"\\]/g, " ")
        .split(/\s+/)
        .map((token) => token.trim())
        .filter(Boolean);

      if (tokens.length === 0) {
        if (!cancelled) {
          setSearchResults([]);
          setSearching(false);
        }
        return;
      }

      let request = supabase
        .from("izlanuvchilar")
        .select(
          "id,full_name,pinfl,source_no,department_id,education_stage,specialty_code,research_topic,supervisor_name,admission_year,submission_date,course,departments(name)"
        )
        .eq("university_id", user.university_id)
        .eq("turi", researcherTuri);

      // Each token must match the name or an identifier — chained filters are
      // ANDed, so word order and extra spaces no longer break name search.
      for (const token of tokens) {
        request = request.or(
          `full_name.ilike.%${token}%,pinfl.ilike.%${token}%,source_no.ilike.%${token}%`
        );
      }

      const { data, error: searchError } = await request
        .order("full_name")
        .limit(8);

      if (cancelled) return;
      if (searchError) {
        setError(searchError.message);
        setSearchResults([]);
      } else {
        setSearchResults(
          ((data as any[]) ?? []).map((row) => {
            const department = relationOne<{ name?: string | null }>(
              row.departments
            );
            return {
              id: row.id,
              source: "izlanuvchilar" as MonitoringResearcherSource,
              fullName: row.full_name,
              identifier: row.pinfl || row.source_no || row.id,
              departmentId: row.department_id ?? "",
              departmentName: department?.name ?? "Kafedra biriktirilmagan",
              level: row.education_stage?.includes("DSc") ? "DSc" : "PhD",
              specialtyCode: row.specialty_code ?? "",
              researchTopic: row.research_topic ?? "",
              advisor: row.supervisor_name ?? "",
              course: row.course ?? "",
              admissionYear: row.admission_year ?? "",
              submissionDate: row.submission_date ?? "",
            };
          })
        );
      }

      if (!cancelled) setSearching(false);
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    evaluationId,
    selected,
    searchQuery,
    researcherTuri,
    supabase,
    user?.university_id,
  ]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      Object.values(commentInputRefs.current).forEach((element) => {
        if (element) resizeCommentField(element);
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [comments]);

  const isDsc = form.level === "DSc";
  const activeItemKeys = useMemo(
    () =>
      MONITORING_RUBRIC.flatMap((section) => section.items)
        .filter((item) => !item.dscOnly || isDsc)
        .map((item) => item.key),
    [isDsc]
  );
  const stats = useMemo(() => {
    let sum = 0;
    let count = 0;

    MONITORING_RUBRIC.forEach((section) => {
      section.items.forEach((item) => {
        if (item.dscOnly && !isDsc) return;
        if (scores[item.key] === undefined) return;
        sum += scores[item.key] <= 2 ? 0 : scores[item.key];
        count += 1;
      });
    });

    const average = count === 0 ? 0 : Number((sum / count).toFixed(1));
    const total100 =
      count === 0 ? 0 : Math.round((sum / (count * 5)) * 100);
    return { sum, count, average, total100 };
  }, [isDsc, scores]);

  function chooseTuri(nextTuri: IzlanuvchiTuri) {
    if (readOnly) return;
    setResearcherTuri(nextTuri);
    setSearchQuery("");
    setSearchResults([]);
    setSelected(null);
    setForm({ ...EMPTY_FORM, period: currentMonitoringPeriod() });
    setScores({});
    setComments({});
    setError("");
  }

  function resetEvaluation() {
    if (readOnly) {
      router.push(resultsPath);
      return;
    }
    if (evaluationId) {
      router.replace("/nazoratchi/baholash");
    }
    setSearchQuery("");
    setSearchResults([]);
    setSelected(null);
    setForm({ ...EMPTY_FORM, period: currentMonitoringPeriod() });
    setScores({});
    setComments({});
    setError("");
    setSavedResult(null);
    setEditLoading(false);
  }

  function selectResearcher(result: SearchResult) {
    if (readOnly) return;
    setSelected(result);
    setForm({
      fullName: result.fullName,
      departmentId: result.departmentId,
      level: result.level,
      specialtyCode: result.specialtyCode,
      researchTopic: result.researchTopic,
      advisor: result.advisor,
      course: result.course,
      admissionYear: result.admissionYear,
      submissionDate: result.submissionDate,
      period: currentMonitoringPeriod(),
    });
    setSearchQuery(result.fullName);
    setSearchResults([]);
    setScores({});
    setComments({});
    setError("");
  }

  function updateScore(key: string, value: string, maxScore: number) {
    if (readOnly) return;
    if (value === "") {
      setScores((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
      return;
    }

    const parsed = Number.parseInt(value, 10);
    const clampedScore = Number.isFinite(parsed)
      ? Math.max(0, Math.min(maxScore, parsed))
      : 0;
    const score = clampedScore <= 2 ? 2 : clampedScore;
    setScores((current) => ({ ...current, [key]: score }));
  }

  function handleScoreTab(
    event: React.KeyboardEvent<HTMLInputElement>,
    key: string
  ) {
    if (event.key !== "Tab") return;

    const currentIndex = activeItemKeys.indexOf(key);
    if (event.shiftKey) {
      if (currentIndex <= 0) return;
      event.preventDefault();
      scoreInputRefs.current[activeItemKeys[currentIndex - 1]]?.focus();
      return;
    }

    event.preventDefault();
    if (currentIndex < activeItemKeys.length - 1) {
      scoreInputRefs.current[activeItemKeys[currentIndex + 1]]?.focus();
    } else {
      commentInputRefs.current[activeItemKeys[0]]?.focus();
    }
  }

  function handleCommentTab(
    event: React.KeyboardEvent<HTMLTextAreaElement>,
    key: string
  ) {
    if (event.key !== "Tab") return;

    const currentIndex = activeItemKeys.indexOf(key);
    if (event.shiftKey) {
      event.preventDefault();
      if (currentIndex > 0) {
        commentInputRefs.current[activeItemKeys[currentIndex - 1]]?.focus();
      } else {
        scoreInputRefs.current[
          activeItemKeys[activeItemKeys.length - 1]
        ]?.focus();
      }
      return;
    }

    if (currentIndex < activeItemKeys.length - 1) {
      event.preventDefault();
      commentInputRefs.current[activeItemKeys[currentIndex + 1]]?.focus();
    }
  }

  function resizeCommentField(element: HTMLTextAreaElement) {
    element.style.height = "auto";
    element.style.height = `${Math.max(40, element.scrollHeight)}px`;
  }

  async function saveEvaluation() {
    setError("");
    if (readOnly) {
      setError("Bu sahifa faqat ko'rish rejimida ochilgan.");
      return;
    }
    if (!user?.university_id || !selected) {
      setError("Avval izlanuvchini qidirib tanlang.");
      return;
    }
    if (!form.departmentId) {
      setError("Biriktirilgan kafedrani tanlang.");
      return;
    }
    if (!form.period.trim()) {
      setError("Monitoring davrini kiriting.");
      return;
    }
    if (stats.count === 0) {
      setError("Kamida bitta baholash mezoniga ball kiriting.");
      return;
    }

    setSaving(true);

    if (selected.source === "izlanuvchilar") {
      const { error: writeBackError } = await supabase
        .from("izlanuvchilar")
        .update({
          full_name: form.fullName.trim(),
          department_id: form.departmentId || null,
          specialty_code: form.specialtyCode.trim() || null,
          research_topic: form.researchTopic.trim() || null,
          supervisor_name: form.advisor.trim() || null,
          admission_year: form.admissionYear.trim() || null,
          submission_date: form.submissionDate || null,
          course: form.course.trim() || null,
        })
        .eq("id", selected.id);

      if (writeBackError) {
        setSaving(false);
        setError(writeBackError.message);
        return;
      }
      invalidateIzlanuvchilarCache();
    }

    const evaluationValues = {
      department_id: form.departmentId,
      full_name: form.fullName,
      education_level: form.level,
      specialty_code: form.specialtyCode.trim() || null,
      research_topic: form.researchTopic.trim() || null,
      advisor_name: form.advisor.trim() || null,
      course: form.course.trim() || null,
      admission_year: form.admissionYear.trim() || null,
      submission_date: form.submissionDate || null,
      monitoring_period: form.period.trim(),
      raw_score: stats.sum,
      scored_item_count: stats.count,
      average_score: stats.average,
      total_score: stats.total100,
    };

    const evaluationRequest = evaluationId
      ? supabase
          .from("monitoring_evaluations")
          .update(evaluationValues)
          .eq("id", evaluationId)
          .eq("created_by", user.id)
      : supabase.from("monitoring_evaluations").insert({
          ...evaluationValues,
          university_id: user.university_id,
          researcher_source: selected.source,
          doktorant_id:
            selected.source === "doktorantlar" ? selected.id : null,
          izlanuvchi_id:
            selected.source === "izlanuvchilar" ? selected.id : null,
          created_by: user.id,
        });

    const { data: evaluation, error: evaluationError } =
      await evaluationRequest.select("id").single();

    if (evaluationError || !evaluation) {
      setSaving(false);
      setError(
        evaluationError?.message ?? "Monitoring natijasini saqlab bo'lmadi."
      );
      return;
    }

    const items = MONITORING_RUBRIC.flatMap((section) =>
      section.items.map((item) => {
        const disabled = Boolean(item.dscOnly && !isDsc);
        return {
          evaluation_id: evaluation.id,
          section_no: section.id,
          section_title: section.title,
          criterion_key: item.key,
          indicator_label: item.label,
          max_score: item.maxScore,
          score: disabled ? null : scores[item.key] ?? null,
          comment: disabled ? null : comments[item.key]?.trim() || null,
          disabled,
        };
      })
    );

    const { error: itemsError } = await supabase
      .from("monitoring_evaluation_items")
      .upsert(items, { onConflict: "evaluation_id,criterion_key" });

    if (itemsError) {
      if (!evaluationId) {
        await supabase
          .from("monitoring_evaluations")
          .delete()
          .eq("id", evaluation.id);
      }
      setSaving(false);
      setError(itemsError.message);
      return;
    }

    if (evaluationId) {
      const changes: EvaluationChangeInput[] = [];
      for (const item of items) {
        const oldScore = initialScoresRef.current[item.criterion_key] ?? null;
        const newScore = item.score;
        if (oldScore !== newScore) {
          changes.push({
            criterion_key: item.criterion_key,
            indicator_label: item.indicator_label,
            field: "score",
            old_value: oldScore === null ? null : String(oldScore),
            new_value: newScore === null ? null : String(newScore),
          });
        }

        const oldComment = initialCommentsRef.current[item.criterion_key] ?? null;
        const newComment = item.comment;
        if ((oldComment ?? "") !== (newComment ?? "")) {
          changes.push({
            criterion_key: item.criterion_key,
            indicator_label: item.indicator_label,
            field: "comment",
            old_value: oldComment,
            new_value: newComment,
          });
        }
      }

      const nextScores: Record<string, number> = {};
      const nextComments: Record<string, string> = {};
      items.forEach((item) => {
        if (!item.disabled && item.score !== null) {
          nextScores[item.criterion_key] = item.score;
        }
        if (item.comment) nextComments[item.criterion_key] = item.comment;
      });
      initialScoresRef.current = nextScores;
      initialCommentsRef.current = nextComments;

      if (changes.length > 0) {
        await logEvaluationChanges(evaluation.id, detectDeviceKind(), changes);
        await loadLogs();
      }
    }

    setSaving(false);
    setSavedResult({ id: evaluation.id, total: stats.total100 });
  }

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-blue-700">
            Nazoratchi
          </p>
          <h1 className="mt-1 text-3xl font-extrabold text-slate-900 dark:text-surface-100">
            {readOnly
              ? "Monitoring natijasini ko'rish"
              : evaluationId
              ? "Monitoring natijasini tahrirlash"
              : "Izlanuvchilar faoliyatini baholash"}
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-500 dark:text-surface-400">
            Oliy ta&apos;limdan keyingi ta&apos;lim bo&apos;yicha faoliyat
            samaradorligi monitoringi.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!readOnly && (
            <Button variant="outline" size="md" onClick={resetEvaluation}>
              + Yangi baholash
            </Button>
          )}
          <Link href={resultsPath}>
            <Button size="md">Natijalarni ko&apos;rish</Button>
          </Link>
        </div>
      </div>

      {error && (
        <div className="mb-5 rounded-xl bg-red-100 px-4 py-3 text-sm font-medium text-red-800 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}

      {editLoading && (
        <div className="mb-7 rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-sm dark:border-surface-700 dark:bg-surface-800">
          Monitoring natijasi yuklanmoqda...
        </div>
      )}

      {!evaluationId && (
        <section className="mb-7 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-surface-700 dark:bg-surface-800">
        <h2 className="mb-4 text-base font-bold text-slate-800 dark:text-surface-100">
          Izlanuvchini qidirish
        </h2>

        <div className="mb-4 flex flex-wrap gap-3">
          {(
            [
              {
                value: "doktorant",
                label: "Doktorantlar",
                description: "doktorant turidagi izlanuvchilar",
              },
              {
                value: "mustaqil",
                label: "Mustaqil izlanuvchilar",
                description: "mustaqil izlanuvchilar",
              },
            ] as const
          ).map((option) => (
            <label
              key={option.value}
              className={`flex min-w-[15rem] cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition-colors ${
                researcherTuri === option.value
                  ? "border-blue-600 bg-blue-50 dark:bg-blue-950/30"
                  : "border-slate-200 bg-slate-50 dark:border-surface-600 dark:bg-surface-700"
              }`}
            >
              <input
                type="radio"
                name="researcher-source"
                value={option.value}
                checked={researcherTuri === option.value}
                onChange={() => chooseTuri(option.value)}
                className="h-4 w-4 accent-blue-700"
              />
              <span>
                <span className="block text-sm font-bold text-slate-800 dark:text-surface-100">
                  {option.label}
                </span>
                <span className="block text-xs text-slate-500 dark:text-surface-400">
                  Manba: {option.description}
                </span>
              </span>
            </label>
          ))}
        </div>

        <div className="relative max-w-3xl">
          <svg
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            width="19"
            height="19"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" strokeLinecap="round" />
          </svg>
          <input
            value={searchQuery}
            onChange={(event) => {
              setSearchQuery(event.target.value);
              setSelected(null);
            }}
            placeholder="F.I.Sh., PINFL yoki ro'yxat raqami bo'yicha qidiring..."
            className="w-full rounded-lg border border-slate-300 bg-slate-50 py-3 pl-11 pr-4 text-sm outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-200 dark:border-surface-600 dark:bg-surface-700"
          />

          {(searching || searchResults.length > 0) && (
            <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-surface-600 dark:bg-surface-800">
              {searching ? (
                <div className="px-4 py-5 text-center text-sm text-slate-500">
                  Qidirilmoqda...
                </div>
              ) : (
                searchResults.map((result) => (
                  <button
                    type="button"
                    key={result.id}
                    onClick={() => selectResearcher(result)}
                    className="flex w-full items-start justify-between gap-4 border-b border-slate-100 px-4 py-3 text-left last:border-b-0 hover:bg-blue-50 dark:border-surface-700 dark:hover:bg-surface-700"
                  >
                    <span>
                      <span className="block text-sm font-bold text-slate-900 dark:text-surface-100">
                        {result.fullName}
                      </span>
                      <span className="mt-0.5 block text-xs text-slate-500 dark:text-surface-400">
                        {result.departmentName}
                      </span>
                    </span>
                    <span className="shrink-0 font-mono text-xs text-slate-500">
                      {result.identifier}
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
        <p className="mt-2 text-xs text-slate-500">
          {selected
            ? `Tanlandi: ${selected.fullName}`
            : "Natijadan izlanuvchini tanlang, ma'lumotlari forma ichiga avtomatik tushadi."}
        </p>
        </section>
      )}

      {evaluationId && !editLoading && selected && (
        <section className="mb-7 rounded-xl border border-blue-200 bg-blue-50 px-5 py-4 dark:border-blue-900 dark:bg-blue-950/30">
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-blue-700">
            {readOnly ? "Ko'rish rejimi" : "Tahrirlanmoqda"}
          </p>
          <p className="mt-1 font-semibold text-slate-900 dark:text-surface-100">
            {selected.fullName}
          </p>
        </section>
      )}

      <section className="mb-8 grid grid-cols-1 gap-5 rounded-xl border border-slate-200 bg-slate-50 p-5 md:grid-cols-2 dark:border-surface-700 dark:bg-surface-800">
        <Field
          label="F.I.Sh."
          value={form.fullName}
          readOnly={readOnly}
          onChange={(value) =>
            setForm((current) => ({ ...current, fullName: value }))
          }
        />
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-slate-700 dark:text-surface-200">
            Biriktirilgan kafedra nomi
          </span>
          <select
            value={form.departmentId}
            disabled={readOnly}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                departmentId: event.target.value,
              }))
            }
            className={fieldClassName(readOnly)}
          >
            <option value="">Kafedrani tanlang</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-slate-700 dark:text-surface-200">
            Ta&apos;lim shakli
          </span>
          <select value={form.level} disabled className={fieldClassName(true)}>
            <option value="PhD">PhD (Falsafa doktori)</option>
            <option value="DSc">DSc (Fan doktori)</option>
          </select>
        </label>
        <Field
          label="Ixtisoslik shifri"
          value={form.specialtyCode}
          readOnly={readOnly}
          onChange={(value) =>
            setForm((current) => ({ ...current, specialtyCode: value }))
          }
          placeholder="10.00.06"
        />
        <Field
          label="Qabul yili"
          value={form.admissionYear}
          readOnly={readOnly}
          onChange={(value) =>
            setForm((current) => ({ ...current, admissionYear: value }))
          }
          placeholder="2023"
        />
        <Field
          label="Topshirgan vaqti"
          type="date"
          value={form.submissionDate}
          readOnly={readOnly}
          onChange={(value) =>
            setForm((current) => ({ ...current, submissionDate: value }))
          }
        />
        <Field
          label="Kursi"
          value={form.course}
          readOnly={readOnly}
          onChange={(value) =>
            setForm((current) => ({ ...current, course: value }))
          }
          placeholder="1-kurs"
        />
        <div className="md:col-span-2">
          <Field
            label="Dissertatsiya mavzusi"
            value={form.researchTopic}
            readOnly={readOnly}
            onChange={(value) =>
              setForm((current) => ({ ...current, researchTopic: value }))
            }
          />
        </div>
        <Field
          label="Ilmiy rahbari F.I.Sh. (daraja va unvoni)"
          value={form.advisor}
          readOnly={readOnly}
          onChange={(value) =>
            setForm((current) => ({ ...current, advisor: value }))
          }
        />
        <Field
          label="Monitoring davri"
          value={form.period}
          readOnly={readOnly}
          onChange={(value) =>
            setForm((current) => ({ ...current, period: value }))
          }
        />
      </section>

      <section className="mb-8 overflow-x-auto rounded-xl border border-slate-300 bg-white shadow-sm dark:border-surface-600 dark:bg-surface-800">
        <table className="w-full min-w-[940px] border-collapse text-left">
          <thead>
            <tr className="bg-slate-800 text-center text-white">
              <th className="w-12 border border-slate-700 p-3">№</th>
              <th className="w-1/5 border border-slate-700 p-3">
                Mezon (ko&apos;rsatkich)
              </th>
              <th className="border border-slate-700 p-3">
                Baholash indikatori
              </th>
              <th className="w-24 border border-slate-700 p-3">Maks ball</th>
              <th className="w-28 border border-slate-700 p-3">Ball</th>
              <th className="w-1/4 border border-slate-700 p-3">Izoh</th>
            </tr>
          </thead>
          <tbody>
            {MONITORING_RUBRIC.map((section) => (
              <React.Fragment key={section.id}>
                {section.items.map((item, itemIndex) => {
                  const disabled = Boolean(item.dscOnly && !isDsc);
                  return (
                    <tr
                      key={item.key}
                      className={
                        disabled
                          ? "bg-slate-100 opacity-55 dark:bg-surface-700"
                          : "hover:bg-blue-50 dark:hover:bg-surface-700"
                      }
                    >
                      {itemIndex === 0 && (
                        <>
                          <td
                            rowSpan={section.items.length}
                            className="border border-slate-300 p-3 text-center font-bold text-slate-700 dark:border-surface-600 dark:text-surface-200"
                          >
                            {section.id}
                          </td>
                          <td
                            rowSpan={section.items.length}
                            className="border border-slate-300 p-3 align-top dark:border-surface-600"
                          >
                            <span className="block font-bold text-slate-800 dark:text-surface-100">
                              {section.title}
                            </span>
                            <span className="mt-1 block text-xs text-slate-400">
                              Tavsiya etilgan: {section.max} ball
                            </span>
                          </td>
                        </>
                      )}
                      <td className="border border-slate-300 p-3 text-sm leading-relaxed dark:border-surface-600">
                        {item.label}
                      </td>
                      <td className="border border-slate-300 bg-slate-50 p-3 text-center font-bold text-slate-600 dark:border-surface-600 dark:bg-surface-700 dark:text-surface-200">
                        {item.maxScore}
                      </td>
                      <td className="border border-slate-300 bg-white p-2 dark:border-surface-600 dark:bg-surface-800">
                        <input
                          ref={(element) => {
                            scoreInputRefs.current[item.key] = element;
                          }}
                          type="number"
                          min={0}
                          max={item.maxScore}
                          step={1}
                          disabled={disabled || readOnly}
                          value={scores[item.key] ?? ""}
                          onChange={(event) =>
                            updateScore(
                              item.key,
                              event.target.value,
                              item.maxScore
                            )
                          }
                          onKeyDown={(event) =>
                            handleScoreTab(event, item.key)
                          }
                          className="w-full appearance-none rounded border border-slate-300 p-2 text-center font-bold text-blue-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 disabled:bg-slate-200 dark:border-surface-600 dark:bg-surface-700 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                        />
                      </td>
                      <td className="border border-slate-300 bg-white p-2 align-top dark:border-surface-600 dark:bg-surface-800">
                        <textarea
                          ref={(element) => {
                            commentInputRefs.current[item.key] = element;
                          }}
                          rows={1}
                          wrap="soft"
                          tabIndex={-1}
                          disabled={disabled || readOnly}
                          value={comments[item.key] ?? ""}
                          placeholder="Izoh..."
                          onChange={(event) => {
                            resizeCommentField(event.currentTarget);
                            setComments((current) => ({
                              ...current,
                              [item.key]: event.target.value,
                            }));
                          }}
                          onKeyDown={(event) =>
                            handleCommentTab(event, item.key)
                          }
                          className="min-h-10 w-full resize-y overflow-hidden whitespace-pre-wrap break-words rounded border border-slate-300 p-2 text-sm leading-relaxed outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 disabled:bg-slate-200 dark:border-surface-600 dark:bg-surface-700"
                        />
                      </td>
                    </tr>
                  );
                })}
              </React.Fragment>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-800 text-white">
              <td
                colSpan={3}
                className="border border-slate-700 p-4 text-right text-sm font-bold uppercase tracking-wider"
              >
                Nisbiy jami ball (faqat kiritilganlar asosida)
              </td>
              <td className="border border-slate-700 p-3 text-center">
                <span className="block text-[10px] text-slate-400">
                  O&apos;rtacha ball
                </span>
                <span className="font-bold">
                  {stats.sum} / {stats.count} = {stats.average}
                </span>
              </td>
              <td
                colSpan={2}
                className={`border border-slate-700 p-4 text-center text-xl font-bold ${
                  stats.total100 >= 80
                    ? "text-green-400"
                    : stats.total100 >= 60
                      ? "text-yellow-400"
                      : "text-red-400"
                }`}
              >
                {stats.total100} / 100
              </td>
            </tr>
          </tfoot>
        </table>
      </section>

      {evaluationId && !editLoading && (
        <section className="mb-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-surface-700 dark:bg-surface-800">
          <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-slate-800 dark:text-surface-100">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-slate-400"
            >
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
              <path d="M12 7v5l4 2" />
            </svg>
            O&apos;zgarishlar tarixi
            {!logsLoading && (
              <span className="ml-auto text-xs font-normal text-slate-400">
                {logs.length} ta o&apos;zgarish
              </span>
            )}
          </h2>

          {logsLoading ? (
            <p className="text-sm text-slate-500">Yuklanmoqda...</p>
          ) : logs.length === 0 ? (
            <p className="text-sm text-slate-500">
              Hali o&apos;zgarishlar yo&apos;q.
            </p>
          ) : (
            <ul className="space-y-3">
              {logs.map((log) => (
                <li
                  key={log.id}
                  className="border-t border-slate-100 pt-3 first:border-t-0 first:pt-0 dark:border-surface-700"
                >
                  <p className="text-sm">
                    <span className="font-semibold text-slate-800 dark:text-surface-100">
                      {log.indicator_label}
                    </span>
                    :{" "}
                    {log.field === "score" ? (
                      <>
                        <span className="text-slate-500 dark:text-surface-400">
                          ball
                        </span>{" "}
                        <span className="font-bold text-red-700 dark:text-red-400">
                          {log.old_value ?? "—"}
                        </span>
                        <span className="mx-1 text-slate-400">→</span>
                        <span className="font-bold text-green-700 dark:text-green-400">
                          {log.new_value ?? "—"}
                        </span>
                      </>
                    ) : (
                      <span className="text-slate-500 dark:text-surface-400">
                        izoh o&apos;zgartirildi
                      </span>
                    )}
                  </p>
                  {log.field === "comment" && (
                    <p className="mt-1 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:bg-surface-700 dark:text-surface-300">
                      <span className="text-slate-400 line-through">
                        {log.old_value || "—"}
                      </span>
                      <span className="mx-1 text-slate-400">→</span>
                      {log.new_value || "—"}
                    </p>
                  )}
                  <div className="mt-1 flex flex-wrap gap-3 text-xs text-slate-400">
                    <span>{log.changed_by_name}</span>
                    <span>{formatLogTimestamp(log.created_at)}</span>
                    <span>
                      {log.device_kind === "mobil"
                        ? "Mobil qurilma"
                        : "Kompyuter"}
                    </span>
                    {log.ip_address && <span>IP {log.ip_address}</span>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {!readOnly && (
        <div className="flex justify-end border-t border-slate-200 pt-6 dark:border-surface-700">
          <Button
            size="lg"
            isLoading={saving}
            disabled={!selected || editLoading}
            onClick={saveEvaluation}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M5 3h12l2 2v16H5V3z" />
              <path d="M8 3v6h8V3M8 21v-7h8v7" />
            </svg>
            {evaluationId ? "O'zgarishlarni saqlash" : "Saqlash"}
          </Button>
        </div>
      )}

      <Modal
        isOpen={Boolean(savedResult)}
        onClose={() => setSavedResult(null)}
        title={
          evaluationId
            ? "Monitoring natijasi yangilandi"
            : "Monitoring natijasi saqlandi"
        }
      >
        {savedResult && (
          <div className="space-y-5">
            <div className="rounded-xl bg-green-100 p-5 text-center dark:bg-green-950/30">
              <p className="text-sm font-semibold text-green-800 dark:text-green-300">
                {form.fullName}
              </p>
              <p className="mt-2 text-4xl font-extrabold text-green-700 dark:text-green-300">
                {savedResult.total} / 100
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setSavedResult(null)}>
                Yopish
              </Button>
              <Link href={resultsPath}>
                <Button>Natijalarga o&apos;tish</Button>
              </Link>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
