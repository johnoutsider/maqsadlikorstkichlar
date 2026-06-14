"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { createClient } from "@/lib/supabase/client";
import type {
  MonitoringEvaluation,
  MonitoringEvaluationItem,
  MonitoringResearcherSource,
} from "@/types/db";

type ResultRow = MonitoringEvaluation & {
  departments?: { name?: string | null } | null;
  monitoring_evaluation_items?: MonitoringEvaluationItem[];
  assessor?: { display_name?: string | null; email?: string | null } | null;
};

function sourceLabel(source: MonitoringResearcherSource) {
  return source === "doktorantlar"
    ? "Doktorantlar bazasi"
    : "Mustaqil izlanuvchilar bazasi";
}

function scoreClass(score: number) {
  if (score >= 80) {
    return "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300";
  }
  if (score >= 60) {
    return "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300";
  }
  return "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300";
}

export function MonitoringResultsTable() {
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;
  const { user } = useSupabaseAuth();
  const [rows, setRows] = useState<ResultRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [source, setSource] = useState<MonitoringResearcherSource | "">("");
  const [period, setPeriod] = useState("");
  const [viewing, setViewing] = useState<ResultRow | null>(null);

  const load = useCallback(async () => {
    if (!user?.university_id) return;
    setLoading(true);
    setError("");

    const { data, error: databaseError } = await supabase
      .from("monitoring_evaluations")
      .select(
        "*, departments(name), monitoring_evaluation_items(*), assessor:users!monitoring_evaluations_created_by_fkey(display_name,email)"
      )
      .eq("university_id", user.university_id)
      .order("created_at", { ascending: false });

    if (databaseError) {
      setError(databaseError.message);
      setRows([]);
    } else {
      setRows((data as ResultRow[] | null) ?? []);
    }
    setLoading(false);
  }, [supabase, user?.university_id]);

  useEffect(() => {
    load();
  }, [load]);

  const periods = useMemo(
    () =>
      Array.from(new Set(rows.map((row) => row.monitoring_period))).sort((a, b) =>
        b.localeCompare(a)
      ),
    [rows]
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("uz");
    return rows.filter((row) => {
      if (source && row.researcher_source !== source) return false;
      if (period && row.monitoring_period !== period) return false;
      if (
        query &&
        ![
          row.full_name,
          row.specialty_code,
          row.advisor_name,
          row.departments?.name,
        ]
          .filter(Boolean)
          .join(" ")
          .toLocaleLowerCase("uz")
          .includes(query)
      ) {
        return false;
      }
      return true;
    });
  }, [period, rows, search, source]);

  async function remove(row: ResultRow) {
    if (user?.role !== "science_department") return;
    if (
      !confirm(
        `"${row.full_name}" uchun ${row.monitoring_period} natijasini o'chirasizmi?`
      )
    ) {
      return;
    }

    const { error: deleteError } = await supabase
      .from("monitoring_evaluations")
      .delete()
      .eq("id", row.id);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    if (viewing?.id === row.id) setViewing(null);
    load();
  }

  const groupedItems = useMemo(() => {
    if (!viewing?.monitoring_evaluation_items) return [];
    const groups = new Map<
      number,
      { title: string; items: MonitoringEvaluationItem[] }
    >();
    [...viewing.monitoring_evaluation_items]
      .sort(
        (a, b) =>
          a.section_no - b.section_no ||
          a.criterion_key.localeCompare(b.criterion_key)
      )
      .forEach((item) => {
        const group = groups.get(item.section_no) ?? {
          title: item.section_title,
          items: [],
        };
        group.items.push(item);
        groups.set(item.section_no, group);
      });
    return Array.from(groups.entries());
  }, [viewing]);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-blue-700">
            Nazoratchi
          </p>
          <h1 className="mt-1 text-3xl font-extrabold text-slate-900 dark:text-surface-100">
            Monitoring natijalari
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-surface-400">
            Doktorant va mustaqil izlanuvchilar bo&apos;yicha saqlangan
            baholashlar.
          </p>
        </div>
        {user?.role === "monitor" && (
          <Link href="/nazoratchi/baholash">
            <Button size="md">+ Yangi baholash</Button>
          </Link>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-xl bg-red-100 px-4 py-3 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-surface-700 dark:bg-surface-800">
        <div className="grid grid-cols-1 gap-3 border-b border-slate-200 p-4 md:grid-cols-3 dark:border-surface-700">
          <div className="relative">
            <svg
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="F.I.Sh., kafedra yoki ixtisoslik..."
              className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-10 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-surface-600 dark:bg-surface-700"
            />
          </div>
          <select
            value={source}
            onChange={(event) =>
              setSource(
                event.target.value as MonitoringResearcherSource | ""
              )
            }
            className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-surface-600 dark:bg-surface-700"
          >
            <option value="">Barcha ma&apos;lumot manbalari</option>
            <option value="doktorantlar">Doktorantlar bazasi</option>
            <option value="izlanuvchilar">Mustaqil izlanuvchilar bazasi</option>
          </select>
          <select
            value={period}
            onChange={(event) => setPeriod(event.target.value)}
            className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-surface-600 dark:bg-surface-700"
          >
            <option value="">Barcha monitoring davrlari</option>
            {periods.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-500">Yuklanmoqda...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            Monitoring natijasi topilmadi.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px]">
              <thead className="bg-slate-50 dark:bg-surface-700">
                <tr className="border-b border-slate-200 dark:border-surface-600">
                  {[
                    "Izlanuvchi",
                    "Baholovchi",
                    "Kafedra",
                    "Monitoring davri",
                    "Natija",
                    "Sana",
                    "Harakatlar",
                  ].map((heading) => (
                    <th
                      key={heading}
                      className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.06em] text-slate-500"
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-surface-700">
                {filtered.map((row) => (
                  <tr
                    key={row.id}
                    className="hover:bg-slate-50 dark:hover:bg-surface-700"
                  >
                    <td className="max-w-[18rem] px-4 py-3">
                      <p className="font-semibold text-slate-900 dark:text-surface-100">
                        {row.full_name}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {[row.education_level, row.specialty_code]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-surface-300">
                      {row.assessor?.display_name ?? row.assessor?.email ?? "—"}
                    </td>
                    <td className="max-w-[15rem] px-4 py-3 text-sm text-slate-600 dark:text-surface-300">
                      {row.departments?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-surface-300">
                      {row.monitoring_period}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-sm font-bold ${scoreClass(
                          row.total_score
                        )}`}
                      >
                        {row.total_score} / 100
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-500">
                      {new Intl.DateTimeFormat("uz-UZ", {
                        year: "numeric",
                        month: "2-digit",
                        day: "2-digit",
                      }).format(new Date(row.created_at))}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setViewing(row)}
                        >
                          Ko&apos;rish
                        </Button>
                        {user?.role === "monitor" &&
                          row.created_by === user.id && (
                            <Link
                              href={`/nazoratchi/baholash?edit=${row.id}`}
                            >
                              <Button size="sm">Tahrirlash</Button>
                            </Link>
                          )}
                        {user?.role === "science_department" && (
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => remove(row)}
                          >
                            O&apos;chirish
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Modal
        isOpen={Boolean(viewing)}
        onClose={() => setViewing(null)}
        title={viewing?.full_name ?? "Monitoring natijasi"}
        size="xl"
      >
        {viewing && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-2 lg:grid-cols-4 dark:bg-surface-700">
              <div>
                <p className="text-[10px] font-bold uppercase text-slate-400">
                  Manba
                </p>
                <p className="mt-1 text-sm font-semibold">
                  {sourceLabel(viewing.researcher_source)}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase text-slate-400">
                  Kafedra
                </p>
                <p className="mt-1 text-sm font-semibold">
                  {viewing.departments?.name ?? "—"}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase text-slate-400">
                  Davr
                </p>
                <p className="mt-1 text-sm font-semibold">
                  {viewing.monitoring_period}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase text-slate-400">
                  Jami
                </p>
                <p className="mt-1 text-lg font-extrabold text-blue-700">
                  {viewing.total_score} / 100
                </p>
              </div>
            </div>

            {groupedItems.map(([sectionNo, group]) => (
              <section key={sectionNo}>
                <h3 className="mb-2 text-sm font-bold text-slate-800 dark:text-surface-100">
                  {sectionNo}. {group.title}
                </h3>
                <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-surface-600">
                  {group.items.map((item) => (
                    <div
                      key={item.id}
                      className={`grid grid-cols-[1fr_auto] gap-4 border-b border-slate-100 px-4 py-3 last:border-b-0 dark:border-surface-700 ${
                        item.disabled ? "opacity-50" : ""
                      }`}
                    >
                      <div>
                        <p className="text-sm text-slate-700 dark:text-surface-200">
                          {item.indicator_label}
                        </p>
                        {item.comment && (
                          <p className="mt-1 text-xs italic text-slate-500">
                            {item.comment}
                          </p>
                        )}
                      </div>
                      <span className="font-mono text-sm font-bold text-blue-700">
                        {item.disabled || item.score === null
                          ? "—"
                          : `${item.score}/${item.max_score}`}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
