"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import type {
  GroupType, Semester, StudyGroup, Subject, SubjectWorkload, TeacherAllocation, WorkType,
} from "@/types/db";
import { SEMESTER_LABELS, WORK_TYPE_GROUP_MAP, WORK_TYPE_LABELS } from "@/types/db";

const WORK_TYPES: WorkType[] = [
  "maruza", "seminar", "amaliy", "reyting", "malaka_amaliyoti",
  "bmi_rahbarlik", "yada", "md_rahbarlik", "mustaqil_tadqiqot",
  "doktorantura", "kurs_ishi",
];

export type AllocationRow = Omit<TeacherAllocation, "id" | "work_plan_id" | "created_at" | "updated_at">;

export interface EditingState {
  semester: Semester;
  workType: WorkType;
  subjectId: string;
  groupIds: string[];
  hasReyting: boolean;
  reytingHours: number;
}

interface Props {
  subjects: Subject[];
  groups: StudyGroup[];
  workloads: SubjectWorkload[];
  editing: EditingState | null;
  defaultSemester: Semester;
  onSave: (rows: AllocationRow[]) => Promise<void>;
  onCancel: () => void;
}

const GROUP_TYPE_LABEL: Record<GroupType, string> = {
  amaliy: "Amaliy", seminar: "Seminar", maruza: "Ma'ruza",
};

function hourKey(wt: WorkType): keyof SubjectWorkload {
  return `${wt}_h` as keyof SubjectWorkload;
}

export function AllocationForm({
  subjects, groups, workloads, editing, defaultSemester, onSave, onCancel,
}: Props) {
  const [semester, setSemester] = useState<Semester>(editing?.semester ?? defaultSemester);
  const [workType, setWorkType] = useState<WorkType>(editing?.workType ?? "maruza");
  const [subjectId, setSubjectId] = useState(editing?.subjectId ?? "");
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>(editing?.groupIds ?? []);
  const [addReyting, setAddReyting] = useState(editing?.hasReyting ?? false);
  const [reytingInput, setReytingInput] = useState(
    editing?.hasReyting && editing.reytingHours ? String(editing.reytingHours) : ""
  );
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const isEditing = editing !== null;
  const requiredGroupType: GroupType | null = WORK_TYPE_GROUP_MAP[workType] ?? null;

  const filteredGroups = useMemo(
    () => requiredGroupType ? groups.filter(g => g.group_type === requiredGroupType) : [],
    [groups, requiredGroupType]
  );

  const budget = useMemo(() => {
    if (!subjectId) return null;
    const wl = workloads.find(w => w.subject_id === subjectId && w.semester === semester);
    if (!wl) return null;
    return Number(wl[hourKey(workType)]) || 0;
  }, [subjectId, workloads, semester, workType]);

  const reytingHours = parseFloat(reytingInput) || 0;

  useEffect(() => {
    setSemester(editing?.semester ?? defaultSemester);
    setWorkType(editing?.workType ?? "maruza");
    setSubjectId(editing?.subjectId ?? "");
    setSelectedGroupIds(editing?.groupIds ?? []);
    setAddReyting(editing?.hasReyting ?? false);
    setReytingInput(editing?.hasReyting && editing.reytingHours ? String(editing.reytingHours) : "");
    setFormError("");
  }, [editing, defaultSemester]);

  const handleWorkTypeChange = (nextWorkType: WorkType) => {
    setWorkType(nextWorkType);
    setSelectedGroupIds([]);
    setAddReyting(false);
    setReytingInput("");
  };

  const groupCount = requiredGroupType ? selectedGroupIds.length : 1;
  const totalHours = (budget ?? 0) * Math.max(groupCount, 1);
  const grandTotal = totalHours + (addReyting ? reytingHours : 0);
  const reytingWarning = addReyting && reytingHours > 20;

  const toggleGroup = (id: string) => {
    setSelectedGroupIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const selLabel = (id: string) => groups.find(x => x.id === id)?.name ?? id;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    if (!subjectId) { setFormError("Fan tanlang."); return; }
    if (budget === null || budget === 0) {
      setFormError("Bu fan uchun ushbu ish turi bo'yicha soat belgilanmagan. Avval 'Fan yuklamasi' sahifasida soat kiriting.");
      return;
    }
    if (requiredGroupType && selectedGroupIds.length === 0) {
      setFormError("Kamida bitta guruh tanlang.");
      return;
    }

    setSaving(true);
    const groupIds = requiredGroupType ? selectedGroupIds : [null];
    const rows: AllocationRow[] = groupIds.map(gid => ({
      subject_id: subjectId,
      group_id: gid,
      semester,
      work_type: workType,
      hours: budget,
    }));

    // Single reyting row per subject (not per group)
    if (addReyting && reytingHours > 0) {
      rows.push({
        subject_id: subjectId,
        group_id: null,
        semester,
        work_type: "reyting" as WorkType,
        hours: reytingHours,
      });
    }

    await onSave(rows);
    setSaving(false);
  };

  return (
    <form onSubmit={handleSave} className="space-y-4">
      {formError && (
        <div className="p-3 bg-danger-50 dark:bg-danger-900/30 text-danger-600 dark:text-danger-400 rounded-lg text-sm">
          {formError}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Semestr</label>
          <select
            value={semester}
            onChange={e => setSemester(e.target.value as Semester)}
            className="w-full rounded-md border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 px-3 py-2 text-sm"
          >
            <option value="kuzgi">{SEMESTER_LABELS.kuzgi}</option>
            <option value="bahorgi">{SEMESTER_LABELS.bahorgi}</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Ish turi</label>
          <select
            value={workType}
            onChange={e => handleWorkTypeChange(e.target.value as WorkType)}
            className="w-full rounded-md border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 px-3 py-2 text-sm"
          >
            {WORK_TYPES.map(wt => <option key={wt} value={wt}>{WORK_TYPE_LABELS[wt]}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Fan</label>
        <select
          value={subjectId}
          onChange={e => setSubjectId(e.target.value)}
          className="w-full rounded-md border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 px-3 py-2 text-sm"
          required
        >
          <option value="">— tanlang —</option>
          {subjects.map(s => <option key={s.id} value={s.id}>{s.name} ({s.course}-kurs)</option>)}
        </select>
      </div>

      {/* Group multi-select */}
      {requiredGroupType && (
        <div>
          <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
            Guruhlar ({GROUP_TYPE_LABEL[requiredGroupType]})
            <span className="ml-1 text-xs text-surface-400">— bir nechta tanlash mumkin</span>
          </label>
          {filteredGroups.length === 0 ? (
            <p className="text-xs text-amber-500">Bu turdagi guruh yo'q.</p>
          ) : (
            <div className="border border-surface-200 dark:border-surface-600 rounded-md overflow-hidden max-h-48 overflow-y-auto">
              {filteredGroups.map(g => {
                const checked = selectedGroupIds.includes(g.id);
                return (
                  <label
                    key={g.id}
                    className={`flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors ${
                      checked ? "bg-primary-50 dark:bg-primary-900/30" : "hover:bg-surface-50 dark:hover:bg-surface-700"
                    } border-b border-surface-100 dark:border-surface-700 last:border-0`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleGroup(g.id)}
                      className="rounded accent-primary-600"
                    />
                    <span className="text-sm flex-1">{g.name}</span>
                    <span className="text-xs text-surface-400">{g.course}-kurs · {g.student_count} talaba</span>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Reyting optional — single value for the subject, not tied to groups */}
      {subjectId && workType !== "reyting" && (
        <div className="space-y-2">
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={addReyting}
              onChange={e => setAddReyting(e.target.checked)}
              className="rounded accent-primary-600 w-4 h-4"
            />
            <span className="text-sm text-surface-700 dark:text-surface-300">Reyting ham qo'shish (fan uchun)</span>
          </label>
          {addReyting && (
            <div className="bg-surface-50 dark:bg-surface-700/50 rounded-lg p-3 space-y-2 border border-surface-200 dark:border-surface-600 ml-7">
              <div className="flex items-center gap-3">
                <label className="text-sm text-surface-600 dark:text-surface-400 shrink-0">Reyting soati:</label>
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  value={reytingInput}
                  onChange={e => setReytingInput(e.target.value)}
                  placeholder="0"
                  className="w-24 rounded-md border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 px-3 py-1.5 text-sm"
                />
                <span className="text-xs text-surface-500">soat</span>
              </div>
              {reytingWarning && (
                <div className="flex items-start gap-2 text-amber-700 dark:text-amber-400 text-xs bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded p-2">
                  <span className="shrink-0">⚠️</span>
                  <span>
                    Reyting soati {reytingHours} — bir semestrdagi ruxsat etilgan chegaradan (20 soat) oshdi!
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Hours summary */}
      {subjectId && (
        <div className={`rounded-md px-4 py-3 text-sm ${
          budget === null || budget === 0
            ? "bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400"
            : "bg-surface-50 dark:bg-surface-700 border border-surface-200 dark:border-surface-600"
        }`}>
          {budget === null || budget === 0 ? (
            <p>Bu fan uchun <strong>{WORK_TYPE_LABELS[workType]}</strong> soati belgilanmagan.</p>
          ) : (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-4">
                <span className="text-surface-600 dark:text-surface-300">
                  {WORK_TYPE_LABELS[workType]}: <strong>{budget} soat</strong>
                  {requiredGroupType && groupCount > 1 && (
                    <span className="ml-1 text-surface-400">× {groupCount} guruh = {totalHours} soat</span>
                  )}
                </span>
              </div>
              {addReyting && reytingHours > 0 && (
                <div className="flex items-center justify-between gap-4">
                  <span className="text-surface-600 dark:text-surface-300">
                    Reyting: <strong>{reytingHours} soat</strong>
                  </span>
                </div>
              )}
              {addReyting && reytingHours > 0 && (
                <div className="flex items-center justify-between gap-4 pt-1 border-t border-surface-200 dark:border-surface-600">
                  <span className="font-semibold text-surface-700 dark:text-surface-200">Umumiy jami:</span>
                  <span className="font-bold text-surface-900 dark:text-surface-100">{grandTotal} soat</span>
                </div>
              )}
              {requiredGroupType && groupCount > 1 && (
                <div className="text-xs text-surface-400 pt-0.5">
                  Tanlangan: {selectedGroupIds.map(selLabel).join(", ")}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>Bekor qilish</Button>
        <Button type="submit" isLoading={saving}>
          {isEditing
            ? "Saqlash"
            : selectedGroupIds.length > 1
              ? `${selectedGroupIds.length} ta qator qo'shish`
              : "Qo'shish"}
        </Button>
      </div>
    </form>
  );
}
