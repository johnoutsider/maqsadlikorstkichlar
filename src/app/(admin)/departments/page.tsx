"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import type { Department, Faculty } from "@/types/db";

export default function DepartmentsPage() {
  const supabase = createClient();
  const { user } = useSupabaseAuth();
  const [rows, setRows] = useState<Department[]>([]);
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [filterFaculty, setFilterFaculty] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);
  const [name, setName] = useState("");
  const [shortCode, setShortCode] = useState("");
  const [facultyId, setFacultyId] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const load = useCallback(async () => {
    if (!user?.university_id) return;
    setLoading(true);
    setError("");
    const [d, f] = await Promise.all([
      supabase.from("departments").select("*").eq("university_id", user.university_id).order("short_code"),
      supabase.from("faculties").select("*").eq("university_id", user.university_id).order("short_code"),
    ]);
    if (d.error) setError(d.error.message);
    else setRows((d.data as Department[]) ?? []);
    setFaculties((f.data as Faculty[]) ?? []);
    setLoading(false);
  }, [supabase, user?.university_id]);

  useEffect(() => {
    load();
  }, [load]);

  const facultyById = useMemo(() => {
    const m = new Map<string, Faculty>();
    faculties.forEach((f) => m.set(f.id, f));
    return m;
  }, [faculties]);

  const visible = filterFaculty ? rows.filter((d) => d.faculty_id === filterFaculty) : rows;

  const openCreate = () => {
    setEditing(null);
    setName("");
    setShortCode("");
    setFacultyId(filterFaculty || faculties[0]?.id || "");
    setFormError("");
    setModalOpen(true);
  };

  const openEdit = (d: Department) => {
    setEditing(d);
    setName(d.name);
    setShortCode(d.short_code);
    setFacultyId(d.faculty_id);
    setFormError("");
    setModalOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    if (!user?.university_id) return;
    if (!facultyId) {
      setFormError("Fakultet tanlang.");
      return;
    }
    const trimmedName = name.trim();
    const trimmedCode = shortCode.trim().toUpperCase();
    if (!trimmedName || !trimmedCode) {
      setFormError("Nom va qisqa kod talab qilinadi.");
      return;
    }
    setSaving(true);
    const payload = {
      name: trimmedName,
      short_code: trimmedCode,
      faculty_id: facultyId,
      university_id: user.university_id,
    };
    const { error: e2 } = editing
      ? await supabase.from("departments").update(payload).eq("id", editing.id)
      : await supabase.from("departments").insert(payload);
    setSaving(false);
    if (e2) {
      setFormError(e2.code === "23505" ? "Bu qisqa kod ushbu fakultetda allaqachon mavjud." : e2.message);
      return;
    }
    setModalOpen(false);
    load();
  };

  const remove = async (d: Department) => {
    if (!confirm(`"${d.name}" bo'limini o'chirishni tasdiqlaysizmi?`)) return;
    const { error: e } = await supabase.from("departments").delete().eq("id", d.id);
    if (e) { alert(e.message); return; }
    load();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-100">Kafedralar</h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
            Fakultetlar tarkibidagi bo&apos;limlar
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filterFaculty}
            onChange={(e) => setFilterFaculty(e.target.value)}
            className="rounded-md border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 px-3 py-2 text-sm"
          >
            <option value="">Barcha fakultetlar</option>
            {faculties.map((f) => (
              <option key={f.id} value={f.id}>{f.short_code} — {f.name}</option>
            ))}
          </select>
          <Button onClick={openCreate} disabled={faculties.length === 0}>+ Yangi bo&apos;lim</Button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-danger-50 dark:bg-danger-900/30 text-danger-600 dark:text-danger-400 rounded-lg text-sm">{error}</div>
      )}
      {faculties.length === 0 && !loading && (
        <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-lg text-sm">
          Avval kamida bitta fakultet yarating.
        </div>
      )}

      <div className="bg-white dark:bg-surface-800 rounded-lg border border-surface-200 dark:border-surface-700 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-surface-500">Yuklanmoqda...</div>
        ) : visible.length === 0 ? (
          <div className="p-8 text-center text-surface-500">Kafedra topilmadi.</div>
        ) : (
          <table className="w-full">
            <thead className="bg-surface-50 dark:bg-surface-900/50 border-b border-surface-200 dark:border-surface-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-surface-600 dark:text-surface-400 uppercase">Nom</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-surface-600 dark:text-surface-400 uppercase">Kod</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-surface-600 dark:text-surface-400 uppercase">Fakultet</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-200 dark:divide-surface-700">
              {visible.map((d) => (
                <tr key={d.id} className="hover:bg-surface-50 dark:hover:bg-surface-900/30">
                  <td className="px-4 py-3 text-sm">{d.name}</td>
                  <td className="px-4 py-3 text-sm font-mono">{d.short_code}</td>
                  <td className="px-4 py-3 text-sm text-surface-500">
                    {facultyById.get(d.faculty_id)?.short_code ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <Button variant="outline" size="sm" onClick={() => openEdit(d)}>Tahrirlash</Button>
                    <Button variant="danger" size="sm" onClick={() => remove(d)}>O&apos;chirish</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Kafedrani tahrirlash" : "Yangi kafedra"}>
        <form onSubmit={save} className="space-y-4">
          {formError && (
            <div className="p-3 bg-danger-50 dark:bg-danger-900/30 text-danger-600 dark:text-danger-400 rounded-lg text-sm">{formError}</div>
          )}
          <div>
            <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Fakultet</label>
            <select
              value={facultyId}
              onChange={(e) => setFacultyId(e.target.value)}
              className="w-full rounded-md border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 px-3 py-2 text-sm"
              required
            >
              <option value="">— tanlang —</option>
              {faculties.map((f) => (
                <option key={f.id} value={f.id}>{f.short_code} — {f.name}</option>
              ))}
            </select>
          </div>
          <Input label="Nomi" value={name} onChange={(e) => setName(e.target.value)} required />
          <Input
            label="Qisqa kod"
            value={shortCode}
            onChange={(e) => setShortCode(e.target.value.toUpperCase())}
            placeholder="AF1"
            maxLength={16}
            required
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Bekor qilish</Button>
            <Button type="submit" isLoading={saving}>{editing ? "Saqlash" : "Yaratish"}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
