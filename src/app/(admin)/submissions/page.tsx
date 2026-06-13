"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import type { Submission, Faculty, Department, Quarter, SubmissionStatus } from "@/types/db";
import { STATUS_LABEL, SELECTABLE_STATUSES } from "@/lib/workflow";

const QUARTERS: Quarter[] = ["Q1", "Q2", "Q3", "Q4"];

export default function SubmissionsListPage() {
  const supabase = createClient();
  const { user } = useSupabaseAuth();
  const availableStatuses = useMemo(
    () =>
      user?.role === "dean"
        ? SELECTABLE_STATUSES.filter((status) => status !== "draft")
        : SELECTABLE_STATUSES,
    [user?.role]
  );

  const [rows, setRows] = useState<Submission[]>([]);
  const [targets, setTargets] = useState<import("@/types/db").Target[]>([]);
  const [indicators, setIndicators] = useState<import("@/types/db").Indicator[]>([]);
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [filterStatus, setFilterStatus] = useState<SubmissionStatus | "">("");
  const [filterStatusInit, setFilterStatusInit] = useState(false);
  useEffect(() => {
    if (filterStatusInit || !user) return;
    setFilterStatus(
      user.role === "dean" ? "pending_dean"
        : user.role === "science_department" ? "pending_science"
          : ""
    );
    setFilterStatusInit(true);
  }, [user, filterStatusInit]);
  const [filterYear, setFilterYear] = useState<number>(new Date().getFullYear());
  const [filterQuarter, setFilterQuarter] = useState<Quarter | "">("");
  const [filterFaculty, setFilterFaculty] = useState("");

  useEffect(() => {
    if (!user?.university_id) return;
    (async () => {
      const [f, d, i] = await Promise.all([
        supabase.from("faculties").select("*").eq("university_id", user.university_id).order("short_code"),
        supabase.from("departments").select("*").eq("university_id", user.university_id).order("short_code"),
        supabase.from("indicators").select("*").eq("university_id", user.university_id),
      ]);
      setFaculties((f.data as Faculty[]) ?? []);
      setDepartments((d.data as Department[]) ?? []);
      setIndicators((i.data as import("@/types/db").Indicator[]) ?? []);
    })();
  }, [supabase, user?.university_id]);

  const load = useCallback(async () => {
    if (!user?.university_id) return;
    setLoading(true);
    setError("");
    let q = supabase
      .from("submissions")
      .select("*")
      .eq("university_id", user.university_id)
      .order("updated_at", { ascending: false });
    if (user.role === "dean") q = q.neq("status", "draft");
    if (filterStatus) q = q.eq("status", filterStatus);
    if (filterYear) q = q.eq("year", filterYear);
    if (filterQuarter) q = q.eq("quarter", filterQuarter);
    if (filterFaculty) q = q.eq("faculty_id", filterFaculty);
    const { data, error: e } = await q;

    if (e) {
      setError(e.message);
    } else {
      const subs = (data as Submission[]) ?? [];
      setRows(subs);

      // Fetch targets for these submissions
      if (subs.length > 0) {
        let tq = supabase.from("targets").select("*").eq("university_id", user.university_id);
        if (filterYear) tq = tq.eq("year", filterYear);
        if (filterQuarter) tq = tq.eq("quarter", filterQuarter);
        if (filterFaculty) tq = tq.eq("faculty_id", filterFaculty);
        const tr = await tq;
        setTargets((tr.data as import("@/types/db").Target[]) ?? []);
      } else {
        setTargets([]);
      }
    }
    setLoading(false);
  }, [supabase, user?.university_id, user?.role, filterStatus, filterYear, filterQuarter, filterFaculty]);

  useEffect(() => { load(); }, [load]);

  const facById = useMemo(() => new Map(faculties.map((x) => [x.id, x])), [faculties]);
  const depById = useMemo(() => new Map(departments.map((x) => [x.id, x])), [departments]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-100">Hisobotlar</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Kafedralardan kelgan hisobotlarni ko&apos;rib chiqish
        </p>
      </div>

      <div className="bg-white dark:bg-surface-800 rounded-lg border border-surface-200 dark:border-surface-700 p-4 mb-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">Holat</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as SubmissionStatus | "")}
              className="w-full rounded-md border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 px-3 py-2 text-sm"
            >
              <option value="">Barchasi</option>
              {availableStatuses.map((s) => <option key={s} value={s}>{STATUS_LABEL[s].text}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">Yil</label>
            <input
              type="number"
              value={filterYear}
              onChange={(e) => setFilterYear(Number(e.target.value))}
              className="w-full rounded-md border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">Chorak</label>
            <select
              value={filterQuarter}
              onChange={(e) => setFilterQuarter(e.target.value as Quarter | "")}
              className="w-full rounded-md border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 px-3 py-2 text-sm"
            >
              <option value="">Barchasi</option>
              {QUARTERS.map((q) => <option key={q} value={q}>{q}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">Fakultet</label>
            <select
              value={filterFaculty}
              onChange={(e) => setFilterFaculty(e.target.value)}
              className="w-full rounded-md border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 px-3 py-2 text-sm"
            >
              <option value="">Barchasi</option>
              {faculties.map((f) => <option key={f.id} value={f.id}>{f.short_code}</option>)}
            </select>
          </div>
        </div>
      </div>

      {error && <div className="mb-4 p-3 bg-danger-50 dark:bg-danger-900/30 text-danger-600 dark:text-danger-400 rounded-lg text-sm">{error}</div>}

      <div className="bg-white dark:bg-surface-800 rounded-lg border border-surface-200 dark:border-surface-700 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-surface-500">Yuklanmoqda...</div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-surface-500">Hisobot topilmadi.</div>
        ) : (
          <table className="w-full">
            <thead className="bg-surface-50 dark:bg-surface-900/50 border-b border-surface-200 dark:border-surface-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-surface-600 uppercase">Fakultet</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-surface-600 uppercase">Kafedra</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-surface-600 uppercase">Davr</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-surface-600 uppercase">Holat</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-surface-600 uppercase">Umumiy Ball</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-surface-600 uppercase">Yuborilgan</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-200 dark:divide-surface-700">
              {rows.map((s) => {
                const depTarget = targets.find((t) => t.department_id === s.department_id && t.year === s.year && t.quarter === s.quarter);
                let totalScore = 0;
                let scoredItemsCount = 0;

                indicators.forEach(ind => {
                  const maqsad = depTarget?.values?.[ind.id] ?? null;
                  const qiymat = s.indicators[ind.id]?.value ?? null;
                  if (typeof maqsad === "number" && typeof qiymat === "number") {
                    scoredItemsCount++;
                    if (maqsad > 0) {
                      totalScore += Math.min((qiymat / maqsad) * 100, 100);
                    } else if (maqsad === 0 && qiymat >= 0) {
                      totalScore += 100;
                    }
                  }
                });

                const overallScore = scoredItemsCount > 0 ? (totalScore / scoredItemsCount).toFixed(1) + "%" : "—";

                return (
                  <tr key={s.id} className="hover:bg-surface-50 dark:hover:bg-surface-900/30">
                    <td className="px-4 py-3 text-sm font-mono">{facById.get(s.faculty_id)?.short_code ?? "?"}</td>
                    <td className="px-4 py-3 text-sm">{depById.get(s.department_id)?.name ?? "?"}</td>
                    <td className="px-4 py-3 text-sm">{s.year} {s.quarter}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_LABEL[s.status].cls}`}>
                        {STATUS_LABEL[s.status].text}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-primary-600 dark:text-primary-400">
                      {overallScore}
                    </td>
                    <td className="px-4 py-3 text-sm text-surface-500">
                      {s.submitted_at ? new Date(s.submitted_at).toLocaleString("uz-UZ") : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/submissions/${s.id}`} className="text-sm text-primary-600 hover:underline">
                        Ko&apos;rish →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}




