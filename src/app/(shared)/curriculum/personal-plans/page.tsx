"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { cacheGet, cacheSet } from "@/lib/curriculum-cache";
import type {
  AcademicYear, Department, Teacher, TeacherAllocation, TeacherWorkPlan, WorkPlanStatus, WorkType,
} from "@/types/db";
import { WORK_PLAN_STATUS_LABELS } from "@/types/db";

const STATUS_COLORS: Record<WorkPlanStatus, string> = {
  draft:     "bg-surface-100 text-surface-600 dark:bg-surface-700 dark:text-surface-300",
  submitted: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
  approved:  "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400",
  rejected:  "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
};

const WORK_TYPES: WorkType[] = [
  "maruza", "seminar", "amaliy", "reyting", "malaka_amaliyoti",
  "bmi_rahbarlik", "yada", "md_rahbarlik", "mustaqil_tadqiqot",
  "doktorantura", "kurs_ishi",
];

export default function PersonalPlansPage() {
  const supabase = createClient();
  const { user } = useSupabaseAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  // ?department=<id> — set by oquv_bolimi workload drill-in
  const deptParam = searchParams.get("department");

  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [plans, setPlans] = useState<TeacherWorkPlan[]>([]);
  const [allocations, setAllocations] = useState<TeacherAllocation[]>([]);
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [filterYear, setFilterYear] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const isManager    = user?.role === "staff_manager";
  const isOquvBolimi = user?.role === "oquv_bolimi";

  const load = useCallback(async () => {
    if (!user?.university_id) return;

    // oquv_bolimi: try module-level cache first (populated by workload page)
    if (isOquvBolimi) {
      const cached = cacheGet(user.university_id);
      if (cached) {
        setTeachers(cached.teachers);
        setDepartments(cached.departments);
        setPlans(cached.plans);
        setAllocations(cached.allocations);
        setYears(cached.years);
        setLoading(false);
        return;
      }
    }

    setLoading(true);
    setError("");

    const [yr, tr] = await Promise.all([
      supabase.from("academic_years").select("*").eq("university_id", user.university_id).order("name"),
      supabase.from("teachers").select("*").eq("university_id", user.university_id).order("last_name"),
    ]);
    const fetchedYears = (yr.data as AcademicYear[]) ?? [];
    const fetchedTeachers = (tr.data as Teacher[]) ?? [];
    setYears(fetchedYears);
    setTeachers(fetchedTeachers);

    let fetchedDepts: Department[] = [];
    if (isOquvBolimi) {
      const { data } = await supabase.from("departments").select("*").eq("university_id", user.university_id);
      fetchedDepts = (data as Department[]) ?? [];
      setDepartments(fetchedDepts);
    }

    if (fetchedTeachers.length > 0) {
      const ids = fetchedTeachers.map(t => t.id);
      const [pr, ar] = await Promise.all([
        supabase.from("teacher_work_plans").select("*").in("teacher_id", ids),
        supabase.from("teacher_allocations").select("*"),
      ]);
      const fetchedPlans = (pr.data as TeacherWorkPlan[]) ?? [];
      const fetchedAllocs = (ar.data as TeacherAllocation[]) ?? [];
      setPlans(fetchedPlans);
      setAllocations(fetchedAllocs);

      // Warm cache for oquv_bolimi so workload back-navigation is instant
      if (isOquvBolimi) {
        cacheSet(user.university_id, {
          teachers: fetchedTeachers,
          plans: fetchedPlans,
          allocations: fetchedAllocs,
          years: fetchedYears,
          departments: fetchedDepts,
          faculties: [],
          subjects: [],
          groups: [],
        });
      }
    }
    if (tr.error) setError(tr.error.message);
    setLoading(false);
  }, [supabase, user?.university_id, isOquvBolimi]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!filterYear && years.length > 0) {
      const active = years.find(y => y.is_active);
      setFilterYear(active?.id ?? years[0].id);
    }
  }, [years, filterYear]);

  const planByTeacherYear = useMemo(() => {
    const m = new Map<string, TeacherWorkPlan>();
    plans.forEach(p => m.set(`${p.teacher_id}:${p.academic_year_id}`, p));
    return m;
  }, [plans]);

  const hoursByPlan = useMemo(() => {
    const m = new Map<string, Record<WorkType, number>>();
    for (const a of allocations) {
      if (!m.has(a.work_plan_id)) m.set(a.work_plan_id, {} as Record<WorkType, number>);
      const rec = m.get(a.work_plan_id)!;
      rec[a.work_type] = (rec[a.work_type] ?? 0) + Number(a.hours);
    }
    return m;
  }, [allocations]);

  // Department name for breadcrumb (oquv_bolimi drill-in)
  const activeDeptName = useMemo(() => {
    if (!deptParam || !departments.length) return null;
    return departments.find(d => d.id === deptParam)?.name ?? null;
  }, [deptParam, departments]);

  const visibleTeachers = useMemo(() =>
    teachers.filter(t => {
      if (isManager && user?.department_id && t.department_id !== user.department_id) return false;
      // oquv_bolimi drill-in: filter to selected kafedra
      if (isOquvBolimi && deptParam && t.department_id !== deptParam) return false;
      return true;
    }),
    [teachers, isManager, isOquvBolimi, deptParam, user?.department_id]
  );

  const handleRowClick = (teacherId: string) => {
    router.push(`/curriculum/personal-plans/${teacherId}`);
  };

  const subtitle = isOquvBolimi && activeDeptName
    ? activeDeptName
    : isManager
      ? "Kafedra o'qituvchilarining yillik yuklamasi"
      : "Fakultet o'qituvchilarining yuklamasi";

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Breadcrumb back link for oquv_bolimi drill-in */}
      {isOquvBolimi && (
        <Link
          href="/oquv-bolimi/workload"
          className="inline-flex items-center gap-1.5 text-sm text-surface-500 hover:text-surface-900 dark:hover:text-surface-100 transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
          Kafedralar yuklamasiga qaytish
        </Link>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-100">Shaxsiy ish reja</h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-0.5">{subtitle}</p>
        </div>
        <select
          value={filterYear}
          onChange={e => setFilterYear(e.target.value)}
          className="rounded-md border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 px-3 py-2 text-sm"
        >
          <option value="">Barcha yillar</option>
          {years.map(y => <option key={y.id} value={y.id}>{y.name}{y.is_active ? " (faol)" : ""}</option>)}
        </select>
      </div>

      {error && (
        <div className="p-3 bg-danger-50 dark:bg-danger-900/30 text-danger-600 dark:text-danger-400 rounded-lg text-sm">{error}</div>
      )}

      <div className="bg-white dark:bg-surface-800 rounded-lg border border-surface-200 dark:border-surface-700 overflow-x-auto">
        {loading ? (
          <div className="p-8 text-center text-surface-500">Yuklanmoqda...</div>
        ) : visibleTeachers.length === 0 ? (
          <div className="p-8 text-center text-surface-500">O'qituvchi topilmadi.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-surface-50 dark:bg-surface-900/50 border-b border-surface-200 dark:border-surface-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-surface-600 dark:text-surface-400 uppercase">F.I.Sh</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-surface-600 dark:text-surface-400 uppercase">Lavozim</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-surface-600 dark:text-surface-400 uppercase">Stavka</th>
                {WORK_TYPES.slice(0, 4).map(wt => (
                  <th key={wt} className="px-3 py-3 text-center text-xs font-semibold text-surface-600 dark:text-surface-400 uppercase whitespace-nowrap">
                    {wt === "maruza" ? "Ma'ruza" : wt === "seminar" ? "Seminar" : wt === "amaliy" ? "Amaliy" : "Reyting"}
                  </th>
                ))}
                <th className="px-3 py-3 text-center text-xs font-semibold text-surface-600 dark:text-surface-400 uppercase">Jami</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-surface-600 dark:text-surface-400 uppercase">Holat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-200 dark:divide-surface-700">
              {visibleTeachers.map(t => {
                const plan = filterYear ? planByTeacherYear.get(`${t.id}:${filterYear}`) : undefined;
                const hrs = plan ? hoursByPlan.get(plan.id) : undefined;
                const total = hrs ? Object.values(hrs).reduce((s, v) => s + v, 0) : null;
                return (
                  <tr
                    key={t.id}
                    onClick={() => handleRowClick(t.id)}
                    className="hover:bg-surface-50 dark:hover:bg-surface-900/30 cursor-pointer"
                  >
                    <td className="px-4 py-3 font-medium">
                      {t.last_name} {t.first_name} {t.middle_name ?? ""}
                    </td>
                    <td className="px-4 py-3 text-surface-500">{plan?.position ?? t.lavozim ?? "—"}</td>
                    <td className="px-4 py-3 text-surface-500">{plan?.stavka ?? t.stavka ?? "—"}</td>
                    {WORK_TYPES.slice(0, 4).map(wt => (
                      <td key={wt} className="px-3 py-3 text-center text-surface-500">
                        {hrs?.[wt] ?? "—"}
                      </td>
                    ))}
                    <td className="px-3 py-3 text-center font-medium">{total ?? "—"}</td>
                    <td className="px-4 py-3">
                      {plan ? (
                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[plan.status]}`}>
                          {WORK_PLAN_STATUS_LABELS[plan.status]}
                        </span>
                      ) : (
                        <span className="text-xs text-surface-400">Reja yo'q</span>
                      )}
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
