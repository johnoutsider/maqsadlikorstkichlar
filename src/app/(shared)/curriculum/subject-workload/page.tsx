"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { Button } from "@/components/ui/Button";
import type { AcademicYear, EducationType, Semester, Subject, SubjectWorkload, WorkType } from "@/types/db";
import { SEMESTER_LABELS, WORK_TYPE_LABELS } from "@/types/db";

const WORK_TYPES: WorkType[] = [
  "maruza", "seminar", "amaliy", "reyting", "malaka_amaliyoti",
  "bmi_rahbarlik", "yada", "md_rahbarlik", "mustaqil_tadqiqot",
  "doktorantura", "kurs_ishi",
];
const SEMESTERS: Semester[] = ["kuzgi", "bahorgi"];
const EDU_LABELS: Record<EducationType, string> = { bakalavr: "Bakalavr", magistr: "Magistr" };

function hourKey(wt: WorkType): keyof SubjectWorkload {
  return `${wt}_h` as keyof SubjectWorkload;
}

export default function SubjectWorkloadPage() {
  const supabase = createClient();
  const { user } = useSupabaseAuth();

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [workloads, setWorkloads] = useState<SubjectWorkload[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [filterYear, setFilterYear] = useState("");
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [activeSemester, setActiveSemester] = useState<Semester>("kuzgi");

  // Hours editor state: work_type → hours string
  const [hours, setHours] = useState<Record<WorkType, string>>(() =>
    Object.fromEntries(WORK_TYPES.map(wt => [wt, "0"])) as Record<WorkType, string>
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    if (!user?.university_id) return;
    setLoading(true);
    setError("");
    const [sr, yr] = await Promise.all([
      supabase.from("subjects").select("*").eq("university_id", user.university_id).order("name"),
      supabase.from("academic_years").select("*").eq("university_id", user.university_id).order("name"),
    ]);
    if (sr.error) { setError(sr.error.message); setLoading(false); return; }
    const subs = (sr.data as Subject[]) ?? [];
    setSubjects(subs);
    setYears((yr.data as AcademicYear[]) ?? []);

    // Load all workloads for this university's subjects at once
    const ids = subs.map(s => s.id);
    if (ids.length > 0) {
      const { data: wd } = await supabase
        .from("subject_workloads")
        .select("*")
        .in("subject_id", ids);
      setWorkloads((wd as SubjectWorkload[]) ?? []);
    }
    setLoading(false);
  }, [supabase, user?.university_id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!filterYear && years.length > 0) {
      const active = years.find(y => y.is_active);
      setFilterYear(active?.id ?? years[0].id);
    }
  }, [years, filterYear]);

  const visibleSubjects = useMemo(() =>
    subjects.filter(s => !filterYear || s.academic_year_id === filterYear),
    [subjects, filterYear]
  );

  // When subject or semester changes, populate the hours editor
  useEffect(() => {
    if (!selectedSubject) return;
    const wl = workloads.find(w => w.subject_id === selectedSubject.id && w.semester === activeSemester);
    setHours(
      Object.fromEntries(
        WORK_TYPES.map(wt => [wt, wl ? String(wl[hourKey(wt)] ?? 0) : "0"])
      ) as Record<WorkType, string>
    );
    setSaved(false);
  }, [selectedSubject, activeSemester, workloads]);

  const saveWorkload = async () => {
    if (!selectedSubject) return;
    setSaving(true);
    setSaved(false);
    const payload: Record<string, unknown> = {
      subject_id: selectedSubject.id,
      semester: activeSemester,
    };
    for (const wt of WORK_TYPES) {
      payload[hourKey(wt)] = parseFloat(hours[wt]) || 0;
    }
    const { error: err } = await supabase
      .from("subject_workloads")
      .upsert(payload, { onConflict: "subject_id,semester" });
    setSaving(false);
    if (err) { alert(err.message); return; }
    setSaved(true);
    // refresh workloads
    const { data: wd } = await supabase
      .from("subject_workloads")
      .select("*")
      .eq("subject_id", selectedSubject.id);
    setWorkloads(prev => {
      const withoutCurrent = prev.filter(w => w.subject_id !== selectedSubject.id);
      return [...withoutCurrent, ...((wd as SubjectWorkload[]) ?? [])];
    });
  };

  const totalHours = WORK_TYPES.reduce((sum, wt) => sum + (parseFloat(hours[wt]) || 0), 0);

  return (
    <div className="p-4 md:p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-100">Fan yuklamasi</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-0.5">Fan bo'yicha soatlarni belgilang</p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-danger-50 dark:bg-danger-900/30 text-danger-600 dark:text-danger-400 rounded-lg text-sm">{error}</div>
      )}

      <div className="flex gap-4 flex-col lg:flex-row">
        {/* Left: subject list */}
        <div className="lg:w-72 shrink-0">
          <div className="mb-2">
            <select
              value={filterYear}
              onChange={e => { setFilterYear(e.target.value); setSelectedSubject(null); }}
              className="w-full rounded-md border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 px-3 py-2 text-sm"
            >
              <option value="">Barcha yillar</option>
              {years.map(y => <option key={y.id} value={y.id}>{y.name}{y.is_active ? " (faol)" : ""}</option>)}
            </select>
          </div>
          <div className="bg-white dark:bg-surface-800 rounded-lg border border-surface-200 dark:border-surface-700 overflow-hidden">
            {loading ? (
              <div className="p-4 text-center text-sm text-surface-500">Yuklanmoqda...</div>
            ) : visibleSubjects.length === 0 ? (
              <div className="p-4 text-center text-sm text-surface-500">Fan topilmadi.</div>
            ) : (
              <ul className="divide-y divide-surface-100 dark:divide-surface-700 max-h-[60vh] overflow-y-auto">
                {visibleSubjects.map(s => {
                  const hasWorkload = workloads.some(w => w.subject_id === s.id);
                  return (
                    <li key={s.id}>
                      <button
                        onClick={() => setSelectedSubject(s)}
                        className={`w-full text-left px-4 py-3 text-sm transition-colors ${
                          selectedSubject?.id === s.id
                            ? "bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300"
                            : "hover:bg-surface-50 dark:hover:bg-surface-700"
                        }`}
                      >
                        <div className="font-medium truncate">{s.name}</div>
                        <div className="text-xs text-surface-400 mt-0.5">
                          {s.course}-kurs · {EDU_LABELS[s.education_type]}
                          {hasWorkload && <span className="ml-1 text-green-500">✓</span>}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* Right: hours editor */}
        <div className="flex-1">
          {!selectedSubject ? (
            <div className="h-48 flex items-center justify-center bg-white dark:bg-surface-800 rounded-lg border border-surface-200 dark:border-surface-700">
              <p className="text-surface-400 text-sm">Chapdan fan tanlang</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-surface-800 rounded-lg border border-surface-200 dark:border-surface-700 overflow-hidden">
              {/* Fan info + semester tabs */}
              <div className="px-5 pt-5 pb-3 border-b border-surface-100 dark:border-surface-700">
                <h2 className="font-semibold text-surface-900 dark:text-surface-100">{selectedSubject.name}</h2>
                <p className="text-xs text-surface-400 mt-0.5">
                  {selectedSubject.course}-kurs · {EDU_LABELS[selectedSubject.education_type]}
                </p>
                <div className="flex gap-1 mt-3">
                  {SEMESTERS.map(s => (
                    <button
                      key={s}
                      onClick={() => setActiveSemester(s)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                        activeSemester === s
                          ? "bg-primary-600 text-white"
                          : "bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-300 hover:bg-surface-200 dark:hover:bg-surface-600"
                      }`}
                    >
                      {SEMESTER_LABELS[s]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Hours grid */}
              <div className="p-5 space-y-3">
                {WORK_TYPES.map(wt => (
                  <div key={wt} className="flex items-center gap-3">
                    <label className="text-sm text-surface-700 dark:text-surface-300 w-44 shrink-0">
                      {WORK_TYPE_LABELS[wt]}
                    </label>
                    <input
                      type="number"
                      min={0}
                      step={0.5}
                      value={hours[wt]}
                      onChange={e => {
                        setHours(prev => ({ ...prev, [wt]: e.target.value }));
                        setSaved(false);
                      }}
                      className="w-24 rounded-md border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 px-3 py-1.5 text-sm text-right"
                    />
                    <span className="text-xs text-surface-400">soat</span>
                  </div>
                ))}

                <div className="pt-3 border-t border-surface-100 dark:border-surface-700 flex items-center justify-between">
                  <span className="text-sm font-medium text-surface-700 dark:text-surface-300">
                    Jami: <strong>{totalHours}</strong> soat
                  </span>
                  <div className="flex items-center gap-2">
                    {saved && <span className="text-xs text-green-600 dark:text-green-400">Saqlandi ✓</span>}
                    <Button onClick={saveWorkload} isLoading={saving}>Saqlash</Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
