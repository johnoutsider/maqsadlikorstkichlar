"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import type { AcademicYear, EducationType, GroupType, StudyGroup } from "@/types/db";
import { GROUP_TYPE_LABELS } from "@/types/db";

const COURSES = [1, 2, 3, 4, 5, 6];
const EDU_TYPES: EducationType[] = ["bakalavr", "magistr"];
const EDU_LABELS: Record<EducationType, string> = { bakalavr: "Bakalavr", magistr: "Magistr" };
const GROUP_TYPES: GroupType[] = ["amaliy", "seminar", "maruza"];

type TabType = GroupType;

export default function GroupsPage() {
  const supabase = createClient();
  const { user } = useSupabaseAuth();

  const [groups, setGroups] = useState<StudyGroup[]>([]);
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [members, setMembers] = useState<{ parent_group_id: string; child_group_id: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [tab, setTab] = useState<TabType>("amaliy");
  const [filterYear, setFilterYear] = useState("");

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<StudyGroup | null>(null);
  const [name, setName] = useState("");
  const [course, setCourse] = useState("1");
  const [eduType, setEduType] = useState<EducationType>("bakalavr");
  const [groupType, setGroupType] = useState<GroupType>("amaliy");
  const [studentCount, setStudentCount] = useState("0");
  const [yearId, setYearId] = useState("");
  // For seminar/maruza: selected child (amaliy) group IDs
  const [selectedChildren, setSelectedChildren] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const load = useCallback(async () => {
    if (!user?.university_id) return;
    setLoading(true);
    setError("");
    const [gr, yr, mr] = await Promise.all([
      supabase.from("study_groups").select("*").eq("university_id", user.university_id).order("name"),
      supabase.from("academic_years").select("*").eq("university_id", user.university_id).order("name"),
      supabase.from("study_group_members").select("parent_group_id, child_group_id"),
    ]);
    if (gr.error) setError(gr.error.message);
    else setGroups((gr.data as StudyGroup[]) ?? []);
    setYears((yr.data as AcademicYear[]) ?? []);
    setMembers(mr.data ?? []);
    setLoading(false);
  }, [supabase, user?.university_id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!filterYear && years.length > 0) {
      const active = years.find(y => y.is_active);
      setFilterYear(active?.id ?? years[0].id);
    }
  }, [years, filterYear]);

  const activeYear = years.find(y => y.is_active) ?? years[0];

  const visible = useMemo(() => groups.filter(g => {
    if (g.group_type !== tab) return false;
    if (filterYear && g.academic_year_id !== filterYear) return false;
    return true;
  }), [groups, tab, filterYear]);

  // Amaliy groups available as children for seminar/maruza (same year + faculty)
  const childCandidates = useMemo(() => groups.filter(g =>
    g.group_type === "amaliy" &&
    (!filterYear || g.academic_year_id === filterYear)
  ), [groups, filterYear]);

  // Children already assigned to a given parent
  const childrenOf = (parentId: string) =>
    members.filter(m => m.parent_group_id === parentId).map(m => m.child_group_id);

  const openCreate = () => {
    setEditing(null);
    setName("");
    setCourse("1");
    setEduType("bakalavr");
    setGroupType(tab);
    setStudentCount("0");
    setYearId(activeYear?.id ?? years[0]?.id ?? "");
    setSelectedChildren([]);
    setFormError("");
    setModalOpen(true);
  };

  const openEdit = (g: StudyGroup) => {
    setEditing(g);
    setName(g.name);
    setCourse(String(g.course));
    setEduType(g.education_type);
    setGroupType(g.group_type);
    setStudentCount(String(g.student_count));
    setYearId(g.academic_year_id);
    setSelectedChildren(childrenOf(g.id));
    setFormError("");
    setModalOpen(true);
  };

  const toggleChild = (id: string) => {
    setSelectedChildren(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    if (!user?.university_id || !user?.faculty_id) return;
    const trimmed = name.trim();
    if (!trimmed) { setFormError("Guruh nomi talab qilinadi."); return; }
    if (!yearId)  { setFormError("O'quv yilini tanlang."); return; }
    setSaving(true);

    const payload = {
      name: trimmed,
      course: Number(course),
      education_type: eduType,
      group_type: groupType,
      student_count: Number(studentCount) || 0,
      faculty_id: user.faculty_id,
      university_id: user.university_id,
      academic_year_id: yearId,
    };

    let groupId: string;
    if (editing) {
      const { error: err } = await supabase.from("study_groups").update(payload).eq("id", editing.id);
      if (err) { setSaving(false); setFormError(err.message); return; }
      groupId = editing.id;
    } else {
      const { data, error: err } = await supabase
        .from("study_groups")
        .insert({ ...payload, created_by: user.id })
        .select("id")
        .single();
      if (err || !data) { setSaving(false); setFormError(err?.message ?? "Xato"); return; }
      groupId = data.id;
    }

    // Sync members for seminar/maruza parent groups
    if (groupType !== "amaliy") {
      const currentChildren = childrenOf(groupId);
      const toAdd = selectedChildren.filter(id => !currentChildren.includes(id));
      const toRemove = currentChildren.filter(id => !selectedChildren.includes(id));
      if (toAdd.length)    await supabase.from("study_group_members").insert(toAdd.map(id => ({ parent_group_id: groupId, child_group_id: id })));
      if (toRemove.length) await supabase.from("study_group_members").delete().eq("parent_group_id", groupId).in("child_group_id", toRemove);
    }

    setSaving(false);
    setModalOpen(false);
    load();
  };

  const remove = async (g: StudyGroup) => {
    if (!confirm(`"${g.name}" guruhini o'chirishni tasdiqlaysizmi?`)) return;
    const { error: err } = await supabase.from("study_groups").delete().eq("id", g.id);
    if (err) { alert(err.message); return; }
    load();
  };

  const tabClass = (t: TabType) =>
    `px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
      tab === t
        ? "border-primary-600 text-primary-600 dark:text-primary-400"
        : "border-transparent text-surface-500 hover:text-surface-700 dark:hover:text-surface-300"
    }`;

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-100">Guruhlar</h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-0.5">O'quv guruhlar ro'yxati</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filterYear}
            onChange={e => setFilterYear(e.target.value)}
            className="rounded-md border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 px-3 py-2 text-sm"
          >
            <option value="">Barcha yillar</option>
            {years.map(y => <option key={y.id} value={y.id}>{y.name}{y.is_active ? " (faol)" : ""}</option>)}
          </select>
          <Button onClick={openCreate}>+ Yangi guruh</Button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-danger-50 dark:bg-danger-900/30 text-danger-600 dark:text-danger-400 rounded-lg text-sm">{error}</div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-surface-200 dark:border-surface-700">
        {GROUP_TYPES.map(t => (
          <button key={t} className={tabClass(t)} onClick={() => setTab(t)}>
            {GROUP_TYPE_LABELS[t]}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-surface-800 rounded-lg border border-surface-200 dark:border-surface-700 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-surface-500">Yuklanmoqda...</div>
        ) : visible.length === 0 ? (
          <div className="p-8 text-center text-surface-500">Guruh topilmadi.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-surface-50 dark:bg-surface-900/50 border-b border-surface-200 dark:border-surface-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-surface-600 dark:text-surface-400 uppercase">Nom</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-surface-600 dark:text-surface-400 uppercase">Kurs</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-surface-600 dark:text-surface-400 uppercase">Ta'lim turi</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-surface-600 dark:text-surface-400 uppercase">Talabalar</th>
                {tab !== "amaliy" && (
                  <th className="px-4 py-3 text-left text-xs font-semibold text-surface-600 dark:text-surface-400 uppercase">Amaliy guruhlar</th>
                )}
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-200 dark:divide-surface-700">
              {visible.map(g => {
                const childIds = childrenOf(g.id);
                const childNames = childIds.map(id => groups.find(x => x.id === id)?.name ?? id).join(", ");
                return (
                  <tr key={g.id} className="hover:bg-surface-50 dark:hover:bg-surface-900/30">
                    <td className="px-4 py-3 font-medium">{g.name}</td>
                    <td className="px-4 py-3">{g.course}-kurs</td>
                    <td className="px-4 py-3">{EDU_LABELS[g.education_type]}</td>
                    <td className="px-4 py-3">{g.student_count}</td>
                    {tab !== "amaliy" && (
                      <td className="px-4 py-3 text-surface-500 text-xs">{childNames || "—"}</td>
                    )}
                    <td className="px-4 py-3 text-right space-x-2">
                      <Button variant="outline" size="sm" onClick={() => openEdit(g)}>Tahrirlash</Button>
                      <Button variant="danger" size="sm" onClick={() => remove(g)}>O'chirish</Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Guruhni tahrirlash" : "Yangi guruh"}>
        <form onSubmit={save} className="space-y-4">
          {formError && (
            <div className="p-3 bg-danger-50 dark:bg-danger-900/30 text-danger-600 dark:text-danger-400 rounded-lg text-sm">{formError}</div>
          )}
          <div>
            <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">O'quv yili</label>
            <select
              value={yearId}
              onChange={e => setYearId(e.target.value)}
              className="w-full rounded-md border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 px-3 py-2 text-sm"
              required
            >
              <option value="">— tanlang —</option>
              {years.map(y => <option key={y.id} value={y.id}>{y.name}{y.is_active ? " (faol)" : ""}</option>)}
            </select>
          </div>
          <Input label="Guruh nomi" value={name} onChange={e => setName(e.target.value)} required />
          <div>
            <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Guruh turi</label>
            <select
              value={groupType}
              onChange={e => setGroupType(e.target.value as GroupType)}
              className="w-full rounded-md border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 px-3 py-2 text-sm"
            >
              {GROUP_TYPES.map(t => <option key={t} value={t}>{GROUP_TYPE_LABELS[t]}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Kurs</label>
              <select
                value={course}
                onChange={e => setCourse(e.target.value)}
                className="w-full rounded-md border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 px-3 py-2 text-sm"
              >
                {COURSES.map(c => <option key={c} value={c}>{c}-kurs</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Ta'lim turi</label>
              <select
                value={eduType}
                onChange={e => setEduType(e.target.value as EducationType)}
                className="w-full rounded-md border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 px-3 py-2 text-sm"
              >
                {EDU_TYPES.map(t => <option key={t} value={t}>{EDU_LABELS[t]}</option>)}
              </select>
            </div>
          </div>
          <Input
            label="Talabalar soni"
            type="number"
            min={0}
            value={studentCount}
            onChange={e => setStudentCount(e.target.value)}
          />
          {/* Child picker for seminar/maruza */}
          {groupType !== "amaliy" && (
            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                Amaliy guruhlar ({GROUP_TYPE_LABELS[groupType]} ichiga kiruvchilar)
              </label>
              {childCandidates.length === 0 ? (
                <p className="text-sm text-surface-400">Amaliy guruh yo'q — avval amaliy guruhlar yarating.</p>
              ) : (
                <div className="max-h-40 overflow-y-auto border border-surface-200 dark:border-surface-600 rounded-md divide-y divide-surface-100 dark:divide-surface-700">
                  {childCandidates.map(g => (
                    <label key={g.id} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-surface-50 dark:hover:bg-surface-700">
                      <input
                        type="checkbox"
                        checked={selectedChildren.includes(g.id)}
                        onChange={() => toggleChild(g.id)}
                        className="rounded"
                      />
                      <span className="text-sm">{g.name} — {g.course}-kurs, {EDU_LABELS[g.education_type]}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Bekor qilish</Button>
            <Button type="submit" isLoading={saving}>{editing ? "Saqlash" : "Yaratish"}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
