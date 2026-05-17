"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { AllocationForm } from "../_components/AllocationForm";
import type { AllocationRow, EditingState } from "../_components/AllocationForm";
import type {
  AcademicYear, RoleName, Semester, StudyGroup, Subject, SubjectWorkload,
  Teacher, TeacherAllocation, TeacherWorkPlan, WorkPlanApprovalLog, WorkPlanStatus, WorkType,
} from "@/types/db";
import { WORK_PLAN_STATUS_LABELS } from "@/types/db";

const TABLE_WORK_TYPES: WorkType[] = [
  "maruza", "amaliy", "seminar", "reyting", "kurs_ishi",
  "malaka_amaliyoti", "bmi_rahbarlik", "md_rahbarlik",
  "mustaqil_tadqiqot", "doktorantura", "yada",
];
const TABLE_LABELS: Record<WorkType, string> = {
  maruza:            "Ma'ruza",
  amaliy:            "Amaliy mashg'ulot",
  seminar:           "Seminar mashg'ulot",
  reyting:           "O'zlashtirish nazorati (Reyting)",
  kurs_ishi:         "Kurs ishi",
  malaka_amaliyoti:  "Amaliyotga rahbarlik",
  bmi_rahbarlik:     "BMI ga rahbarlik",
  md_rahbarlik:      "MD ga rahbarlik",
  mustaqil_tadqiqot: "Mustaqil izlanuvchiga maslahatchi",
  doktorantura:      "Doktorantura",
  yada:              "YADAda qanashish",
};

const SEMESTERS: Semester[] = ["kuzgi", "bahorgi"];
const SEMESTER_LABELS_FULL: Record<Semester, string> = {
  kuzgi:   "Kuzgi semestr",
  bahorgi: "Bahorgi semestr",
};
const STATUS_COLORS: Record<WorkPlanStatus, string> = {
  draft:     "bg-surface-100 text-surface-600 dark:bg-surface-700 dark:text-surface-300",
  submitted: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
  approved:  "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400",
  rejected:  "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
};

interface SubjectRow {
  subject: Subject;
  groupNames: string[];
  hours: Partial<Record<WorkType, number>>;
  total: number;
}

interface CurrentUser {
  id: string;
  role: RoleName;
  university_id: string | null;
  display_name: string;
}

interface Props {
  teacher: Teacher;
  plan: TeacherWorkPlan | null;
  allocations: TeacherAllocation[];
  approvalLogs: WorkPlanApprovalLog[];
  subjects: Subject[];
  groups: StudyGroup[];
  workloads: SubjectWorkload[];
  activeYear: AcademicYear | null;
  currentUser: CurrentUser;
}

export function PlanView({
  teacher,
  plan: initialPlan,
  allocations: initialAllocations,
  approvalLogs: initialLogs,
  subjects,
  groups,
  workloads,
  activeYear,
  currentUser,
}: Props) {
  const router = useRouter();
  const supabase = createClient();

  // Local mutable copies — synced from props after router.refresh()
  const [plan, setPlan] = useState<TeacherWorkPlan | null>(initialPlan);
  const [allocations, setAllocations] = useState<TeacherAllocation[]>(initialAllocations);
  const [logs, setLogs] = useState<WorkPlanApprovalLog[]>(initialLogs);

  useEffect(() => { setPlan(initialPlan); }, [initialPlan]);
  useEffect(() => { setAllocations(initialAllocations); }, [initialAllocations]);
  useEffect(() => { setLogs(initialLogs); }, [initialLogs]);

  const [submitting, setSubmitting] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalKey, setModalKey] = useState(0);
  const [editingState, setEditingState] = useState<EditingState | null>(null);
  const [defaultSemester, setDefaultSemester] = useState<Semester>("kuzgi");

  // Reviewer approve / reject state
  const [reviewLoading, setReviewLoading] = useState(false);
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const isManager = currentUser.role === "staff_manager";
  const isDean    = currentUser.role === "dean" || currentUser.role === "oquv_bolimi";
  const canReview = isDean && plan?.status === "submitted";
  const canEditOrCreate = isManager && (!plan || ["draft", "rejected"].includes(plan.status));
  const canEdit         = isManager && plan?.status != null && ["draft", "rejected"].includes(plan.status);

  // ── Derived maps ─────────────────────────────────────────────────────────
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

  const activeWorkTypes = useMemo(() => {
    const used = new Set<WorkType>();
    allocations.forEach(a => used.add(a.work_type as WorkType));
    return TABLE_WORK_TYPES.filter(wt => used.has(wt));
  }, [allocations]);

  const pivotBySemester = useMemo(() => {
    const result: Record<Semester, SubjectRow[]> = { kuzgi: [], bahorgi: [] };
    for (const sem of SEMESTERS) {
      const semAllocs = allocations.filter(a => a.semester === sem);
      const subjectMap = new Map<string, SubjectRow>();
      for (const a of semAllocs) {
        if (!subjectMap.has(a.subject_id)) {
          const sub = subjectById.get(a.subject_id);
          if (!sub) continue;
          subjectMap.set(a.subject_id, { subject: sub, groupNames: [], hours: {}, total: 0 });
        }
        const row = subjectMap.get(a.subject_id)!;
        const wt = a.work_type as WorkType;
        row.hours[wt] = (row.hours[wt] ?? 0) + Number(a.hours);
        row.total += Number(a.hours);
        if (a.group_id) {
          const gName = groupById.get(a.group_id)?.name;
          if (gName && !row.groupNames.includes(gName)) row.groupNames.push(gName);
        }
      }
      result[sem] = Array.from(subjectMap.values());
    }
    return result;
  }, [allocations, subjectById, groupById]);

  const semTotals = useMemo(() => {
    const result: Record<Semester, Partial<Record<WorkType, number>> & { grand: number }> = {
      kuzgi:   { grand: 0 },
      bahorgi: { grand: 0 },
    };
    for (const sem of SEMESTERS) {
      for (const row of pivotBySemester[sem]) {
        for (const [wt, h] of Object.entries(row.hours) as [WorkType, number][]) {
          result[sem][wt] = (result[sem][wt] ?? 0) + h;
        }
        result[sem].grand += row.total;
      }
    }
    return result;
  }, [pivotBySemester]);

  const grandTotal = semTotals.kuzgi.grand + semTotals.bahorgi.grand;

  // ── Plan actions ─────────────────────────────────────────────────────────
  const ensurePlan = useCallback(async (): Promise<TeacherWorkPlan | null> => {
    if (plan) return plan;
    if (!activeYear || !currentUser) return null;
    const { data, error: err } = await supabase
      .from("teacher_work_plans")
      .insert({
        teacher_id: teacher.id,
        academic_year_id: activeYear.id,
        university_id: currentUser.university_id,
        position: teacher.lavozim,
        stavka: teacher.stavka,
        created_by: currentUser.id,
      })
      .select("*")
      .single();
    if (err || !data) { alert(err?.message ?? "Reja yaratib bo'lmadi"); return null; }
    setPlan(data as TeacherWorkPlan);
    return data as TeacherWorkPlan;
  }, [plan, activeYear, currentUser, supabase, teacher]);

  const handleSaveAllocation = useCallback(async (rows: AllocationRow[]) => {
    const p = await ensurePlan();
    if (!p) return;

    if (editingState) {
      const toDelete = allocations
        .filter(a => a.subject_id === editingState.subjectId && a.semester === editingState.semester)
        .map(a => a.id);
      if (toDelete.length > 0) {
        await supabase.from("teacher_allocations").delete().in("id", toDelete);
      }
    }

    const { error: err } = await supabase
      .from("teacher_allocations").insert(rows.map(r => ({ ...r, work_plan_id: p.id })));
    if (err) { alert(err.message); return; }

    setModalOpen(false);
    const { data: allocData } = await supabase
      .from("teacher_allocations").select("*").eq("work_plan_id", p.id).order("created_at");
    setAllocations((allocData as TeacherAllocation[]) ?? []);
    router.refresh();
  }, [ensurePlan, editingState, allocations, supabase, router]);

  const deleteSubjectRow = useCallback(async (subjectId: string, sem: Semester) => {
    if (!confirm("Bu fanning barcha yuklamalarini o'chirishni tasdiqlaysizmi?")) return;
    const toDelete = allocations
      .filter(a => a.subject_id === subjectId && a.semester === sem)
      .map(a => a.id);
    if (toDelete.length > 0) {
      await supabase.from("teacher_allocations").delete().in("id", toDelete);
      setAllocations(prev => prev.filter(a => !(a.subject_id === subjectId && a.semester === sem)));
      router.refresh();
    }
  }, [allocations, supabase, router]);

  const submitPlan = useCallback(async () => {
    if (!plan) return;
    if (!confirm("Rejani tasdiqlash uchun yuborishni tasdiqlaysizmi?")) return;
    setSubmitting(true);
    const { data } = await supabase
      .from("teacher_work_plans")
      .update({ status: "submitted", submitted_at: new Date().toISOString() })
      .eq("id", plan.id).select("*").single();
    setSubmitting(false);
    if (data) {
      setPlan(data as TeacherWorkPlan);
      router.refresh();
    }
  }, [plan, supabase, router]);

  const addLog = useCallback(async (
    action: 'approved' | 'rejected',
    reason?: string
  ) => {
    if (!plan) return;
    const { data: logRow } = await supabase
      .from("work_plan_approval_logs")
      .insert({
        work_plan_id:  plan.id,
        reviewer_id:   currentUser.id,
        reviewer_name: currentUser.display_name,
        reviewer_role: currentUser.role,
        action,
        reason: reason ?? null,
      })
      .select("*")
      .single();
    if (logRow) setLogs(prev => [logRow as WorkPlanApprovalLog, ...prev]);
  }, [plan, currentUser, supabase]);

  const approvePlan = useCallback(async () => {
    if (!plan || reviewLoading) return;
    setReviewLoading(true);
    const { data } = await supabase
      .from("teacher_work_plans")
      .update({ status: "approved", reviewed_at: new Date().toISOString(), reviewed_by: currentUser.id })
      .eq("id", plan.id).select("*").single();
    if (data) {
      setPlan(data as TeacherWorkPlan);
      await addLog("approved");
      router.refresh();
    }
    setReviewLoading(false);
  }, [plan, reviewLoading, supabase, currentUser.id, addLog, router]);

  const rejectPlan = useCallback(async () => {
    const trimmed = rejectReason.trim();
    if (!plan || reviewLoading || !trimmed) return;
    setReviewLoading(true);
    const { data } = await supabase
      .from("teacher_work_plans")
      .update({
        status: "rejected",
        rejection_reason: trimmed,
        reviewed_at: new Date().toISOString(),
        reviewed_by: currentUser.id,
      })
      .eq("id", plan.id).select("*").single();
    if (data) {
      setPlan(data as TeacherWorkPlan);
      await addLog("rejected", trimmed);
      router.refresh();
    }
    setRejectReason("");
    setShowRejectInput(false);
    setReviewLoading(false);
  }, [plan, reviewLoading, rejectReason, supabase, currentUser.id, addLog, router]);

  const openEditSubjectRow = useCallback((subjectId: string, sem: Semester) => {
    const subjectAllocs = allocations.filter(a => a.subject_id === subjectId && a.semester === sem);
    const mainAllocs = subjectAllocs.filter(a => a.work_type !== "reyting");
    const wt = (TABLE_WORK_TYPES.find(type => mainAllocs.some(a => a.work_type === type)) as WorkType | undefined) ?? "maruza";
    const groupIds = mainAllocs
      .filter(a => a.work_type === wt && a.group_id)
      .map(a => a.group_id!);
    const reytingAllocs = subjectAllocs.filter(a => a.work_type === "reyting");
    const reytingHours = reytingAllocs.reduce((sum, a) => sum + Number(a.hours), 0);
    const hasReyting = reytingAllocs.length > 0;
    setEditingState({ semester: sem, workType: wt, subjectId, groupIds, hasReyting, reytingHours });
    setDefaultSemester(sem);
    setModalKey(k => k + 1);
    setModalOpen(true);
  }, [allocations]);

  const openAdd = useCallback((sem: Semester) => {
    setEditingState(null);
    setDefaultSemester(sem);
    setModalKey(k => k + 1);
    setModalOpen(true);
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────
  const fullName = `${teacher.last_name} ${teacher.first_name}${teacher.middle_name ? " " + teacher.middle_name : ""}`;

  const vhStyle: React.CSSProperties = {
    writingMode: "vertical-rl",
    transform: "rotate(180deg)",
    whiteSpace: "nowrap",
    fontSize: "0.78rem",
    fontWeight: 800,
    textAlign: "center",
    padding: "10px 6px",
    minHeight: 90,
  };

  const SemesterTable = ({ sem }: { sem: Semester }) => {
    const rows = pivotBySemester[sem];
    const tots = semTotals[sem];
    if (rows.length === 0) return null;

    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-surface-700 dark:text-surface-300 text-sm uppercase tracking-wide">
            {SEMESTER_LABELS_FULL[sem]}
          </h3>
          {canEditOrCreate && (
            <Button size="sm" onClick={() => openAdd(sem)}>+ Yuklama qo&apos;shish</Button>
          )}
        </div>

        <div className="overflow-x-auto rounded-lg border border-slate-300 bg-white dark:border-surface-600 dark:bg-surface-900">
          <table className="w-full border-collapse bg-white text-sm dark:bg-surface-900">
            <thead>
              <tr className="border-b border-slate-300 bg-white dark:border-surface-600 dark:bg-surface-900">
                <th className="px-4 py-3 text-center text-sm font-extrabold text-surface-700 dark:text-surface-300 min-w-48 border-r border-slate-300 dark:border-surface-600">
                  Fan nomi, guruhlar
                </th>
                {activeWorkTypes.map(wt => (
                  <th key={wt} className="border-r border-slate-300 text-surface-700 dark:border-surface-600 dark:text-surface-300 align-middle">
                    <div style={vhStyle}>{TABLE_LABELS[wt]}</div>
                  </th>
                ))}
                <th className="border-r border-slate-300 text-surface-700 dark:border-surface-600 dark:text-surface-300 align-middle">
                  <div style={{ ...vhStyle, color: "inherit" }}>Jami (soat)</div>
                </th>
                {canEdit && <th className="w-20" />}
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.subject.id} className="border-b border-slate-300 bg-white hover:bg-slate-50 dark:border-surface-600 dark:bg-surface-900 dark:hover:bg-surface-800/50">
                  <td className="px-4 py-3 border-r border-slate-300 dark:border-surface-600 align-top">
                    <div className="font-medium text-surface-900 dark:text-surface-100">{row.subject.name}</div>
                    {row.groupNames.length > 0 && (
                      <div className="text-xs text-surface-400 mt-0.5 italic">
                        ({row.groupNames.join(", ")})
                      </div>
                    )}
                    <div className="text-xs text-surface-400 mt-0.5">
                      {row.subject.course}-kurs
                    </div>
                  </td>
                  {activeWorkTypes.map(wt => (
                    <td key={wt} className="text-center px-2 py-3 border-r border-slate-300 font-medium text-surface-800 dark:border-surface-600 dark:text-surface-200">
                      {row.hours[wt] ? row.hours[wt] : ""}
                    </td>
                  ))}
                  <td className="text-center px-2 py-3 border-r border-slate-300 font-bold text-surface-900 dark:border-surface-600 dark:text-surface-100">
                    {row.total}
                  </td>
                  {canEdit && (
                    <td className="px-2 py-3">
                      <div className="flex gap-1">
                        <button
                          onClick={() => openEditSubjectRow(row.subject.id, sem)}
                          className="text-xs px-1.5 py-0.5 rounded border border-surface-300 dark:border-surface-600 hover:bg-surface-100 dark:hover:bg-surface-700 text-surface-600 dark:text-surface-300"
                        >
                          Tahrir
                        </button>
                        <button
                          onClick={() => deleteSubjectRow(row.subject.id, sem)}
                          className="text-xs px-1.5 py-0.5 rounded border border-red-300 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400"
                        >
                          O&apos;ch
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              <tr className="border-t-2 border-slate-400 bg-white font-semibold dark:border-surface-500 dark:bg-surface-900">
                <td className="px-4 py-2 text-xs text-surface-500 uppercase border-r border-slate-300 dark:border-surface-600">
                  Jami
                </td>
                {activeWorkTypes.map(wt => (
                  <td key={wt} className="text-center px-2 py-2 border-r border-slate-300 dark:border-surface-600">
                    {tots[wt] ? tots[wt] : ""}
                  </td>
                ))}
                <td className="text-center px-2 py-2 border-r border-slate-300 font-bold dark:border-surface-600">
                  {tots.grand}
                </td>
                {canEdit && <td />}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 md:p-6 space-y-5">
      <button
        onClick={() => router.push("/curriculum/personal-plans")}
        className="text-sm text-surface-500 hover:text-surface-700 dark:hover:text-surface-300 flex items-center gap-1"
      >
        ← Ro&apos;yxatga qaytish
      </button>

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-100">{fullName}</h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-0.5">
            {plan?.position ?? teacher.lavozim ?? "Lavozim ko'rsatilmagan"}
            {(plan?.stavka ?? teacher.stavka) && ` · ${plan?.stavka ?? teacher.stavka} stavka`}
            {activeYear && ` · ${activeYear.name}`}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-start gap-3 shrink-0">
          {plan && (
            <span className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${STATUS_COLORS[plan.status]}`}>
              {WORK_PLAN_STATUS_LABELS[plan.status]}
            </span>
          )}
          {isManager && canEditOrCreate && allocations.length > 0 && (
            <Button onClick={submitPlan} isLoading={submitting} variant="outline">
              Tasdiqlash uchun yuborish
            </Button>
          )}
          {/* Inline approve / reject for dean & oquv_bolimi */}
          {canReview && !showRejectInput && (
            <div className="flex gap-2">
              <Button onClick={approvePlan} isLoading={reviewLoading}>
                Tasdiqlash
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowRejectInput(true)}
                className="!border-red-400 !text-red-600 hover:!bg-red-50 dark:hover:!bg-red-900/20"
              >
                Rad etish
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Rejection reason input (inline) */}
      {canReview && showRejectInput && (
        <div className="rounded-lg border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20 p-4 space-y-3">
          <p className="text-sm font-medium text-red-700 dark:text-red-300">Rad etish sababini kiriting:</p>
          <textarea
            value={rejectReason}
            onChange={e => setRejectReason(e.target.value)}
            rows={3}
            placeholder="Masalan: reja noto'g'ri tuzilgan, soatlar noto'g'ri..."
            className="w-full rounded-md border border-red-300 dark:border-red-600 bg-white dark:bg-surface-800 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-400"
          />
          <div className="flex gap-2">
            <Button
              onClick={rejectPlan}
              isLoading={reviewLoading}
              disabled={!rejectReason.trim()}
              className="!bg-red-600 hover:!bg-red-700"
            >
              Rad etishni tasdiqlash
            </Button>
            <Button variant="outline" onClick={() => { setShowRejectInput(false); setRejectReason(""); }}>
              Bekor qilish
            </Button>
          </div>
        </div>
      )}

      {plan?.status === "rejected" && plan.rejection_reason && (
        <div className="rounded-lg border border-red-300 bg-red-50 dark:bg-red-900/20 dark:border-red-800 p-4">
          <p className="text-sm font-medium text-red-700 dark:text-red-300">Rad etilgan — sabab:</p>
          <p className="text-sm text-red-600 dark:text-red-400 mt-1">{plan.rejection_reason}</p>
        </div>
      )}

      {!activeYear && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-900/20 p-4 text-sm text-amber-700 dark:text-amber-300">
          Faol o&apos;quv yili topilmadi.
        </div>
      )}

      {activeYear && allocations.length === 0 && (
        <div className="rounded-lg border border-dashed border-surface-300 dark:border-surface-600 p-8 text-center">
          <p className="text-surface-400 mb-3">Hali yuklama qo&apos;shilmagan.</p>
          {canEditOrCreate && (
            <Button onClick={() => openAdd("kuzgi")}>+ Birinchi yuklamani qo&apos;shish</Button>
          )}
        </div>
      )}

      {activeYear && allocations.length > 0 && (
        <div className="space-y-6">
          {SEMESTERS.map(sem => <SemesterTable key={sem} sem={sem} />)}

          <div className="flex justify-end">
            <div className="bg-white dark:bg-surface-800 rounded-lg border border-surface-200 dark:border-surface-700 px-5 py-3">
              <span className="text-sm text-surface-500">Umumiy jami: </span>
              <span className="text-lg font-bold text-surface-900 dark:text-surface-100">{grandTotal} soat</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Approval log timeline ─────────────────────────────────────────── */}
      {logs.length > 0 && (
        <div className="space-y-2 pt-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-surface-500 dark:text-surface-400">
            Tasdiqlash tarixi
          </h3>
          <div className="space-y-2">
            {logs.map(log => (
              <div
                key={log.id}
                className={`flex gap-3 rounded-lg border p-3 text-sm ${
                  log.action === "approved"
                    ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20"
                    : "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20"
                }`}
              >
                {/* Icon */}
                <div className="mt-0.5 shrink-0">
                  {log.action === "approved" ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="font-medium text-surface-900 dark:text-surface-100">
                      {log.reviewer_name}
                    </span>
                    <span className="text-xs text-surface-400">
                      ({log.reviewer_role === "dean" ? "Dekan" : log.reviewer_role === "oquv_bolimi" ? "O'quv bo'limi" : log.reviewer_role})
                    </span>
                    <span className={`font-medium ${log.action === "approved" ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}`}>
                      — {log.action === "approved" ? "Tasdiqladi" : "Rad etdi"}
                    </span>
                    <span className="text-xs text-surface-400 ml-auto">
                      {new Date(log.created_at).toLocaleString("uz-UZ", { dateStyle: "medium", timeStyle: "short" })}
                    </span>
                  </div>
                  {log.reason && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400 italic">&ldquo;{log.reason}&rdquo;</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingState ? "Yuklamani tahrirlash" : "Yangi yuklama"}
      >
        <AllocationForm
          key={modalKey}
          subjects={subjects}
          groups={groups}
          workloads={workloads}
          editing={editingState}
          defaultSemester={defaultSemester}
          onSave={handleSaveAllocation}
          onCancel={() => setModalOpen(false)}
        />
      </Modal>
    </div>
  );
}
