"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { createClient } from "@/lib/supabase/client";
import { MONITORING_RUBRIC } from "@/lib/monitoring-rubric";
import type {
  Department,
  IzlanuvchiTuri,
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
};

type EvaluationForm = {
  fullName: string;
  departmentId: string;
  level: string;
  specialtyCode: string;
  researchTopic: string;
  advisor: string;
  period: string;
};

function currentMonitoringPeriod() {
  const now = new Date();
  const quarter = Math.floor(now.getMonth() / 3) + 1;
  return `${now.getFullYear()}-yil, ${quarter}-chorak`;
}

const EMPTY_FORM: EvaluationForm = {
  fullName: "",
  departmentId: "",
  level: "PhD",
  specialtyCode: "",
  researchTopic: "",
  advisor: "",
  period: currentMonitoringPeriod(),
};

function relationOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
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
}: {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  readOnly?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-semibold text-slate-700 dark:text-surface-200">
        {label}
      </span>
      <input
        value={value}
        readOnly={readOnly}
        placeholder={placeholder}
        onChange={(event) => onChange?.(event.target.value)}
        className={fieldClassName(readOnly)}
      />
    </label>
  );
}

export function MonitoringEvaluationForm() {
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;
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
  const [error, setError] = useState("");
  const [savedResult, setSavedResult] = useState<{
    id: string;
    total: number;
  } | null>(null);

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
          "id,full_name,pinfl,source_no,department_id,education_stage,specialty_code,research_topic,supervisor_name,departments(name)"
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
  }, [searchQuery, researcherTuri, supabase, user?.university_id]);

  const isDsc = form.level === "DSc";
  const stats = useMemo(() => {
    let sum = 0;
    let count = 0;

    MONITORING_RUBRIC.forEach((section) => {
      section.items.forEach((item) => {
        if (item.dscOnly && !isDsc) return;
        if (scores[item.key] === undefined) return;
        sum += scores[item.key];
        count += 1;
      });
    });

    const average = count === 0 ? 0 : Number((sum / count).toFixed(1));
    const total100 =
      count === 0 ? 0 : Math.round((sum / (count * 5)) * 100);
    return { sum, count, average, total100 };
  }, [isDsc, scores]);

  function chooseTuri(nextTuri: IzlanuvchiTuri) {
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
    setSearchQuery("");
    setSearchResults([]);
    setSelected(null);
    setForm({ ...EMPTY_FORM, period: currentMonitoringPeriod() });
    setScores({});
    setComments({});
    setError("");
    setSavedResult(null);
  }

  function selectResearcher(result: SearchResult) {
    setSelected(result);
    setForm({
      fullName: result.fullName,
      departmentId: result.departmentId,
      level: result.level,
      specialtyCode: result.specialtyCode,
      researchTopic: result.researchTopic,
      advisor: result.advisor,
      period: currentMonitoringPeriod(),
    });
    setSearchQuery(result.fullName);
    setSearchResults([]);
    setScores({});
    setComments({});
    setError("");
  }

  function updateScore(key: string, value: string, maxScore: number) {
    if (value === "") {
      setScores((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
      return;
    }

    const parsed = Number.parseInt(value, 10);
    const score = Number.isFinite(parsed)
      ? Math.max(0, Math.min(maxScore, parsed))
      : 0;
    setScores((current) => ({ ...current, [key]: score }));
  }

  async function saveEvaluation() {
    setError("");
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

    if (
      selected.source === "izlanuvchilar" &&
      selected.departmentId !== form.departmentId
    ) {
      const { error: departmentError } = await supabase
        .from("izlanuvchilar")
        .update({ department_id: form.departmentId })
        .eq("id", selected.id);

      if (departmentError) {
        setSaving(false);
        setError(departmentError.message);
        return;
      }
    }

    const { data: evaluation, error: evaluationError } = await supabase
      .from("monitoring_evaluations")
      .insert({
        university_id: user.university_id,
        researcher_source: selected.source,
        doktorant_id:
          selected.source === "doktorantlar" ? selected.id : null,
        izlanuvchi_id:
          selected.source === "izlanuvchilar" ? selected.id : null,
        department_id: form.departmentId,
        full_name: form.fullName,
        education_level: form.level,
        specialty_code: form.specialtyCode.trim() || null,
        research_topic: form.researchTopic.trim() || null,
        advisor_name: form.advisor.trim() || null,
        monitoring_period: form.period.trim(),
        raw_score: stats.sum,
        scored_item_count: stats.count,
        average_score: stats.average,
        total_score: stats.total100,
        created_by: user.id,
      })
      .select("id")
      .single();

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
      .insert(items);

    if (itemsError) {
      await supabase
        .from("monitoring_evaluations")
        .delete()
        .eq("id", evaluation.id);
      setSaving(false);
      setError(itemsError.message);
      return;
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
            Izlanuvchilar faoliyatini baholash
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-500 dark:text-surface-400">
            Oliy ta&apos;limdan keyingi ta&apos;lim bo&apos;yicha faoliyat
            samaradorligi monitoringi.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="md" onClick={resetEvaluation}>
            + Yangi baholash
          </Button>
          <Link href="/nazoratchi/natijalar">
            <Button size="md">Natijalarni ko&apos;rish</Button>
          </Link>
        </div>
      </div>

      {error && (
        <div className="mb-5 rounded-xl bg-red-100 px-4 py-3 text-sm font-medium text-red-800 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}

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

      <section className="mb-8 grid grid-cols-1 gap-5 rounded-xl border border-slate-200 bg-slate-50 p-5 md:grid-cols-2 dark:border-surface-700 dark:bg-surface-800">
        <Field label="F.I.Sh." value={form.fullName} readOnly />
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-slate-700 dark:text-surface-200">
            Biriktirilgan kafedra nomi
          </span>
          <select
            value={form.departmentId}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                departmentId: event.target.value,
              }))
            }
            className={fieldClassName()}
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
          <select
            value={form.level}
            onChange={(event) =>
              setForm((current) => ({ ...current, level: event.target.value }))
            }
            className={fieldClassName()}
          >
            <option value="PhD">PhD (Falsafa doktori)</option>
            <option value="DSc">DSc (Fan doktori)</option>
          </select>
        </label>
        <Field
          label="Ixtisoslik shifri"
          value={form.specialtyCode}
          onChange={(value) =>
            setForm((current) => ({ ...current, specialtyCode: value }))
          }
          placeholder="10.00.06"
        />
        <div className="md:col-span-2">
          <Field
            label="Dissertatsiya mavzusi"
            value={form.researchTopic}
            onChange={(value) =>
              setForm((current) => ({ ...current, researchTopic: value }))
            }
          />
        </div>
        <Field
          label="Ilmiy rahbari F.I.Sh. (daraja va unvoni)"
          value={form.advisor}
          onChange={(value) =>
            setForm((current) => ({ ...current, advisor: value }))
          }
        />
        <Field
          label="Monitoring davri"
          value={form.period}
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
              <th className="w-1/5 border border-slate-700 p-3">Izoh</th>
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
                          type="number"
                          min={0}
                          max={item.maxScore}
                          disabled={disabled}
                          value={scores[item.key] ?? ""}
                          placeholder="0"
                          onChange={(event) =>
                            updateScore(
                              item.key,
                              event.target.value,
                              item.maxScore
                            )
                          }
                          className="w-full rounded border border-slate-300 p-2 text-center font-bold text-blue-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 disabled:bg-slate-200 dark:border-surface-600 dark:bg-surface-700"
                        />
                      </td>
                      <td className="border border-slate-300 bg-white p-2 align-top dark:border-surface-600 dark:bg-surface-800">
                        <textarea
                          rows={1}
                          disabled={disabled}
                          value={comments[item.key] ?? ""}
                          placeholder="Izoh..."
                          onChange={(event) =>
                            setComments((current) => ({
                              ...current,
                              [item.key]: event.target.value,
                            }))
                          }
                          className="min-h-10 w-full resize-y rounded border border-slate-300 p-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 disabled:bg-slate-200 dark:border-surface-600 dark:bg-surface-700"
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

      <div className="flex justify-end border-t border-slate-200 pt-6 dark:border-surface-700">
        <Button
          size="lg"
          isLoading={saving}
          disabled={!selected}
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
          Saqlash
        </Button>
      </div>

      <Modal
        isOpen={Boolean(savedResult)}
        onClose={() => setSavedResult(null)}
        title="Monitoring natijasi saqlandi"
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
              <Link href="/nazoratchi/natijalar">
                <Button>Natijalarga o&apos;tish</Button>
              </Link>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
