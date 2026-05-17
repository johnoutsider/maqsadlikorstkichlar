"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { cacheGet, cacheSet } from "@/lib/curriculum-cache";
import type {
  AcademicYear, Department, Faculty, StudyGroup, Subject, Teacher, TeacherAllocation, TeacherWorkPlan, WorkPlanStatus, WorkType,
} from "@/types/db";
import { WORK_PLAN_STATUS_LABELS } from "@/types/db";

const STATUS_COLORS: Record<WorkPlanStatus, string> = {
  draft:     "bg-surface-100 text-surface-600 dark:bg-surface-700 dark:text-surface-300",
  submitted: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
  approved:  "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400",
  rejected:  "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
};

const SUMMARY_WORK_TYPES: WorkType[] = ["maruza", "seminar", "amaliy", "reyting"];
const ALL_WORK_TYPES: WorkType[] = [
  "maruza", "seminar", "amaliy", "reyting", "malaka_amaliyoti",
  "bmi_rahbarlik", "yada", "md_rahbarlik", "mustaqil_tadqiqot",
  "doktorantura", "kurs_ishi",
];

const COL_LABEL: Partial<Record<WorkType, string>> = {
  maruza: "Ma'ruza", seminar: "Seminar", amaliy: "Amaliy", reyting: "Reyting",
};

export default function OquvBolimiWorkloadPage() {
  const supabase = createClient();
  const { user } = useSupabaseAuth();
  const router = useRouter();

  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [plans, setPlans] = useState<TeacherWorkPlan[]>([]);
  const [allocations, setAllocations] = useState<TeacherAllocation[]>([]);
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [filterYear, setFilterYear] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!user?.university_id) return;

    // Serve from cache if warm — no spinner flicker on back-navigation
    const cached = cacheGet(user.university_id);
    if (cached) {
      setTeachers(cached.teachers);
      setDepartments(cached.departments);
      setFaculties(cached.faculties);
      setPlans(cached.plans);
      setAllocations(cached.allocations);
      setYears(cached.years);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    const [yr, tr, dr, fr, sr, gr] = await Promise.all([
      supabase.from("academic_years").select("*").eq("university_id", user.university_id).order("name"),
      supabase.from("teachers").select("*").eq("university_id", user.university_id).order("last_name"),
      supabase.from("departments").select("*").eq("university_id", user.university_id).order("name"),
      supabase.from("faculties").select("*").eq("university_id", user.university_id).order("name"),
      supabase.from("subjects").select("*").eq("university_id", user.university_id),
      supabase.from("study_groups").select("*").eq("university_id", user.university_id),
    ]);

    const fetchedYears = (yr.data as AcademicYear[]) ?? [];
    const fetchedTeachers = (tr.data as Teacher[]) ?? [];
    const fetchedDepts = (dr.data as Department[]) ?? [];
    const fetchedFaculties = (fr.data as Faculty[]) ?? [];
    const fetchedSubjects = (sr.data as Subject[]) ?? [];
    const fetchedGroups = (gr.data as StudyGroup[]) ?? [];

    let fetchedPlans: TeacherWorkPlan[] = [];
    let fetchedAllocations: TeacherAllocation[] = [];

    if (fetchedTeachers.length > 0) {
      const ids = fetchedTeachers.map(t => t.id);
      const [pr, ar] = await Promise.all([
        supabase.from("teacher_work_plans").select("*").in("teacher_id", ids),
        supabase.from("teacher_allocations").select("*"),
      ]);
      fetchedPlans = (pr.data as TeacherWorkPlan[]) ?? [];
      fetchedAllocations = (ar.data as TeacherAllocation[]) ?? [];
    }

    if (tr.error) setError(tr.error.message);

    // Write to cache before setting state
    cacheSet(user.university_id, {
      teachers: fetchedTeachers,
      plans: fetchedPlans,
      allocations: fetchedAllocations,
      years: fetchedYears,
      departments: fetchedDepts,
      faculties: fetchedFaculties,
      subjects: fetchedSubjects,
      groups: fetchedGroups,
    });

    setTeachers(fetchedTeachers);
    setDepartments(fetchedDepts);
    setFaculties(fetchedFaculties);
    setPlans(fetchedPlans);
    setAllocations(fetchedAllocations);
    setYears(fetchedYears);
    setLoading(false);
  }, [supabase, user?.university_id]);

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

  const facultyById = useMemo(() => {
    const m = new Map<string, Faculty>();
    faculties.forEach(f => m.set(f.id, f));
    return m;
  }, [faculties]);

  const teachersByDept = useMemo(() => {
    const m = new Map<string, Teacher[]>();
    for (const t of teachers) {
      if (!m.has(t.department_id)) m.set(t.department_id, []);
      m.get(t.department_id)!.push(t);
    }
    return m;
  }, [teachers]);

  const kafedraRows = useMemo(() => {
    return departments.map(d => {
      const ts = teachersByDept.get(d.id) ?? [];
      const totals = {} as Record<WorkType, number>;
      let jami = 0, stavka = 0;
      const statusCount: Record<WorkPlanStatus, number> = { draft: 0, submitted: 0, approved: 0, rejected: 0 };
      let withPlan = 0;
      for (const t of ts) {
        const plan = filterYear ? planByTeacherYear.get(`${t.id}:${filterYear}`) : undefined;
        if (plan) {
          withPlan++;
          statusCount[plan.status]++;
          stavka += Number(plan.stavka ?? t.stavka ?? 0);
          const hrs = hoursByPlan.get(plan.id);
          if (hrs) for (const wt of ALL_WORK_TYPES) {
            const v = hrs[wt] ?? 0;
            totals[wt] = (totals[wt] ?? 0) + v;
            jami += v;
          }
        } else {
          stavka += Number(t.stavka ?? 0);
        }
      }
      return {
        dept: d, faculty: facultyById.get(d.faculty_id),
        teacherCount: ts.length, withPlan, stavka, totals, jami, statusCount,
      };
    }).sort((a, b) => {
      const fa = a.faculty?.name ?? "", fb = b.faculty?.name ?? "";
      return fa !== fb ? fa.localeCompare(fb) : a.dept.name.localeCompare(b.dept.name);
    });
  }, [departments, teachersByDept, facultyById, filterYear, planByTeacherYear, hoursByPlan]);

  const handleKafedraClick = (deptId: string) => {
    router.push(`/curriculum/personal-plans?department=${deptId}`);
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-100">Kafedralar yuklamasi</h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-0.5">
            Kafedra nomiga bosing — o'qituvchilar ro'yxatini ko'rish uchun
          </p>
        </div>
        <select
          value={filterYear}
          onChange={e => setFilterYear(e.target.value)}
          className="rounded-md border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 px-3 py-2 text-sm"
        >
          {years.map(y => <option key={y.id} value={y.id}>{y.name}{y.is_active ? " (faol)" : ""}</option>)}
        </select>
      </div>

      {error && (
        <div className="p-3 bg-danger-50 dark:bg-danger-900/30 text-danger-600 dark:text-danger-400 rounded-lg text-sm">{error}</div>
      )}

      <div className="bg-white dark:bg-surface-800 rounded-lg border border-surface-200 dark:border-surface-700 overflow-x-auto">
        {loading ? (
          <div className="p-8 text-center text-surface-500">Yuklanmoqda...</div>
        ) : kafedraRows.length === 0 ? (
          <div className="p-8 text-center text-surface-500">Kafedra topilmadi.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-surface-50 dark:bg-surface-900/50 border-b border-surface-200 dark:border-surface-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-surface-600 dark:text-surface-400 uppercase">Kafedra</th>
                <th className="px-3 py-3 text-center text-xs font-semibold text-surface-600 dark:text-surface-400 uppercase">O'qit.</th>
                <th className="px-3 py-3 text-center text-xs font-semibold text-surface-600 dark:text-surface-400 uppercase">Stavka</th>
                {SUMMARY_WORK_TYPES.map(wt => (
                  <th key={wt} className="px-3 py-3 text-center text-xs font-semibold text-surface-600 dark:text-surface-400 uppercase whitespace-nowrap">
                    {COL_LABEL[wt]}
                  </th>
                ))}
                <th className="px-3 py-3 text-center text-xs font-semibold text-surface-600 dark:text-surface-400 uppercase">Jami</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-surface-600 dark:text-surface-400 uppercase">Holat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-200 dark:divide-surface-700">
              {kafedraRows.map(row => (
                <tr
                  key={row.dept.id}
                  onClick={() => handleKafedraClick(row.dept.id)}
                  className="hover:bg-surface-50 dark:hover:bg-surface-900/30 cursor-pointer group"
                >
                  <td className="px-4 py-3 font-medium">
                    <div>
                      <span className="group-hover:underline">{row.dept.name}</span>
                      {row.faculty && (
                        <div className="text-xs text-surface-500">{row.faculty.name}</div>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-center text-surface-500">{row.teacherCount}</td>
                  <td className="px-3 py-3 text-center text-surface-500">{row.stavka || "—"}</td>
                  {SUMMARY_WORK_TYPES.map(wt => (
                    <td key={wt} className="px-3 py-3 text-center text-surface-500">
                      {row.totals[wt] ?? "—"}
                    </td>
                  ))}
                  <td className="px-3 py-3 text-center font-medium">{row.jami || "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(["submitted", "approved", "draft", "rejected"] as WorkPlanStatus[]).map(s =>
                        row.statusCount[s] > 0 ? (
                          <span key={s} className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${STATUS_COLORS[s]}`}>
                            {row.statusCount[s]} {WORK_PLAN_STATUS_LABELS[s]}
                          </span>
                        ) : null
                      )}
                      {row.withPlan === 0 && <span className="text-xs text-surface-400">Reja yo'q</span>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
