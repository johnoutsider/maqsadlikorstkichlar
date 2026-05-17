"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { cacheGet, cacheSet } from "@/lib/curriculum-cache";
import type {
  AcademicYear, Department, EducationType, Faculty, Semester, StudyGroup,
  Subject, TeacherAllocation, TeacherWorkPlan, WorkType,
} from "@/types/db";

// All possible work types in display order
const ALL_WORK_TYPES: WorkType[] = [
  "maruza", "amaliy", "seminar", "reyting", "kurs_ishi",
  "malaka_amaliyoti", "bmi_rahbarlik", "md_rahbarlik",
  "mustaqil_tadqiqot", "doktorantura", "yada",
];

const WORK_TYPE_LABELS: Record<WorkType, string> = {
  maruza:            "Ma'ruza",
  amaliy:            "Amaliy mashg'ulot",
  seminar:           "Seminar mashg'ulot",
  reyting:           "Reyting (O'r. YAN)",
  kurs_ishi:         "Kurs ishi",
  malaka_amaliyoti:  "Malakaviy amaliyot",
  bmi_rahbarlik:     "BMI ga rahbarlik",
  md_rahbarlik:      "MD ga rahbarlik",
  mustaqil_tadqiqot: "Mustaqil tadqiqot maslahatchi",
  doktorantura:      "Doktorantura",
  yada:              "YADA da o'qitish",
};

const EDU_LABELS: Record<EducationType, string> = {
  bakalavr: "Bakalavr",
  magistr:  "Magistr",
};

const SEMESTER_TITLES: Record<Semester, string> = {
  kuzgi:   "Kuzgi semestr",
  bahorgi: "Bahorgi semestr",
};

interface SubjectRow {
  subject: Subject;
  dept: Department | undefined;
  faculty: Faculty | undefined;
  // group counts
  maruzaGroups: number;
  seminarGroups: number;
  amaliyGroups: number;
  studentCount: number;
  // hours per work type
  hours: Partial<Record<WorkType, number>>;
  total: number;
}

export default function SubjectWorkloadPage() {
  const supabase = createClient();
  const { user } = useSupabaseAuth();

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [groups, setGroups] = useState<StudyGroup[]>([]);
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

    const cached = cacheGet(user.university_id);
    if (cached && cached.subjects.length > 0) {
      setSubjects(cached.subjects);
      setGroups(cached.groups);
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

    const [yr, dr, fr, sr, gr] = await Promise.all([
      supabase.from("academic_years").select("*").eq("university_id", user.university_id).order("name"),
      supabase.from("departments").select("*").eq("university_id", user.university_id).order("name"),
      supabase.from("faculties").select("*").eq("university_id", user.university_id).order("name"),
      supabase.from("subjects").select("*").eq("university_id", user.university_id),
      supabase.from("study_groups").select("*").eq("university_id", user.university_id),
    ]);

    const fetchedYears     = (yr.data as AcademicYear[]) ?? [];
    const fetchedDepts     = (dr.data as Department[])   ?? [];
    const fetchedFaculties = (fr.data as Faculty[])      ?? [];
    const fetchedSubjects  = (sr.data as Subject[])      ?? [];
    const fetchedGroups    = (gr.data as StudyGroup[])   ?? [];

    // Fetch plans for all teachers in university then their allocations
    const trRes = await supabase.from("teachers").select("id").eq("university_id", user.university_id);
    const teacherIds = ((trRes.data ?? []) as { id: string }[]).map(t => t.id);

    let fetchedPlans: TeacherWorkPlan[] = [];
    let fetchedAllocs: TeacherAllocation[] = [];
    if (teacherIds.length > 0) {
      const [pr, ar] = await Promise.all([
        supabase.from("teacher_work_plans").select("*").in("teacher_id", teacherIds),
        supabase.from("teacher_allocations").select("*"),
      ]);
      fetchedPlans  = (pr.data as TeacherWorkPlan[])  ?? [];
      fetchedAllocs = (ar.data as TeacherAllocation[]) ?? [];
    }

    if (sr.error) setError(sr.error.message);

    cacheSet(user.university_id, {
      teachers: [],
      plans: fetchedPlans,
      allocations: fetchedAllocs,
      years: fetchedYears,
      departments: fetchedDepts,
      faculties: fetchedFaculties,
      subjects: fetchedSubjects,
      groups: fetchedGroups,
    });

    setSubjects(fetchedSubjects);
    setGroups(fetchedGroups);
    setDepartments(fetchedDepts);
    setFaculties(fetchedFaculties);
    setPlans(fetchedPlans);
    setAllocations(fetchedAllocs);
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

  // Index lookups
  const deptById    = useMemo(() => new Map(departments.map(d => [d.id, d])), [departments]);
  const facultyById = useMemo(() => new Map(faculties.map(f => [f.id, f])),   [faculties]);
  const groupById   = useMemo(() => new Map(groups.map(g => [g.id, g])),      [groups]);

  // planId → Set of work plan IDs for the selected academic year
  const planIdSetForYear = useMemo(() => {
    if (!filterYear) return new Set(plans.map(p => p.id));
    return new Set(plans.filter(p => p.academic_year_id === filterYear).map(p => p.id));
  }, [plans, filterYear]);

  // Allocations scoped to the selected year
  const filteredAllocs = useMemo(
    () => allocations.filter(a => planIdSetForYear.has(a.work_plan_id)),
    [allocations, planIdSetForYear]
  );

  // Subjects scoped to the selected year
  const filteredSubjects = useMemo(() => {
    if (!filterYear) return subjects;
    return subjects.filter(s => s.academic_year_id === filterYear);
  }, [subjects, filterYear]);

  // Build rows per semester
  const buildRows = useCallback((sem: Semester): SubjectRow[] => {
    const semAllocs = filteredAllocs.filter(a => a.semester === sem);

    // Group allocations by subject_id
    const allocsBySubject = new Map<string, TeacherAllocation[]>();
    for (const a of semAllocs) {
      if (!allocsBySubject.has(a.subject_id)) allocsBySubject.set(a.subject_id, []);
      allocsBySubject.get(a.subject_id)!.push(a);
    }

    return filteredSubjects
      .map(subject => {
        const allocs = allocsBySubject.get(subject.id) ?? [];

        const hours: Partial<Record<WorkType, number>> = {};
        let total = 0;
        const maruzaGroupIds = new Set<string>();
        const seminarGroupIds = new Set<string>();
        const amaliyGroupIds  = new Set<string>();

        for (const a of allocs) {
          const wt = a.work_type as WorkType;
          hours[wt] = (hours[wt] ?? 0) + Number(a.hours);
          total += Number(a.hours);
          if (a.group_id) {
            const g = groupById.get(a.group_id);
            if (g) {
              if (g.group_type === "maruza")  maruzaGroupIds.add(a.group_id);
              if (g.group_type === "seminar") seminarGroupIds.add(a.group_id);
              if (g.group_type === "amaliy")  amaliyGroupIds.add(a.group_id);
            }
          }
        }

        // Student count from maruza groups (each student belongs to one maruza group)
        const studentCount = [...maruzaGroupIds].reduce(
          (sum, gid) => sum + (groupById.get(gid)?.student_count ?? 0), 0
        );

        return {
          subject,
          dept:    deptById.get(subject.department_id),
          faculty: facultyById.get(subject.faculty_id),
          maruzaGroups:  maruzaGroupIds.size,
          seminarGroups: seminarGroupIds.size,
          amaliyGroups:  amaliyGroupIds.size,
          studentCount,
          hours,
          total,
        };
      })
      .filter(r => r.total > 0); // hide subjects with no allocations this semester
  }, [filteredAllocs, filteredSubjects, groupById, deptById, facultyById]);

  const kuzgiRows   = useMemo(() => buildRows("kuzgi"),   [buildRows]);
  const bahorgiRows = useMemo(() => buildRows("bahorgi"), [buildRows]);

  // Which work types actually have data (across both semesters) — dynamic columns
  const activeWorkTypes = useMemo((): WorkType[] => {
    const used = new Set<WorkType>();
    for (const r of [...kuzgiRows, ...bahorgiRows]) {
      for (const wt of Object.keys(r.hours) as WorkType[]) {
        if (r.hours[wt]) used.add(wt);
      }
    }
    return ALL_WORK_TYPES.filter(wt => used.has(wt));
  }, [kuzgiRows, bahorgiRows]);

  const hasGroups = useMemo(
    () => [...kuzgiRows, ...bahorgiRows].some(
      r => r.maruzaGroups > 0 || r.seminarGroups > 0 || r.amaliyGroups > 0
    ),
    [kuzgiRows, bahorgiRows]
  );

  const vhStyle: React.CSSProperties = {
    writingMode: "vertical-rl",
    transform: "rotate(180deg)",
    whiteSpace: "nowrap",
    fontSize: "0.7rem",
    fontWeight: 600,
    padding: "8px 4px",
    minHeight: 80,
    textAlign: "center",
  };

  const SemesterTable = ({ sem, rows }: { sem: Semester; rows: SubjectRow[] }) => {
    if (rows.length === 0) return null;

    // Totals row
    const totals: Partial<Record<WorkType, number>> = {};
    let grandTotal = 0;
    let totalStudents = 0;
    for (const r of rows) {
      grandTotal += r.total;
      totalStudents += r.studentCount;
      for (const wt of activeWorkTypes) {
        totals[wt] = (totals[wt] ?? 0) + (r.hours[wt] ?? 0);
      }
    }

    return (
      <div className="space-y-2">
        <h2 className="text-base font-semibold text-surface-700 dark:text-surface-300 uppercase tracking-wide px-1">
          {SEMESTER_TITLES[sem]}
        </h2>
        <div className="overflow-x-auto rounded-lg border border-surface-200 dark:border-surface-700">
          <table className="w-full text-sm border-collapse bg-white dark:bg-surface-900">
            <thead>
              <tr className="bg-surface-50 dark:bg-surface-800 border-b border-surface-200 dark:border-surface-700">
                {/* Fixed columns */}
                <th className="px-3 py-2 text-left text-xs font-semibold text-surface-600 dark:text-surface-400 min-w-[180px] border-r border-surface-200 dark:border-surface-700">
                  Fan nomi
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-surface-600 dark:text-surface-400 min-w-[140px] border-r border-surface-200 dark:border-surface-700">
                  Kafedra
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-surface-600 dark:text-surface-400 min-w-[130px] border-r border-surface-200 dark:border-surface-700">
                  Ta'lim yo'nalishi
                </th>
                <th className="px-3 py-2 text-center text-xs font-semibold text-surface-600 dark:text-surface-400 border-r border-surface-200 dark:border-surface-700">
                  Ta'lim shakli
                </th>
                <th className="px-3 py-2 text-center text-xs font-semibold text-surface-600 dark:text-surface-400 border-r border-surface-200 dark:border-surface-700">
                  Kurs
                </th>

                {/* Group / student columns */}
                {hasGroups && (
                  <>
                    <th className="border-r border-surface-200 dark:border-surface-700 text-surface-600 dark:text-surface-400 align-bottom">
                      <div style={vhStyle}>Ma'ruza guruh</div>
                    </th>
                    <th className="border-r border-surface-200 dark:border-surface-700 text-surface-600 dark:text-surface-400 align-bottom">
                      <div style={vhStyle}>Seminar guruh</div>
                    </th>
                    <th className="border-r border-surface-200 dark:border-surface-700 text-surface-600 dark:text-surface-400 align-bottom">
                      <div style={vhStyle}>Amaliy guruh</div>
                    </th>
                    <th className="border-r border-surface-200 dark:border-surface-700 text-surface-600 dark:text-surface-400 align-bottom">
                      <div style={vhStyle}>Talaba soni</div>
                    </th>
                  </>
                )}

                {/* Dynamic work type columns */}
                {activeWorkTypes.map(wt => (
                  <th key={wt} className="border-r border-surface-200 dark:border-surface-700 text-surface-600 dark:text-surface-400 align-bottom">
                    <div style={vhStyle}>{WORK_TYPE_LABELS[wt]}</div>
                  </th>
                ))}

                <th className="border-r border-surface-200 dark:border-surface-700 text-surface-600 dark:text-surface-400 align-bottom">
                  <div style={{ ...vhStyle, fontWeight: 700 }}>Jami</div>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr
                  key={r.subject.id}
                  className={`border-b border-surface-200 dark:border-surface-700 ${i % 2 === 0 ? "bg-white dark:bg-surface-900" : "bg-surface-50/50 dark:bg-surface-800/30"}`}
                >
                  <td className="px-3 py-2 font-medium text-surface-900 dark:text-surface-100 border-r border-surface-200 dark:border-surface-700">
                    {r.subject.name}
                  </td>
                  <td className="px-3 py-2 text-surface-600 dark:text-surface-400 text-xs border-r border-surface-200 dark:border-surface-700">
                    {r.dept?.name ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-surface-600 dark:text-surface-400 text-xs border-r border-surface-200 dark:border-surface-700">
                    {r.faculty?.name ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-center text-xs text-surface-600 dark:text-surface-400 border-r border-surface-200 dark:border-surface-700">
                    {EDU_LABELS[r.subject.education_type]}
                  </td>
                  <td className="px-3 py-2 text-center text-surface-600 dark:text-surface-400 border-r border-surface-200 dark:border-surface-700">
                    {r.subject.course}
                  </td>

                  {hasGroups && (
                    <>
                      <td className="px-2 py-2 text-center text-surface-700 dark:text-surface-300 border-r border-surface-200 dark:border-surface-700">
                        {r.maruzaGroups || "—"}
                      </td>
                      <td className="px-2 py-2 text-center text-surface-700 dark:text-surface-300 border-r border-surface-200 dark:border-surface-700">
                        {r.seminarGroups || "—"}
                      </td>
                      <td className="px-2 py-2 text-center text-surface-700 dark:text-surface-300 border-r border-surface-200 dark:border-surface-700">
                        {r.amaliyGroups || "—"}
                      </td>
                      <td className="px-2 py-2 text-center font-medium text-surface-700 dark:text-surface-300 border-r border-surface-200 dark:border-surface-700">
                        {r.studentCount || "—"}
                      </td>
                    </>
                  )}

                  {activeWorkTypes.map(wt => (
                    <td key={wt} className="px-2 py-2 text-center font-medium text-surface-800 dark:text-surface-200 border-r border-surface-200 dark:border-surface-700">
                      {r.hours[wt] ?? ""}
                    </td>
                  ))}

                  <td className="px-2 py-2 text-center font-bold text-surface-900 dark:text-surface-100 border-r border-surface-200 dark:border-surface-700">
                    {r.total}
                  </td>
                </tr>
              ))}

              {/* Semester totals row */}
              <tr className="border-t-2 border-surface-400 dark:border-surface-500 bg-surface-100 dark:bg-surface-800 font-semibold">
                <td colSpan={5} className="px-3 py-2 text-xs uppercase text-surface-500 dark:text-surface-400 border-r border-surface-200 dark:border-surface-700">
                  {SEMESTER_TITLES[sem]} bo'yicha jami
                </td>
                {hasGroups && (
                  <>
                    <td className="border-r border-surface-200 dark:border-surface-700" />
                    <td className="border-r border-surface-200 dark:border-surface-700" />
                    <td className="border-r border-surface-200 dark:border-surface-700" />
                    <td className="px-2 py-2 text-center font-bold border-r border-surface-200 dark:border-surface-700">
                      {totalStudents || ""}
                    </td>
                  </>
                )}
                {activeWorkTypes.map(wt => (
                  <td key={wt} className="px-2 py-2 text-center border-r border-surface-200 dark:border-surface-700">
                    {totals[wt] ? totals[wt] : ""}
                  </td>
                ))}
                <td className="px-2 py-2 text-center font-bold text-surface-900 dark:text-surface-100 border-r border-surface-200 dark:border-surface-700">
                  {grandTotal}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-100">Fan bo'yicha yuklama</h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-0.5">
            Barcha fanlar bo'yicha o'qituvchilar yuklamasining umumiy ko'rinishi
          </p>
        </div>
        <select
          value={filterYear}
          onChange={e => setFilterYear(e.target.value)}
          className="rounded-md border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 px-3 py-2 text-sm"
        >
          {years.map(y => (
            <option key={y.id} value={y.id}>{y.name}{y.is_active ? " (faol)" : ""}</option>
          ))}
        </select>
      </div>

      {error && (
        <div className="p-3 bg-danger-50 dark:bg-danger-900/30 text-danger-600 dark:text-danger-400 rounded-lg text-sm">{error}</div>
      )}

      {loading ? (
        <div className="p-12 text-center text-surface-500">Yuklanmoqda...</div>
      ) : kuzgiRows.length === 0 && bahorgiRows.length === 0 ? (
        <div className="p-12 text-center text-surface-500">
          Tanlangan o'quv yili uchun yuklama ma'lumotlari topilmadi.
        </div>
      ) : (
        <>
          <SemesterTable sem="kuzgi"   rows={kuzgiRows}   />
          <SemesterTable sem="bahorgi" rows={bahorgiRows} />

          {/* Annual grand total */}
          {kuzgiRows.length > 0 && bahorgiRows.length > 0 && (
            <div className="flex justify-end">
              <div className="bg-white dark:bg-surface-800 rounded-lg border border-surface-200 dark:border-surface-700 px-6 py-3">
                <span className="text-sm text-surface-500">O'quv yili bo'yicha umumiy jami: </span>
                <span className="text-xl font-bold text-surface-900 dark:text-surface-100">
                  {kuzgiRows.reduce((s, r) => s + r.total, 0) +
                   bahorgiRows.reduce((s, r) => s + r.total, 0)} soat
                </span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
