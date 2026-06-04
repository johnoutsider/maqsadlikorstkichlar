"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import type { Faculty, Department, Indicator, Target, Quarter } from "@/types/db";

const QUARTERS: Quarter[] = ["Q1", "Q2", "Q3", "Q4"];
const CAN_EDIT_ROLES = new Set(["university_admin", "science_department"]);

function currentQuarter(): Quarter {
  const m = new Date().getMonth() + 1;
  if (m <= 3) return "Q1";
  if (m <= 6) return "Q2";
  if (m <= 9) return "Q3";
  return "Q4";
}

export default function TargetsPage() {
  const supabase = createClient();
  const { user } = useSupabaseAuth();
  const router = useRouter();
  const canEdit = !!user && CAN_EDIT_ROLES.has(user.role);
  const isDean = user?.role === "dean";

  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [quarter, setQuarter] = useState<Quarter>(currentQuarter());
  const [facultyId, setFacultyId] = useState<string>("");

  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [indicators, setIndicators] = useState<Indicator[]>([]);
  const [targets, setTargets] = useState<Target[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Load faculties + indicators + all departments once
  useEffect(() => {
    if (!user?.university_id) return;
    (async () => {
      const [f, d, i] = await Promise.all([
        supabase.from("faculties").select("*").eq("university_id", user.university_id).order("short_code"),
        supabase.from("departments").select("*").eq("university_id", user.university_id).order("short_code"),
        supabase.from("indicators").select("*").eq("university_id", user.university_id).order("order_idx"),
      ]);
      const facs = (f.data as Faculty[]) ?? [];
      setFaculties(facs);
      setDepartments((d.data as Department[]) ?? []);
      setIndicators((i.data as Indicator[]) ?? []);
      if (isDean && user.faculty_id) setFacultyId(user.faculty_id);
      else if (facs.length > 0) setFacultyId(facs[0].id);
    })();
  }, [supabase, user?.university_id, user?.faculty_id, isDean]);

  // Reload targets whenever faculty / year / quarter changes
  const loadTargets = useCallback(async () => {
    if (!facultyId) return;
    setLoading(true);
    setError("");
    const { data, error: e } = await supabase
      .from("targets")
      .select("*")
      .eq("faculty_id", facultyId)
      .eq("year", year)
      .eq("quarter", quarter);
    if (e) setError(e.message);
    setTargets((data as Target[]) ?? []);
    setLoading(false);
  }, [supabase, facultyId, year, quarter]);

  useEffect(() => { if (facultyId) loadTargets(); }, [loadTargets, facultyId]);

  const departmentsInFaculty = useMemo(
    () => departments.filter((d) => d.faculty_id === facultyId),
    [departments, facultyId]
  );

  const targetByDept = useMemo(() => {
    const m = new Map<string, Target>();
    targets.forEach((t) => m.set(t.department_id, t));
    return m;
  }, [targets]);

  const filledCountFor = (deptId: string) => {
    const t = targetByDept.get(deptId);
    if (!t) return 0;
    let n = 0;
    for (const ind of indicators) {
      const v = t.values?.[ind.id];
      if (typeof v === "number") n++;
    }
    return n;
  };

  const editUrl = (deptId: string) =>
    `/targets/${deptId}?year=${year}&quarter=${quarter}`;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-100">Rejalar (KPI)</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Har bir kafedra uchun chorakli KPI rejalarini belgilang.
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-surface-800 rounded-lg border border-surface-200 dark:border-surface-700 p-4 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
          <div>
            <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">Fakultet</label>
            <select
              value={facultyId}
              onChange={(e) => setFacultyId(e.target.value)}
              disabled={isDean}
              className="w-full rounded-md border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 px-3 py-2 text-sm disabled:opacity-60"
            >
              {faculties.map((f) => <option key={f.id} value={f.id}>{f.short_code} — {f.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      {error && <div className="mb-4 p-3 bg-danger-50 dark:bg-danger-900/30 text-danger-600 dark:text-danger-400 rounded-lg text-sm">{error}</div>}

      {/* Kafedra list */}
      <div className="bg-white dark:bg-surface-800 rounded-lg border border-surface-200 dark:border-surface-700 overflow-hidden">
        <div className="px-5 py-3 border-b border-surface-200 dark:border-surface-700 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-surface-900 dark:text-surface-100">
            {faculties.find(f => f.id === facultyId)?.name ?? "Fakultet"} — kafedralar
          </h2>
          <span className="text-xs text-surface-500">{departmentsInFaculty.length} ta</span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-surface-500">Yuklanmoqda...</div>
        ) : departmentsInFaculty.length === 0 ? (
          <div className="p-8 text-center text-surface-500">Bu fakultetda kafedra topilmadi.</div>
        ) : indicators.length === 0 ? (
          <div className="p-8 text-center text-surface-500">
            Avval &quot;Ko&apos;rsatkichlar&quot; sahifasida ko&apos;rsatkichlarni qo&apos;shing.
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-surface-50 dark:bg-surface-900/50 border-b border-surface-200 dark:border-surface-700">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold text-surface-600 uppercase w-20">Kod</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-surface-600 uppercase">Kafedra</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-surface-600 uppercase w-36">To&apos;ldirilgan</th>
                <th className="px-5 py-3 w-32" />
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-200 dark:divide-surface-700">
              {departmentsInFaculty.map((dept) => {
                const filled = filledCountFor(dept.id);
                const total = indicators.length;
                const complete = filled === total;
                const empty = filled === 0;
                return (
                  <tr
                    key={dept.id}
                    className="hover:bg-surface-50 dark:hover:bg-surface-900/30 cursor-pointer transition-colors"
                    onClick={() => router.push(editUrl(dept.id))}
                  >
                    <td className="px-5 py-3.5 text-sm font-mono text-surface-700 dark:text-surface-300">
                      {dept.short_code}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-surface-900 dark:text-surface-100 font-medium">
                      {dept.name}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                        empty
                          ? "bg-surface-100 text-surface-600 dark:bg-surface-700 dark:text-surface-300"
                          : complete
                            ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                            : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                      }`}>
                        {!empty && !complete && (
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 dark:bg-amber-400 shrink-0" />
                        )}
                        {complete && (
                          <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                        {filled} / {total}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <Link
                        href={editUrl(dept.id)}
                        onClick={(e) => e.stopPropagation()}
                        className={`inline-flex items-center gap-1 text-sm font-medium px-3 py-1.5 rounded-md transition-colors ${
                          canEdit
                            ? "bg-primary-600 text-white hover:bg-primary-700"
                            : "border border-surface-300 dark:border-surface-600 text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-700"
                        }`}
                      >
                        {canEdit ? (filled > 0 ? "Tahrirlash" : "Belgilash") : "Ko'rish"}
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
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
