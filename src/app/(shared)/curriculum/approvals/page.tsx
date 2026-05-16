"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import type {
  AcademicYear, StudyGroup, Subject, Teacher, TeacherAllocation, TeacherWorkPlan, WorkType,
} from "@/types/db";
import { SEMESTER_LABELS, WORK_TYPE_LABELS } from "@/types/db";

export default function ApprovalsPage() {
  const supabase = createClient();
  const { user } = useSupabaseAuth();

  const [plans, setPlans] = useState<TeacherWorkPlan[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [allocations, setAllocations] = useState<TeacherAllocation[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [groups, setGroups] = useState<StudyGroup[]>([]);
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [filterYear, setFilterYear] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Expanded plan row
  const [expandedPlanId, setExpandedPlanId] = useState<string | null>(null);

  // Reject modal
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectingPlan, setRejectingPlan] = useState<TeacherWorkPlan | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const load = useCallback(async () => {
    if (!user?.university_id) return;
    setLoading(true);
    setError("");

    const [tr, yr, sr, gr] = await Promise.all([
      supabase.from("teachers").select("*").eq("university_id", user.university_id),
      supabase.from("academic_years").select("*").eq("university_id", user.university_id).order("name"),
      supabase.from("subjects").select("*").eq("university_id", user.university_id),
      supabase.from("study_groups").select("*").eq("university_id", user.university_id),
    ]);
    setTeachers((tr.data as Teacher[]) ?? []);
    setYears((yr.data as AcademicYear[]) ?? []);
    setSubjects((sr.data as Subject[]) ?? []);
    setGroups((gr.data as StudyGroup[]) ?? []);

    const teacherIds = ((tr.data as Teacher[]) ?? []).map(t => t.id);
    if (teacherIds.length > 0) {
      const { data: planData, error: pe } = await supabase
        .from("teacher_work_plans")
        .select("*")
        .in("teacher_id", teacherIds)
        .eq("status", "submitted")
        .order("submitted_at", { ascending: false });
      if (pe) setError(pe.message);
      const fetchedPlans = (planData as TeacherWorkPlan[]) ?? [];
      setPlans(fetchedPlans);

      if (fetchedPlans.length > 0) {
        const planIds = fetchedPlans.map(p => p.id);
        const { data: allocData } = await supabase
          .from("teacher_allocations")
          .select("*")
          .in("work_plan_id", planIds);
        setAllocations((allocData as TeacherAllocation[]) ?? []);
      }
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

  const teacherById = useMemo(() => {
    const m = new Map<string, Teacher>();
    teachers.forEach(t => m.set(t.id, t));
    return m;
  }, [teachers]);

  const subjectById = useMemo(() => {
    const m = new Map<string, Subject>();
    subjects.forEach(s => m.set(s.id, s));
    return m;
  }, [subjects]);

  const groupById = useMemo(() => {
    const m = new Map<string, StudyGroup>();
    groups.forEach(g => m.set(g.id, g));
    return m;
  }, [groups]);

  const allocsByPlan = useMemo(() => {
    const m = new Map<string, TeacherAllocation[]>();
    allocations.forEach(a => {
      if (!m.has(a.work_plan_id)) m.set(a.work_plan_id, []);
      m.get(a.work_plan_id)!.push(a);
    });
    return m;
  }, [allocations]);

  const visiblePlans = useMemo(() =>
    plans.filter(p => !filterYear || p.academic_year_id === filterYear),
    [plans, filterYear]
  );

  const approvePlan = async (p: TeacherWorkPlan) => {
    if (!confirm("Rejani tasdiqlashni tasdiqlaysizmi?")) return;
    setActionLoading(true);
    await supabase
      .from("teacher_work_plans")
      .update({ status: "approved", reviewed_at: new Date().toISOString(), reviewed_by: user?.id })
      .eq("id", p.id);
    setActionLoading(false);
    load();
  };

  const openReject = (p: TeacherWorkPlan) => {
    setRejectingPlan(p);
    setRejectionReason("");
    setRejectModalOpen(true);
  };

  const confirmReject = async () => {
    if (!rejectingPlan) return;
    const trimmed = rejectionReason.trim();
    if (!trimmed) return;
    setActionLoading(true);
    await supabase
      .from("teacher_work_plans")
      .update({
        status: "rejected",
        rejection_reason: trimmed,
        reviewed_at: new Date().toISOString(),
        reviewed_by: user?.id,
      })
      .eq("id", rejectingPlan.id);
    setActionLoading(false);
    setRejectModalOpen(false);
    load();
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-100">Tasdiqlash</h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-0.5">Yuborilgan shaxsiy ish rejalar</p>
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

      {loading ? (
        <div className="p-8 text-center text-surface-500">Yuklanmoqda...</div>
      ) : visiblePlans.length === 0 ? (
        <div className="p-8 text-center bg-white dark:bg-surface-800 rounded-lg border border-surface-200 dark:border-surface-700">
          <p className="text-surface-500">Tasdiqlanishi kerak bo'lgan reja yo'q.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visiblePlans.map(p => {
            const t = teacherById.get(p.teacher_id);
            const fullName = t ? `${t.last_name} ${t.first_name} ${t.middle_name ?? ""}`.trim() : "—";
            const isExpanded = expandedPlanId === p.id;
            const planAllocs = allocsByPlan.get(p.id) ?? [];
            const total = planAllocs.reduce((s, a) => s + Number(a.hours), 0);

            return (
              <div key={p.id} className="bg-white dark:bg-surface-800 rounded-lg border border-surface-200 dark:border-surface-700 overflow-hidden">
                {/* Row header */}
                <div className="flex items-center justify-between px-5 py-4 gap-4">
                  <button
                    className="flex-1 text-left"
                    onClick={() => setExpandedPlanId(isExpanded ? null : p.id)}
                  >
                    <div className="font-semibold text-surface-900 dark:text-surface-100">{fullName}</div>
                    <div className="text-xs text-surface-400 mt-0.5">
                      {p.position ?? "—"} · {p.stavka ?? "—"} stavka · Jami: {total} soat
                      {p.submitted_at && ` · Yuborildi: ${new Date(p.submitted_at).toLocaleDateString("uz-UZ")}`}
                    </div>
                  </button>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      onClick={() => approvePlan(p)}
                      isLoading={actionLoading}
                    >
                      Tasdiqlash
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => openReject(p)}
                      isLoading={actionLoading}
                    >
                      Rad etish
                    </Button>
                  </div>
                </div>

                {/* Expanded: allocation details */}
                {isExpanded && (
                  <div className="border-t border-surface-100 dark:border-surface-700 overflow-x-auto">
                    {planAllocs.length === 0 ? (
                      <div className="p-4 text-sm text-center text-surface-400">Yuklama yo'q</div>
                    ) : (
                      <>
                        {(["kuzgi", "bahorgi"] as const).map(sem => {
                          const rows = planAllocs.filter(a => a.semester === sem);
                          if (rows.length === 0) return null;
                          return (
                            <div key={sem}>
                              <div className="px-5 py-2 bg-surface-50 dark:bg-surface-900/30 text-xs font-semibold text-surface-500 uppercase">
                                {SEMESTER_LABELS[sem]}
                              </div>
                              <table className="w-full text-sm">
                                <thead className="border-b border-surface-100 dark:border-surface-700">
                                  <tr>
                                    <th className="px-5 py-2 text-left text-xs font-medium text-surface-500">Ish turi</th>
                                    <th className="px-5 py-2 text-left text-xs font-medium text-surface-500">Fan</th>
                                    <th className="px-5 py-2 text-left text-xs font-medium text-surface-500">Guruh</th>
                                    <th className="px-5 py-2 text-right text-xs font-medium text-surface-500">Soat</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-surface-50 dark:divide-surface-700">
                                  {rows.map(a => (
                                    <tr key={a.id}>
                                      <td className="px-5 py-2">{WORK_TYPE_LABELS[a.work_type as WorkType]}</td>
                                      <td className="px-5 py-2">{subjectById.get(a.subject_id)?.name ?? "—"}</td>
                                      <td className="px-5 py-2 text-surface-400">{a.group_id ? groupById.get(a.group_id)?.name ?? "—" : "—"}</td>
                                      <td className="px-5 py-2 text-right font-medium">{a.hours}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          );
                        })}
                        <div className="px-5 py-3 flex justify-end border-t border-surface-100 dark:border-surface-700">
                          <span className="text-sm font-semibold">Jami: {total} soat</span>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Reject Modal */}
      <Modal isOpen={rejectModalOpen} onClose={() => setRejectModalOpen(false)} title="Rejani rad etish">
        <div className="space-y-4">
          <p className="text-sm text-surface-600 dark:text-surface-400">Rad etish sababini kiriting:</p>
          <textarea
            value={rejectionReason}
            onChange={e => setRejectionReason(e.target.value)}
            rows={3}
            className="w-full rounded-md border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 px-3 py-2 text-sm"
            placeholder="Sabab..."
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRejectModalOpen(false)}>Bekor qilish</Button>
            <Button
              variant="danger"
              onClick={confirmReject}
              isLoading={actionLoading}
              disabled={!rejectionReason.trim()}
            >
              Rad etish
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
