"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import type { AcademicYear, Department, EducationType, Subject } from "@/types/db";

const COURSES = [1, 2, 3, 4, 5, 6];
const EDU_TYPES: EducationType[] = ["bakalavr", "magistr"];
const EDU_LABELS: Record<EducationType, string> = { bakalavr: "Bakalavr", magistr: "Magistr" };

export default function SubjectsPage() {
  const supabase = createClient();
  const { user } = useSupabaseAuth();

  const [rows, setRows] = useState<Subject[]>([]);
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters
  const [filterYear, setFilterYear] = useState("");
  const [filterCourse, setFilterCourse] = useState("");
  const [filterEdu, setFilterEdu] = useState("");

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Subject | null>(null);
  const [name, setName] = useState("");
  const [course, setCourse] = useState<string>("1");
  const [eduType, setEduType] = useState<EducationType>("bakalavr");
  const [departmentId, setDepartmentId] = useState("");
  const [yearId, setYearId] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const load = useCallback(async () => {
    if (!user?.university_id) return;
    setLoading(true);
    setError("");
    const [sr, yr, dr] = await Promise.all([
      supabase
        .from("subjects")
        .select("*")
        .eq("university_id", user.university_id)
        .order("name"),
      supabase
        .from("academic_years")
        .select("*")
        .eq("university_id", user.university_id)
        .order("name"),
      supabase
        .from("departments")
        .select("*")
        .eq("university_id", user.university_id)
        .order("name"),
    ]);
    if (sr.error) setError(sr.error.message);
    else setRows((sr.data as Subject[]) ?? []);
    setYears((yr.data as AcademicYear[]) ?? []);
    setDepartments((dr.data as Department[]) ?? []);
    setLoading(false);
  }, [supabase, user?.university_id]);

  useEffect(() => { load(); }, [load]);

  // Auto-select active year on first load
  useEffect(() => {
    if (!filterYear && years.length > 0) {
      const active = years.find(y => y.is_active);
      setFilterYear(active?.id ?? years[0].id);
    }
  }, [years, filterYear]);

  const deptById = useMemo(() => {
    const m = new Map<string, Department>();
    departments.forEach(d => m.set(d.id, d));
    return m;
  }, [departments]);

  const visible = useMemo(() => rows.filter(r => {
    if (filterYear && r.academic_year_id !== filterYear) return false;
    if (filterCourse && String(r.course) !== filterCourse) return false;
    if (filterEdu && r.education_type !== filterEdu) return false;
    return true;
  }), [rows, filterYear, filterCourse, filterEdu]);

  const activeYear = years.find(y => y.is_active) ?? years[0];

  const openCreate = () => {
    setEditing(null);
    setName("");
    setCourse("1");
    setEduType("bakalavr");
    setDepartmentId(user?.department_id ?? departments[0]?.id ?? "");
    setYearId(activeYear?.id ?? years[0]?.id ?? "");
    setFormError("");
    setModalOpen(true);
  };

  const openEdit = (s: Subject) => {
    setEditing(s);
    setName(s.name);
    setCourse(String(s.course));
    setEduType(s.education_type);
    setDepartmentId(s.department_id);
    setYearId(s.academic_year_id);
    setFormError("");
    setModalOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    if (!user?.university_id || !user?.faculty_id) return;
    const trimmed = name.trim();
    if (!trimmed) { setFormError("Fan nomi talab qilinadi."); return; }
    if (!yearId)  { setFormError("O'quv yilini tanlang."); return; }
    if (!departmentId) { setFormError("Kafedrani tanlang."); return; }
    setSaving(true);
    const payload = {
      name: trimmed,
      course: Number(course),
      education_type: eduType,
      department_id: departmentId,
      faculty_id: user.faculty_id,
      university_id: user.university_id,
      academic_year_id: yearId,
    };
    const { error: err } = editing
      ? await supabase.from("subjects").update(payload).eq("id", editing.id)
      : await supabase.from("subjects").insert({ ...payload, created_by: user.id });
    setSaving(false);
    if (err) { setFormError(err.message); return; }
    setModalOpen(false);
    load();
  };

  const remove = async (s: Subject) => {
    if (!confirm(`"${s.name}" fanini o'chirishni tasdiqlaysizmi?`)) return;
    const { error: err } = await supabase.from("subjects").delete().eq("id", s.id);
    if (err) { alert(err.message); return; }
    load();
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-100">Fanlar</h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-0.5">O'quv fanlari ro'yxati</p>
        </div>
        <Button onClick={openCreate}>+ Yangi fan</Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <select
          value={filterYear}
          onChange={e => setFilterYear(e.target.value)}
          className="rounded-md border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 px-3 py-2 text-sm"
        >
          <option value="">Barcha yillar</option>
          {years.map(y => <option key={y.id} value={y.id}>{y.name}{y.is_active ? " (faol)" : ""}</option>)}
        </select>
        <select
          value={filterCourse}
          onChange={e => setFilterCourse(e.target.value)}
          className="rounded-md border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 px-3 py-2 text-sm"
        >
          <option value="">Barcha kurslar</option>
          {COURSES.map(c => <option key={c} value={c}>{c}-kurs</option>)}
        </select>
        <select
          value={filterEdu}
          onChange={e => setFilterEdu(e.target.value)}
          className="rounded-md border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 px-3 py-2 text-sm"
        >
          <option value="">Barcha ta'lim turi</option>
          {EDU_TYPES.map(t => <option key={t} value={t}>{EDU_LABELS[t]}</option>)}
        </select>
      </div>

      {error && (
        <div className="p-3 bg-danger-50 dark:bg-danger-900/30 text-danger-600 dark:text-danger-400 rounded-lg text-sm">{error}</div>
      )}

      {/* Table */}
      <div className="bg-white dark:bg-surface-800 rounded-lg border border-surface-200 dark:border-surface-700 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-surface-500">Yuklanmoqda...</div>
        ) : visible.length === 0 ? (
          <div className="p-8 text-center text-surface-500">Fan topilmadi.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-surface-50 dark:bg-surface-900/50 border-b border-surface-200 dark:border-surface-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-surface-600 dark:text-surface-400 uppercase">Fan nomi</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-surface-600 dark:text-surface-400 uppercase">Kurs</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-surface-600 dark:text-surface-400 uppercase">Ta'lim turi</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-surface-600 dark:text-surface-400 uppercase">Kafedra</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-200 dark:divide-surface-700">
              {visible.map(s => (
                <tr key={s.id} className="hover:bg-surface-50 dark:hover:bg-surface-900/30">
                  <td className="px-4 py-3 font-medium">{s.name}</td>
                  <td className="px-4 py-3">{s.course}-kurs</td>
                  <td className="px-4 py-3">{EDU_LABELS[s.education_type]}</td>
                  <td className="px-4 py-3 text-surface-500">{deptById.get(s.department_id)?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <Button variant="outline" size="sm" onClick={() => openEdit(s)}>Tahrirlash</Button>
                    <Button variant="danger" size="sm" onClick={() => remove(s)}>O'chirish</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Fanni tahrirlash" : "Yangi fan"}>
        <form onSubmit={save} className="space-y-4">
          {formError && (
            <div className="p-3 bg-danger-50 dark:bg-danger-900/30 text-danger-600 dark:text-danger-400 rounded-lg text-sm">{formError}</div>
          )}
          <Input label="Fan nomi" value={name} onChange={e => setName(e.target.value)} required />
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
          <div>
            <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Kafedra</label>
            <select
              value={departmentId}
              onChange={e => setDepartmentId(e.target.value)}
              className="w-full rounded-md border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 px-3 py-2 text-sm"
              required
            >
              <option value="">— tanlang —</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Bekor qilish</Button>
            <Button type="submit" isLoading={saving}>{editing ? "Saqlash" : "Yaratish"}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
